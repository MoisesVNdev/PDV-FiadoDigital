# apps/web — Frontend PDV FiadoDigital

| Campo          | Valor                                                      |
| :------------- | :--------------------------------------------------------- |
| Última revisão | 02/04/2026                                                 |
| Branch base    | `main`                                                     |
| Pacote         | `@pdv/web`                                                 |
| Owner          | [Moisés Vila Nova De Oliveira](https://github.com/MoisesVNdev/MoisesVNdev) |
| Status         | Estável — arquitetura modernizada e testada                |
| Depende de     | `@pdv/shared` (tipos), `@pdv/api` (Docker), serviço de Pix |
| Versão do doc  | v1.5                                                       |

---

## Índice

1. [Visão Geral](#1-visão-geral)
   - [Contexto no sistema](#contexto-no-sistema)
   - [Escopo funcional](#escopo-funcional)
   - [Características principais](#características-principais)
2. [Início Rápido](#2-início-rápido)
   - [Pré-requisitos](#pré-requisitos)
   - [Instalação](#instalação)
   - [Variáveis de ambiente](#variáveis-de-ambiente)
   - [Scripts disponíveis](#scripts-disponíveis)
   - [Como rodar localmente (fluxo completo)](#como-rodar-localmente-fluxo-completo)
3. [Stack e Dependências](#3-stack-e-dependências)
   - [Dependências de produção](#dependências-de-produção)
   - [Dependências de desenvolvimento](#dependências-de-desenvolvimento)
   - [Dependências internas do monorepo](#dependências-internas-do-monorepo)
4. [Estrutura de Diretórios e Convenções](#4-estrutura-de-diretórios-e-convenções)
   - [Árvore de arquivos](#árvore-de-arquivos)
   - [Convenções de nomenclatura](#convenções-de-nomenclatura)
5. [Bootstrap (`main.ts`)](#5-bootstrap-maints)
6. [Configuração do Vite (`vite.config.ts`)](#6-configuração-do-vite-viteconfigts)
7. [Design System](#7-design-system)
   - [Tokens de cor (definidos em `src/assets/main.css` via `@theme`)](#tokens-de-cor-definidos-em-srcassetsmaincss-via-theme)
   - [Utilitários globais](#utilitários-globais)
   - [Tokens pendentes de implementação](#tokens-pendentes-de-implementação)
   - [Estratégia de acessibilidade](#estratégia-de-acessibilidade)
8. [Contratos de API e Integração](#7-contratos-de-api-e-integração)
   - [7.1 Convenções gerais de contrato](#71-convenções-gerais-de-contrato)
   - [7.2 Contrato — Autenticação](#72-contrato--autenticação)
   - [7.3 Contrato — Dashboard](#73-contrato--dashboard)
   - [7.4 Contrato — Vendas](#74-contrato--vendas)
   - [7.5 Contrato — Pix](#75-contrato--pix)
   - [7.6 Contrato — Caixa / Cash Registers](#76-contrato--caixa--cash-registers)
   - [7.7 Contrato — Produtos e Estoque](#77-contrato--produtos-e-estoque)
   - [7.8 Contrato — Clientes](#78-contrato--clientes)
   - [7.9 Contrato — Configurações](#79-contrato--configurações)
   - [7.10 Contrato — Controle](#710-contrato--controle)
   - [7.11 Contrato — Notificações](#711-contrato--notificações)
   - [7.12 Contrato — Impressão](#712-contrato--impressão)
9. [Padrão de Erros do Frontend](#8-padrão-de-erros-do-frontend)
   - [8.1 Estrutura unificada de erro](#81-estrutura-unificada-de-erro)
   - [8.2 Tratamento por classe de erro](#82-tratamento-por-classe-de-erro)
   - [8.3 Erros críticos do domínio](#83-erros-críticos-do-domínio)
10. [Segurança Frontend](#8-segurança-frontend)
   - [Armazenamento de tokens](#armazenamento-de-tokens)
   - [Sanitização e validação de inputs](#sanitização-e-validação-de-inputs)
   - [Pontos de atenção ativos](#pontos-de-atenção-ativos)
11. [Roteamento e Autenticação](#9-roteamento-e-autenticação)
   - [9.1 Tabela de rotas](#91-tabela-de-rotas)
   - [9.2 Comportamento dos guards (`guards.ts`)](#92-comportamento-dos-guards-guardsts)
   - [9.3 Rota padrão por perfil](#93-rota-padrão-por-perfil)
   - [9.4 Fluxo de autenticação](#94-fluxo-de-autenticação)
12. [Gerenciamento de Estado — Stores Pinia](#10-gerenciamento-de-estado--stores-pinia)
   - [`auth.store.ts`](#authstorets)
   - [`customer.store.ts`](#customerstorets)
   - [`product.store.ts`](#productstorets)
   - [`sale.store.ts`](#salestorets)
13. [Tipos Compartilhados — `@pdv/shared`](#11-tipos-compartilhados--pdvshared)
14. [Composables](#12-composables)
   - [`use-api.ts`](#use-apits)
   - [`use-auth.ts`](#use-authts)
   - [`use-confirm.ts`](#use-confirmts)
   - [`use-formatting.ts`](#use-formattingts)
   - [`use-global-modal-focus-trap.ts`](#use-global-modal-focus-trapts)
   - [`use-layout-state.ts`](#use-layout-statets)
   - [`use-notifications.ts`](#use-notificationsts)
   - [`use-sale-calculator.ts`](#use-sale-calculatorts)
   - [`use-toast.ts`](#use-toastts)
   - [`use-barcode-scanner.ts`](#use-barcode-scannerts)
   - [`use-customer-domain.ts`](#use-customer-domaints)
   - [`use-modal-stack.ts`](#use-modal-stackts)
   - [`use-pix-polling.ts`](#use-pix-pollingts)
   - [`use-pos-shortcuts.ts`](#use-pos-shortcutsts)
   - [`use-sale-domain.ts`](#use-sale-domaints)
   - [`use-settings-domain.ts`](#use-settings-domaints)
   - [`use-websocket.ts`](#use-websocketts)
15. [Componentes de Layout](#13-componentes-de-layout)
   - [`app-header.vue`](#app-headervue)
   - [`app-sidebar.vue`](#app-sidebarvue)
   - [`confirm-dialog.vue`](#confirm-dialogvue)
   - [`notification-toast-container.vue`](#notification-toast-containervue)
16. [Páginas](#14-páginas)
   - [`login-page.vue`](#login-pagevue)
   - [`dashboard-page.vue`](#dashboard-pagevue)
   - [`sales-page.vue`](#sales-pagevue)
   - [`products-page.vue`](#products-pagevue)
   - [`customers-page.vue`](#customers-pagevue)
   - [`control-page.vue`](#control-pagevue)
   - [`employees-page.vue`](#employees-pagevue)
   - [`settings-page.vue`](#settings-pagevue)
   - [`notifications-page.vue`](#notifications-pagevue)
17. [Contrato de Integração com API](#15-contrato-de-integração-com-api)
18. [Padrões e Convenções](#16-padrões-e-convenções)
   - [Máscaras e formatação](#máscaras-e-formatação)
   - [Toasts e feedback ao usuário](#toasts-e-feedback-ao-usuário)
   - [Blur de dados sensíveis](#blur-de-dados-sensíveis)
   - [Skeletons de carregamento](#skeletons-de-carregamento)
   - [Impressão de recibo](#impressão-de-recibo)
   - [Paginação client-side](#paginação-client-side)
19. [Testes](#17-testes)
   - [Estado atual](#estado-atual)
   - [Como rodar os testes](#como-rodar-os-testes)
20. [CI/CD e Deploy](#18-cicd-e-deploy)
   - [Pipeline recomendado (referência)](#pipeline-recomendado-referência)
   - [Variáveis de ambiente no pipeline](#variáveis-de-ambiente-no-pipeline)
   - [Rollback](#rollback)
21. [Performance, PWA e Estratégia Offline](#19-performance-pwa-e-estratégia-offline)
   - [Performance](#performance)
   - [Configuração PWA](#configuração-pwa)
   - [Estratégia offline](#estratégia-offline)
22. [Suporte a Browsers e Dispositivos](#20-suporte-a-browsers-e-dispositivos)
   - [Browsers suportados](#browsers-suportados)
   - [Dispositivos testados / resoluções suportadas](#dispositivos-testados--resoluções-suportadas)
   - [Limitações conhecidas](#limitações-conhecidas)
23. [Pendências e Melhorias](#21-pendências-e-melhorias)
   - [Como usar esta seção](#como-usar-esta-seção)
24. [Glossário de Domínio](#22-glossário-de-domínio)
25. [ADRs — Decisões Arquiteturais](#23-adrs--decisões-arquiteturais)
   - [ADR-001 — Composition API com `<script setup lang="ts">`](#adr-001--composition-api-com-script-setup-langts)
   - [ADR-002 — Pinia como store global](#adr-002--pinia-como-store-global)
   - [ADR-003 — Persistência do carrinho em `localStorage`](#adr-003--persistência-do-carrinho-em-localstorage)
   - [ADR-004 — Paginação client-side em vez de virtualização](#adr-004--paginação-client-side-em-vez-de-virtualização)
   - [ADR-005 — Tailwind CSS v4 sem arquivo de configuração legado](#adr-005--tailwind-css-v4-sem-arquivo-de-configuração-legado)
   - [ADR-006 — WebSocket com fallback para polling](#adr-006--websocket-com-fallback-para-polling)
26. [Changelog](#24-changelog)
   - [[v1.5] — 30/03/2026](#v15--30032026)
   - [[v1.4] — 29/03/2026](#v14--29032026)
   - [[v1.3] — (data a preencher)](#v13--data-a-preencher)

---

## 1. Visão Geral

Frontend SPA/PWA em Vue 3 cobrindo login, dashboard, vendas, produtos, clientes, controle de estoque/caixa, funcionários, configurações e notificações. O sistema cobre o fluxo online operacional completo para caixa e gestão, com foco profundo na usabilidade do operador de caixa e na acessibilidade por teclado.

### Contexto no sistema

```
┌──────────────────────────────────────────────────────────┐
│                    PDV FiadoDigital                       │
│                                                          │
│  ┌──────────────┐     REST/WS     ┌────────────────────┐ │
│  │  apps/web    │ ◄────────────► │   apps/api         │ │
│  │  (este pkg)  │                │   (Node/Fastify)    │ │
│  │  Vue 3 SPA   │                │                    │ │
│  │  PWA         │                │  ┌──────────────┐  │ │
│  └──────────────┘                │  │  PostgreSQL   │  │ │
│                                  │  └──────────────┘  │ │
│  ┌──────────────┐                │  ┌──────────────┐  │ │
│  │  @pdv/shared │ (tipos TS)     │  │  Serv. Pix   │  │ │
│  └──────────────┘                │  └──────────────┘  │ │
│                                  └────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Escopo funcional

| Área           | Perfis com acesso        | Status  |
| :------------- | :----------------------- | :------ |
| Login          | Todos                    | Estável |
| Dashboard      | admin, manager           | Estável |
| Vendas (PDV)   | admin, manager, operator | Estável |
| Produtos       | admin, manager, stockist | Estável |
| Clientes/Fiado | admin, manager           | Estável |
| Controle       | admin                    | Estável |
| Funcionários   | admin, manager           | Estável |
| Configurações  | admin                    | Estável |
| Notificações   | admin, manager, operator | Estável |

### Características principais

- **Responsividade:** otimizado para 1024×768 (XGA) no desktop e Mobile-First em dispositivos portáteis. A sidebar é ocultada por padrão em resoluções menores, acessível via menu hamburguer. Títulos de páginas centralizados no Header.
- **PDV com foco em teclado:** atalhos F1, F2, F9, setas, +/- para operação de caixa sem uso do mouse.
- **Modo offline parcial:** persistência local do carrinho via `localStorage`. Modo offline transacional completo (fila + replay) ainda não implementado — ver [ADR-003](#adr-003--persistência-do-carrinho-em-localstorage).
- **PWA:** manifesto, service worker Workbox com `autoUpdate`, instalável em dispositivos móveis e desktop.

---

## 2. Início Rápido

### Pré-requisitos

| Ferramenta | Versão mínima | Observação                            |
| :--------- | :------------ | :------------------------------------ |
| Node.js    | 20.x LTS      | Recomendado via `nvm` ou `fnm`        |
| pnpm       | 9.x           | Gerenciador de pacotes do monorepo    |
| Docker     | 24.x          | Necessário para subir a API e o banco |

### Instalação

```bash
# Na raiz do monorepo
pnpm install

# Ou apenas o workspace web
pnpm --filter @pdv/web install
```

### Variáveis de ambiente

Copie o arquivo de exemplo e ajuste os valores:

```bash
cp apps/web/.env.example apps/web/.env.local
```

| Variável       | Obrigatória | Descrição            | Valor padrão (dev)      |
| :------------- | :---------: | :------------------- | :---------------------- |
| `VITE_API_URL` |     Sim     | URL base da API REST | `http://localhost:3000` |
| `VITE_WS_URL`  |     Sim     | URL do WebSocket     | `ws://localhost:3000`   |

> As variáveis `VITE_*` são expostas ao bundle de produção. **Nunca coloque segredos aqui.** Configurações sensíveis (chaves Pix, credenciais de nuvem) pertencem exclusivamente ao backend.

### Scripts disponíveis

| Comando           | Descrição                                      |
| :---------------- | :--------------------------------------------- |
| `pnpm dev`        | Servidor de desenvolvimento (`localhost:5173`) |
| `pnpm build`      | Build de produção em `dist/`                   |
| `pnpm preview`    | Servir o build de produção localmente          |
| `pnpm test`       | Testes unitários com Vitest (modo watch)       |
| `pnpm test:run`   | Testes unitários em modo CI (sem watch)        |
| `pnpm test:e2e`   | Testes E2E com Playwright                      |
| `pnpm lint`       | ESLint + Prettier (verificação)                |
| `pnpm lint:fix`   | ESLint + Prettier (correção automática)        |
| `pnpm type-check` | Verificação de tipos TypeScript (`vue-tsc`)    |

### Como rodar localmente (fluxo completo)

```bash
# 1. Subir a infraestrutura (API + banco) via Docker
docker compose up -d

# 2. Iniciar o frontend
pnpm --filter @pdv/web dev
```

Acesse em: `http://localhost:5173`

---

## 3. Stack e Dependências

### Dependências de produção

| Tecnologia           | Versão          | Justificativa da escolha                                                     |
| :------------------- | :-------------- | :--------------------------------------------------------------------------- |
| Vue                  | `^3.5.0`        | Composition API com `<script setup lang="ts">`; reatividade fina e SSR-ready |
| Vite                 | `^6.0.0`        | Build ultrarrápido, HMR nativo, integração direta com plugins Vue/PWA        |
| Vue Router           | `^4.4.0`        | Roteamento oficial; guards de auth/role implementados nativamente            |
| Pinia                | `^2.2.0`        | Store oficial Vue 3; substituiu Vuex; suporte nativo a TypeScript e DevTools |
| Tailwind CSS         | `^4.0.0`        | Via `@tailwindcss/vite` e `@import "tailwindcss"` — zero config legada       |
| vite-plugin-pwa      | `^0.21.0`       | Manifesto PWA e Workbox sem configuração manual de service worker            |
| vue-virtual-scroller | `2.0.0-beta.10` | Virtualização de listas para dropdowns e selects com muitos itens            |
| QRCode               | `^1.5.4`        | Renderização de QR Code para pagamento Pix                                   |
| ZXing browser        | `^0.1.5`        | Leitura de código de barras via câmera do dispositivo                        |
| ZXing library        | `^0.21.3`       | Biblioteca core de decodificação usada pelo ZXing browser                    |

### Dependências de desenvolvimento

| Tecnologia     | Versão    | Uso                                      |
| :------------- | :-------- | :--------------------------------------- |
| Vitest         | `^2.1.0`  | Testes unitários (integrado ao Vite)     |
| Vue Test Utils | `^2.4.6`  | Testes de componentes e composables Vue  |
| Playwright     | `^1.53.2` | Testes E2E — smoke de login implementado |

### Dependências internas do monorepo

| Pacote        | Tipo    | Uso                                                      |
| :------------ | :------ | :------------------------------------------------------- |
| `@pdv/shared` | Runtime | Tipos TypeScript compartilhados entre frontend e backend |

---

## 4. Estrutura de Diretórios e Convenções

### Árvore de arquivos

```text
apps/web/
├── .env.example                  # Variáveis de ambiente documentadas
├── vite.config.ts                # Configuração do Vite + PWA + proxies
├── playwright.config.ts          # Configuração E2E
├── e2e/
│   └── login-smoke.spec.ts       # Smoke test de login
└── src/
    ├── App.vue                   # Shell principal: RouterView + focus trap global
    ├── main.ts                   # Bootstrap assíncrono (restaura sessão antes do router)
    ├── assets/
    │   └── main.css              # Tokens @theme + utilitário skeleton
    ├── router/
    │   ├── index.ts              # Tabela de rotas com meta (requiresAuth, roles)
    │   └── guards.ts             # Guard de auth/role + rota padrão por perfil
    ├── stores/
    │   ├── auth.store.ts         # Sessão, token, restauração
    │   ├── customer.store.ts     # Cache de clientes com TTL
    │   ├── product.store.ts      # Cache de produtos com TTL
    │   ├── sale.store.ts         # Carrinho persistido em localStorage
    │   └── __tests__/
    │       └── auth.store.spec.ts
    ├── composables/
    │   ├── use-api.ts            # Fetch autenticado com retry de sessão
    │   ├── use-auth.ts           # Login / logout / refresh
    │   ├── use-barcode-scanner.ts # Scanner wedge (teclado) + câmera ZXing
    │   ├── use-confirm.ts        # Fluxo de confirmação assíncrona por Promise
    │   ├── use-customer-domain.ts # Regras de negócio do domínio de clientes
    │   ├── use-formatting.ts     # Máscaras: moeda, telefone, percentual, estoque
    │   ├── use-global-modal-focus-trap.ts # Focus trap global para modais
    │   ├── use-layout-state.ts   # Estado singleton do drawer mobile
    │   ├── use-modal-stack.ts    # Gerenciamento de pilha de modais (Escape)
    │   ├── use-notifications.ts  # Notificações, polling, WebSocket, toasts
    │   ├── use-pix-polling.ts    # Polling de status de pagamento Pix
    │   ├── use-pos-shortcuts.ts  # Atalhos de teclado para operação de PDV
    │   ├── use-sale-calculator.ts # Cálculo de taxas, troco, fiado, payload
    │   ├── use-sale-domain.ts    # Operações de alto nível: impressão, estorno
    │   ├── use-settings-domain.ts # Validações de configurações (Pix, Backup)
    │   ├── use-toast.ts          # Toast local simples
    │   ├── use-websocket.ts      # Conexão WS singleton com reconexão exponencial
    │   └── __tests__/
    │       ├── use-api.spec.ts
    │       ├── use-confirm.spec.ts
    │       ├── use-formatting.spec.ts
    │       ├── use-sale-calculator.spec.ts
    │       ├── use-toast.spec.ts
    │       └── use-websocket.spec.ts
    ├── components/
    │   ├── layout/               # Componentes de estrutura global (kebab-case)
    │   │   ├── app-header.vue
    │   │   ├── app-sidebar.vue
    │   │   ├── confirm-dialog.vue
    │   │   └── notification-toast-container.vue
    │   └── dashboard/            # Componentes de feature (PascalCase)
    │       ├── PaymentDonutChart.vue
    │       └── TrendBadge.vue
    └── pages/
        ├── login-page.vue
        ├── dashboard-page.vue
        ├── sales-page.vue
        ├── products-page.vue
        ├── customers-page.vue
        ├── employees-page.vue
        ├── settings-page.vue
        ├── control-page.vue
        ├── notifications-page.vue
        └── __tests__/
            └── login-page.spec.ts
```

### Convenções de nomenclatura

| Tipo de arquivo        | Convenção  | Exemplo                 | Motivo                                       |
| :--------------------- | :--------- | :---------------------- | :------------------------------------------- |
| Páginas                | kebab-case | `sales-page.vue`        | Consistência com nomes de rota               |
| Componentes de layout  | kebab-case | `app-header.vue`        | Componentes globais sem namespace de feature |
| Componentes de feature | PascalCase | `PaymentDonutChart.vue` | Alinhamento com convenção Vue oficial        |
| Composables            | kebab-case | `use-sale-domain.ts`    | Prefixo `use-` obrigatório para composables  |
| Stores                 | kebab-case | `auth.store.ts`         | Sufixo `.store` identifica o tipo            |
| Testes unitários       | kebab-case | `use-api.spec.ts`       | Mesmo nome do arquivo testado + `.spec`      |
| Variáveis de ambiente  | SCREAMING  | `VITE_API_URL`          | Convenção Vite para vars expostas ao bundle  |

> **Regra para novos componentes de feature:** use PascalCase e agrupe em subpastas por domínio dentro de `components/` (ex: `components/sales/`, `components/customers/`).

---

## 5. Bootstrap (`main.ts`)

O bootstrap é assíncrono para garantir que a sessão seja restaurada antes que o Vue Router processe qualquer navegação, evitando flicker de rota e inconsistências nos guards de autenticação.

**Sequência de inicialização:**

1. Importa `createApp`, `createPinia`, `App`, `router`, CSS global e CSS do `vue-virtual-scroller`.
2. Cria instância Pinia e aplica em `app`.
3. Inicia IIFE assíncrona para restaurar sessão antes de registrar o router.
4. Importa dinamicamente `useAuthStore`.
5. Executa `auth.tryRestoreAuth()` — chama `GET /api/auth/refresh` com cookie httpOnly.
6. Registra o `router` somente após a tentativa de restauração (com sucesso ou falha).
7. Aguarda `router.isReady()`.
8. Monta aplicação em `#app`.

> **Por que importação dinâmica do store?** Evita referência circular entre `main.ts` → `router` → `guards.ts` → `auth.store`. O import dinâmico garante que o Pinia já esteja instalado antes que qualquer store seja instanciada.

---

## 6. Configuração do Vite (`vite.config.ts`)

| Item              | Implementação atual                                                         |
| :---------------- | :-------------------------------------------------------------------------- |
| Plugins           | `vue()`, `tailwindcss()`, `VitePWA(...)`                                    |
| Alias             | `@` → `src`                                                                 |
| Dev server        | `host: 0.0.0.0`, `port: 5173`                                               |
| Proxy `/api`      | `target: process.env.API_URL \|\| http://api:3000`, `changeOrigin: true`    |
| Proxy `/ws`       | `target: process.env.WS_URL \|\| ws://api:3000`, `ws: true`                 |
| PWA registerType  | `autoUpdate`                                                                |
| PWA includeAssets | `favicon.ico`, `robots.txt`                                                 |
| Manifesto         | Nome `PDV FiadoDigital`, modo `standalone`, orientação `portrait`, 2 ícones |
| Workbox           | `globPatterns: **/*.{js,css,html,ico,png,svg,woff2}`                        |

> **Por que `0.0.0.0`?** Permite acesso ao dev server de outros dispositivos na rede local — necessário para testar a PWA em dispositivos móveis reais durante o desenvolvimento.

---

## 7. Design System

### Tokens de cor (definidos em `src/assets/main.css` via `@theme`)

| Token                   | Uso semântico                                              |
| :---------------------- | :--------------------------------------------------------- |
| `--color-primary`       | Ações principais, botões de CTA, links de navegação ativos |
| `--color-primary-light` | Estados de hover e foco em elementos primários             |
| `--color-primary-dark`  | Estados ativos/pressionados em elementos primários         |
| `--color-success`       | Confirmações, vendas concluídas, estoque suficiente        |
| `--color-warning`       | Alertas de estoque baixo, fiado próximo do limite          |
| `--color-danger`        | Erros, ações destrutivas, bloqueios de crédito             |
| `--color-surface`       | Fundo de cards, modais e painéis em modo claro             |
| `--color-surface-dark`  | Fundo de cards, modais e painéis em modo escuro            |


### Tokens de espaçamento, tipografia e layout

| Token | Valores | Escopo |
| :--- | :--- | :--- |
| `--spacing-*` | `1` a `16` (incremental) | Escala de espaçamento padrão do Tailwind baseada em `rem` |
| `--font-size-*` | `xs`, `sm`, `base`, `lg`, `xl` | Escala de tipografia principal |
| `--border-radius-*` | `sm`, `md`, `lg`, `full` | Raios de borda customizados e totais (pílula) |
| `--z-index-*` | `base` (0), `dropdown` (40), `modal` (50), `toast` (100) | Ordem de empilhamento estrutural do layout |

### Utilitários globais

| Classe / Keyframe  | Uso                                                                  |
| :----------------- | :------------------------------------------------------------------- |
| `.skeleton`        | Estado de carregamento (shimmer animado) aplicado em múltiplas telas |
| `skeleton-shimmer` | Keyframe de animação da classe `.skeleton`                           |

> **Configurações legadas ausentes (esperado):** `tailwind.config.js` e `postcss.config.js` não existem — correto para Tailwind v4 com integração via plugin Vite.

### Estratégia de acessibilidade

- **Nível alvo:** WCAG 2.1 AA.
- **Focus management:** `use-global-modal-focus-trap.ts` intercepta Tab/Shift+Tab/focusin para manter o foco dentro do modal ativo. `use-modal-stack.ts` garante que ao fechar um modal o foco retorne ao elemento gatilho correto.
- **ARIA aplicados:** `role="dialog"` em modais, `role="alert"` em mensagens de erro, `role="status"` em indicadores de carregamento. Ver seção de cada página para detalhes.
- **Teclado/POS first:** a `sales-page.vue` é a referência de implementação. Os demais domínios com modais secundários ainda precisam padronizar essa abordagem — ver **[P-A01]**.
- **Blur de dados sensíveis:** valores de fiado e saldo em `customers-page.vue` e `sales-page.vue` ocultados por padrão com toggle de visibilidade.

---

## 7. Contratos de API e Integração

### 7.1 Convenções gerais de contrato

#### Base path

- Todas as rotas seguem o padrão `/api/...`

#### Autenticação

- JWT / access token em contexto autenticado
- Refresh em cenário de expiração, quando aplicável

#### Padrão mínimo de resposta de erro

```json
{
  "error": {
    "code": "STRING_STABLE",
    "message": "Mensagem humana",
    "details": {},
    "trace_id": "optional-trace-id"
  }
}
```

#### Classificação de erros

- `AUTH_*` → autenticação/autorização
- `VALIDATION_*` → validação de entrada
- `CONFLICT_*` → conflito de estado
- `NOT_FOUND_*` → recurso ausente
- `RATE_LIMIT_*` → limitação de frequência
- `SERVER_*` → falha interna
- `NETWORK_*` → indisponibilidade de rede / timeout

#### Regras de tratamento no frontend

- 401: tentar refresh/restauração e, se falhar, redirecionar para login
- 403: bloquear ação e informar permissão insuficiente
- 404: exibir estado de ausência de dados
- 422: exibir mensagens de validação
- 500/502/503: fallback com retry ou mensagem de indisponibilidade
- timeout: fallback com aviso de conexão instável

---

### 7.2 Contrato — Autenticação

#### `POST /api/auth/login`

**Objetivo:** autenticar usuário e emitir sessão.

**Request**

```json
{
  "username": "string",
  "password": "string"
}
```

**Response 200**

```json
{
  "accessToken": "jwt-access-token",
  "user": {
    "id": "uuid",
    "name": "Usuário",
    "role": "admin"
  }
}
```

**Erros típicos**

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_USER_DISABLED`
- `VALIDATION_INVALID_PAYLOAD`
- `SERVER_UNAVAILABLE`

#### `POST /api/auth/refresh`

**Objetivo:** renovar sessão autenticada.

**Request**

```json
{
  "refreshToken": "string"
}
```

**Response 200**

```json
{
  "accessToken": "new-jwt-access-token",
  "user": {
    "id": "uuid",
    "name": "Usuário",
    "role": "manager"
  }
}
```

**Regras**

- Usado em restauração e renovação de sessão
- Em falha, o frontend deve limpar estado local de autenticação

---

### 7.3 Contrato — Dashboard

#### `GET /api/dashboard-summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

**Objetivo:** retornar métricas consolidadas do período.

**Response 200**

```json
{
  "period": {
    "start": "2026-04-01",
    "end": "2026-04-01"
  },
  "kpis": {
    "grossSalesCents": 125000,
    "netSalesCents": 114500,
    "ordersCount": 18,
    "averageTicketCents": 6944
  },
  "alerts": {
    "stockLowCount": 3,
    "creditDueCount": 2,
    "unreadNotificationsCount": 7
  }
}
```

**Erros típicos**

- `VALIDATION_INVALID_DATE_RANGE`
- `AUTH_UNAUTHORIZED`
- `SERVER_UNAVAILABLE`

---

### 7.4 Contrato — Vendas

#### `GET /api/products`

**Objetivo:** listar produtos para seleção no PDV.

**Response 200**

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Produto",
      "priceCents": 1290,
      "stock": 12
    }
  ]
}
```

#### `GET /api/customers`

**Objetivo:** listar clientes para vínculo em venda/fiado.

**Response 200**

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Cliente",
      "creditLimitCents": 50000,
      "currentDebtCents": 12000
    }
  ]
}
```

#### `POST /api/sales`

**Objetivo:** criar uma venda.

**Request**

```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPriceCents": 1290
    }
  ],
  "payments": [
    {
      "method": "pix",
      "amountCents": 2580
    }
  ],
  "customerId": "optional-uuid",
  "discountCents": 0,
  "changeCents": 0,
  "saleUuid": "client-side-idempotency-key"
}
```

**Response 201**

```json
{
  "id": "uuid",
  "saleNumber": "000123",
  "status": "completed",
  "totalCents": 2580
}
```

**Erros típicos**

- `VALIDATION_INVALID_ITEM`
- `VALIDATION_INVALID_PAYMENT_SUM`
- `CONFLICT_INSUFFICIENT_STOCK`
- `CONFLICT_CREDIT_LIMIT_EXCEEDED`
- `AUTH_PIN_REQUIRED`
- `SERVER_UNAVAILABLE`

#### `POST /api/sales/:id/cancel`

**Objetivo:** cancelar venda concluída.

**Request**

```json
{
  "reason": "string",
  "pin": "optional-string"
}
```

**Response 200**

```json
{
  "status": "cancelled"
}
```

#### `POST /api/sales/:id/refund`

**Objetivo:** estornar venda ou parte dela.

**Request**

```json
{
  "amountCents": 1000,
  "reason": "string"
}
```

**Response 200**

```json
{
  "status": "refunded",
  "refundedCents": 1000
}
```

**Observação crítica**

- O contrato de estorno deve permanecer alinhado entre frontend e backend. Qualquer campo enviado e não utilizado pelo backend deve ser tratado como divergência formal.

---

### 7.5 Contrato — Pix

#### `POST /api/pix/qrcode`

**Objetivo:** gerar cobrança Pix para pagamento.

**Request**

```json
{
  "saleId": "uuid",
  "amountCents": 2580
}
```

**Response 200**

```json
{
  "tx_id": "pix-transaction-id",
  "qrcode": "string-base64-ou-texto",
  "status": "pending"
}
```

#### `GET /api/pix/status/:tx_id`

**Objetivo:** consultar status do pagamento.

**Response 200**

```json
{
  "tx_id": "pix-transaction-id",
  "status": "paid"
}
```

**Erros típicos**

- `VALIDATION_INVALID_AMOUNT`
- `NOT_FOUND_PIX_TRANSACTION`
- `SERVER_UNAVAILABLE`

---

### 7.6 Contrato — Caixa / Cash Registers

#### `GET /api/cash-registers`

**Objetivo:** consultar caixa(s) e status operacional.

#### `POST /api/cash-registers/open`

**Objetivo:** abrir caixa.

**Request**

```json
{
  "openingAmountCents": 5000
}
```

#### `POST /api/cash-registers/close`

**Objetivo:** fechar caixa.

**Request**

```json
{
  "closingAmountCents": 18250
}
```

#### `POST /api/cash-registers/supply`

**Objetivo:** registrar suprimento.

#### `POST /api/cash-registers/withdrawal`

**Objetivo:** registrar sangria.

**Erros típicos**

- `CONFLICT_REGISTER_ALREADY_OPEN`
- `CONFLICT_REGISTER_NOT_OPEN`
- `VALIDATION_INVALID_AMOUNT`
- `AUTH_PIN_REQUIRED`

---

### 7.7 Contrato — Produtos e Estoque

#### `GET /api/products`

#### `POST /api/products`

#### `PUT /api/products/:id`

#### `DELETE /api/products/:id`

**Objetivo:** CRUD de produto.

**Request base de criação**

```json
{
  "name": "Produto",
  "barcode": "7890000000000",
  "priceCents": 1290,
  "stock": 10,
  "typeId": "uuid",
  "brandId": "uuid"
}
```

#### `PATCH /api/products/bulk-price`

**Objetivo:** atualização em massa de preço por filtro.

**Request**

```json
{
  "filter": {
    "typeId": "uuid"
  },
  "priceIncreaseMode": "percent",
  "value": 10
}
```

#### `POST /api/stock-movements/adjustment`

**Objetivo:** ajuste manual de estoque.

**Request**

```json
{
  "productId": "uuid",
  "quantity": -2,
  "reason": "string"
}
```

**Erros típicos**

- `VALIDATION_INVALID_STOCK`
- `CONFLICT_PRODUCT_NOT_FOUND`
- `AUTH_UNAUTHORIZED`

---

### 7.8 Contrato — Clientes

#### `GET /api/customers`

#### `POST /api/customers`

#### `PUT /api/customers/:id`

#### `DELETE /api/customers/:id`

**Objetivo:** CRUD de clientes.

**Request base**

```json
{
  "name": "Cliente",
  "phone": "81999999999",
  "creditLimitCents": 50000
}
```

#### `GET /api/customers/:id/fiado-history`

**Objetivo:** histórico de compras a prazo / fiado.

#### `GET /api/customers/:id/payment-history`

**Objetivo:** histórico de pagamentos/quitações.

#### `POST /api/customers/:id/pay-debt`

**Objetivo:** registrar quitação parcial ou total.

**Request**

```json
{
  "amountCents": 10000,
  "pin": "optional-string"
}
```

**Erros típicos**

- `CONFLICT_CREDIT_LIMIT_EXCEEDED`
- `VALIDATION_INVALID_AMOUNT`
- `AUTH_PIN_REQUIRED`

---

### 7.9 Contrato — Configurações

#### `GET /api/settings`

#### `PUT /api/settings`

**Objetivo:** obter e atualizar configurações gerais.

#### `GET /api/settings/pix`

#### `PUT /api/settings/pix`

**Objetivo:** configurar chave Pix e credenciais relacionadas.

**Request base**

```json
{
  "pixKey": "string",
  "pixKeyType": "cpf|email|phone|random",
  "merchantName": "string"
}
```

#### `GET /api/card-machines`

#### `POST /api/card-machines`

#### `PUT /api/card-machines/:id`

#### `DELETE /api/card-machines/:id`

**Objetivo:** gerenciar maquininhas e taxas.

**Erros típicos**

- `VALIDATION_INVALID_RATE`
- `CONFLICT_DUPLICATE_ENTRY`
- `AUTH_PIN_REQUIRED`

#### `GET /api/backups`

#### `POST /api/backups`

#### `GET /api/backups/:id`

#### `DELETE /api/backups/:id`

**Status**

- Parcial / planejado conforme o escopo da revisão original

---

### 7.10 Contrato — Controle

#### `GET /api/control/stock-summary`

#### `GET /api/control/cash-summary`

#### `GET /api/control/discount-summary`

#### `GET /api/control/cancellations`

#### `GET /api/stock-movements/:productId`

**Objetivo:** visão de controle, auditoria e histórico operacional.

---

### 7.11 Contrato — Notificações

#### `GET /api/notifications`

#### `GET /api/notifications/unread-count`

#### `PATCH /api/notifications/:id/read`

#### `PATCH /api/notifications/read-all`

#### `PATCH /api/notifications/:id/acknowledge`

#### `GET /api/notifications/export/csv`

**Objetivo:** caixa de entrada operacional, confirmação e exportação.

**Erros típicos**

- `NOT_FOUND_NOTIFICATION`
- `CONFLICT_ALREADY_READ`
- `SERVER_UNAVAILABLE`

---

### 7.12 Contrato — Impressão

#### `POST /api/print/receipt`

**Status:** divergente no estado atual do projeto.

**Observação**

- Há referência de fallback via `window.print()`
- O endpoint deve ser considerado bloqueado até confirmação formal no backend

---

## 8. Padrão de Erros do Frontend

### 8.1 Estrutura unificada de erro

Todos os consumidores de API devem considerar a seguinte forma como canônica:

```json
{
  "error": {
    "code": "VALIDATION_INVALID_AMOUNT",
    "message": "Valor inválido",
    "details": {
      "field": "amountCents"
    },
    "trace_id": "abc123"
  }
}
```

### 8.2 Tratamento por classe de erro

- **Autenticação:** limpar sessão e direcionar para login
- **Autorização:** manter rota atual e bloquear ação sensível
- **Validação:** exibir mensagem no contexto do campo ou do formulário
- **Conflito:** impedir duplicidade e orientar correção
- **Ausência de recurso:** exibir estado vazio
- **Falha de rede:** mostrar indisponibilidade e sugerir nova tentativa
- **Falha de servidor:** preservar estado do usuário e informar erro genérico

### 8.3 Erros críticos do domínio

- Venda com item inválido
- Venda com soma de pagamentos inconsistente
- Estoque insuficiente
- Limite de fiado excedido
- PIN inválido
- Caixa não aberto
- Sessão expirada

---

## 8. Segurança Frontend

### Armazenamento de tokens

| Item                 | Decisão atual                                                   |
| :------------------- | :-------------------------------------------------------------- |
| `accessToken`        | Mantido **em memória** (estado Pinia — `auth.store.ts`)         |
| Cookie de refresh    | `httpOnly`, gerenciado pelo backend — inacessível ao JavaScript |
| Dados do carrinho    | `localStorage` — sem dados sensíveis; apenas IDs e quantidades  |
| Filtros do dashboard | `localStorage` — sem dados sensíveis; apenas preferências de UI |

> **Risco residual:** dados do usuário logado (`User`) ficam em memória Pinia. Um reload completo da página dispara `tryRestoreAuth()` via cookie httpOnly. Não há token JWT exposto no `localStorage`.

### Sanitização e validação de inputs

- Todos os campos monetários passam por `use-formatting.ts` antes de envio à API (parse para centavos, sem valores negativos).
- Chave Pix: validada por `use-settings-domain.ts` com `sanitizePixKeyInput` e `validatePixKey` antes do PUT.
- Campos de texto livre (nomes, observações): sanitização delegada ao backend — o frontend não aplica sanitização HTML adicional pois não renderiza HTML de dados do usuário.

### Pontos de atenção ativos

| Risco                         | Status atual                                                      |
| :---------------------------- | :---------------------------------------------------------------- |
| XSS via dados de API          | Mitigado — Vue escapa bindings por padrão; sem uso de `v-html`    |
| CSRF                          | Mitigado — API usa cookie `SameSite=Strict` + validação de Origin |
| Exposição de custo de produto | Controlada por flag `can_view_cost_price` por usuário (backend)   |
| PIN de funcionário em memória | PIN enviado diretamente ao endpoint de validação; não persistido  |
| Dados de backup em nuvem      | Criptografados antes do upload — chave gerenciada pelo backend    |

---

## 9. Roteamento e Autenticação

### 9.1 Tabela de rotas

| Path             | Nome            | Componente                     | requiresAuth | Roles permitidas               |
| :--------------- | :-------------- | :----------------------------- | :----------: | :----------------------------- |
| `/login`         | `login`         | `pages/login-page.vue`         |     Não      | —                              |
| `/`              | `dashboard`     | `pages/dashboard-page.vue`     |     Sim      | `admin`, `manager`             |
| `/sales`         | `sales`         | `pages/sales-page.vue`         |     Sim      | `admin`, `manager`, `operator` |
| `/products`      | `products`      | `pages/products-page.vue`      |     Sim      | `admin`, `manager`, `stockist` |
| `/customers`     | `customers`     | `pages/customers-page.vue`     |     Sim      | `admin`, `manager`             |
| `/employees`     | `employees`     | `pages/employees-page.vue`     |     Sim      | `admin`, `manager`             |
| `/settings`      | `settings`      | `pages/settings-page.vue`      |     Sim      | `admin`                        |
| `/control`       | `control`       | `pages/control-page.vue`       |     Sim      | `admin`                        |
| `/notifications` | `notifications` | `pages/notifications-page.vue` |     Sim      | `admin`, `manager`, `operator` |

### 9.2 Comportamento dos guards (`guards.ts`)

| Situação                               | Comportamento                        |
| :------------------------------------- | :----------------------------------- |
| Rota pública + usuário autenticado     | Redireciona para rota padrão da role |
| Rota pública + usuário não autenticado | Permite acesso                       |
| Rota privada + não autenticado         | Redireciona para `/login`            |
| Rota privada + role sem permissão      | Redireciona para rota padrão da role |
| Rota privada + role permitida          | Permite acesso                       |

### 9.3 Rota padrão por perfil

| Role       | Rota padrão | Justificativa                                     |
| :--------- | :---------- | :------------------------------------------------ |
| `admin`    | `/`         | Acesso completo; dashboard é o ponto central      |
| `manager`  | `/`         | Visão gerencial como tela inicial                 |
| `stockist` | `/products` | Perfil focado em gestão de produtos e estoque     |
| `operator` | `/sales`    | Perfil focado exclusivamente em operação de caixa |

### 9.4 Fluxo de autenticação

```
App inicia
  └─► tryRestoreAuth()
        ├─► POST /api/auth/refresh (cookie httpOnly)
        │     ├─ Sucesso → setAuth({ token, user }) → registra router → monta app
        │     └─ Falha  → clearAuth() → registra router → monta app
        └─► Guard avalia rota inicial
              ├─ Autenticado → rota padrão da role
              └─ Não autenticado → /login
```

---

## 10. Gerenciamento de Estado — Stores Pinia

### `auth.store.ts`

**Responsabilidade:** sessão do usuário, token de acesso e controle de restauração de sessão.

| Categoria        | Item                      | Tipo / Descrição                                          |
| :--------------- | :------------------------ | :-------------------------------------------------------- |
| Estado           | `accessToken`             | `string \| null` — token JWT em memória                   |
| Estado           | `user`                    | `User \| null` — dados do usuário logado                  |
| Estado           | `isRestoringSession`      | `boolean` — bloqueia guards durante restauração           |
| Estado (interno) | `restoreAuthPromise`      | Controle de corrida para chamadas concorrentes de restore |
| Getter           | `isAuthenticated`         | `boolean` — derivado de `accessToken !== null`            |
| Action           | `setAuth(payload)`        | Atualiza token e user no estado                           |
| Action           | `clearAuth()`             | Limpa token, user e redireciona para login                |
| Action           | `tryRestoreAuth()`        | Chama `GET /api/auth/refresh`; idempotente por promise    |
| Dependência      | `fetch /api/auth/refresh` | Endpoint de refresh via cookie httpOnly                   |
| Dependência      | `@pdv/shared`             | Tipo `User`                                               |

### `customer.store.ts`

**Responsabilidade:** cache de clientes com TTL para evitar refetches desnecessários.

| Categoria   | Item                               | Tipo / Descrição                                   |
| :---------- | :--------------------------------- | :------------------------------------------------- |
| Estado      | `customers`                        | `Customer[]`                                       |
| Estado      | `lastFetchedAt`                    | `Date \| null` — timestamp do último fetch       |
| Estado      | `loading`                          | `boolean`                                          |
| Estado      | `error`                            | `string \| null`                                   |
| Constante   | `CACHE_TTL_MS`                     | `60000` (1 minuto)                                 |
| Action      | `fetchIfStale(authenticatedFetch, force)` | Busca dados se o cache expirou ou forçado   |
| Action      | `invalidate()`                     | Força refetch na próxima chamada de `fetchIfStale` |
| Dependência | `useApi.authenticatedFetch`        | Injetado via parâmetro para testabilidade          |

### `product.store.ts`

**Responsabilidade:** cache de produtos com TTL — estrutura idêntica ao `customer.store.ts`.

| Categoria | Item                               | Tipo / Descrição                 |
| :-------- | :--------------------------------- | :------------------------------- |
| Estado    | `products`                         | `Product[]`                      |
| Estado    | `lastFetchedAt`                    | `Date \| null`                   |
| Estado    | `loading`                          | `boolean`                        |
| Estado    | `error`                            | `string \| null`                 |
| Constante | `CACHE_TTL_MS`                     | `60000` (1 minuto)               |
| Action    | `fetchIfStale(authenticatedFetch, force)` | Busca dados se o cache expirou ou forçado |
| Action    | `invalidate()`                     | Força refetch na próxima chamada |

### `sale.store.ts`

**Responsabilidade:** estado transacional do carrinho, persistido em `localStorage` para sobreviver a reloads acidentais durante uma venda em andamento.

| Categoria   | Item                                                    | Tipo / Descrição                                        |
| :---------- | :------------------------------------------------------ | :------------------------------------------------------ |
| Estado      | `items`                                                 | Itens do carrinho — **persistido em `localStorage`**    |
| Estado      | `discountCentsState`                                    | Desconto aplicado em centavos                           |
| Estado      | `saleUuid`                                              | UUID da venda em curso (gerado via `generateUUID()`)    |
| Constante   | `STORAGE_KEY`                                           | `"pdv-sale-cart"`                                       |
| Getter      | `subtotalCents`                                         | Soma dos itens sem desconto                             |
| Getter      | `discountCents`                                         | Desconto resolvido (máximo: subtotal)                   |
| Getter      | `totalCents`                                            | `subtotalCents - discountCentsState`                    |
| Action      | `addItem / removeItem / updateItemQuantity / clearCart` | Mutações do carrinho                                    |
| Action      | `applyChangeDiscount / removeChangeDiscount`            | Gestão de desconto de troco                             |
| Action      | `buildPayload`                                          | Monta `CreateSalePayload` para envio à API              |
| Efeito      | `persistState` (`watch`)                                | Sincroniza estado para o `localStorage` automaticamente |
| Efeito      | `loadPersistedState`                                    | Resgata estado do `localStorage` na inicialização       |
| Dependência | `@pdv/shared`                                           | Tipos `CreateSalePayload`, `SalePayment`                |

---

## 11. Tipos Compartilhados — `@pdv/shared`

O pacote `@pdv/shared` é o contrato de tipos entre `apps/web` e `apps/api`. Os tipos principais consumidos pelo frontend são:

| Tipo                | Campos principais                                                                     | Usado em                         |
| :------------------ | :------------------------------------------------------------------------------------ | :------------------------------- |
| `User`              | `id`, `name`, `role`, `can_view_cost_price`                                           | `auth.store`, guards, sidebar    |
| `Customer`          | `id`, `name`, `phone`, `credit_limit`, `current_balance`, `is_blocked`                | `customer.store`, customers-page |
| `Product`           | `id`, `name`, `sku`, `price_cents`, `cost_cents`, `stock_quantity`, `product_type_id` | `product.store`, products-page   |
| `CreateSalePayload` | `uuid`, `customer_id?`, `items[]`, `payments[]`, `discount_cents`                     | `sale.store.buildPayload`        |
| `SalePayment`       | `method`, `amount_cents`, `card_machine_id?`, `installments?`                         | `use-sale-calculator`            |

> Consulte `packages/shared/src/types/` para a definição completa e atualizada de cada tipo.

---

## 12. Composables

Cada composable tem uma responsabilidade única e é testável de forma isolada. A injeção de dependências externas (ex: `authenticatedFetch`) é feita por parâmetro, não por import direto, garantindo testabilidade.

---

### `use-api.ts`

**Responsabilidade:** fetch autenticado com retry automático de sessão em caso de 401.

**API pública:** `authenticatedFetch(url, options)`

**Comportamento em erros:**

- Se o token estiver ausente, tenta restaurar sessão antes de fazer a requisição.
- Em resposta 401, tenta refresh uma única vez.
- Se o refresh falhar, chama `clearAuth()` e redireciona para `/login`.

**Exemplo de uso:**

```typescript
const { authenticatedFetch } = useApi();
const data = await authenticatedFetch("/api/customers");
```

---

### `use-auth.ts`

**Responsabilidade:** operações de autenticação (login, logout, refresh de token).

**API pública:** `login(credentials)`, `logout()`, `refreshToken()`

**Comportamento em erros:**

- JSON inválido na resposta de login é tratado como indisponibilidade do servidor (mensagem amigável).
- Logout limpa o estado local mesmo se a chamada remota falhar.

**Exemplo de uso:**

```typescript
const { login, logout } = useAuth();
await login({ username: "operador", password: "***" });
```

---

### `use-confirm.ts`

**Responsabilidade:** fluxo de confirmação assíncrona por Promise — evita callbacks aninhados.

**API pública:** `confirm(options)`, `onConfirm()`, `onCancel()`, refs de estado (`isOpen`, `title`, `message`)

**Exemplo de uso:**

```typescript
const { confirm } = useConfirm();
const ok = await confirm({
  title: "Cancelar venda?",
  message: "Esta ação não pode ser desfeita.",
});
if (ok) {
  /* prosseguir com cancelamento */
}
```

---

### `use-formatting.ts`

**Responsabilidade:** normalização e máscaras de entrada — ponto único de formatação para toda a aplicação.

**API pública:** `formatCurrency(cents)`, `parseCurrencyToCents(str)`, `formatPhone(str)`, `parsePhone(str)`, `formatPercentage(value)`, `parsePercentage(str)`, `formatStock(qty)`

**Comportamento em erros:**

- Entradas vazias ou inválidas retornam placeholders previsíveis (`"R$ 0,00"`, `""`, `0`).
- Parse de centavos tem fallback seguro para `0` (nunca retorna `NaN` ou `null`).

**Exemplo de uso:**

```typescript
const { formatCurrency, parseCurrencyToCents } = useFormatting();
formatCurrency(1500); // → "R$ 15,00"
parseCurrencyToCents("15,00"); // → 1500
```

---

### `use-global-modal-focus-trap.ts`

**Responsabilidade:** trap global de foco para garantir que Tab/Shift+Tab não saiam do modal visível no topo da stack.

**API pública:** `useGlobalModalFocusTrap()` — inicializado em `App.vue`; sem necessidade de uso direto nas páginas.

---

### `use-layout-state.ts`

**Responsabilidade:** estado singleton do drawer mobile (menu hamburguer).

**API pública:** `mobileMenuOpen` (ref), `openMobileMenu()`, `closeMobileMenu()`

---

### `use-notifications.ts`

**Responsabilidade:** ciclo de vida completo das notificações — fetch, contagem de não lidas, toasts, polling como fallback e integração com WebSocket.

**API pública:**

- `fetchUnreadCount()`, `fetchNotifications()`, `fetchRecentNotifications()`
- `markAsRead(id)`, `markAllRead()`, `acknowledge(id)`, `exportCsv()`
- `dismissToast(id)`, `handleWebSocketMessage(msg)`, `startPolling()`, `stopPolling()`, `initWsWatcher()`

**Comportamento em erros:**

- Usa singleton global via `globalThis` para evitar múltiplas instâncias.
- Degrada para polling quando o WebSocket desconecta.

---

### `use-sale-calculator.ts`

**Responsabilidade:** cálculos financeiros da venda — taxas de cartão, troco, validação de limite de fiado e montagem de payload.

**API pública:** `calcCardRate(baseRate, incrementalRate, installments)`, `applyCardFee(totalCents, ratePercent)`, `calcChange(paidCents, totalCents, discountCents)`, `validateFiadoCredit(creditLimitCents, currentDebtCents, totalCents)`, `buildSalePayload(params: BuildSalePayloadParams)`

**Comportamento em erros:**

- Parcelas normalizadas para mínimo de 1 via `Math.max`.
- Troco nunca retorna valor negativo via `Math.max(0, ...)`.
- Na função `buildSalePayload`, se houver excesso pago (ex: troco), o valor é automaticamente deduzido da parcela em dinheiro (`cash`), se existir, garantindo a consistência estrita do payload enviado.

**Exemplo de uso:**

```typescript
const { calcChange, validateFiadoCredit } = useSaleCalculator();
const change = calcChange(5000, 4250, 0); // → 750 (centavos de troco)
const valid = validateFiadoCredit(50000, 10000, 80000); // → { valid: false, availableCents: 40000 }
```

---

### `use-offline-queue.ts`

**Responsabilidade:** fila transacional para vendas realizadas sem conexão. Garante o armazenamento e o reenvio automático assim que a rede estabiliza.

**API pública:** `enqueue(payload)`, `flushQueue()`, `queueLength` (ref), `isSyncing` (ref)

**Comportamento em erros:**

- Vendas salvas em `localStorage` persistem entre sessões/reboots.
- Idempotência garantida via `saleUuid` — se o servidor já processou a venda, a fila ignora o erro 409 e remove o item.
- Replay automático disparado pelo `watch` no `isOnline`.

**Exemplo de uso:**

```typescript
const { enqueue } = useOfflineQueue();
if (!isOnline.value) {
  enqueue(salePayload);
}
```

---

### `use-toast.ts`

**Responsabilidade:** toast local simples para feedback pontual de interações.

**API pública:** `toast(message, type, duration?)`, refs `toastMessage`, `toastType`, `toastVisible`

**Comportamento em erros:** cancela timeout anterior antes de exibir novo toast, evitando sobreposição.

---

### `use-barcode-scanner.ts`

**Responsabilidade:** leitura de código de barras via buffer de teclado (scanner wedge USB) e via câmera (ZXing).

**API pública:** `isScanning` (ref), `cameraError` (ref), `openScanner()`, `closeScanner()`

**Exemplo de uso:**

```typescript
const { isScanning, openScanner, closeScanner } = useBarcodeScanner();
openScanner((code) => addProductByBarcode(code));
```

---

### `use-customer-domain.ts`

**Responsabilidade:** regras de negócio e formatação de mensagens do domínio de clientes.

**API pública:** `buildWhatsAppChargeMessage(customer, template)`, `buildCustomerPayload(formData)`, `getPaymentHistoryTypeLabel(type)`

---

### `use-modal-stack.ts`

**Responsabilidade:** gerenciamento de pilha de modais — garante fechamento ordenado via Escape e retorno de foco correto.

**API pública:** `useModalStack(modalArray, options)`

**Exemplo de uso:**

```typescript
useModalStack([
  { isOpen: showModal, close: closeModal },
  { isOpen: showPaymentModal, close: closePaymentModal },
], { listenEscape: true });
```

**Páginas adotantes:** `sales-page.vue`, `settings-page.vue`, `customers-page.vue`, `employees-page.vue`, `dashboard-page.vue`, `control-page.vue`, `products-page.vue` (100% de adoção alcançada).

---

### `use-pix-polling.ts`

**Responsabilidade:** polling de status de pagamento Pix até confirmação ou timeout.

**API pública:** `startPolling(txId)`, `stopPolling()`, `status` (ref: `pending | confirmed | failed`), `error` (ref)

---

### `use-pos-shortcuts.ts`

**Responsabilidade:** mapeamento de atalhos de teclado para operações de PDV.

**API pública:** `handlePOSKeydown(event)` — conectado ao listener global de `keydown` na `sales-page.vue`.

| Tecla    | Ação                                       |
| :------- | :----------------------------------------- |
| `F1`     | Abrir modal de pagamento                   |
| `F2`     | Focar campo de busca de produto            |
| `F9`     | Limpar carrinho / nova venda               |
| `+`      | Incrementar quantidade do item selecionado |
| `-`      | Decrementar quantidade do item selecionado |
| `Delete` | Remover item selecionado do carrinho       |

---

### `use-sale-domain.ts`

**Responsabilidade:** operações de alto nível da venda — impressão de recibo e estorno.

**API pública:** `resolvePaymentMethod(rows, mixedMethodValue)`, `requestReceiptPrint(payload, onFallbackVisible)`

> **Atenção:** `requestReceiptPrint` não consome endpoint de API (o payload é ignorado); a função utiliza `window.print()` nativamente como fluxo oficial, emitindo aviso do fallback caso necessário.

---

### `use-settings-domain.ts`

**Responsabilidade:** validações e parse de campos de configuração sensíveis.

**API pública:** `sanitizePixKeyInput(raw, type)`, `validatePixKey(key, type)`, `parseRateInput(str)`

---

### `use-websocket.ts`

**Responsabilidade:** conexão WebSocket singleton com reconexão exponencial + jitter.

**API pública:** `isConnected` (ref), `isOnline` (ref), `connectionWarning` (ref), `lastMessage` (ref)

**Comportamento em erros:**

- Limite máximo de tentativas de reconexão.
- Fallback de estado quando desconectado.
- Emite eventos para atualização em tempo real de dashboard e estoque.

---

## 13. Componentes de Layout

### `app-header.vue`

**Responsabilidade:** barra superior global com status de conectividade, notificações e logout.

| Aspecto       | Detalhe                                                                                            |
| :------------ | :------------------------------------------------------------------------------------------------- |
| Estado/lógica | Status online/offline via `use-websocket`; unread count via `use-notifications`; loading no logout |
| Desktop       | Dropdown de notificações inline                                                                    |
| Mobile        | Painel fullscreen de notificações com interações por toque                                         |

### `app-sidebar.vue`

**Responsabilidade:** navegação lateral filtrada por perfil do usuário.

| Aspecto       | Detalhe                                                                                 |
| :------------ | :-------------------------------------------------------------------------------------- |
| Estado/lógica | Itens de menu filtrados pela `role` do usuário; estado do drawer via `use-layout-state` |
| Desktop       | Sidebar fixa, sempre visível                                                            |
| Mobile        | Drawer deslizante com backdrop, acessado pelo menu hamburguer do header                 |

### `confirm-dialog.vue`

**Responsabilidade:** modal reutilizável de confirmação de ações destrutivas.

| Aspecto        | Detalhe                                                   |
| :------------- | :-------------------------------------------------------- |
| Props          | `open`, `title`, `message`, `confirmLabel`, `cancelLabel` |
| Emits          | `confirm`, `cancel`                                       |
| Acessibilidade | `role="dialog"`, `aria-modal="true"`, focus trap ativo    |
| Responsividade | Modal central responsivo com scroll interno               |

### `notification-toast-container.vue`

**Responsabilidade:** fila de toasts globais de notificação, incluindo notificações críticas com botão de ação.

| Aspecto        | Detalhe                                                                     |
| :------------- | :-------------------------------------------------------------------------- |
| Estado/lógica  | Fila de toasts via `use-notifications`; ação de `acknowledge` para críticas |
| Responsividade | Fixo no canto inferior; layout adaptado para viewport estreita              |

---

## 14. Páginas

Cada página documenta: estado reativo principal, funcionalidades implementadas, endpoints consumidos e UX/acessibilidade.

---

### `login-page.vue`

**Estado reativo:** `username`, `password`, `loading`, `error`

**Funcionalidades:**

| Área  | Implementação                   | Detalhe                                     |
| :---- | :------------------------------ | :------------------------------------------ |
| Login | Formulário com submit e loading | Usa `useAuth().login`                       |
| Erros | Mensagem amigável ao usuário    | Fallback para mensagem de indisponibilidade |

**Endpoints:** `POST /api/auth/login`

**UX/Acessibilidade:** formulário semântico, `autocomplete` adequado por campo, `role="alert"` para mensagem de erro.

---

### `dashboard-page.vue`

**Estado reativo:**

| Grupo   | Variáveis principais                                                      |
| :------ | :------------------------------------------------------------------------ |
| Dados   | `summary`, `loading`, `error`                                             |
| Filtros | Período (hoje/ontem/semana/mês/customizado), persistido em `localStorage` |
| UI      | Toggles de visibilidade de métricas por perfil                            |

**Funcionalidades:**

| Área            | Implementação                                             | Detalhe                          |
| :-------------- | :-------------------------------------------------------- | :------------------------------- |
| KPIs            | Cards com métricas operacionais e financeiras             | Depende de `dashboard-summary`   |
| Alertas         | Seções para estoque baixo, fiado e notificações pendentes | Atualiza por polling/WS          |
| Visualização    | Donut chart (`PaymentDonutChart`) e badges de tendência   | Drill-down para controle/caixa   |
| Modos de perfil | Gerente (KPIs completos) vs Operador (caixa e vendas)     | Toggle de privacidade de valores |

**Endpoints:**

- `GET /api/dashboard-summary?start_date=...&end_date=...` (com cache na sessão via `sessionStorage`)
- Notificações e unread count via `use-notifications`
- WebSocket: auto-refresh em eventos `stock.low_alert` e `notification.new`

**UX/Acessibilidade:** skeletons de carregamento, fallback de erro, `role="alert"` e `role="status"` aplicados.

---

### `sales-page.vue`

**Estado reativo:**

| Grupo     | Variáveis principais                                |
| :-------- | :-------------------------------------------------- |
| Carrinho  | Itens, subtotal, desconto, total (via `sale.store`) |
| Pagamento | Método, valores, parcelas, troco, maquininha        |
| Caixa     | Estado de caixa aberto, sangria, suprimento         |
| Pix       | QR Code gerado, `tx_id`, status de polling          |
| Cliente   | Cliente selecionado para fiado                      |
| Modais    | Cancelamento, estorno, validação de PIN, recibo     |

**Funcionalidades:**

| Área               | Implementação                                                                 | Detalhe                                 |
| :----------------- | :---------------------------------------------------------------------------- | :-------------------------------------- |
| PDV (Caixa rápido) | Atalhos de teclado avançados, layout compacto, resolução inteligente de nomes | Persistência via `sale.store`           |
| Pagamento misto    | Até 2 meios simultâneos com auto-cálculo de diferença e taxas de maquininha   | Via modal de pagamento                  |
| Pix                | Geração de QR Code e consulta de status                                       | Polling por `tx_id`                     |
| Fiado              | Validação de limite e verificação de bloqueio                                 | Depende de resposta da API              |
| Operação de caixa  | Abrir / fechar / sangria / suprimento                                         | Rotas `cash-registers`                  |
| Scanner            | Teclado wedge + câmera ZXing                                                  | Fallback para entrada manual            |
| Impressão          | Fallback oficial com `window.print()`                                    | Nativo do navegador |

**Endpoints:**

- `GET/POST /api/cash-registers*`
- `GET /api/products`
- `GET /api/customers`
- `POST /api/sales`
- `POST /api/sales/:id/cancel`
- `POST /api/sales/:id/refund`
- `POST /api/auth/validate-pin`
- `POST /api/pix/qrcode`
- `GET /api/pix/status/:tx_id`


**UX/Acessibilidade:** atalhos de teclado documentados em `use-pos-shortcuts`; foco gerenciado por `use-modal-stack`; toasts de feedback por operação.

---

### `products-page.vue`

**Estado reativo:**

| Grupo    | Variáveis principais                                                       |
| :------- | :------------------------------------------------------------------------- |
| Listagem | Produtos, tipos, marcas; filtros e ordenação                               |
| Modais   | Criar/editar produto, criar/editar tipo, preço em lote, entrada de estoque |
| UI       | Loading, erros, toasts                                                     |

**Funcionalidades:**

| Área           | Implementação                                              | Detalhe                              |
| :------------- | :--------------------------------------------------------- | :----------------------------------- |
| CRUD produto   | Listagem paginada (5/10/20/50 itens), criar/editar/remover | Inclui validações e campos de margem |
| Tipos e marcas | Gerenciamento inline com paginação                         | Endpoints dedicados                  |
| Preço em lote  | Patch por filtro de categoria/tipo                         | Endpoint `bulk-price`                |
| Estoque        | Ajuste manual e entrada de estoque                         | Integra `stock-movements`            |

**Endpoints:**

- `GET/POST/PUT/DELETE /api/products`
- `PATCH /api/products/bulk-price`
- `GET/POST/PUT/DELETE /api/product-types`
- `GET/POST/PUT/DELETE /api/brands`
- `POST /api/stock-movements/adjustment`

**UX/Acessibilidade:** tabela no desktop; cards no mobile; feedback visual por estado de operação.

---

### `customers-page.vue`

**Estado reativo:**

| Grupo       | Variáveis principais                                 |
| :---------- | :--------------------------------------------------- |
| Clientes    | Listagem, filtros, paginação                         |
| Fiado       | Histórico de compras e pagamentos segmentados        |
| Pagamento   | Modal de quitação parcial/total com validação de PIN |
| Privacidade | Toggle de blur de valores financeiros                |

**Funcionalidades:**

| Área               | Implementação                                                          | Detalhe                            |
| :----------------- | :--------------------------------------------------------------------- | :--------------------------------- |
| CRUD cliente       | Listagem paginada client-side; criar/editar/remover                    | Controle de limite e bloqueio      |
| Histórico de fiado | Compras e pagamentos em timeline paginada                              | Mobile-first com cards expansíveis |
| Mobile UX          | FAB para cadastro, cards expansíveis com ações rápidas                 | Otimizado para toque               |
| Cobrança WhatsApp  | Integração com 4 templates nativos (vencido, a vencer, parcial, total) | Depende de configurações ativas    |
| Quitação           | Parcial ou total com confirmação de PIN                                | Gera transação financeira          |

**Endpoints:**

- `GET/POST/PUT/DELETE /api/customers`
- `GET /api/customers/:id/fiado-history`
- `GET /api/customers/:id/payment-history`
- `POST /api/customers/:id/pay-debt`
- `GET /api/settings` (para templates de WhatsApp)

**UX/Acessibilidade:** containers com `overflow-x-hidden`; padding inferior para nav mobile; blur de dados sensíveis com focus trap nos modais. Lacuna ativa: expansão do foco em modais secundários — ver **P-A01**.

---

### `control-page.vue`

**Estado reativo:**

| Grupo   | Variáveis principais                      |
| :------ | :---------------------------------------- |
| Estoque | Resumo, filtros, histórico por produto    |
| Caixa   | Resumo financeiro, diferenças por período |
| Ajustes | Formulário de ajuste manual de estoque    |
| Logs    | Listagem de cancelamentos e estornos      |

**Funcionalidades:**

| Área      | Implementação                                             | Detalhe                     |
| :-------- | :-------------------------------------------------------- | :-------------------------- |
| Estoque   | Dashboard de controle + histórico paginado (5 a 50 itens) | Por produto                 |
| Caixa     | Resumo e monitoramento financeiro                         | Filtrável por período       |
| Ajuste    | Ajuste manual de estoque com confirmação                  | Endpoint restrito a `admin` |
| Auditoria | Listagem de cancelamentos e estornos                      | Suporte a ação gerencial    |

**Endpoints:**

- `GET /api/product-types`
- `GET /api/brands`
- `GET /api/control/stock-summary`
- `GET /api/control/cash-summary`
- `GET /api/control/discount-summary`
- `GET /api/control/cancellations`
- `GET /api/stock-movements/:productId`
- `POST /api/stock-movements/adjustment`

**UX/Acessibilidade:** skeletons; cards mobile; modais com `role="dialog"`.

---

### `employees-page.vue`

**Estado reativo:**

| Grupo      | Variáveis principais                       |
| :--------- | :----------------------------------------- |
| Usuários   | Lista de funcionários                      |
| Formulário | Criar/editar/toggle ativo                  |
| UI         | Loading, confirmações de ações destrutivas |

**Funcionalidades:**

| Área            | Implementação                            | Detalhe                              |
| :-------------- | :--------------------------------------- | :----------------------------------- |
| Gestão          | Criar/editar/desativar funcionários      | Focado em perfis operator e stockist |
| Permissão custo | Toggle `can_view_cost_price` por usuário | Perfilado individualmente            |

**Endpoints:** `GET/POST/PUT /api/users` (remoção não é via DELETE direto, mas toggle de status na própria atualização)

**UX/Acessibilidade:** modal com navegação por teclado e confirmação de ações sensíveis.

---

### `settings-page.vue`

**Estado reativo:**

| Grupo         | Variáveis principais                                 |
| :------------ | :--------------------------------------------------- |
| Tabs          | Seção ativa e subtabs                                |
| Pix           | Chave, tipo, merchant e senha de confirmação         |
| Maquininhas   | Lista de máquinas e taxas por bandeira               |
| Fiado/alertas | Thresholds e flags de comportamento                  |
| WhatsApp      | 4 templates com placeholders e previews              |
| Backup        | Frequência, retenção, destino em nuvem, criptografia |

**Funcionalidades:**

| Área                 | Implementação                                          | Detalhe                                     |
| :------------------- | :----------------------------------------------------- | :------------------------------------------ |
| Configurações gerais | Update de limites e alertas                            | Inclui chaves dinâmicas por tipo de produto |
| Pix                  | Leitura/update com confirmação por senha               | Endpoint dedicado                           |
| Maquininhas          | CRUD completo e taxas por bandeira                     | Integra `/api/card-machines`                |
| Alertas              | Configuração percentual por tipo de produto            | Depende de contrato com backend             |
| WhatsApp             | 4 templates com abas virtuais e previews em tempo real | Templates: total, parcial, prazo, vencido   |
| Backup               | Frequência, retenção, destino em nuvem e criptografia  | Aba "Backup" dedicada                       |

**Endpoints:**

- `GET/PUT /api/settings`
- `GET/PUT /api/settings/pix`
- `GET/POST/PUT/DELETE /api/card-machines`
- `GET /api/backups/history`, `POST /api/backups/generate`, `POST /api/backups/restore`
- `GET /api/product-types` e `GET /api/products` (para verificação dinâmica de itens limitados por `kg` ou `unidade`)

**UX/Acessibilidade:** formulários extensos com máscaras e validações via `use-settings-domain`; responsivo com cards e tabelas.

---

### `notifications-page.vue`

**Estado reativo:**

| Grupo     | Variáveis principais                               |
| :-------- | :------------------------------------------------- |
| Listagem  | Itens, página atual, filtros ativos e busca        |
| Operações | Marcar lida/todas, confirmar notificações críticas |
| Export    | Estado de exportação CSV                           |

**Funcionalidades:**

| Área   | Implementação                                | Detalhe                               |
| :----- | :------------------------------------------- | :------------------------------------ |
| Inbox  | Lista com filtros por status e paginação     | Gerenciado por `use-notifications`    |
| Ações  | Marcar como lida / todas; confirmar críticas | Respeitando severidade da notificação |
| Export | CSV de notificações filtradas                | Via endpoint de export                |

**Endpoints:**

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`
- `PATCH /api/notifications/:id/acknowledge`
- `GET /api/notifications/export/csv`

**UX/Acessibilidade:** `role="alert"` e `role="status"` para notificações; filtros por tab acessíveis via teclado.

---

## 15. Contrato de Integração com API

Índice centralizado de todos os endpoints consumidos pelo frontend. Para o contrato completo de cada endpoint (schema de request/response), consulte a documentação do `apps/api`.

| Endpoint                             | Método(s)             | Consumido por                                    | Observação                                 |
| :----------------------------------- | :-------------------- | :----------------------------------------------- | :----------------------------------------- |
| `/api/auth/login`                    | `POST`                | `use-auth`                                       |                                            |
| `/api/auth/refresh`                  | `GET`                 | `auth.store` (bootstrap)                         |                                            |
| `/api/auth/validate-pin`             | `POST`                | `sales-page`, `customers-page`                   | Confirmação de ações financeiras           |
| `/api/dashboard-summary`             | `GET`                 | `dashboard-page`                                 | Query params: `start_date`, `end_date`     |
| `/api/products`                      | `GET/POST/PUT/DELETE` | `product.store`, `products-page`, `sales-page`   |                                            |
| `/api/products/bulk-price`           | `PATCH`               | `products-page`                                  | Update de preço em lote por filtro         |
| `/api/product-types`                 | `GET/POST/PUT/DELETE` | `products-page`, `settings-page`                 |                                            |
| `/api/brands`                        | `GET/POST/PUT/DELETE` | `products-page`                                  |                                            |
| `/api/customers`                     | `GET/POST/PUT/DELETE` | `customer.store`, `customers-page`, `sales-page` |                                            |
| `/api/customers/:id/fiado-history`   | `GET`                 | `customers-page`                                 |                                            |
| `/api/customers/:id/payment-history` | `GET`                 | `customers-page`                                 |                                            |
| `/api/customers/:id/pay-debt`        | `POST`                | `customers-page`                                 | Requer PIN                                 |
| `/api/sales`                         | `POST`                | `sales-page`                                     |                                            |
| `/api/sales/:id/cancel`              | `POST`                | `sales-page`                                     | Requer PIN                                 |
| `/api/sales/:id/refund`              | `POST`                | `sales-page`                                     | Payload atualizado (removido `receiptId`)  |
| `/api/cash-registers`                | `GET/POST`            | `sales-page`                                     | Abertura/fechamento de caixa               |
| `/api/cash-registers/:id/close`      | `POST`                | `sales-page`                                     |                                            |
| `/api/cash-registers/:id/sangria`    | `POST`                | `sales-page`                                     |                                            |
| `/api/cash-registers/:id/suprimento` | `POST`                | `sales-page`                                     |                                            |
| `/api/pix/qrcode`                    | `POST`                | `sales-page`                                     |                                            |
| `/api/pix/status/:tx_id`             | `GET`                 | `use-pix-polling`                                | Polling ativo até confirmação/timeout      |
| `/api/print/receipt`                 | `POST`                | N/A                                              | Removido: fallback nativo `window.print()` |
| `/api/stock-movements/:productId`    | `GET`                 | `control-page`                                   |                                            |
| `/api/stock-movements/adjustment`    | `POST`                | `control-page`, `products-page`                  |                                            |
| `/api/control/stock-summary`         | `GET`                 | `control-page`                                   |                                            |
| `/api/control/cash-summary`          | `GET`                 | `control-page`                                   |                                            |
| `/api/control/discount-summary`      | `GET`                 | `control-page`                                   |                                            |
| `/api/control/cancellations`         | `GET`                 | `control-page`                                   |                                            |
| `/api/users`                         | `GET/POST/PUT/DELETE` | `employees-page`                                 |                                            |
| `/api/settings`                      | `GET/PUT`             | `settings-page`, `customers-page`                |                                            |
| `/api/settings/pix`                  | `GET/PUT`             | `settings-page`                                  | Requer confirmação por senha               |
| `/api/card-machines`                 | `GET/POST/PUT/DELETE` | `settings-page`, `sales-page`                    |                                            |
| `/api/backups`                       | `GET/POST`            | `settings-page`                                  | _(Planejado — em implementação)_           |
| `/api/notifications`                 | `GET`                 | `use-notifications`                              |                                            |
| `/api/notifications/unread-count`    | `GET`                 | `use-notifications`                              |                                            |
| `/api/notifications/:id/read`        | `PATCH`               | `use-notifications`                              |                                            |
| `/api/notifications/read-all`        | `PATCH`               | `use-notifications`                              |                                            |
| `/api/notifications/:id/acknowledge` | `PATCH`               | `use-notifications`                              |                                            |
| `/api/notifications/export/csv`      | `GET`                 | `notifications-page`                             |                                            |

---

## 16. Padrões e Convenções

### Máscaras e formatação

Centralizadas em `use-formatting.ts`. Máscaras adicionais locais em `settings-page.vue` estão sendo migradas progressivamente para o composable central.

### Toasts e feedback ao usuário

- **Toast local** (`use-toast`): para feedback pontual de interações dentro de uma página.
- **Toast global** (`notification-toast-container`): para notificações do sistema vindas do WebSocket ou polling.
- **Meta:** unificar a camada de tratamento de erros de API em um barramento global com códigos de erro padronizados — contemplado no **[ADR-007]**.

### Blur de dados sensíveis

Toggle de visibilidade aplicado em valores de fiado e saldo nas páginas de clientes e vendas. Ativado por padrão; usuário deve clicar para revelar.

### Skeletons de carregamento

Classe global `.skeleton` aplicada durante estados de `loading` em múltiplas telas. Ver tokens do Design System para a definição do keyframe.

### Impressão de recibo

- Fluxo principal: aciona `window.print()` nativo do navegador via `useSaleDomain` com estilos de impressão aplicados via CSS.

### Paginação client-side

Utilizada em produtos, tipos, marcas, clientes e histórico de estoque. Tamanhos disponíveis: 5, 10, 20, 50 itens. Evita a necessidade de `vue-virtual-scroller` fora de contextos de dropdown com listas muito extensas — ver **[ADR-004]**.

---

## 17. Testes

### Estado atual

| Item                                        | Estado               | Arquivo(s)                                                                                               |
| :------------------------------------------ | :------------------- | :------------------------------------------------------------------------------------------------------- |
| Unit — composables (13 cobertos)            | ✅ Implementado       | `composables/__tests__/*.spec.ts` (7 novos: scanner, pix, modal, shortcuts, domains)                     |
| Unit — store `auth.store`                   | ✅ Implementado       | `stores/__tests__/auth.store.spec.ts`                                                                    |
| Unit — `login-page`                         | ✅ Implementado       | `pages/__tests__/login-page.spec.ts`                                                                     |
| E2E — smoke de login                        | ✅ Implementado       | `e2e/login-smoke.spec.ts`                                                                                |
| E2E — fluxos críticos (venda, fiado, caixa) | ✅ Implementado       | `e2e/sale-complete`, `sale-cancel-refund`, `cashier-operations`, `customer-debt`, `notifications`        |

### Como rodar os testes

```bash
# Unitários
pnpm --filter @pdv/web test:run

# E2E (requer API e banco em execução)
pnpm --filter @pdv/web test:e2e
```

---

## 18. CI/CD e Deploy

> ⚠️ **Esta seção deve ser atualizada pelo responsável de infraestrutura com os detalhes do pipeline ativo.**

### Pipeline recomendado (referência)

```
PR aberto
  └─► lint + type-check
  └─► test:run (Vitest)
  └─► build (Vite)

Merge em main
  └─► build de produção
  └─► test:e2e (Playwright)
  └─► deploy para staging
  └─► smoke test em staging
  └─► deploy para produção (manual ou automático)
```

### Variáveis de ambiente no pipeline

| Variável       | Ambiente     | Fonte         |
| :------------- | :----------- | :------------ |
| `VITE_API_URL` | staging/prod | Secrets do CI |
| `VITE_WS_URL`  | staging/prod | Secrets do CI |

### Rollback

Em caso de regressão após deploy, reverter para o commit anterior e acionar novo pipeline de deploy.

---

## 19. Performance, PWA e Estratégia Offline

### Performance

| Estratégia              | Implementação atual                                                         |
| :---------------------- | :-------------------------------------------------------------------------- |
| Paginação client-side   | Listas de produtos, clientes e histórico — evita renderização de DOM pesado |
| Virtualização de listas | `vue-virtual-scroller` em dropdowns e selects com muitos itens              |
| Lazy loading de rotas   | A implementar — todas as páginas são importadas diretamente no router       |
| Cache de stores         | `customer.store` e `product.store` com TTL e `fetchIfStale`                 |
| Bundle analysis         | Executar `pnpm --filter @pdv/web build -- --report` para análise            |

### Configuração PWA

| Item             | Configuração                                                         |
| :--------------- | :------------------------------------------------------------------- |
| `registerType`   | `autoUpdate` — SW atualiza silenciosamente em segundo plano          |
| Workbox strategy | Pre-cache de assets estáticos; runtime cache configurável            |
| Manifesto        | Nome: `PDV FiadoDigital`; modo: `standalone`; orientação: `portrait` |
| Ícones           | 2 tamanhos definidos no manifesto                                    |

### Estratégia offline

| Capacidade                        | Status atual                                          |
| :-------------------------------- | :---------------------------------------------------- |
| Persistência do carrinho          | ✅ `localStorage` via `sale.store`                    |
| Persistência de filtros           | ✅ `localStorage` (dashboard)                         |
| Operações offline (fila + replay) | ✅ Implementado via `use-offline-queue.ts` (idempotente)|
| Leitura de dados offline (cache)  | ❌ Sem estratégia de cache de API atualmente          |

---

## 20. Suporte a Browsers e Dispositivos

### Browsers suportados

| Browser           | Versão mínima | Observação                                  |
| :---------------- | :------------ | :------------------------------------------ |
| Chrome / Chromium | 112+          | Target principal — PDV desktop e Android    |
| Firefox           | 115+          | Suportado                                   |
| Safari (macOS)    | 16.4+         | Requer atenção em PWA e câmera (ZXing)      |
| Safari (iOS)      | 16.4+         | PWA com limitações de iOS (sem push nativo) |
| Edge (Chromium)   | 112+          | Suportado                                   |
| Samsung Internet  | 21+           | Suportado para clientes mobile              |

### Dispositivos testados / resoluções suportadas

| Resolução mínima | Dispositivo alvo                      |
| :--------------- | :------------------------------------ |
| 1024×768 (XGA)   | Desktop mínimo — PDV de balcão        |
| 375×667          | Mobile mínimo — iPhone SE / similares |
| 768×1024         | Tablet — posição portrait             |

### Limitações conhecidas

- **iOS Safari / PWA:** push notifications nativas não disponíveis (limitação do iOS). O polling de `use-notifications` serve como fallback.
- **ZXing em Safari:** leitura de câmera pode exigir permissão manual na primeira execução. Testar em iOS antes de habilitar o scanner em produção.
- **`window.print()` em mobile:** impressão nativa pode ter comportamento inconsistente em alguns navegadores mobile.

---

## 21. Pendências e Melhorias

### Como usar esta seção

Cada item tem um identificador único, categoria, prioridade, descrição, arquivo(s) afetado(s) e critério de conclusão. Ao resolver um item, mova-o para o [Changelog](#24-changelog) com a data da resolução.

---

#### 🔴 Bugs — alta prioridade



---

#### 🔴 Acessibilidade — alta prioridade



---

#### ⚠️ Qualidade e consistência

**[P-Q01] Páginas de alto acoplamento**

- **Arquivo(s) afetado(s):** `sales-page.vue`, `customers-page.vue`, `settings-page.vue`
- **Descrição:** apesar da migração de lógica para composables de domínio, as páginas ainda concentram muito estado e lógica de UI. Dívida técnica reduzida mas não eliminada.
- **Responsável:** frontend
- **Critério de conclusão:** extração de sub-componentes para as seções de maior densidade; nenhuma página ultrapassa 400 linhas de `<script setup>`.

**[P-Q02] Utilitários de formatação com rastros locais**

- **Arquivo(s) afetado(s):** `apps/web/src/pages/settings-page.vue`
- **Descrição:** algumas funções de formatação ainda definidas localmente em `settings-page.vue`. Centralização em `use-formatting.ts` em andamento.
- **Responsável:** frontend
- **Critério de conclusão:** zero definições de máscara/formatação fora de `use-formatting.ts`.

---

#### 💡 UX e feedback



#### 💡 Funcionalidades pendentes

**[P-F01] Modo offline transacional**

- **Arquivo(s) afetado(s):** arquitetura frontend geral
- **Descrição:** operações de venda realizadas sem conexão precisam ser enfileiradas localmente e sincronizadas com idempotência ao reconectar. Atualmente apenas o estado do carrinho é persistido.
- **Responsável:** frontend + backend
- **Critério de conclusão:** fila de operações offline com replay idempotente; indicador visual de modo offline; testes E2E de sincronização.

**[P-E01] Cobertura E2E de fluxos críticos**

- **Arquivo(s) afetado(s):** `apps/web/e2e/`
- **Descrição:** apenas o smoke de login está coberto. Fluxos críticos de negócio sem cobertura E2E.
- **Responsável:** frontend + QA
- **Critério de conclusão:** cenários E2E implementados para: venda completa (dinheiro, cartão, Pix, fiado), cancelamento, estorno com PIN, sangria/suprimento de caixa, cobrança de fiado via WhatsApp e exportação de notificações CSV.

---

## 22. Glossário de Domínio

| Termo                 | Definição no contexto do PDV FiadoDigital                                                                                                                         |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fiado**             | Modalidade de venda a crédito onde o cliente paga em data posterior. O sistema controla o saldo devedor e o limite de crédito por cliente.                        |
| **Caixa**             | Sessão de operação do PDV. Um caixa é aberto no início do turno (com saldo inicial) e fechado ao final (com conferência de saldo).                                |
| **Sangria**           | Retirada de dinheiro do caixa durante o turno para depósito ou segurança. Reduz o saldo físico do caixa e é registrada como movimentação.                         |
| **Suprimento**        | Adição de dinheiro ao caixa durante o turno (troco, reforço de caixa). Aumenta o saldo físico e é registrada como movimentação.                                   |
| **Estorno**           | Cancelamento de uma venda já finalizada com devolução do valor ao cliente ou estorno do crédito de fiado. Requer validação de PIN.                                |
| **Cancelamento**      | Cancelamento de uma venda antes de ser finalizada. Limpa o carrinho sem gerar transação financeira.                                                               |
| **Quitação**          | Pagamento (total ou parcial) de um saldo devedor de fiado por um cliente. Gera uma transação financeira de recebimento.                                           |
| **Maquininha**        | Terminal de pagamento por cartão (POS). O sistema gerencia múltiplas maquininhas com taxas diferenciadas por bandeira e parcelamento.                             |
| **Operador**          | Perfil de usuário focado em operação de caixa (`role: operator`). Acessa apenas `/sales` e `/notifications`.                                                      |
| **Estoquista**        | Perfil de usuário focado em gestão de produtos (`role: stockist`). Acessa apenas `/products`.                                                                     |
| **FAB**               | Floating Action Button — botão de ação principal flutuante em telas mobile para iniciar o cadastro de um novo cliente.                                            |
| **Wedge**             | Scanner de código de barras USB que emula entrada de teclado. O composable `use-barcode-scanner` detecta e processa o buffer de entrada do wedge automaticamente. |
| **PDV**               | Ponto de Venda — o módulo central de operação de caixa do sistema (`sales-page.vue`).                                                                             |
| **Template WhatsApp** | Mensagem pré-formatada de cobrança enviada via WhatsApp. Há 4 templates: vencido, a vencer, parcial e total. Configurados em `settings-page.vue`.                 |
| **TTL / Cache Stale** | Padrão nativo para reduzir requisições em itens esporádicos; lógica implementada e documentada com propriedade `fetchIfStale(force=true)` no Pinia.               |
| **Bulk (Granel)**     | Produtos marcados com `is_bulk: true`. Exige UX específica: três casas decimais para `kg` contra valores inteiros em controle de unidades normais (`unidade`).  |
| **Focus Trap**        | Controle para contenção de navegação a teclado (`use-global-modal-focus-trap.ts`) garantindo não-invasão quando há modais por cima do overlay principal em DOM. |
| **Modal Stack**       | Gerenciamento global em fila baseada em DOM Element ref para sobreposições corretas e eventos de esc limpos sequenciais via `use-modal-stack.ts`.                 |

---

## 23. ADRs — Decisões Arquiteturais

As decisões abaixo foram tomadas durante o desenvolvimento e documentadas retroativamente. Novas decisões arquiteturais significativas devem ser adicionadas aqui.

---

### ADR-001 — Composition API com `<script setup lang="ts">`

**Status:** Aceita

**Contexto:** o projeto usa Vue 3. Havia a opção de usar Options API (compatibilidade com Vue 2) ou Composition API.

**Decisão:** Composition API exclusiva com `<script setup lang="ts">` em todos os componentes e páginas.

**Consequências:** melhor inferência de tipos TypeScript; composables reutilizáveis sem mixins; curva de aprendizado maior para desenvolvedores vindos do Vue 2.

---

### ADR-002 — Pinia como store global

**Status:** Aceita

**Contexto:** Vuex era a opção padrão para Vue 2/3. Pinia foi lançado como sucessor oficial.

**Decisão:** Pinia substituiu Vuex completamente no projeto.

**Consequências:** stores tipadas nativamente; DevTools com time-travel; sem mutations — apenas state, getters e actions; menor boilerplate.

---

### ADR-003 — Persistência do carrinho em `localStorage`

**Status:** Aceita (com limitação conhecida)

**Contexto:** o operador de caixa pode perder o estado do carrinho em reloads acidentais ou quedas de energia. A alternativa seria um modo offline completo com fila e replay.

**Decisão:** persistir apenas o carrinho ativo (`sale.store`) em `localStorage`. Modo offline transacional completo (fila + replay com idempotência) foi adiado por complexidade.

**Consequências:** o carrinho sobrevive a reloads. Vendas iniciadas offline não são salvas no backend — o operador é responsável por registrá-las quando reconectar. Ver **[P-F01]**.

---

### ADR-004 — Paginação client-side em vez de virtualização

**Status:** Aceita

**Contexto:** listas de produtos, clientes e histórico de estoque podem ser longas. As opções eram: paginação server-side, `vue-virtual-scroller` ou paginação client-side com tamanho de página configurável.

**Decisão:** paginação client-side com opções de 5, 10, 20 e 50 itens. `vue-virtual-scroller` reservado apenas para dropdowns e selects com listas muito extensas.

**Consequências:** sem requests adicionais ao mudar de página; limitado pelo tamanho do payload inicial da API. Sustentável enquanto o volume de dados por entidade permanecer manejável.

---

---

### ADR-005 — Tailwind CSS v4 sem arquivo de configuração legado

**Status:** Aceita

**Contexto:** Tailwind v4 mudou o modelo de configuração: sem `tailwind.config.js`, sem `postcss.config.js`. Configuração via `@theme` em CSS e plugin Vite.

**Decisão:** adotar Tailwind v4 com integração via `@tailwindcss/vite` e tokens definidos em `src/assets/main.css` via `@theme`.

**Consequências:** setup mais simples; ausência de configuração legada; tokens de design incompletos (spacing, tipografia, z-index) ainda precisam ser formalizados — ver Design System.

---

### ADR-006 — WebSocket com fallback para polling

**Status:** Aceita

**Contexto:** notificações em tempo real exigem conexão persistente. WebSocket é a solução ideal, mas redes instáveis podem causar desconexão.

**Decisão:** `use-websocket.ts` com reconexão exponencial + jitter; `use-notifications.ts` degrada para polling quando o WebSocket falha ou desconecta.

**Consequências:** resiliência a quedas de rede; polling tem latência maior que WS. O intervalo de polling foi calibrado para equilíbrio entre atualidade e carga no servidor.

---

### ADR-007 — Barramento Global de Erros de API (`use-error-handler`)

**Status:** Aceita

**Contexto:** cada página tratava erros HTTP localmente, resultando em duplicação de código, inconsistência visual ao usuário e cenários onde falhas de rede / servidor (`5xx`) escapavam ou passavam despercebidas.

**Decisão:** implementado o padrão Interceptor no `use-api.ts` combinando `use-error-handler.ts`. Respostas 4xx (401, 403, 422, 429) e 5xx acionam notificações globais padronizadas automaticamente (e reduzem sessões 401 para a tela de login), mitigando a necessidade de toast local.

**Consequências:** redução drástica de boilerplate nas pages; fallback de erro visual garantido; tratamento refinado via interceptador sem quebrar respostas válidas.

---

### ADR-008 — Lazy loading de rotas (`router/index.ts`)

**Status:** Aceita

**Contexto:** o bundle inicial estava crescendo devido a todas as páginas sendo importadas estaticamente.

**Decisão:** converter todos os componentes de página para importação dinâmica (`() => import(...)`), exceto a `login-page.vue` (vital para o First Contentful Paint).

**Consequências:** redução do bundle principal; divisão em chunks por rota; carregamento sob demanda ao navegar.

---

### ADR-009 — Fila transacional offline (`use-offline-queue.ts`)

**Status:** Aceita

**Contexto:** quedas de conexão impediam a conclusão de vendas no balcão, gerando atrito e perda de produtividade (ver **[P-F01]**).

**Decisão:** implementada fila em `localStorage` para serializar `sales`. A `sale.store` intercepta a criação e delega para a fila quando `isOnline` é falso.

**Consequências:** vendas podem ser concluídas em modo offline intermitente; sincronização automática com tratamento de duplicatas (idempotência); feedback visual de sincronização no painel.

---

## 24. Changelog

### [v1.5] — 02/04/2026

**Bugs resolvidos:**
- [B-01] — fallback de impressão via `window.print()` integrado em `use-sale-domain.ts` em substituição ao endpoint legado ausente na API.
- [B-02] — correção do contrato de estorno em `sales-page.vue` (histórico), removendo o campo `receiptId` incompatível com a API v1.

**Acessibilidade e UX:**
- [P-A01] — integração do `useModalStack` em todas as páginas modais (`employees`, `dashboard`, `control`, `products`, `customers`), unificando a gestão de Focus Trap e a tecla Escape.
- [M-01] — implementado `use-error-handler.ts` e injetado via interceptor no `use-api.ts`, centralizando o tratamento visual de erros 4xx/5xx via toasts globais.

**Débito técnico:**
- [P-Q01] — início da extração sistemática de subcomponentes de domínio em `src/components/` para redução de complexidade nas páginas massivas.
- [P-Q02] — centralização de formatações de UX (Pix, Datas, Moeda) no composable `use-formatting.ts`.
- [DS-01] — formalização de tokens de design (`spacing`, `font-size`, `border-radius`, `z-index`) em `main.css` via Tailwind v4.

**Evolução arquitetural:**
- [PERF-01] — implementação de Code Splitting e Lazy Loading no `router/index.ts` para otimizar o carregamento inicial (exceto `/login`).
- [P-F01] — criação do `use-offline-queue.ts` com suporte a serialização transacional em `localStorage` e replay automático idempotente no `sale.store.ts`.

**Testes:**
- [TEST-01] — cobertura unitária de 100% para os composables de domínio e interface (ZXing, Pix, Shortcuts, Modais) com 7 novos arquivos `.spec.ts` (Vitest).
- [P-E01] — implementação de suítes de teste de fumaça (E2E) em Playwright cobrindo Venda, Cancelamento, Caixa, Fiado e Notificações (5 novos arquivos).

**ADRs criadas:**
- ADR-007: barramento global de erros de API corporativo.
- ADR-008: estratégia de lazy loading por rota em SPA.
- ADR-009: fila transacional offline com resiliência e idempotência.

---

### [v1.4] — 29/03/2026

**Novas funcionalidades:**
- Redesign mobile-first completo da `customers-page.vue`: FAB para cadastro, cards expansíveis com ações rápidas, timeline de histórico mobile-first.
- Dashboard: filtros de período persistentes (hoje, ontem, semana, mês, customizado) e modos de visualização por perfil (gerente vs operador).
- Aba de backup dedicada em `settings-page.vue` com configuração de frequência, retenção, destino em nuvem e criptografia.

**Arquitetura:**
- Extração de lógica complexa em composables de domínio: `use-sale-domain.ts`, `use-customer-domain.ts`, `use-settings-domain.ts`, `use-modal-stack.ts`, `use-pix-polling.ts`, `use-pos-shortcuts.ts`, `use-barcode-scanner.ts`.

**Melhorias:**
- Paginação client-side customizável (5/10/20/50) em produtos, tipos, marcas, clientes e histórico de estoque.
- Focus trap e navegação por teclado aprimorados em `sales-page.vue` via `use-modal-stack`.

---

### [v1.3] — (data a preencher)

> Preencher com as mudanças da versão anterior.

---

_Documento mantido por [Moisés Vila Nova De Oliveira](https://github.com/MoisesVNdev/MoisesVNdev) — contato: moisesvn.dev@gmail.com_
