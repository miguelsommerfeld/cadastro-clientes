# Cadastro de Clientes

Aplicação para cadastro e gerenciamento de clientes pessoa física e pessoa jurídica. O projeto está organizado como um monorepo: uma API REST, uma interface web e contratos compartilhados entre os pacotes.

> **Documentação interativa:** a API usa Swagger. Inicie a aplicação e acesse [`http://localhost:3333/docs`](http://localhost:3333/docs) para consultar os detalhes dos endpoints e experimentar as requisições.

## Conteúdo

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Configuração e inicialização](#configuração-e-inicialização)
- [URLs locais](#urls-locais)
- [API](#api)
- [Modelos e validações](#modelos-e-validações)
- [Comandos úteis](#comandos-úteis)

## Funcionalidades

- Cadastro de clientes pessoa física (CPF) e pessoa jurídica (CNPJ).
- Cadastro de endereço associado ao cliente.
- Consulta de clientes ativos e consulta individual por ID.
- Atualização parcial dos dados de um cliente.
- Remoção lógica, listagem de clientes removidos e restauração.
- Exclusão permanente de clientes removidos.
- Verificação de saúde da API e documentação interativa via Swagger.

## Stack

| Camada | Tecnologias |
| --- | --- |
| API | Node.js 24, TypeScript, Fastify 5, Zod |
| Documentação da API | OpenAPI e Swagger UI (`@fastify/swagger`) |
| Persistência | PostgreSQL 18, Prisma ORM |
| Interface web | React 19, TypeScript, Vite 8 |
| Servidor web | Nginx |
| Execução local | Docker e Docker Compose |

## Estrutura do projeto

```text
.
├── apps/
│   ├── api/
│   │   ├── prisma/             # Contrato do banco e migrações
│   │   └── src/
│   │       ├── controllers/    # Coordenação das operações da API
│   │       ├── helpers/        # Validações auxiliares
│   │       ├── models/         # Acesso e operações sobre os dados
│   │       ├── repositories/   # Camada de repositório
│   │       ├── routes/         # Rotas Fastify
│   │       └── services/       # Regras de negócio
│   └── web/                    # Interface React servida pelo Nginx
├── packages/
│   └── contracts/              # Schemas Zod compartilhados
├── docker-compose.yml
├── start.sh                    # Inicialização e comandos auxiliares
└── .env.example
```

## Pré-requisitos

- Docker Engine ou Docker Desktop em execução.
- Docker Compose v2 ou superior.

O script `start.sh` verifica os pré-requisitos antes de iniciar os serviços. Não é necessário instalar Node.js ou PostgreSQL na máquina para usar a configuração via Docker Compose.

## Configuração e inicialização

1. Crie o arquivo local de configuração:

   ```bash
   cp .env.example .env
   ```

2. Edite `.env` e defina os valores de banco de dados. Os campos abaixo devem ser consistentes entre si:

   ```dotenv
   DB_NAME=cadastro_clientes
   DB_USER=usuario
   DB_PASSWORD=senha_local
   DB_URL=postgresql://${DB_USER}:${DB_PASSWORD}$@db:5432/${DB_NAME}
   ```

   `DB_URL` é a URL usada pela API e pelas migrações. No ambiente do Compose, o host do banco é `db`. Use uma senha local segura e mantenha o arquivo `.env` fora do controle de versão.

3. Inicie a aplicação a partir da raiz do repositório:

   ```bash
   ./start.sh
   ```

   O script constrói as imagens, inicia PostgreSQL, API e interface web, aplica as migrações do banco e aguarda a API ficar saudável. Na primeira execução, o Docker pode levar alguns minutos para baixar imagens e construir os serviços.

## URLs locais

| Serviço | URL |
| --- | --- |
| Interface web | [`http://localhost:8080`](http://localhost:8080) |
| API | [`http://localhost:3333`](http://localhost:3333) |
| Swagger UI | [`http://localhost:3333/docs`](http://localhost:3333/docs) |
| Health check | [`http://localhost:3333/health`](http://localhost:3333/health) |

> A interface web está no projeto, mas ainda exibe a tela inicial padrão do template React/Vite. O gerenciamento de clientes está disponível pela API.

## API

As rotas de clientes usam o prefixo `/api/v1`. A URL base é:

```text
http://localhost:3333/api/v1
```

### Rotas disponíveis

| Método | Caminho | Parâmetros | Descrição |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Verifica a disponibilidade da API e do banco. Retorna `200` ou `503`. |
| `GET` | `/api/v1/customers` | Query opcional `id` | Lista clientes ativos; com `id`, retorna um cliente. Retorna `404` se o ID não for encontrado entre os ativos. |
| `GET` | `/api/v1/customers/deleted` | — | Lista clientes na lixeira (removidos logicamente). |
| `POST` | `/api/v1/customers` | Corpo JSON | Cadastra um cliente e seu endereço. Retorna `201` quando criado. |
| `PATCH` | `/api/v1/customers?id={id}` | Query obrigatória `id`; corpo JSON parcial | Atualiza os campos enviados. |
| `DELETE` | `/api/v1/customers?id={id}` | Query obrigatória `id` | Move o cliente ativo para a lixeira. Retorna `204` sem corpo. |
| `POST` | `/api/v1/customers/restore?id={id}` | Query obrigatória `id` | Restaura um cliente da lixeira. Retorna `200` sem corpo. |
| `DELETE` | `/api/v1/customers/permanent?id={id}` | Query obrigatória `id` | Exclui permanentemente um cliente que esteja na lixeira. Retorna `204` sem corpo. |

Os parâmetros `id` são enviados na query string, por exemplo:

```text
GET    /api/v1/customers?id=8da62e8d-7cdd-432b-b828-3722fb6e791b
PATCH  /api/v1/customers?id=8da62e8d-7cdd-432b-b828-3722fb6e791b
DELETE /api/v1/customers?id=8da62e8d-7cdd-432b-b828-3722fb6e791b
```

### Cadastrar cliente

Envie `personType` como `INDIVIDUAL` ou `COMPANY`. O endereço é obrigatório no cadastro.

Exemplo de pessoa física:

```http
POST /api/v1/customers
Content-Type: application/json
```

```json
{
  "personType": "INDIVIDUAL",
  "name": "Maria da Silva",
  "document": "529.982.247-25",
  "email": "maria@example.com",
  "phone": "+55 (11) 99999-9999",
  "birthDate": "1990-05-20",
  "address": {
    "zipCode": "01310-100",
    "street": "Avenida Paulista",
    "number": "1000",
    "complement": "Apto 12",
    "district": "Bela Vista",
    "city": "São Paulo",
    "state": "SP"
  }
}
```

Para pessoa jurídica, use `"personType": "COMPANY"` e um CNPJ válido no campo `document`. `tradeName` (nome fantasia) é opcional. `birthDate` é específico de pessoa física.

### Atualizar cliente

O `PATCH` aceita os campos que serão alterados, sem exigir o objeto completo. Para o endereço, o campo atualizável é `address.number`.

```http
PATCH /api/v1/customers?id=8da62e8d-7cdd-432b-b828-3722fb6e791b
Content-Type: application/json
```

```json
{
  "phone": "+55 (11) 98888-7777",
  "address": {
    "number": "120"
  }
}
```

### Respostas

As consultas e o cadastro retornam os dados do cliente, incluindo `id`, `personType`, `name`, `document`, `phone`, `address`, `createdAt` e `deletedAt`. Também podem retornar `email`, `updatedAt`, `birthDate` (pessoa física) ou `tradeName` (pessoa jurídica).

Erros de validação e de operação incluem uma mensagem descritiva. Entre os status usados pela API estão `400` (dados ou parâmetros inválidos), `404` (cliente não encontrado), `409` (conflito de cadastro) e `503` (serviço indisponível no health check). Consulte o Swagger para os schemas e respostas documentados de cada rota.

## Modelos e validações

- **Pessoa física:** CPF válido, nome com 3 a 150 caracteres, e-mail válido, telefone brasileiro e data de nascimento entre `1900-01-01` e a data atual.
- **Pessoa jurídica:** CNPJ válido; nome fantasia é opcional.
- **Documento e e-mail:** não podem ser repetidos entre os clientes cadastrados.
- **Telefone:** validado como número brasileiro e armazenado apenas com dígitos.
- **Endereço:** CEP com 8 dígitos (com ou sem hífen) e UF correspondente a um estado brasileiro.
- **Remoção lógica:** o cliente permanece armazenado e pode ser consultado na lixeira e restaurado.
- **Exclusão permanente:** remove também o endereço associado e não pode ser desfeita.

## Comandos úteis

```bash
./start.sh --help   # Exibe as opções disponíveis
./start.sh --logs   # Acompanha os logs dos serviços
./start.sh --stop   # Para os serviços, preservando os dados
./start.sh --reset  # Apaga os volumes do banco e inicia tudo novamente
```

> **Atenção:** `./start.sh --reset` apaga permanentemente os dados persistidos no banco. O script solicita que você digite `RESET` antes de continuar.

Os pacotes também têm comandos próprios:

| Diretório | Comando | Descrição |
| --- | --- | --- |
| `apps/api` | `npm run dev` | Inicia a API em modo de desenvolvimento. |
| `apps/api` | `npm run build` | Executa a verificação TypeScript de produção. |
| `apps/api` | `npm start` | Inicia a API compilada. |
| `apps/web` | `npm run dev` | Inicia o servidor de desenvolvimento Vite. |
| `apps/web` | `npm run build` | Verifica os tipos e gera a versão de produção. |
| `apps/web` | `npm run lint` | Executa o ESLint. |