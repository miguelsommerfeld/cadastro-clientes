#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly ENV_FILE="$(mktemp "${TMPDIR:-/tmp}/cadastro-clientes-qa.XXXXXX")"
readonly PROJECT_NAME="cadastro-clientes-qa-${USER:-local}-$$"
readonly WEB_PORT="${QA_WEB_PORT:-18080}"
readonly API_PORT="${QA_API_PORT:-13333}"
readonly DB_PORT="${QA_DB_PORT:-15432}"
readonly QA_WEB_URL="http://127.0.0.1:${WEB_PORT}"
readonly QA_API_BASE="http://127.0.0.1:${API_PORT}"
readonly -a COMPOSE=(
  docker compose
  --env-file "$ENV_FILE"
  --project-name "$PROJECT_NAME"
  -f "$ROOT_DIR/docker-compose.yml"
  -f "$ROOT_DIR/docker-compose.qa.yml"
)

cleanup() {
  local exit_code=$?
  "${COMPOSE[@]}" down --volumes --remove-orphans || true
  rm -f -- "$ENV_FILE"
  exit "$exit_code"
}
trap cleanup EXIT

cat >"$ENV_FILE" <<EOF
DB_NAME=cadastro_clientes_qa
DB_USER=qa
DB_PASSWORD=qa-only-password
DB_URL=postgresql://qa:qa-only-password@db:5432/cadastro_clientes_qa
JWT_SECRET=qa-only-secret-that-is-long-enough-for-tests
CORS_ORIGIN=http://127.0.0.1:${WEB_PORT}
NODE_ENV=development
GRAFANA_ADMIN_PASSWORD=qa-only-password
VITE_API_BASE_URL=/api/v1
VITE_API_CUSTOMERS_PATH=/customers
VITE_API_DELETED_CUSTOMERS_PATH=/customers/deleted
VITE_API_CUSTOMER_RESTORE_PATH=/customers/restore
VITE_API_CUSTOMER_PERMANENT_DELETE_PATH=/customers/permanent
API_PROXY_PREFIX=/api
API_PROXY_TARGET=api:3333
QA_DB_PORT=${DB_PORT}
QA_API_PORT=${API_PORT}
QA_WEB_PORT=${WEB_PORT}
EOF

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  printf 'Erro: Docker precisa estar instalado e em execução para rodar o QA E2E.\n' >&2
  exit 1
fi

npm exec --workspace @cadastro-clientes/e2e -- playwright install chromium
"${COMPOSE[@]}" up --build --detach db api web

wait_for_url() {
  local url="$1"
  local service="$2"
  local attempt
  for attempt in {1..90}; do
    if curl --fail --silent "$url" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  "${COMPOSE[@]}" logs --tail=100 "$service" >&2
  printf 'Erro: tempo limite ao aguardar %s (%s).\n' "$service" "$url" >&2
  return 1
}

wait_for_url "http://127.0.0.1:${API_PORT}/health" api
wait_for_url "$QA_WEB_URL/entrar" web

if [[ -n "${E2E_GREP:-}" ]]; then
  E2E_BASE_URL="$QA_WEB_URL" QA_API_URL="$QA_API_BASE" \
    npm run test --workspace @cadastro-clientes/e2e -- --grep "$E2E_GREP"
else
  E2E_BASE_URL="$QA_WEB_URL" QA_API_URL="$QA_API_BASE" \
    npm run test --workspace @cadastro-clientes/e2e
fi
