#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly API_HEALTH_TIMEOUT=180
readonly POLL_INTERVAL=5
readonly API_SERVICE="api"
LOADING_PID=""
COMPOSE_OUTPUT_FILE=""

usage() {
  cat <<'EOF'
Uso: ./start.sh [opção]

Opções:
  --help    Mostra esta ajuda.
  --stop    Para os serviços sem apagar os dados.
  --logs    Acompanha os logs dos serviços.
  --reset   Apaga o banco de dados e inicia a aplicação novamente
            (exige confirmação explícita).

Sem opções, cria .env a partir de .env.example se necessário, constrói
as imagens, inicia os serviços e aguarda a API ficar saudável (limite:
180 segundos).
EOF
}

stop_loading() {
  if [[ -n "$LOADING_PID" ]]; then
    kill "$LOADING_PID" 2>/dev/null || true
    wait "$LOADING_PID" 2>/dev/null || true
    LOADING_PID=""
    printf '\r\033[K'
  fi
}

cleanup() {
  stop_loading
  if [[ -n "$COMPOSE_OUTPUT_FILE" && -f "$COMPOSE_OUTPUT_FILE" ]]; then
    rm -f -- "$COMPOSE_OUTPUT_FILE"
  fi
}

trap cleanup EXIT

loading_animation() {
  local dots=""
  local started_at="$SECONDS"
  local elapsed=0

  while true; do
    elapsed=$((SECONDS - started_at))
    printf '\r\033[KCarregando%-3s          %ss' "$dots" "$elapsed"
    case "$dots" in
      "") dots="." ;;
      ".") dots=".." ;;
      "..") dots="..." ;;
      "...") dots="" ;;
    esac
    sleep 0.3
  done
}

start_loading() {
  if [[ -t 1 ]]; then
    loading_animation &
    LOADING_PID=$!
  else
    printf 'Carregando...\n'
  fi
}

fail() {
  printf 'Erro: %s\n' "$*" >&2
  exit 1
}

check_prerequisites() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker não está instalado ou não está no PATH. Instale o Docker Desktop ou Docker Engine."
  fi

  if ! docker info >/dev/null 2>&1; then
    fail "O daemon do Docker não está rodando ou o usuário não tem permissão para acessá-lo. Inicie o Docker e tente novamente."
  fi

  local compose_version
  if ! compose_version="$(docker compose version --short 2>/dev/null)"; then
    fail "Docker Compose v2 não está disponível. Instale/ative o plugin Docker Compose v2."
  fi

  if [[ ! "$compose_version" =~ ^v?([0-9]+)\.[0-9]+ ]]; then
    fail "Não foi possível identificar a versão do Docker Compose: ${compose_version:-desconhecida}."
  fi

  local compose_major="${BASH_REMATCH[1]}"
  if (( 10#$compose_major < 2 )); then
    fail "Docker Compose v2 ou superior é necessário; versão detectada: ${compose_version:-desconhecida}."
  fi
}

ensure_env_file() {
  if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
    if [[ ! -f "$SCRIPT_DIR/.env.example" ]]; then
      fail "Não encontrei .env nem .env.example em $SCRIPT_DIR."
    fi

    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    printf 'Arquivo .env criado a partir de .env.example.\n'
    printf 'Configure as variáveis em .env e execute ./start.sh novamente.\n' >&2
    return 1
  fi

  local compare_status=0
  cmp -s "$SCRIPT_DIR/.env" "$SCRIPT_DIR/.env.example" || compare_status=$?
  if (( compare_status == 0 )); then
    printf 'O arquivo .env ainda está idêntico a .env.example.\n' >&2
    printf 'Configure as variáveis em .env e execute ./start.sh novamente.\n' >&2
    return 1
  elif (( compare_status > 1 )); then
    fail "Não foi possível comparar .env com .env.example."
  fi
}

compose() {
  docker compose --project-directory "$SCRIPT_DIR" "$@"
}

wait_for_api() {
  local elapsed=0
  local container_id
  local health_status
  local wait_step

  while (( elapsed < API_HEALTH_TIMEOUT )); do
    container_id="$(compose ps -q "$API_SERVICE" 2>/dev/null || true)"
    if [[ -n "$container_id" ]]; then
      health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_id" 2>/dev/null || true)"
      if [[ "$health_status" == "healthy" ]]; then
        return 0
      fi

      if [[ "$health_status" == "no-healthcheck" ]]; then
        printf 'A API não possui healthcheck configurado.\n' >&2
        return 1
      fi
    fi

    wait_step="$POLL_INTERVAL"
    if (( API_HEALTH_TIMEOUT - elapsed < wait_step )); then
      wait_step=$((API_HEALTH_TIMEOUT - elapsed))
    fi
    sleep "$wait_step"
    elapsed=$((elapsed + wait_step))
  done

  printf 'Tempo limite de %s segundos excedido ao aguardar a API.\n' "$API_HEALTH_TIMEOUT" >&2
  return 1
}

run_compose_up() {
  local compose_pid
  local compose_status=0

  COMPOSE_OUTPUT_FILE="$(mktemp "${TMPDIR:-/tmp}/cadastro-clientes-compose.XXXXXX")" ||
    fail "Não foi possível criar um arquivo temporário para capturar a saída do Docker Compose."

  compose up -d --build >"$COMPOSE_OUTPUT_FILE" 2>&1 &
  compose_pid=$!
  wait "$compose_pid" || compose_status=$?

  if (( compose_status != 0 )); then
    stop_loading
    printf 'O Docker Compose falhou. Saída do comando:\n' >&2
    cat "$COMPOSE_OUTPUT_FILE" >&2
    return "$compose_status"
  fi

  rm -f -- "$COMPOSE_OUTPUT_FILE"
  COMPOSE_OUTPUT_FILE=""
}

start_application() {
  start_loading

  if ! run_compose_up; then
    stop_loading
    return 1
  fi

  if ! wait_for_api; then
    stop_loading
    printf 'Logs relevantes dos serviços:\n' >&2
    compose logs --tail=100 api db web >&2 || true
    return 1
  fi

  stop_loading

  cat <<'EOF'

Aplicação pronta!
  Interface:    http://localhost:8080
  API:          http://localhost:3333
  Documentação: http://localhost:3333/docs
EOF
}

main() {
  local option="${1:-}"

  if (( $# > 1 )); then
    usage >&2
    fail "Informe apenas uma opção."
  fi

  case "$option" in
    --help|-h)
      usage
      return 0
      ;;
    ""|--stop|--logs|--reset)
      ;;
    *)
      usage >&2
      fail "Opção desconhecida: $option"
      ;;
  esac

  if [[ -z "$option" ]]; then
    ensure_env_file || return 1
  elif [[ "$option" == "--reset" ]]; then
    printf 'Atenção: isso apagará permanentemente os dados do banco de dados.\n'
    printf 'Digite RESET para confirmar: '
    local confirmation
    if ! read -r confirmation || [[ "$confirmation" != "RESET" ]]; then
      printf 'Reset cancelado; nenhum dado foi removido.\n'
      return 1
    fi
    ensure_env_file || return 1
  fi

  check_prerequisites

  case "$option" in
    --stop)
      compose stop
      ;;
    --logs)
      compose logs --follow
      ;;
    --reset)
      compose down --volumes
      start_application
      ;;
    *)
      start_application
      ;;
  esac
}

main "$@"
