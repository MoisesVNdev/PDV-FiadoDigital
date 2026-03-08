# PDV FiadoDigital

Sistema de Ponto de Venda (PDV) híbrido e local para pequenos comércios. Controle de vendas, estoque, clientes com fiado, dashboard gerencial e impressão de cupom não fiscal. **Não emite NF-e** — o único comprovante é o cupom/recibo não fiscal impresso.

## Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | pnpm workspaces (v9) |
| Frontend | Vue 3, Vite 6, Tailwind CSS v4, Pinia, Vue Router, PWA |
| Backend | Node.js 20+, Express 4, Prisma ORM 7, JWT, WebSocket |
| Banco | SQLite (WAL mode) via better-sqlite3 |
| Validação | Zod |
| Linguagem | TypeScript 5.x strict |

## Estrutura

```
PDV-FiadoDigital/
├── apps/
│   ├── api/                          # Backend Node.js/Express
│   │   ├── src/
│   │   │   ├── controllers/          # Auth, User, Product, Sale, Customer, CashRegister
│   │   │   ├── services/             # Regras de negócio
│   │   │   ├── repositories/         # Acesso a dados (Prisma)
│   │   │   ├── routes/               # Rotas REST + router central
│   │   │   ├── validators/           # Validação de entrada (Zod)
│   │   │   ├── middlewares/          # Auth, error-handler, rate-limiter, role
│   │   │   ├── websocket/            # WebSocket (broadcast multi-terminal)
│   │   │   ├── config/               # Database, env config
│   │   │   ├── app.ts                # Express app factory
│   │   │   └── index.ts              # Bootstrap (server + graceful shutdown)
│   │   └── prisma/
│   │       └── seed.ts               # Seed do admin inicial
│   │
│   └── web/                          # Frontend Vue 3
│       └── src/
│           ├── pages/                # Login, Dashboard, Sales, Products, Customers
│           ├── components/layout/    # Componentes de layout
│           ├── composables/          # use-auth, use-websocket
│           ├── stores/               # Pinia (auth, sale)
│           ├── router/               # Vue Router + guards (auth + role)
│           └── assets/               # Tailwind CSS v4 (@theme)
│
├── packages/
│   └── shared/                       # Types, constants e utils compartilhados
│       └── src/
│           ├── types/                # User, Product, Sale, Customer, CashRegister, Transaction, AuditLog
│           ├── constants/            # Roles, PaymentMethods, SaleStatus, Pagination
│           └── utils/                # Utilitários compartilhados
│
├── prisma/
│   └── schema.prisma                 # 8 modelos (User, Customer, Product, Sale, SaleItem, CashRegister, Transaction, AuditLog)
│
├── docker-compose.yml                # Ambiente de desenvolvimento
└── .github/
    └── workflows/ci.yml              # CI: lint → typecheck → test → build
```

## Pré-requisitos

- **Node.js** >= 20
- **pnpm** >= 9

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Setup Local

```bash
# 1. Clonar o repositório
git clone https://github.com/MoisesVNdev/PDV-FiadoDigital.git
cd PDV-FiadoDigital

# 2. Instalar dependências
pnpm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env — gere secrets JWT com:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 4. Gerar Prisma Client e rodar migrations
pnpm --filter @pdv/api run db:generate
pnpm --filter @pdv/api run db:migrate

# 5. Seed do usuário admin (opcional)
pnpm db:seed

# 6. Iniciar em modo desenvolvimento
pnpm dev
```

Backend: `http://localhost:3000` | Frontend: `http://localhost:5173`

## Docker (desenvolvimento)

```bash
cp .env.example .env
docker compose up -d --build
```

- **api**: porta 3000 (hot reload em `apps/api/src`)
- **web**: porta 5173 (hot reload em `apps/web/src`)
- Health check via `HEAD /health`
- Volume persistente para SQLite em `./data`

> **Nota:** Impressora USB, Tauri e mDNS não funcionam dentro do container — teste esses recursos fora do Docker.

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_URL` | Caminho do SQLite | `file:./data/data.db` |
| `JWT_SECRET` | Secret do access token (mín. 64 chars) | — |
| `JWT_REFRESH_SECRET` | Secret do refresh token (mín. 64 chars) | — |
| `JWT_EXPIRES_IN` | Tempo de vida do access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Tempo de vida do refresh token | `7d` |
| `PORT` | Porta da API | `3000` |
| `NODE_ENV` | Ambiente | `development` |
| `CORS_ORIGIN` | Origem permitida para CORS | `http://localhost:5173` |
| `PIX_KEY` | Chave Pix para QR Code estático | — |
| `PIX_MERCHANT_NAME` | Nome do recebedor Pix | — |
| `PIX_MERCHANT_CITY` | Cidade do recebedor Pix | — |
| `BACKUP_LOCAL_PATH` | Diretório de backups locais | `./backups` |

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Inicia api + web em paralelo (hot reload) |
| `pnpm dev:api` | Inicia apenas o backend |
| `pnpm dev:web` | Inicia apenas o frontend |
| `pnpm build` | Build de produção de todos os workspaces |
| `pnpm build:api` | Build apenas do backend |
| `pnpm build:web` | Build apenas do frontend |
| `pnpm lint` | Lint/type-check em todos os workspaces |
| `pnpm typecheck` | Verificação de tipos |
| `pnpm test` | Executa todos os testes (Vitest) |
| `pnpm test:unit` | Testes unitários |
| `pnpm db:migrate` | Push do schema Prisma para o banco |
| `pnpm db:seed` | Popula banco com admin inicial |
| `pnpm db:studio` | Abre Prisma Studio (GUI) |
| `pnpm clean` | Remove dist e node_modules |

