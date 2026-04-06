# apps/api — Documentação Técnica (Backend PDV FiadoDigital)

> **Última revisão:** 29/03/2026
> **Branch base:** `main`
> **Pacote:** `@pdv/api`
> **Responsável:** [Moisés Vila Nova De Oliveira](https://github.com/MoisesVNdev/MoisesVNdev)
> **Status:** Em desenvolvimento ativo — ver [Seção 15](#15-pendências-melhorias-e-roadmap) para backlog

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Pré-requisitos e Setup Local](#2-pré-requisitos-e-setup-local)
3. [Stack, Dependências e Scripts](#3-stack-dependências-e-scripts)
4. [Estrutura de Diretórios](#4-estrutura-de-diretórios)
5. [Arquitetura em Camadas](#5-arquitetura-em-camadas)
6. [Configuração e Variáveis de Ambiente](#6-configuração-e-variáveis-de-ambiente)
7. [Banco de Dados](#7-banco-de-dados)
8. [Autenticação, Segurança e Permissões](#8-autenticação-segurança-e-permissões)
9. [Contratos de API — Schemas de Request e Response](#9-contratos-de-api--schemas-de-request-e-response)
10. [Endpoints por Domínio](#10-endpoints-por-domínio)
11. [Regras de Negócio Detalhadas](#11-regras-de-negócio-detalhadas)
12. [Modelo de resposta da API](#12-modelo-de-resposta-da-api)
13. [WebSocket — Protocolo e Eventos](#13-websocket--protocolo-e-eventos)
14. [Jobs em Background](#14-jobs-em-background)
15. [Tratamento de Erros e Utilitários](#15-tratamento-de-erros-e-utilitários)
16. [Testes](#16-testes)
17. [Pendências, Melhorias e Roadmap](#17-pendências-melhorias-e-roadmap)
18. [Guia de Contribuição](#18-guia-de-contribuição)
19. [Observabilidade e auditoria](#19-observabilidade-e-auditoria)


---

## 1. Visão Geral

### 1.1 Contexto de negócio

O `apps/api` é o backend HTTP/WebSocket do sistema PDV FiadoDigital — um ponto de venda voltado para pequenos comércios que operam com crédito informal ("fiado"). O sistema gerencia o ciclo completo de vendas presenciais: abertura e fechamento de caixa, venda com múltiplos meios de pagamento (dinheiro, cartão, Pix, fiado), controle de estoque, gestão de clientes com limite de crédito, e notificações em tempo real.

A API é consumida exclusivamente pelo `apps/web` (frontend React/Vite). Não há outros consumidores previstos. Toda a persistência é local via SQLite — sem réplicas, sem sincronização remota. Isso é uma **decisão de projeto intencional**: o PDV opera offline-first, com backup periódico criptografado para armazenamento local ou em nuvem.

### 1.2 Decisões arquiteturais relevantes

| Decisão | Escolha | Motivo |
| :--- | :--- | :--- |
| Banco de dados | SQLite + better-sqlite3 | Operação offline, zero-config, single-file backup |
| ORM | Prisma com adapter custom | Suporte a SQLite via better-sqlite3 sem driver nativo |
| Runtime | Node.js 20.x + TypeScript strict | LTS estável, tipagem forte em todo o projeto |
| HTTP | Express 4.x | Familiaridade do time, ecossistema maduro |
| Validação | Zod | Inferência de tipos a partir de schemas, sem boilerplate |
| Auth | JWT (access + refresh) + cookie HttpOnly | Refresh token protegido contra XSS via cookie |
| PIN gerencial | bcrypt + rate limit | Operações críticas (cancelamento, estorno, fiado) exigem PIN |
| Tempo real | WebSocket nativo (`ws`) | Notificações sem polling — baixa sobrecarga para uso local |
| Agendamento | node-cron | Jobs de verificação de dívidas e backup automático |

### 1.3 Fronteiras do sistema

```
┌──────────────────────────────────────────────────────┐
│                  PDV FiadoDigital                    │
│                                                      │
│   ┌────────────┐   HTTP/REST    ┌──────────────────┐ │
│   │  apps/web  │ ◄────────────► │    apps/api      │ │
│   │ (React/    │   WebSocket    │  (Express +      │ │
│   │  Vite)     │ ◄────────────► │   Prisma +       │ │
│   └────────────┘                │   SQLite)        │ │
│                                 └────────┬─────────┘ │
│                                          │           │
│                              ┌───────────▼─────────┐ │
│                              │   data/dev.db        │ │
│                              │   (SQLite local)     │ │
│                              └─────────────────────┘ │
│                                                      │
│   Externo: Pix webhook (provedor PSP)                │
│   Externo: Cloud storage (backup opcional)           │
└──────────────────────────────────────────────────────┘
```

**Premissas importantes:**
- A API roda em instância única — não suporta múltiplas instâncias simultâneas (SQLite não é adequado para isso).
- O estado de transações Pix é mantido em memória — um restart limpa esse estado. Ver pendência Q02.
- O sistema assume timezone `America/Sao_Paulo` por padrão para todas as agregações de período.

---

## 2. Pré-requisitos e Setup Local

### 2.1 Requisitos do ambiente

| Requisito | Versão mínima | Verificação |
| :--- | :--- | :--- |
| Node.js | 20.x LTS | `node --version` |
| pnpm | 8.x ou superior | `pnpm --version` |
| Sistema operacional | Linux, macOS ou Windows (WSL2 recomendado) | — |

### 2.2 Configuração inicial (passo a passo)

**1. Instalar dependências do workspace**

```bash
# Na raiz do monorepo
pnpm install
```

**2. Criar o arquivo de variáveis de ambiente**

```bash
cp apps/api/.env.example apps/api/.env
```

Edite `apps/api/.env` e preencha ao menos as variáveis obrigatórias. Ver [Seção 6](#6-configuração-e-variáveis-de-ambiente) para descrição completa.

```env
# Mínimo para rodar localmente:
JWT_SECRET=qualquer-string-longa-aqui
JWT_REFRESH_SECRET=outra-string-diferente-aqui
DATABASE_URL=file:./data/dev.db
```

**3. Criar e migrar o banco de dados**

```bash
cd apps/api
pnpm db:migrate       # aplica o schema via prisma db push
pnpm db:generate      # gera o Prisma Client
pnpm db:seed          # cria usuário admin padrão
```

> **Atenção:** `db:migrate` usa `prisma db push` e é adequado para desenvolvimento. Em produção, use `db:migrate:deploy` (ver Seção 7).

**4. Iniciar o servidor em modo desenvolvimento**

```bash
pnpm dev
# Servidor HTTP em: http://localhost:3000
# WebSocket em:    ws://localhost:3000/ws
```

### 2.3 Credenciais padrão criadas pelo seed

| Campo | Valor |
| :--- | :--- |
| Usuário | `admin` |
| Senha | `admin123` |
| PIN gerencial | `123456` |
| Role | `admin` |

> **Troque imediatamente em qualquer ambiente não-descartável.**

### 2.4 Verificação do ambiente

```bash
# Checar tipos TypeScript
pnpm typecheck

# Rodar suite de testes
pnpm test

# Abrir Prisma Studio para inspecionar o banco
pnpm db:studio
```

---

## 3. Stack, Dependências e Scripts

### 3.1 Dependências de produção

| Tecnologia | Versão | Uso no projeto |
| :--- | :--- | :--- |
| Node.js | 20.x (engine root) | Runtime |
| TypeScript | `^5.5.0` | Linguagem, strict mode habilitado |
| Express | `^4.21.0` | Framework HTTP/REST |
| Prisma Client | `^7.4.2` | ORM e query builder |
| Prisma adapter better-sqlite3 | `^7.4.2` | Adapter SQLite para Prisma |
| better-sqlite3 | `^12.6.2` | Driver SQLite síncrono |
| Zod | `^3.23.0` | Validação de payloads e inferência de tipos |
| jsonwebtoken | `^9.0.2` | Geração e verificação de access/refresh tokens |
| bcryptjs | `^2.4.3` | Hash de senhas e PINs |
| ws | `^8.18.0` | Servidor WebSocket nativo |
| helmet | `^8.0.0` | Headers de segurança HTTP |
| cors | `^2.8.5` | Controle de CORS |
| express-rate-limit | `^7.4.0` | Rate limiting para rotas de auth e PIN |
| cookie-parser | `^1.4.7` | Leitura do cookie `refresh_token` |
| multer | `^1.4.5-lts.1` | Upload de arquivos de backup via multipart |
| node-cron | `^3.0.3` | Agendamento de jobs (dívidas e backup) |

### 3.2 Dependências de desenvolvimento

| Tecnologia | Versão | Uso no projeto |
| :--- | :--- | :--- |
| Vitest | `^2.1.0` | Runner de testes unitários |
| tsx | — | Execução de TypeScript em desenvolvimento |
| rimraf | — | Limpeza do diretório `dist` |

### 3.3 Scripts disponíveis

Todos os scripts são executados a partir de `apps/api/` com `pnpm <script>`.

| Script | Comando completo | Descrição |
| :--- | :--- | :--- |
| `dev` | `tsx watch src/index.ts` | Servidor com hot-reload via tsx |
| `build` | `tsc` | Compila TypeScript para `dist/` |
| `start` | `node dist/index.js` | Inicia a build de produção |
| `typecheck` | `tsc --noEmit` | Verifica tipos sem emitir arquivos |
| `lint` | `tsc --noEmit` | Alias de typecheck (sem linter de estilo) |
| `test` | `vitest run` | Executa todos os testes uma vez |
| `test:unit` | `vitest run` | Alias de `test` (atualmente idêntico) |
| `test:watch` | `vitest` | Modo watch interativo |
| `db:migrate` | `prisma db push --config prisma.config.ts` | Sincroniza schema em desenvolvimento |
| `db:migrate:deploy` | `prisma migrate deploy --config prisma.config.ts` | Aplica migrations versionadas em produção |
| `db:seed` | `tsx prisma/seed.ts` | Popula dados iniciais (admin + saneamento) |
| `db:studio` | `prisma studio --config prisma.config.ts` | Interface visual do banco |
| `db:generate` | `prisma generate --config prisma.config.ts` | Regenera o Prisma Client |
| `clean` | `rimraf dist` | Remove o diretório `dist/` |

> **Nota:** `test` e `test:unit` executam o mesmo comando. A separação por suite (`unit`, `integration`, `e2e`) ainda não foi implementada — ver [Seção 15](#15-testes).

---

## 4. Estrutura de Diretórios

O pacote segue uma organização por **tipo de artefato** (controllers, services, repositories...), não por domínio de negócio. Essa escolha facilita a localização de arquivos por função arquitetural, mas exige que o desenvolvedor saiba qual domínio quer modificar antes de navegar entre as pastas.

```text
apps/api/
├── Dockerfile                        # Container da API (dev)
├── package.json                      # Scripts e dependências do pacote
├── prisma.config.ts                  # Configuração do Prisma para o workspace
├── tsconfig.json                     # Configuração TypeScript da API
├── prisma/
│   └── seed.ts                       # Seed: admin + saneamento de sale_item
└── src/
    ├── app.ts                        # Middlewares globais + prefixo /api + error handler
    ├── index.ts                      # Bootstrap: DB → jobs → HTTP → WS → graceful shutdown
    ├── config/
    │   ├── database.ts               # Prisma Client + WAL mode + busy_timeout
    │   └── index.ts                  # Variáveis de ambiente com valores padrão
    ├── controllers/                  # Mapeamento request → service → resposta HTTP
    │   ├── auth.controller.ts
    │   ├── backup.controller.ts
    │   ├── brand.controller.ts
    │   ├── card-machine.controller.ts
    │   ├── cash-register.controller.ts
    │   ├── control.controller.ts
    │   ├── customer.controller.ts
    │   ├── dashboard.controller.ts
    │   ├── notification.controller.ts
    │   ├── pix.controller.ts
    │   ├── print.controller.ts
    │   ├── product.controller.ts
    │   ├── product-type.controller.ts
    │   ├── sale.controller.ts
    │   ├── settings.controller.ts
    │   ├── stock-movement.controller.ts
    │   └── user.controller.ts
    ├── jobs/                         # Tarefas agendadas via node-cron
    │   ├── backup.job.ts
    │   └── customer-debt-check.job.ts
    ├── middlewares/                  # Funções de middleware Express reutilizáveis
    │   ├── auth.middleware.ts        # Verifica JWT e popula req.user
    │   ├── error-handler.middleware.ts
    │   ├── rate-limiter.middleware.ts
    │   └── role.middleware.ts        # Verifica role do usuário autenticado
    ├── repositories/                 # Operações de persistência via Prisma
    │   ├── audit-log.repository.ts
    │   ├── brand.repository.ts
    │   ├── card-machine.repository.ts
    │   ├── cash-register.repository.ts
    │   ├── control.repository.ts
    │   ├── customer.repository.ts
    │   ├── dashboard.repository.ts
    │   ├── notification.repository.ts
    │   ├── pix-transaction.repository.ts
    │   ├── product.repository.ts
    │   ├── product-type.repository.ts
    │   ├── sale.repository.ts
    │   ├── settings.repository.ts
    │   ├── stock-movement.repository.ts
    │   └── user.repository.ts
    ├── routes/                       # Declaração de rotas, aplicação de middlewares por rota
    │   ├── index.ts                  # Agregador de todas as rotas sob /api
    │   ├── auth.routes.ts
    │   ├── backup.routes.ts
    │   ├── brand.routes.ts
    │   ├── card-machine.routes.ts
    │   ├── cash-register.routes.ts
    │   ├── control.routes.ts
    │   ├── customer.routes.ts
    │   ├── dashboard.routes.ts
    │   ├── notification.routes.ts
    │   ├── pix.routes.ts
    │   ├── print.routes.ts
    │   ├── product.routes.ts
    │   ├── product-type.routes.ts
    │   ├── sale.routes.ts
    │   ├── settings.routes.ts
    │   ├── stock-movement.routes.ts
    │   └── user.routes.ts
    ├── services/                     # Regras de negócio e orquestração transacional
    │   ├── auth.service.ts
    │   ├── backup.service.ts
    │   ├── brand.service.ts
    │   ├── card-machine.service.ts
    │   ├── cash-register.service.ts
    │   ├── cloud-storage.service.ts
    │   ├── control.service.ts
    │   ├── customer.service.ts
    │   ├── dashboard.service.ts
    │   ├── notification.service.ts
    │   ├── pix-payload.service.ts    # Geração de payload EMV/Pix BR Code
    │   ├── pix.service.ts
    │   ├── print.service.ts
    │   ├── product.service.ts
    │   ├── product-type.service.ts
    │   ├── sale.service.ts
    │   ├── settings.service.ts
    │   ├── stock-movement.service.ts
    │   ├── user.service.ts
    │   └── ws-token.service.ts       # Tokens de uso único para autenticação WebSocket
    ├── utils/
    │   └── pix-key.ts                # Validadores e normalizadores de chave Pix
    ├── validators/                   # Schemas Zod para validação de entrada
    │   ├── auth.validator.ts
    │   ├── brand.validator.ts
    │   ├── card-machine.validator.ts
    │   ├── cash-register.validator.ts
    │   ├── control.validator.ts
    │   ├── customer.validator.ts
    │   ├── notification.validator.ts
    │   ├── pix.validator.ts
    │   ├── product.validator.ts
    │   ├── product-type.validator.ts
    │   ├── sale.validator.ts
    │   ├── settings.validator.ts
    │   └── user.validator.ts
    └── websocket/
        └── index.ts                  # Setup do servidor WS, gerenciamento de clientes, broadcast
```

---

## 5. Arquitetura em Camadas

### 5.1 Fluxo principal de uma requisição

```
Requisição HTTP
      │
      ▼
 [ Routes ]
 Declara método/path, aplica middlewares de
 auth/role/rate-limit e validator Zod.
      │
      ▼
 [ Controllers ]
 Extrai dados do request (body, params, query,
 user), chama o service e devolve a resposta HTTP.
      │
      ▼
 [ Services ]
 Contém toda a lógica de negócio. Orquestra
 chamadas a repositories, dispara notificações
 via WebSocket, aplica regras transacionais.
      │
      ▼
 [ Repositories ]
 Realiza operações no banco via Prisma.
 Constrói queries, filtros e paginação.
      │
      ▼
 [ Prisma Client ]
 Acessa o schema central e gerencia transações SQLite.
```

### 5.2 Responsabilidades e fronteiras de cada camada

**Routes** — o que deve conter:
- Declaração de métodos HTTP e paths
- Aplicação de `authenticate`, `authorize(...roles)` e validators Zod
- Aplicação de rate limiters específicos por rota

**Routes** — o que nunca deve conter:
- Lógica de negócio de qualquer tipo
- Consultas diretas ao banco ou ao Prisma
- Transformação de dados

**Controllers** — o que deve conter:
- Extração e tipagem de `req.body`, `req.params`, `req.query`, `req.user`
- Chamada única ao service correspondente
- Montagem do objeto de resposta HTTP (`res.status(...).json(...)`)

**Controllers** — o que nunca deve conter:
- Lógica de domínio ou regras de negócio
- Queries Prisma diretas
- Múltiplas chamadas a services diferentes (orquestração pertence ao service)

**Services** — o que deve conter:
- Regras de negócio completas com pré-condições e exceções
- Orquestração transacional (Prisma `$transaction`)
- Disparo de notificações e broadcasts WebSocket
- Chamadas a outros services quando necessário (ex: `sale.service.ts` → `notification.service.ts`)

**Services** — o que nunca deve conter:
- Detalhes de transporte HTTP (status codes, headers, cookies)
- Acesso direto ao Prisma sem passar por um repository (salvo transações complexas)

**Repositories** — o que deve conter:
- Toda a interação com o Prisma Client
- Construção de filtros, ordenação e paginação
- Queries de leitura e escrita específicas de cada domínio

**Repositories** — o que nunca deve conter:
- Lógica de autorização ou autenticação
- Regras de negócio
- Disparo de efeitos colaterais (notificações, jobs)

---

## 6. Configuração e Variáveis de Ambiente

Todas as variáveis são lidas em `src/config/index.ts`. Os valores padrão são seguros apenas para desenvolvimento. Em produção, qualquer variável marcada como **obrigatória** deve ser definida explicitamente — a ausência de `JWT_SECRET` e `JWT_REFRESH_SECRET` é um risco de segurança crítico (ver pendência S01).

| Variável | Padrão | Obrigatória em prod | Descrição |
| :--- | :--- | :---: | :--- |
| `PORT` | `3000` | Não | Porta do servidor HTTP |
| `NODE_ENV` | `development` | Sim | Modo de execução (`development` / `production`) |
| `DATABASE_URL` | `file:./data/dev.db` | Sim | Caminho do arquivo SQLite |
| `APP_TIME_ZONE` | `America/Sao_Paulo` | Não | Timezone para agregações e filtros de período |
| `CORS_ORIGIN` | `http://localhost:5173` | Sim | Origem permitida no CORS (URL do frontend) |
| `JWT_SECRET` | `""` | **Sim** | Segredo para assinar o access token (mínimo 32 chars) |
| `JWT_REFRESH_SECRET` | `""` | **Sim** | Segredo para assinar o refresh token (diferente do anterior) |
| `JWT_EXPIRES_IN` | `15m` | Não | Expiração do access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Não | Expiração do refresh token |
| `PIX_KEY_TYPE` | `""` | Não | Tipo da chave Pix: `cpf`, `cnpj`, `email`, `phone`, `random` |
| `PIX_KEY` | `""` | Não | Chave Pix do recebedor |
| `PIX_MERCHANT_NAME` | `""` | Não | Nome do recebedor (campo EMV) |
| `PIX_MERCHANT_CITY` | `""` | Não | Cidade do recebedor (campo EMV) |
| `PIX_WEBHOOK_SECRET` | `""` | Não | Segredo para validação do webhook do PSP |

> **Ação pendente (S01 — Alta):** O bootstrap em `src/index.ts` deve fazer fail-fast quando `JWT_SECRET` ou `JWT_REFRESH_SECRET` estiverem vazios em `NODE_ENV=production`. Atualmente, a API sobe sem erro mesmo com segredos em branco.

---

## 7. Banco de Dados

### 7.1 Configuração da conexão (`src/config/database.ts`)

O Prisma usa o adapter `PrismaBetterSqlite3` em vez do driver SQLite padrão, permitindo controle fino sobre as conexões síncronas do better-sqlite3.

A função `initDatabase()` executa na sequência:

1. `prisma.$connect()` — estabelece conexão com o arquivo SQLite
2. `PRAGMA journal_mode=WAL;` — habilita Write-Ahead Log para leituras concorrentes sem bloqueio
3. `PRAGMA busy_timeout=5000;` — aguarda até 5 segundos antes de falhar em caso de lock

O caminho do arquivo é extraído de `DATABASE_URL` removendo o prefixo `file:`.

### 7.2 Entidades principais e relacionamentos

As entidades centrais do domínio e seus relacionamentos de alto nível:

```
User ──────────────── CashRegister
  │                       │
  │                       │ (pertence a um terminal/usuário)
  │                    Sale
  │                    ├── SaleItem (snapshot de produto)
  │                    ├── PaymentMethod[] (até 2, sem repetição)
  │                    └── Customer? (quando pagamento = fiado)
  │
Customer
  ├── current_debt_cents   (saldo devedor acumulado)
  ├── credit_blocked       (bloqueado por inadimplência)
  └── credit_limit_cents   (limite configurável)

Product
  ├── ProductType (categoria)
  ├── Brand (marca)
  ├── stock_quantity
  └── StockMovement[] (histórico de entradas/saídas)

Settings
  ├── Configurações gerais (nome da loja, limites)
  └── Configurações Pix (chave, credenciais)

Notification
  ├── type: 'stock.low' | 'cash.high' | 'debt.overdue' | ...
  ├── is_read
  └── acknowledged_at?
```

### 7.3 Seed (`prisma/seed.ts`)

O seed é idempotente (usa `upsert`) e executa:

1. **Criação/restauração do usuário admin:**
   - `username: admin`, `senha: admin123` (hash bcrypt), `PIN: 123456` (hash bcrypt), `role: admin`
   - Em caso de admin já existente: reativa (`is_active=true`, `deleted_at=null`)

2. **Saneamento de `SaleItem`:**
   - Busca registros com `product_name` vazio ou igual a `"Produto sem nome"`
   - Atualiza o snapshot com `product.name` atual quando o produto ainda existe

### 7.4 Migrations

| Contexto | Comando | Comportamento |
| :--- | :--- | :--- |
| Desenvolvimento | `pnpm db:migrate` | `prisma db push` — sincroniza schema sem versionar migration |
| Produção | `pnpm db:migrate:deploy` | `prisma migrate deploy` — aplica migrations versionadas e rastreáveis |

> Em produção, sempre use `db:migrate:deploy` para garantir rastreabilidade e rollback controlado.

---

## 8. Autenticação, Segurança e Permissões

### 8.1 Fluxo JWT

**Login** (`POST /api/auth/login`):
- Valida credenciais contra o banco via bcrypt
- Emite **access token** (JWT, payload: `{ sub: userId, role }`, expiração: `JWT_EXPIRES_IN`)
- Emite **refresh token** (JWT, expiração: `JWT_REFRESH_EXPIRES_IN`) via cookie HttpOnly

**Refresh** (`POST /api/auth/refresh`):
- Lê o cookie `refresh_token`
- Valida assinatura e expiração com `JWT_REFRESH_SECRET`
- Emite novo par de tokens (rotação de refresh token)

**Logout** (`POST /api/auth/logout`):
- Remove o cookie `refresh_token` via `Set-Cookie` com expiração no passado

**Uso do access token:**
- Header: `Authorization: Bearer <token>`
- O middleware `authenticate` valida o token, verifica que o usuário está ativo no banco e popula `req.user`

### 8.2 Configuração do cookie de refresh token

| Propriedade | Valor |
| :--- | :--- |
| `httpOnly` | `true` — inacessível via JavaScript |
| `sameSite` | `strict` — não enviado em requisições cross-site |
| `secure` | `true` apenas quando `NODE_ENV=production` |
| `path` | `/api/auth/refresh` (restrito à rota de refresh) |

### 8.3 Middlewares de segurança

| Middleware | Função | Aplicação |
| :--- | :--- | :--- |
| `helmet()` | Define headers de segurança HTTP (CSP, HSTS, etc.) | Global — todas as rotas |
| `cors(...)` | Permite apenas `CORS_ORIGIN` com credenciais | Global — todas as rotas |
| `authenticate` | Valida JWT e user ativo, popula `req.user` | Por rota — rotas protegidas |
| `authorize(...roles)` | Bloqueia roles não autorizadas para a rota | Por rota — controle de acesso |
| `authLimiter` | Rate limit: 10 tentativas/15min por IP | Rotas de login |
| `pinRateLimiter` | Rate limit: 10 tentativas/15min por IP | Rotas que exigem PIN |
| `errorHandler` | Centraliza e formata erros HTTP | Global — após todas as rotas |

### 8.4 Roles e permissões

O sistema tem quatro roles com permissões crescentes:

| Role | Descrição |
| :--- | :--- |
| `admin` | Acesso total — inclui exclusão, configurações, backup e operações com PIN |
| `manager` | Gestão de vendas, clientes, produtos e usuários (exceto exclusão de usuários) |
| `operator` | Venda, caixa e consultas operacionais |
| `stockist` | Gestão de produtos e estoque |

Mapeamento de permissões por domínio:

| Domínio | admin | manager | operator | stockist |
| :--- | :---: | :---: | :---: | :---: |
| Usuários (leitura) | ✓ | ✓ | — | — |
| Usuários (escrita) | ✓ | ✓ | — | — |
| Usuários (exclusão) | ✓ | — | — | — |
| Produtos (leitura) | ✓ | ✓ | ✓ | ✓ |
| Produtos (escrita) | ✓ | ✓ | — | ✓ |
| Produtos (bulk price) | ✓ | — | — | — |
| Vendas (leitura) | ✓ | ✓ | ✓ | — |
| Vendas (criação) | ✓ | ✓ | ✓ | — |
| Vendas (cancelamento) | ✓ | ✓ | ✓ | — |
| Clientes (leitura) | ✓ | ✓ | ✓ | — |
| Clientes (escrita) | ✓ | ✓ | — | — |
| Pagamento de dívida | ✓ | ✓ | — | — |
| Caixa | ✓ | ✓ | ✓ | — |
| Configurações | ✓ | — | — | — |
| Backup | ✓ | — | — | — |
| Controle / Dashboard | ✓ | — | — | — |
| Notificações (leitura) | ✓ | ✓ | ✓ | — |
| Notificações (acknowledge) | ✓ | ✓ | — | — |
| Estoque | ✓ | — | — | — |
| Maquininhas | ✓ | ✓ | ✓ | — |

### 8.5 PIN gerencial

O PIN é um segundo fator para operações financeiramente sensíveis. É distinto da senha de login.

**Quando é exigido:**
- Cancelamento de venda (`POST /sales/:id/cancel`)
- Estorno de venda (`POST /sales/:id/refund`)
- Pagamento de dívida de cliente (`POST /customers/:id/pay-debt`)
- Atualização de configurações Pix (`PUT /settings/pix`)

**Como funciona:**
1. O frontend chama `POST /api/auth/validate-pin` com o PIN digitado
2. O backend faz `bcrypt.compare` contra o `pin_hash` de usuários com role `admin` ou `manager`
3. Em sucesso, retorna confirmação que o frontend usa para liberar a operação crítica

---

## 9. Contratos de API — Schemas de Request e Response

Esta seção descreve os shapes de entrada e saída dos endpoints mais críticos. Todos os valores monetários são em **centavos (inteiros)** — nunca float. Datas no padrão ISO 8601.

**Envelope de resposta padrão:**

```ts
// Sucesso
{ "success": true, "data": <payload> }

// Erro
{ "success": false, "message": "Descrição do erro" }
```

### 9.1 Auth

**POST /api/auth/login**

```ts
// Request body
{
  username: string  // obrigatório
  password: string  // obrigatório
}

// Response 200
{
  success: true,
  data: {
    accessToken: string,
    user: {
      id: string,
      username: string,
      name: string,
      role: "admin" | "manager" | "operator" | "stockist"
    }
  }
}
// Set-Cookie: refresh_token=<jwt>; HttpOnly; SameSite=Strict

// Response 401 — credenciais inválidas ou usuário inativo
{ success: false, message: "Usuário ou senha inválidos" }
```

**POST /api/auth/validate-pin**

```ts
// Request body
{
  pin: string  // obrigatório, 6 dígitos
}

// Response 200 — PIN válido
{ success: true, data: { valid: true } }

// Response 403 — PIN incorreto
{ success: false, message: "PIN inválido" }
```

### 9.2 Vendas

**POST /api/sales**

```ts
// Request body
{
  uuid: string,           // obrigatório — chave de idempotência (UUID v4)
  cash_register_id: string,  // obrigatório
  customer_id?: string,   // obrigatório quando payment_methods inclui "fiado"
  discount_cents?: number, // desconto em centavos (0 por padrão)
  items: [
    {
      product_id: string,
      quantity: number,         // inteiro positivo
      unit_price_cents: number  // preço unitário em centavos
    }
  ],
  payment_methods: [  // mínimo 1, máximo 2, sem repetição de type
    {
      type: "cash" | "credit_card" | "debit_card" | "pix" | "fiado" | "mixed",
      amount_cents: number,
      card_machine_id?: string  // obrigatório para credit_card/debit_card
    }
  ]
}

// Response 201 — venda criada
{
  success: true,
  data: {
    id: string,
    uuid: string,
    total_cents: number,
    discount_cents: number,
    status: "completed",
    payment_methods: [...],
    items: [...],
    customer_id: string | null,
    cash_register_id: string,
    created_at: string  // ISO 8601
  }
}

// Response 409 — uuid já utilizado (idempotência)
{ success: false, message: "Venda já registrada" }

// Response 422 — regra de negócio violada
{ success: false, message: "<descrição da regra violada>" }
```

**POST /api/sales/:id/cancel**

```ts
// Request body
{
  pin: string,     // PIN gerencial obrigatório
  reason?: string  // motivo do cancelamento (opcional)
}

// Response 200
{ success: true, data: { id: string, status: "cancelled" } }

// Response 422 — cancelamento fora do prazo (mesmo dia)
{ success: false, message: "Cancelamento permitido apenas no dia da venda" }
```

**POST /api/sales/:id/refund**

```ts
// Request body
{
  pin: string  // PIN gerencial obrigatório
  // Nota: campo receipt_id está no validator mas não é utilizado no domínio — ver bug B01
}

// Response 200
{ success: true, data: { id: string, status: "refunded" } }

// Response 422 — estorno fora do prazo (7 dias)
{ success: false, message: "Estorno permitido apenas em até 7 dias" }
```

### 9.3 Clientes

**POST /api/customers**

```ts
// Request body
{
  name: string,                    // obrigatório
  phone?: string,
  credit_limit_cents?: number,     // padrão definido em Settings
  notes?: string
}

// Response 201
{
  success: true,
  data: {
    id: string,
    name: string,
    phone: string | null,
    current_debt_cents: number,
    credit_limit_cents: number,
    credit_blocked: boolean,
    is_active: boolean,
    created_at: string
  }
}
```

**POST /api/customers/:id/pay-debt**

```ts
// Request body
{
  pin: string,          // PIN gerencial obrigatório
  amount_cents: number, // valor pago (pode ser parcial)
  payment_method: "cash" | "credit_card" | "debit_card" | "pix"
}

// Response 200
{
  success: true,
  data: {
    customer_id: string,
    amount_paid_cents: number,
    remaining_debt_cents: number,
    credit_blocked: boolean  // false se dívida zerada
  }
}

// Response 422 — caixa não está aberto
{ success: false, message: "Caixa deve estar aberto para registrar pagamento" }
```

### 9.4 Caixa

**POST /api/cash-registers/open**

```ts
// Request body (sem body obrigatório)
{
  opening_balance_cents?: number  // saldo inicial em centavos (padrão: 0)
}

// Response 201
{
  success: true,
  data: {
    id: string,
    status: "open",
    opening_balance_cents: number,
    opened_at: string,
    opened_by_user_id: string
  }
}

// Response 409 — caixa já aberto neste terminal
{ success: false, message: "Já existe um caixa aberto" }
```

### 9.5 Pix

**POST /api/pix/qrcode**

```ts
// Request body
{
  amount_cents: number,   // obrigatório, valor em centavos
  description?: string    // descrição da cobrança
}

// Response 201
{
  success: true,
  data: {
    tx_id: string,          // ID da transação em memória
    qr_code: string,        // string EMV do QR Code Pix
    qr_code_base64: string, // imagem PNG em base64 (opcional)
    expires_at: string      // ISO 8601
  }
}
```

**POST /api/pix/webhook** (chamado pelo PSP)

```ts
// Request body (formato do PSP)
{
  pix: [
    {
      txid: string,
      valor: string,     // string decimal, ex: "49.90"
      horario: string,   // ISO 8601
      pagador: { ... }
    }
  ]
}

// Response 200 — sempre retorna 200 para o PSP
{ success: true }
```

### 9.6 Produtos

**POST /api/products**

```ts
// Request body
{
  name: string,                  // obrigatório
  barcode?: string,              // único no sistema
  product_type_id?: string,
  brand_id?: string,
  sale_price_cents: number,      // obrigatório
  cost_price_cents?: number,
  stock_quantity?: number,       // padrão: 0
  min_stock_quantity?: number,   // alerta de estoque baixo
  is_bulk?: boolean,             // produto a granel (peso)
  unit?: string                  // ex: "kg", "L", "un"
}

// Response 201
{
  success: true,
  data: {
    id: string,
    name: string,
    barcode: string | null,
    sale_price_cents: number,
    cost_price_cents: number | null,
    stock_quantity: number,
    is_active: boolean,
    created_at: string
  }
}

// Response 409 — barcode já cadastrado
{ success: false, message: "Código de barras já utilizado" }
```

### 9.7 Notificações

**GET /api/notifications** (lista paginada)

```ts
// Query params
{
  page?: number,       // padrão: 1
  limit?: number,      // padrão: 20
  is_read?: boolean,
  type?: string        // ex: "stock.low"
}

// Response 200
{
  success: true,
  data: {
    items: [
      {
        id: string,
        type: string,
        title: string,
        message: string,
        is_read: boolean,
        acknowledged_at: string | null,
        created_at: string
      }
    ],
    total: number,
    page: number,
    limit: number
  }
}
```

### 9.8 Backup

**POST /api/backups/generate**

```ts
// Request body (sem body obrigatório — usa configurações de Settings)
{}

// Response 201
{
  success: true,
  data: {
    id: string,
    filename: string,
    size_bytes: number,
    encrypted: boolean,
    storage: "local" | "cloud",
    created_at: string
  }
}
```

**POST /api/backups/restore**

```ts
// Content-Type: multipart/form-data
// Campo: file — arquivo de backup (.db ou .db.enc)

// Response 200
{ success: true, data: { restored_at: string } }

// Response 422 — arquivo inválido ou corrompido
{ success: false, message: "Arquivo de backup inválido" }
```

---

## 10. Endpoints por Domínio

Base global: `/api`. Todos os endpoints que exigem Auth usam `Authorization: Bearer <accessToken>`.

### /auth

| Método | Path | Auth | Roles | Validator | Comportamento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/login` | Não | — | `validateLogin` | Autentica e emite access + refresh token |
| POST | `/auth/refresh` | Não | — | — | Renova sessão via cookie HttpOnly |
| POST | `/auth/logout` | Não | — | — | Remove cookie de refresh |
| POST | `/auth/validate-pin` | Sim | qualquer | `validatePinBody` | Valida PIN de gerente/admin |

### /users

| Método | Path | Auth | Roles | Validator | Comportamento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/users` | Sim | admin, manager | — | Lista usuários ativos |
| GET | `/users/:id` | Sim | admin, manager | — | Busca usuário por ID |
| POST | `/users` | Sim | admin, manager | `validateCreateUser` | Cria usuário |
| PUT | `/users/:id` | Sim | admin, manager | `validateUpdateUser` | Atualiza dados do usuário |
| DELETE | `/users/:id` | Sim | admin | — | Soft delete |

### /products

| Método | Path | Auth | Roles | Validator | Comportamento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/products` | Sim | admin, manager, stockist, operator | — | Lista com filtros |
| GET | `/products/:id` | Sim | admin, manager, stockist, operator | — | Busca por ID |
| POST | `/products` | Sim | admin, manager, stockist | `validateCreateProduct` | Cria produto |
| PUT | `/products/:id` | Sim | admin, manager, stockist | `validateUpdateProduct` | Atualiza produto |
| PATCH | `/products/bulk-price` | Sim | admin | `validateBulkUpdatePrice` | Reajuste de preço em lote |
| DELETE | `/products/:id` | Sim | admin, manager, stockist | — | Soft delete |

### /product-types

| Método | Path | Auth | Roles | Validator | Comportamento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/product-types` | Sim | qualquer | — | Lista tipos de produto |
| POST | `/product-types` | Sim | admin, manager | `validateCreateProductType` | Cria tipo |
| PUT | `/product-types/:id` | Sim | admin, manager | `validateUpdateProductType` | Atualiza tipo |
| DELETE | `/product-types/:id` | Sim | admin, manager | — | Soft delete |

### /brands

| Método | Path | Auth | Roles | Validator | Comportamento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/brands` | Sim | qualquer | — | Lista marcas |
| POST | `/brands` | Sim | admin, manager, stockist | `validateCreateBrand` | Cria marca |
| PUT | `/brands/:id` | Sim | admin, manager | `validateUpdateBrand` | Atualiza marca |
| DELETE | `/brands/:id` | Sim | admin, manager | — | Soft delete |

### /customers

| Método | Path | Auth | Roles | Validator | Comportamento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/customers` | Sim | qualquer | `validateListCustomers` | Lista paginada com filtros |
| GET | `/customers/:id` | Sim | qualquer | — | Busca cliente |
| GET | `/customers/:id/fiado-history` | Sim | admin, manager | — | Histórico de compras no fiado |
| GET | `/customers/:id/payment-history` | Sim | admin, manager | — | Histórico de pagamentos de dívida |
| POST | `/customers` | Sim | admin, manager | `validateCreateCustomer` | Cria cliente |
| PUT | `/customers/:id` | Sim | admin, manager | `validateUpdateCustomer` | Atualiza dados do cliente |
| POST | `/customers/:id/pay-debt` | Sim | admin, manager | `validatePayDebt` | Registra pagamento de dívida (exige PIN) |
| DELETE | `/customers/:id` | Sim | admin, manager | — | Soft delete |

### /sales

| Método | Path | Auth | Roles | Validator | Comportamento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/sales` | Sim | admin, manager, operator | `validateListSales` | Lista vendas com filtros |
| GET | `/sales/:id` | Sim | admin, manager, operator | — | Busca venda por ID |
| POST | `/sales` | Sim | admin, manager, operator | `validateCreateSale` | Cria venda (idempotente por uuid) |
| POST | `/sales/:id/cancel` | Sim | admin, manager, operator | `validateCancelSale` | Cancela venda (mesmo dia + PIN) |
| POST | `/sales/:id/refund` | Sim | admin, manager, operator | `validateRefundSale` | Estorna venda (até 7 dias + PIN) |

### /cash-registers

| Método | Path | Auth | Roles | Validator | Comportamento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/cash-registers` | Sim | admin, manager, operator | `validateListCashRegisters` | Lista caixas |
| GET | `/cash-registers/current` | Sim | admin, manager, operator | — | Caixa aberto do terminal atual |
| POST | `/cash-registers/open` | Sim | admin, manager, operator | — | Abre caixa |
| POST | `/cash-registers` | Sim | admin, manager, operator | — | Alias de abertura de caixa |
| POST | `/cash-registers/close` | Sim | admin, manager, operator | — | Fecha caixa |
| POST | `/cash-registers/cash-out` | Sim | admin, manager, operator | — | Sangria |
| POST | `/cash-registers/:id/cash-out` | Sim | admin, manager, operator | — | Sangria por ID do caixa |
| POST | `/cash-registers/:id/cash-in` | Sim | admin, manager, operator | — | Suprimento |

### /transactions

> Nenhuma implementação encontrada nesta revisão. Entidade existe no banco, sem rota própria (ver pendência F01).

### /cash-registers (`src/routes/cash-register.routes.ts`)

| Método | Path | Auth | Roles | PIN? | Validator | Arquivo de origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/cash-registers` | Sim | `admin`, `manager`, `operator`| Não | `listCashRegisterQuerySchema` (Local) | `cash-register.controller.ts` |
| GET | `/cash-registers/current` | Sim | `admin`, `manager`, `operator`| Não | `currentCashRegisterQuerySchema` (Local) | `cash-register.controller.ts` |
| POST | `/cash-registers/open` | Sim | `admin`, `manager`, `operator`| Não | `validateOpenCashRegister` | `cash-register.controller.ts` |
| POST | `/cash-registers` | Sim | `admin`, `manager`, `operator`| Não | Chamada direta para `/open` | `cash-register.controller.ts` |
| POST | `/cash-registers/close` | Sim | `admin`, `manager`, `operator`| Não | `validateCloseCashRegister` | `cash-register.controller.ts` |
| POST | `/cash-registers/cash-out` | Sim | `admin`, `manager`, `operator`| Não | `validateCashMovement` | `cash-register.controller.ts` |
| POST | `/cash-registers/:id/cash-in` | Sim | `admin`, `manager`, `operator`| Não | `validateCashMovement` | `cash-register.controller.ts` |

### /card-machines (`src/routes/card-machine.routes.ts`)

| Método | Path | Auth | Roles | PIN? | Validator | Arquivo de origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/card-machines` | Sim | `admin`, `manager`, `operator`| Não | *Query Parse Manual* | `card-machine.controller.ts` |
| GET | `/card-machines/:id` | Sim | `admin`, `manager`, `operator`| Não | — | `card-machine.controller.ts` |
| POST | `/card-machines` | Sim | `admin` | Não | `validateCreateCardMachine` | `card-machine.controller.ts` |
| PUT | `/card-machines/:id` | Sim | `admin` | Não | `validateUpdateCardMachine` | `card-machine.controller.ts` |
| DELETE | `/card-machines/:id` | Sim | `admin` | Não | — | `card-machine.controller.ts` |

### /stock-movements (`src/routes/stock-movement.routes.ts`)

| Método | Path | Auth | Roles | PIN? | Validator | Arquivo de origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/stock-movements/:productId` | Sim | `admin` | Não | `validateGetStockMovements` | `stock-movement.controller.ts` |
| POST | `/stock-movements/adjustment` | Sim | `admin` | Não | `validateCreateStockAdjustment` | `stock-movement.controller.ts` |

### /control (`src/routes/control.routes.ts`)

| Método | Path | Auth | Roles | PIN? | Validator | Arquivo de origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/control/stock-summary` | Sim | `admin` | Não | *Parsing Manual* | `control.controller.ts` |
| GET | `/control/cash-summary` | Sim | `admin` | Não | *Parsing Manual* | `control.controller.ts` |
| GET | `/control/discount-summary` | Sim | `admin` | Não | *Parsing Manual* | `control.controller.ts` |
| GET | `/control/cancellations` | Sim | `admin` | Não | *Parsing Manual* | `control.controller.ts` |

### /pix (`src/routes/pix.routes.ts`)

| Método | Path | Auth | Roles | PIN? | Validator | Arquivo de origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| POST | `/pix/qrcode` | Sim | *qualquer* | Não | `validateGenerateQRCode` | `pix.controller.ts` |
| GET | `/pix/status/:tx_id` | Sim | *qualquer* | Não | `validatePixStatusParams` | `pix.controller.ts` |
| POST | `/pix/webhook` | Não | — | Não | `validatePixWebhook` | `pix.controller.ts` |

### /settings (`src/routes/settings.routes.ts`)

| Método | Path | Auth | Roles | PIN? | Validator | Arquivo de origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/settings` | Sim | `admin` | Não | — | `settings.controller.ts` |
| PUT | `/settings` | Sim | `admin` | Não | `validateUpdateGeneralSettings` | `settings.controller.ts` |
| GET | `/settings/pix` | Sim | `admin` | Não | — | `settings.controller.ts` |
| PUT | `/settings/pix` | Sim | `admin` | Sim | `validateUpdatePixSettings` | `settings.controller.ts` |

### /notifications (`src/routes/notification.routes.ts`)

| Método | Path | Auth | Roles | PIN? | Validator | Arquivo de origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/notifications` | Sim | `admin`, `manager`, `operator`| Não | `notificationQuerySchema` (Local) | `notification.controller.ts` |
| GET | `/notifications/unread-count` | Sim | *qualquer* | Não | — | `notification.controller.ts` |
| GET | `/notifications/export` | Sim | `admin`, `manager` | Não | `exportQuerySchema` (Local) | `notification.controller.ts` |
| PATCH | `/notifications/read-all` | Sim | *qualquer* | Não | — | `notification.controller.ts` |
| PATCH | `/notifications/:id/read` | Sim | *qualquer* | Não | — | `notification.controller.ts` |
| PATCH | `/notifications/:id/acknowledge` | Sim | `admin`, `manager` | Não | — | `notification.controller.ts` |
| DELETE | `/notifications/read` | Sim | `admin`, `manager` | Não | — | `notification.controller.ts` |

### /print (`src/routes/print.routes.ts`)

| Método | Path | Auth | Roles | PIN? | Validator | Arquivo de origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| POST | `/print/receipt` | Sim | `admin`, `manager`, `operator`| Não | `Zod schema inline` | `print.controller.ts` |
| GET | `/print/receipt` | Sim | `admin`, `manager`, `operator`| Não | *Query string parser* | `print.controller.ts` |

### /backups (`src/routes/backup.routes.ts`)

| Método | Path | Auth | Roles | PIN? | Validator | Arquivo de origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/backups/test-path` | Sim | `admin` | Não | `testPathQuerySchema` (Local) | `backup.controller.ts` |
| POST | `/backups/generate` | Sim | `admin` | Não | — | `backup.controller.ts` |
| GET | `/backups/download/:id` | Sim | `admin` | Não | — | `backup.controller.ts` |
| POST | `/backups/restore` | Sim | `admin` | Não | *File Upload Stream* | `backup.controller.ts` |

---

## 11. Regras de Negócio Detalhadas

### 11.1 Vendas (`src/services/sale.service.ts`)

**Criação de venda**

- Pré-condição: deve existir um caixa aberto associado ao `cash_register_id` informado.
- Pré-condição: o `uuid` não deve ter sido usado em nenhuma venda anterior (idempotência — retorna 409 se duplicado).
- Máximo de 2 meios de pagamento por venda, sem repetição de `type`.
- A soma dos `amount_cents` dos meios de pagamento deve ser igual ao total da venda após desconto.
- Quando há 2 meios de pagamento, o `type` deve ser `"mixed"` (regra de consistência de dados).
- Quando `payment_methods` contém `"fiado"`, `customer_id` é obrigatório.
- Para fiado: verifica se o cliente tem `credit_blocked=false` e se `current_debt_cents + valor_da_venda <= credit_limit_cents`.

**Pós-condição de uma venda criada:**
- Estoque de cada `product_id` é decrementado pela `quantity` vendida.
- Se `payment_method.type === "fiado"`: `customer.current_debt_cents` é incrementado.
- `StockMovement` é registrado para cada item (tipo: saída por venda).
- Notificações são disparadas quando:
  - Estoque de algum produto cai abaixo de `min_stock_quantity` → evento `stock.low`
  - `CashRegister.balance` ultrapassa o limite configurado em Settings → evento `cash.high`
  - Venda com fiado e `current_debt_cents` próximo ao limite → evento `debt.warning`

**Cancelamento de venda**

- Pré-condição: a venda deve ter sido criada no **mesmo dia calendário** (timezone: `APP_TIME_ZONE`).
- Pré-condição: PIN gerencial válido obrigatório.
- Pós-condição: estoque de cada item é restaurado; se pagamento foi fiado, `customer.current_debt_cents` é decrementado.

**Estorno de venda**

- Pré-condição: a venda deve ter sido criada há **no máximo 7 dias corridos**.
- Pré-condição: PIN gerencial válido obrigatório.
- Pós-condição: mesmos efeitos do cancelamento, registrado como `"refunded"` em vez de `"cancelled"`.
- **Bug B01:** o validator `validateRefundSale` exige `receipt_id`, mas o campo não é usado no domínio. Remover ou implementar.

### 11.2 Clientes (`customer.service.ts`)

**Pagamento de dívida**

- Pré-condição: deve existir um caixa aberto no momento do pagamento.
- Pré-condição: PIN gerencial válido obrigatório.
- O pagamento pode ser **parcial** (menor que `current_debt_cents`) ou total.
- Pós-condição parcial: `current_debt_cents` é decrementado pelo valor pago.
- Pós-condição total (dívida zerada): `current_debt_cents = 0`, `credit_blocked = false`, `is_active = true`.
- O valor pago é registrado como transação no `CashRegister` aberto.

**Bloqueio de crédito**

- Condição de bloqueio: `current_debt_cents > 0` e `due_date` vencida (verificado pelo job diário).
- Efeito: `credit_blocked = true` — impede novas compras no fiado até pagamento.
- Desbloqueio automático: ocorre ao zerar a dívida via `pay-debt`.

### 11.3 Produtos (`product.service.ts`)

- `barcode` deve ser único no sistema. Retorna 409 em caso de duplicidade.
- `product_type_id` e `brand_id`, quando informados, devem referenciar registros ativos.
- Produto `is_bulk=true` aceita `quantity` como decimal (peso/volume) em vez de inteiro.
- Ao criar produto com `stock_quantity > 0`, um `StockMovement` de entrada é registrado automaticamente.
- O custo médio (`average_cost_cents`) é recalculado a cada entrada de estoque usando média ponderada.

### 11.4 Caixa (`cash-register.service.ts`)

- Apenas **um caixa pode estar aberto por terminal** por vez. Tentativa de abrir segundo caixa retorna 409.
- O "terminal" é identificado pelo contexto da requisição (usuário + sessão).
- Operações de sangria (`cash-out`) e suprimento (`cash-in`) registram transações e atualizam o saldo do caixa.
- Quando o saldo do caixa ultrapassa o limite configurado em Settings, uma notificação `cash.high` é disparada.
- Fechamento de caixa registra o saldo final e impede novas vendas associadas àquele caixa.

### 11.5 Configurações (`settings.service.ts`)

- Leitura de settings usa o banco como fonte primária, com fallback para variáveis de ambiente quando o campo não está no banco.
- Atualização das configurações Pix exige a senha do usuário autenticado (não o PIN — é a senha de login).
- Settings armazena: limites de desconto máximo, alertas de estoque baixo, parâmetros de fiado (limite padrão, prazo), configurações de backup (frequência, retenção, tipo de storage, criptografia).

### 11.6 Backup (`backup.service.ts`)

- Gera um dump do arquivo SQLite usando a API nativa do better-sqlite3.
- Criptografia opcional: AES-256 quando habilitado em Settings. Arquivos criptografados têm extensão `.db.enc`.
- Storage local: salva o arquivo em diretório configurável com verificação de permissão de escrita.
- Storage cloud: delega para `cloud-storage.service.ts` que gerencia o envio.
- Retenção automática: após gerar novo backup, remove backups mais antigos que o período configurado.
- Restauração: valida a integridade do arquivo (descriptografa se necessário), substitui o banco atual e reinicia a conexão Prisma.

### 11.7 Maquininhas (`card-machine.service.ts`)

- Valida taxa base (`fee_percentage`) dentro de limites razoáveis.
- Suporta configuração de taxa incremental por parcela (ex: taxa base + X% por parcela adicional).
- Soft delete impede uso em novas vendas mas preserva histórico.

---

## 12. Modelo de resposta da API

### 12.1 Resposta de sucesso

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-03-29T12:00:00Z"
  }
}
```

### 12.2 Resposta de erro

```json
{
  "success": false,
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Cliente não encontrado",
    "details": null
  },
  "meta": {
    "timestamp": "2026-03-29T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

### 12.3 Regras do contrato
- O envelope de resposta deve ser consistente.
- Erros de validação, autenticação e negócio devem ser distinguíveis.
- A API deve evitar respostas ambíguas.
- O contrato deve ser previsível para frontend, integrações e testes.

---


## 13. WebSocket — Protocolo e Eventos

### 13.1 Configuração

| Propriedade | Valor |
| :--- | :--- |
| Path de montagem | `/ws` |
| Protocolo | WebSocket nativo (RFC 6455) |
| Gerenciamento de clientes | `Set<WebSocket>` em memória — sem persistência de sessão |
| Direção das mensagens | Unidirecional: **servidor → cliente** (push only) |

### 13.2 Autenticação da conexão WebSocket

O WebSocket não aceita o header `Authorization` diretamente no handshake (limitação do protocolo em browsers). O fluxo correto é:

1. Frontend chama `GET /api/auth/ws-token` (autenticado via JWT normal) para obter um token de uso único.
2. Frontend conecta ao WebSocket passando o token como query param: `ws://host/ws?token=<ws_token>`.
3. O servidor valida o token via `ws-token.service.ts` e aceita ou rejeita a conexão.
4. Cada token é válido para **uma única conexão** e é invalidado após uso.

### 13.3 Eventos emitidos pelo servidor

Todas as mensagens são objetos JSON com a estrutura:

```ts
{
  type: string,      // identificador do evento
  payload: object    // dados do evento
}
```

| Tipo | Emitido por | Shape do payload | Quando ocorre |
| :--- | :--- | :--- | :--- |
| `notification.new` | `notification.service.ts` | Objeto `Notification` completo persistido | Qualquer notificação criada |
| `stock.low_alert` | `sale.service.ts`, `stock-movement.service.ts` | `{ product_id, product_name, current_quantity, min_quantity }` | Estoque cai abaixo do mínimo após venda ou ajuste |
| `cash.high_alert` | `cash-register.service.ts` | `{ cash_register_id, current_balance_cents, limit_cents }` | Saldo do caixa ultrapassa limite |
| `debt.overdue` | `customer-debt-check.job.ts` | `{ customer_id, customer_name, debt_cents, due_date }` | Job detecta dívida vencida |

### 13.4 Comportamento em desconexão

- O servidor remove o cliente do `Set<WebSocket>` automaticamente via evento `close`.
- Não há reconexão automática no servidor — o cliente é responsável por reconectar (implementado no `apps/web`).
- Mensagens emitidas enquanto o cliente estava desconectado são perdidas — o cliente deve fazer polling de notificações não lidas ao reconectar.

---

## 14. Jobs em Background

Jobs são iniciados no bootstrap (`src/index.ts`) após a conexão com o banco. Todos usam `node-cron` para agendamento.

| Job | Arquivo | Chamado no bootstrap? | Intervalo / Trigger | Comportamento | Efeitos colaterais |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `customer-debt-check` | `src/jobs/customer-debt-check.job.ts` | Sim | A cada 24h | Busca clientes inadimplentes após `due_date` | Seta `credit_blocked=true`, cria alertas WS |
| `backup` | `src/jobs/backup.job.ts` | Não (**bug B03**) | Configuração Dinâmica | Executa e retém Checkpoint Wal & cópia da DB local | Despacho de logs, cloud transfer encrypt |

> **Nota:** Bug B03 e a falta da vinculação de chamada `startBackupJob()` no `src/index.ts` continua presente e passiva de correção.


---

## 15. Tratamento de Erros e Utilitários

### 15.1 Middleware de erro (`error-handler.middleware.ts`)

Centraliza o tratamento de todos os erros lançados pelos services e middlewares.

**Formato de resposta de erro:**

```ts
{ "success": false, "message": "Descrição do erro" }
```

**Mapeamento de status HTTP por heurística de texto:**

| Condição na mensagem ou Classe Base | Status HTTP |
| :--- | :--- |
| Erros levantados via classe `DomainError` (Unprocessable/Not Found) | Utiliza o StatusCode tipado da instância |
| Erros levantados nativamente pelo pipeline do Zod (Validação Formato) | 400 (Bad Request) Automático via middleware |
| Contém "não encontrado" / "not found" | 404 |
| Contém "PIN" / "senha" / "permissão" | 403 |
| Regras de negócio (cancelamento, estorno, estoque, crédito) | 422 |
| Conflito / duplicidade | 409 |
| Qualquer outro erro não mapeado | 500 |


**Em `NODE_ENV=production`:** erros não mapeados retornam a mensagem genérica `"Erro interno do servidor"` sem expor detalhes do stack trace.

> **Qualidade Q01 (Média):** A heurística por `includes` de substring é frágil — uma mensagem de erro que contenha a palavra "senha" acidentalmente recebe status 403. A correção correta é padronizar erros de domínio com um campo `code` tipado (ex: `throw new DomainError('SALE_NOT_FOUND', 'Venda não encontrada')`).

### 15.2 Utilitários (`src/utils/pix-key.ts`)

| Função | Entrada | Comportamento |
| :--- | :--- | :--- |
| `validatePixKey(type, key)` | Tipo e valor da chave | Valida formato de CPF, CNPJ, e-mail, telefone ou chave aleatória |
| `normalizePixKey(type, key)` | Tipo e valor da chave | Normaliza a chave para o formato canônico do Pix (ex: remove formatação de CPF) |

---

## 16. Testes

### 16.1 Configuração atual

| Item | Status |
| :--- | :--- |
| Runner | Vitest `^2.1.0` |
| Comando | `pnpm test` ou `pnpm test:unit` (idênticos atualmente) |
| Modo watch | `pnpm test:watch` |
| Cobertura atual | **Não mensurada** — falta configuração de coverage |
| Tipos de teste implementados | **A levantar** — estrutura de testes não mapeada nesta revisão |

### 16.2 Estratégia recomendada

A cobertura de testes deve priorizar os módulos com maior risco de regressão:

**Testes unitários (alta prioridade):**
- `sale.service.ts` — regras de idempotência, múltiplos pagamentos, fiado, cancelamento, estorno
- `customer.service.ts` — pagamento parcial/total, bloqueio/desbloqueio de crédito
- `cash-register.service.ts` — abertura duplicada, sangria, suprimento
- `pix-key.ts` — validação e normalização de todos os tipos de chave

**Testes de integração (média prioridade):**
- Fluxo completo de venda: abertura de caixa → venda → fechamento de caixa
- Fluxo de fiado: venda → acúmulo de dívida → pagamento → desbloqueio

**Testes de carga (baixa prioridade — ver PF01):**
- Fluxos de venda simultânea
- Broadcast WebSocket com múltiplos clientes conectados

### 16.3 Convenção de arquivos de teste

> **A definir.** Recomendação: arquivos de teste colocados ao lado do arquivo testado com sufixo `.test.ts` (ex: `sale.service.test.ts`).

---

## 17. Pendências, Melhorias e Roadmap

### 🔴 Bugs e Inconsistências

| ID | Severidade | Arquivo(s) | Descrição | Correção proposta |
| :--- | :--- | :--- | :--- | :--- |
| B01 | Alta | `sale.validator.ts`, `sale.service.ts` | `validateRefundSale` exige `receipt_id`, mas o campo não é usado no domínio de estorno. | Remover a obrigatoriedade no validator ou implementar o uso real no repository. |
| B02 | Alta | Múltiplos controllers (ex: `product`, `customer`, `control`) | Query params chegam unparsed e controllers forçam conversão caseira, falhando coercitivamente. | Adicionar schemas Zod com `.coerce` e integrá-los de forma global às requests GET em listagens. |
| B03 | Baixa | `src/index.ts`, `backup.job.ts` | `startBackupJob()` não é invocado no inicializador, paralisando os dumps contínuos. | Adicionar chamada após `initDatabase()` explícita. |

### 🔴 Segurança

| ID | Severidade | Arquivo | Descrição | Correção proposta |
| :--- | :--- | :--- | :--- | :--- |
| S01 | Alta | `src/config/index.ts`, `src/index.ts` | `JWT_SECRET` faz fallback perigoso em node dev e sobe normalmente sob production silenciosa e exposta local. | Implementar *fail-fast* obrigatório no Bootstrap com `if (!JWT_SECRET)` em Node Env em produção. |

### ⚠️ Qualidade e Consistência

| ID | Severidade | Arquivo | Descrição | Correção proposta |
| :--- | :--- | :--- | :--- | :--- |
| Q01 | Média | `error-handler.middleware.ts`, `services/*.ts` | Maioria dos services soltam hard `Error` lido sob substrings (anti-pattern) forçando erro de casting. | Refatorar para utilização da classe `DomainError` tipada para unificar Exception pipelines no Express. |
| Q02 | Alta | `pix-transaction.repository.ts`, `settings` table | Transações Webhook pix são armazenadas json-stringed como chaves no `settings` persistido de configuração. | Migrar o cache no SQLite para uma tabela dedicada ou engine stand-alone se possível. |

### 💡 Funcionalidades Pendentes

| ID | Funcionalidade | Status | Observação |
| :--- | :--- | :--- | :--- |
| F01 | Rota `/transactions` dedicada | Pendente | Historização nativa não indexou rota pra view exclusiva do front. |


### 📊 Performance

| ID | Severidade | Descrição | Correção |
| :--- | :--- | :--- | :--- |
| PF01 | Média | Ausência de testes de carga para fluxos de venda e WebSocket | Implementar cenários de stress para `sale`, `pix` e `notifications` (ex: com k6 ou autocannon) |
| PF02 | Baixa | Filtros de query com parse manual em controllers podem gerar comportamento inconsistente em páginas altas | Padronizar coerção via schemas Zod de query em todos os controllers |

---

## 18. Guia de Contribuição

### 18.1 Como adicionar um novo domínio

Ao criar um novo módulo de domínio (ex: `promotions`), siga esta sequência:

1. **Validator** — crie `src/validators/promotion.validator.ts` com os schemas Zod de entrada
2. **Repository** — crie `src/repositories/promotion.repository.ts` com as queries Prisma
3. **Service** — crie `src/services/promotion.service.ts` com as regras de negócio
4. **Controller** — crie `src/controllers/promotion.controller.ts` mapeando request → service → response
5. **Routes** — crie `src/routes/promotion.routes.ts` e registre os middlewares
6. **Registro** — importe as rotas em `src/routes/index.ts`
7. **Schema Prisma** — adicione o model em `prisma/schema.prisma` e execute `pnpm db:migrate`
8. **Testes** — crie `src/services/promotion.service.test.ts` cobrindo as regras críticas
9. **Documentação** — adicione as seções correspondentes nas seções 9, 10 e 11 deste arquivo

### 18.2 Convenções de nomenclatura

| Tipo de arquivo | Padrão | Exemplo |
| :--- | :--- | :--- |
| Controller | `<domínio>.controller.ts` | `promotion.controller.ts` |
| Service | `<domínio>.service.ts` | `promotion.service.ts` |
| Repository | `<domínio>.repository.ts` | `promotion.repository.ts` |
| Validator | `<domínio>.validator.ts` | `promotion.validator.ts` |
| Routes | `<domínio>.routes.ts` | `promotion.routes.ts` |
| Teste | `<arquivo>.test.ts` | `promotion.service.test.ts` |

**Funções nos validators:** prefixo `validate` + ação + entidade (ex: `validateCreatePromotion`, `validateListPromotions`).

**Funções nos services:** verbos diretos sem prefixo (ex: `createPromotion`, `listPromotions`, `applyPromotion`).

### 18.3 O que nunca fazer

- **Nunca** acessar o Prisma diretamente em um Controller — use sempre o Service.
- **Nunca** acessar o Prisma diretamente em um Service sem passar por um Repository (exceção: transações complexas com `$transaction` que cruzam múltiplos repositories).
- **Nunca** lançar objetos HTTP (status codes, headers) dentro de Services — lance erros de domínio com mensagens descritivas.
- **Nunca** criar rotas sem aplicar o middleware `authenticate` em endpoints que exijam login.
- **Nunca** adicionar lógica de negócio em Controllers.

### 18.4 Fluxo de desenvolvimento

```bash
# 1. Criar branch a partir de main
git checkout -b feat/nome-da-feature

# 2. Desenvolver com servidor em watch
pnpm dev

# 3. Checar tipos antes de commitar
pnpm typecheck

# 4. Rodar testes
pnpm test

# 5. Commitar com mensagem descritiva
git commit -m "feat(promotions): adiciona CRUD de promoções com regras de período"

# 6. Abrir Pull Request para main
```

### 18.5 Decisões arquiteturais registradas (ADRs)

| ADR | Decisão | Motivo |
| :--- | :--- | :--- |
| ADR-001 | SQLite + better-sqlite3 em vez de PostgreSQL | Operação offline-first, zero-config, backup trivial (single-file) |
| ADR-002 | Prisma com adapter custom em vez de driver nativo | Único caminho suportado para SQLite síncrono com Prisma 7.x |
| ADR-003 | Refresh token em cookie HttpOnly em vez de localStorage | Proteção contra XSS — localStorage é acessível por JavaScript |
| ADR-004 | Validação de entrada com Zod em vez de joi/yup | Inferência automática de tipos TypeScript a partir dos schemas |
| ADR-005 | WebSocket nativo (`ws`) em vez de Socket.io | Menor overhead, sem dependências adicionais para uso unidirecional simples |

---

## 19. Observabilidade e auditoria

### 19.1 Logs esperados
- logs de bootstrap;
- logs de erro crítico;
- logs de operações sensíveis;
- logs de jobs.

### 19.2 Auditoria esperada
- cancelamentos;
- estornos;
- pagamentos de dívida;
- alterações administrativas;
- eventos financeiros de alto impacto.

### 19.3 Evolução recomendada
- request ID por requisição;
- logs estruturados;
- trilha de eventos sensíveis;
- integração com métricas e tracing.

---

_Documento mantido por [Moisés Vila Nova De Oliveira](https://github.com/MoisesVNdev/MoisesVNdev) — contato: moisesvn.dev@gmail.com_