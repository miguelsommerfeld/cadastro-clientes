#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly API_HEALTH_TIMEOUT=180
readonly POLL_INTERVAL=5
readonly API_SERVICE="api"
readonly GRAFANA_SERVICE="grafana"
readonly DATABASE_VOLUME="cadastro-clientes_postgres_data"
LOADING_PID=""
COMPOSE_OUTPUT_FILE=""
INTEGRATION_TEST_DB_NAME=""
INTEGRATION_TEST_DB_URL=""

usage() {
  cat <<'EOF'
Uso: ./start.sh [opção]

Opções:
  --help           Mostra esta ajuda.
  --stop           Para os serviços sem apagar os dados.
  --logs           Acompanha os logs dos serviços.
  --seed           Inicia a aplicação e cria ou atualiza os dados de demonstração.
  --qa             Executa os testes E2E em ambiente isolado e gera o relatório HTML.
  --test            Executa os testes unitários da API.
  --test-integration Executa os testes de integração da API.
  --reset          Apaga os dados do banco e inicia a aplicação novamente
                   (exige confirmação explícita; preserva os logs).
  --reset --seed   Apaga os dados, inicia a aplicação e recria os dados de demonstração.

Sem opções, cria .env a partir de .env.example se necessário, constrói
as imagens, inicia os serviços e aguarda a API e o Grafana ficarem
saudáveis (limite de 180 segundos para cada serviço).
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

drop_integration_test_db() {
  local db_name="${1:-$INTEGRATION_TEST_DB_NAME}"
  local db_url="${2:-$INTEGRATION_TEST_DB_URL}"
  if [[ -z "$db_name" || -z "$db_url" ]]; then
    return 0
  fi

  TEST_DB_NAME="$db_name" TEST_DATABASE_URL="$db_url" node -e '
    const { Client } = require("pg");
    const dbName = process.env.TEST_DB_NAME;
    const adminUrl = new URL(process.env.TEST_DATABASE_URL);
    adminUrl.pathname = "/postgres";

    async function drop() {
      let client = new Client({ connectionString: adminUrl.toString() });
      try {
        await client.connect();
      } catch {
        adminUrl.pathname = "/template1";
        client = new Client({ connectionString: adminUrl.toString() });
        await client.connect();
      }
      await client.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid();
      `, [dbName]);
      await client.query(`DROP DATABASE IF EXISTS "${dbName.replace(/"/g, "\"\"")}"`);
      await client.end();
    }
    drop().catch(() => {});
  ' 2>/dev/null || true
  INTEGRATION_TEST_DB_NAME=""
  INTEGRATION_TEST_DB_URL=""
}

cleanup() {
  stop_loading
  if [[ -n "$COMPOSE_OUTPUT_FILE" && -f "$COMPOSE_OUTPUT_FILE" ]]; then
    rm -f -- "$COMPOSE_OUTPUT_FILE"
  fi
  drop_integration_test_db
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
  fi
}

compose() {
  docker compose --project-directory "$SCRIPT_DIR" "$@"
}

wait_for_service() {
  local service="$1"
  local elapsed=0
  local container_id
  local health_status
  local wait_step

  while (( elapsed < API_HEALTH_TIMEOUT )); do
    container_id="$(compose ps -q "$service" 2>/dev/null || true)"
    if [[ -n "$container_id" ]]; then
      health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_id" 2>/dev/null || true)"
      if [[ "$health_status" == "healthy" ]]; then
        return 0
      fi

      if [[ "$health_status" == "no-healthcheck" ]]; then
        printf 'O serviço %s não possui healthcheck configurado.\n' "$service" >&2
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

  printf 'Tempo limite de %s segundos excedido ao aguardar o serviço %s.\n' \
    "$API_HEALTH_TIMEOUT" "$service" >&2
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

  if ! wait_for_service "$API_SERVICE"; then
    stop_loading
    printf 'Logs relevantes dos serviços:\n' >&2
    compose logs --tail=100 api db web loki alloy grafana >&2 || true
    return 1
  fi

  if ! wait_for_service "$GRAFANA_SERVICE"; then
    stop_loading
    printf 'Logs relevantes dos serviços:\n' >&2
    compose logs --tail=100 api db web loki alloy grafana >&2 || true
    return 1
  fi

  stop_loading

  cat <<'EOF'

Aplicação pronta!
  Interface:    http://localhost:8080
  API:          http://localhost:3333
  Documentação: http://localhost:3333/docs
  Logs:         http://localhost:3000
EOF
}

run_seed() {
  printf 'Criando dados de demonstração...\n'
  compose exec -T api npm run seed
}

run_qa() {
  bash "$SCRIPT_DIR/apps/e2e/run-qa.sh"
}

run_api_tests() {
  npm run test --workspace @cadastro-clientes/api-v1
}