## Arquitetura do Backend

Arquitetura em camadas com injeção via import direto:

```
Request → Route → Middleware (auth, role, rate-limit) → Controller → Service → Repository → Prisma/SQLite
```

### Rotas da API

| Rota | Descrição |
|---|---|
| `POST /api/auth/login` | Login (retorna access token + refresh cookie) |
| `POST /api/auth/refresh` | Renovar access token via refresh cookie |
| `POST /api/auth/logout` | Logout (limpa refresh cookie) |
| `/api/users` | CRUD de usuários |
| `/api/products` | CRUD de produtos e estoque |
| `/api/sales` | Vendas, cancelamentos, estornos |
| `/api/customers` | CRUD de clientes e controle de fiado |
| `/api/cash-registers` | Abertura/fechamento de caixa |
| `GET /health` | Health check |
| `WebSocket /ws` | Broadcast em tempo real (estoque, vendas) |

### Segurança

- JWT curto (15m) + Refresh Token em cookie HttpOnly/Secure/SameSite=Strict
- bcryptjs (12 rounds) para hash de senhas
- Rate limiting: 10 tentativas de login por 15 min/IP
- Helmet (security headers: CSP, HSTS, X-Content-Type-Options)
- CORS configurável
- Validação de entrada com Zod
- Queries parametrizadas via Prisma (prevenção de SQL Injection)
- Soft delete em todas as entidades (nunca DELETE físico)

## Banco de Dados

SQLite com WAL mode habilitado (busy timeout de 5s para concorrência). Todos os valores monetários são armazenados como **inteiro em centavos** (`Int`), nunca `float` ou `decimal`.

### Modelos

| Modelo | Descrição |
|---|---|
| `User` | Operadores e gestores — name, username, password_hash, pin_hash, role, is_active |
| `Customer` | Clientes com fiado — credit_limit_cents, current_debt_cents, credit_blocked |
| `Product` | Catálogo — barcode, price_cents, cost_price_cents, stock_quantity, min_stock_alert |
| `Sale` | Vendas com UUID v7 (idempotência) — payment_method, subtotal/discount/total_cents, status |
| `SaleItem` | Itens da venda (snapshot do preço no ato) — unit_price_cents, quantity, discount_cents |
| `CashRegister` | Sessões de caixa — opening/closing_balance_cents, difference_cents, status |
| `Transaction` | Movimentações financeiras (sale, refund, cancellation, cash_in, cash_out, fiado_payment) |
| `AuditLog` | Log de auditoria append-only — action, entity_type, entity_id, details (JSON) |

## Perfis de Acesso

| Perfil | Permissões |
|---|---|
| **Administrador** | Gestão de usuários e perfis |
| **Gerente** | Acesso total (exceto gestão de perfis); dashboard; define limites de crédito e desconto |
| **Estoquista** | Módulo de estoque e produtos |
| **Operador** | Vendas, cancelamentos e estornos (com PIN do Gerente) |

## Frontend

- **Composition API** com `<script setup lang="ts">` exclusivamente
- **Pinia** para estado global (auth, carrinho de vendas)
- **PWA**: offline support via Workbox, manifest com ícones
- **Tailwind CSS v4** com `@tailwindcss/vite` e tema customizado via `@theme`
- **Vue Router** com guards de autenticação e autorização por role
- **WebSocket** para atualização em tempo real entre terminais

### Páginas

| Rota | Página | Roles |
|---|---|---|
| `/login` | Login | Pública |
| `/` | Dashboard | admin, manager |
| `/sales` | Vendas | admin, manager, operator |
| `/products` | Produtos | admin, manager, stockist |
| `/customers` | Clientes | admin, manager |

## CI/CD

Pipeline GitHub Actions (`.github/workflows/ci.yml`) com 3 jobs sequenciais em push/PR para `main` e `develop`:

1. **lint-and-typecheck** — Instalação, Prisma generate, lint e type-check
2. **test** — Vitest
3. **build** — Build de produção (tsc + vite build)

Concorrência: apenas 1 execução por branch (cancel-in-progress).

## Licença

Consulte o arquivo [LICENSE](LICENSE).