run_api_integration_tests() {
  check_prerequisites
  ensure_env_file

  if [[ -f "$SCRIPT_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$SCRIPT_DIR/.env"
    set +a
  fi

  local test_db_url="${TEST_DATABASE_URL:-}"
  if [[ -z "$test_db_url" ]]; then
    fail "TEST_DATABASE_URL não configurada no .env nem no ambiente."
  fi

  test_db_url="${test_db_url/\$\{DB_USER\}/${DB_USER:-postgres}}"
  test_db_url="${test_db_url/\$\{DB_PASSWORD\}/${DB_PASSWORD:-postgres}}"
  export TEST_DATABASE_URL="$test_db_url"

  compose up -d db
  if ! wait_for_service "db"; then
    fail "Não foi possível iniciar o serviço de banco de dados para os testes."
  fi

  local test_db_name
  test_db_name="$(node -e '
    const url = new URL(process.env.TEST_DATABASE_URL);
    const name = url.pathname.replace(/^\//, "");
    if (!name) process.exit(1);
    process.stdout.write(name);
  ' 2>/dev/null || true)"

  if [[ -z "$test_db_name" ]]; then
    fail "Não foi possível extrair o nome do banco de dados a partir de TEST_DATABASE_URL."
  fi

  INTEGRATION_TEST_DB_NAME="$test_db_name"
  INTEGRATION_TEST_DB_URL="$test_db_url"

  create_test_db() {
    TEST_DB_NAME="$test_db_name" TEST_DATABASE_URL="$test_db_url" node -e '
      const { Client } = require("pg");
      const dbName = process.env.TEST_DB_NAME;
      const adminUrl = new URL(process.env.TEST_DATABASE_URL);
      adminUrl.pathname = "/postgres";

      async function create() {
        let client = new Client({ connectionString: adminUrl.toString() });
        try {
          await client.connect();
        } catch {
          adminUrl.pathname = "/template1";
          client = new Client({ connectionString: adminUrl.toString() });
          await client.connect();
        }
        await client.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid();
        `, [dbName]);
        await client.query(`DROP DATABASE IF EXISTS "${dbName.replace(/"/g, "\"\"")}"`);
        await client.query(`CREATE DATABASE "${dbName.replace(/"/g, "\"\"")}"`);
        await client.end();
      }
      create().catch(err => {
        console.error("Erro ao criar o banco de dados de teste:", err.message);
        process.exit(1);
      });
    '
  }

  create_test_db

  (
    cd "$SCRIPT_DIR/apps/api"
    DB_URL="$test_db_url" npx prisma db migrate --db "$test_db_url" >/dev/null
  )

  local test_status=0
  npm run test:integration --workspace @cadastro-clientes/api-v1 || test_status=$?

  drop_integration_test_db "$test_db_name" "$test_db_url"
  return "$test_status"
}

main() {
  local option
  local reset_requested=false
  local seed_requested=false
  local qa_requested=false
  local test_requested=false
  local integration_test_requested=false
  local stop_requested=false
  local logs_requested=false

  for option in "$@"; do
    case "$option" in
      --help|-h)
        if (( $# != 1 )); then
          usage >&2
          fail "A opção --help não pode ser combinada com outras opções."
        fi
        usage
        return 0
        ;;
      --stop)
        stop_requested=true
        ;;
      --logs)
        logs_requested=true
        ;;
      --reset)
        reset_requested=true
        ;;
      --seed)
        seed_requested=true
        ;;
      --qa)
        qa_requested=true
        ;;
      --test)
        test_requested=true
        ;;
      --test-integration)
        integration_test_requested=true
        ;;
      *)
        usage >&2
        fail "Opção desconhecida: $option"
        ;;
    esac
  done

  if [[ "$qa_requested" == true ]]; then
    if (( $# != 1 )); then
      usage >&2
      fail "A opção --qa não pode ser combinada com outras opções."
    fi
    check_prerequisites
    run_qa
    return
  fi

  if [[ "$test_requested" == true ]]; then
    if (( $# != 1 )); then
      usage >&2
      fail "A opção --test não pode ser combinada com outras opções."
    fi
    run_api_tests
    return
  fi

  if [[ "$integration_test_requested" == true ]]; then
    if (( $# != 1 )); then
      usage >&2
      fail "A opção --test-integration não pode ser combinada com outras opções."
    fi
    run_api_integration_tests
    return
  fi

  if [[ "$stop_requested" == true || "$logs_requested" == true ]]; then
    if (( $# != 1 )); then
      usage >&2
      fail "As opções --stop e --logs não podem ser combinadas com outras opções."
    fi
    check_prerequisites
    if [[ "$stop_requested" == true ]]; then
      compose stop
    else
      compose logs --follow
    fi
    return
  fi

  if [[ "$reset_requested" == true ]]; then
    printf 'Atenção: isso apagará permanentemente os dados do banco de dados.\n'
    printf 'Digite RESET para confirmar: '
    local confirmation
    if ! read -r confirmation || [[ "$confirmation" != "RESET" ]]; then
      printf 'Reset cancelado; nenhum dado foi removido.\n'
      return 1
    fi
  fi

  ensure_env_file || return 1

  check_prerequisites

  if [[ "$reset_requested" == true ]]; then
    compose down
    if docker volume inspect "$DATABASE_VOLUME" >/dev/null 2>&1; then
      docker volume rm "$DATABASE_VOLUME" >/dev/null
    fi
  fi

  start_application

  if [[ "$seed_requested" == true ]]; then
    run_seed
  fi
}

main "$@"
