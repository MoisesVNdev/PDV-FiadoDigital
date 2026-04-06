# Infraestrutura do Projeto PDV FiadoDigital

---

## Metadados do Documento

| Campo              | Valor                                                                  |
|--------------------|------------------------------------------------------------------------|
| **Versão**         | `4.0.0`                                                                |
| **Status**         | Vigente (P17.21 em aberto)                                             |
| **Autores**        | [Moisés Vila Nova De Oliveira](https://github.com/MoisesVNdev/MoisesVNdev) |
| **Revisores**      | [Moisés Vila Nova De Oliveira](https://github.com/MoisesVNdev/MoisesVNdev) |
| **Última revisão** | 05/04/2026                                                             |
| **Branch base**    | `main`                                                                 |
| **Próxima revisão**| 05/07/2026 (ou após release de nova feature de infra)                  |
| **Escopo**         | Toda a infraestrutura do repositório monorepo PDV FiadoDigital         |

> [!IMPORTANT]
> **Tauri/wrapper de produção fora do escopo deste documento.**
> O servidor principal é empacotado em produção com um wrapper Tauri (modo kiosk). Esse wrapper **não faz parte do monorepo atual** e não é documentado aqui. Qualquer desenvolvedor que precisar trabalhar com o deploy em produção deve consultar o responsável de infra para acesso ao repositório do wrapper.

---

## Sumário

**Seções principais**

1. [Objetivo e Público-alvo](#1-objetivo-e-público-alvo)
2. [Contexto de Negócio](#2-contexto-de-negócio)
3. [Glossário de Domínio](#3-glossário-de-domínio)
4. [Regras de Negócio Fundamentais](#4-regras-de-negócio-fundamentais)
5. [Visão Arquitetural e Decisões (ADR)](#5-visão-arquitetural-e-decisões-adr)
6. [Stack Tecnológico](#6-stack-tecnológico)
7. [Topologia e Rede](#7-topologia-e-rede)
8. [Inventário de Componentes](#8-inventário-de-componentes)
9. [Arquitetura de Dados](#9-arquitetura-de-dados)
10. [Segurança e Controle de Acesso](#10-segurança-e-controle-de-acesso)
11. [CI/CD e Qualidade](#11-cicd-e-qualidade)
12. [Operações e Observabilidade](#12-operações-e-observabilidade)
13. [Matriz de Ambientes](#13-matriz-de-ambientes)
14. [Gestão de Incidentes](#14-gestão-de-incidentes)
15. [Ambiente de Desenvolvimento e Onboarding](#15-ambiente-de-desenvolvimento-e-onboarding)
16. [Governança do Repositório](#16-governança-do-repositório)
17. [Dívida Técnica e Roadmap](#17-dívida-técnica-e-roadmap)
18. [Referências](#18-referências)

**Apêndices**

- [Apêndice A — Schema Prisma Detalhado](#apêndice-a--schema-prisma-detalhado)
- [Apêndice B — Índice de Arquivos](#apêndice-b--índice-de-arquivos)
- [Apêndice C — Histórico de Versões](#apêndice-c--histórico-de-versões)

---

## 1. Objetivo e Público-alvo

### 1.1 Objetivo

Este documento é a **fonte de verdade da infraestrutura** do PDV FiadoDigital. Ele responde a três perguntas essenciais que qualquer membro técnico da equipe deve conseguir responder sem precisar explorar o código:

- **Como o sistema funciona** do ponto de vista operacional e arquitetural?
- **Como um novo desenvolvedor** configura o ambiente e começa a contribuir?
- **O que fazer quando algo falha** em produção?

O documento complementa — e não substitui — o `ARCHITECTURE.md` (decisões de alto nível de produto e negócio) e o código-fonte (fonte de verdade de implementação). Quando houver conflito entre este documento e o código, **o código prevalece** e este documento deve ser atualizado.

### 1.2 Público-alvo

| Perfil                    | Seções prioritárias                                                    |
|---------------------------|------------------------------------------------------------------------|
| **Desenvolvedor novo**    | 2, 3, 5, 6, 13, 15 — contexto, setup, como o sistema funciona         |
| **Dev backend / infra**   | 4, 5, 9, 10, 11, 12 — arquitetura, dados, segurança, operações         |
| **Tech lead / arquiteto** | 4, 5, 10, 17 — regras críticas, decisões arquiteturais, dívida técnica |
| **Operador / suporte**    | 7, 12, 13, 14 — topologia, observabilidade, incidentes, runbooks       |

### 1.3 Escopo e limites

**Coberto por este documento:**
- Monorepo `PDV-FiadoDigital` (branches `main` e `develop`)
- Infraestrutura de desenvolvimento local e Docker Compose
- Pipeline de CI no GitHub Actions
- Operação em rede local (LAN)

**Fora do escopo:**
- Wrapper Tauri para deploy kiosk em produção (repositório separado)
- Infraestrutura de cloud backup (depende de configuração por estabelecimento)
- Emissão fiscal e integração com SEFAZ (não aplicável — ver premissa P4)

---

## 2. Contexto de Negócio

### 2.1 O que é o PDV FiadoDigital

Sistema de Ponto de Venda (PDV) híbrido e local projetado para **pequenos comércios** (mercadinhos, mercearias, lojas de bairro). Seu diferencial central é o controle de **fiado** — crédito informal concedido a clientes frequentes, prática comum nesse segmento. O sistema opera primariamente offline em rede local, sem dependência de internet para as operações do dia a dia.

### 2.2 Premissas de Negócio Não Negociáveis

Estas premissas são restrições arquiteturais impostas pelo contexto do produto e documentadas em `.github/ARCHITECTURE.md`. Qualquer decisão técnica que as viole deve ser discutida explicitamente como ADR antes de ser implementada.

| # | Premissa                           | Implicação técnica                                                     |
|---|------------------------------------|------------------------------------------------------------------------|
| P1 | Hardware modesto no servidor      | Sem runtime pesado, banco leve (SQLite), sem containers em produção    |
| P2 | Operação offline-first            | Vendas não podem depender de internet; dados locais são primários      |
| P3 | Rede local como infraestrutura    | Clientes acessam via LAN; resolução por mDNS, não DNS externo          |
| P4 | Sem emissão de NF-e               | Sem integração com SEFAZ; comprovante não fiscal apenas                |
| P5 | Máximo de 3 terminais simultâneos | Limite de concorrência no SQLite WAL com segurança testada             |
| P6 | Operador não é técnico            | UX operacional simples; recuperação de falha deve ser guiada           |

### 2.3 Fluxo de Operação Principal

```
Abertura de caixa (CashRegister)
    └─► Ciclo de vendas (Sale + SaleItems + SalePayments)
            ├─► Pagamento à vista  → Transaction (caixa)
            ├─► Pagamento fiado    → Customer.current_debt_cents ↑
            └─► Pagamento misto    → combinação dos dois acima
Fechamento de caixa (CashRegister.closing_balance_cents vs expected)
    └─► Relatório de diferença (difference_cents) → AuditLog
```

---

## 3. Glossário de Domínio

### 3.1 Termos de Negócio

| Termo                 | Definição                                                                                          |
|-----------------------|----------------------------------------------------------------------------------------------------|
| **PDV**               | Ponto de Venda — sistema que processa vendas no balcão.                                            |
| **Fiado**             | Crédito informal: o cliente leva a mercadoria e paga depois. Controlado por `Customer.current_debt_cents`. |
| **Sangria**           | Retirada de dinheiro do caixa durante o expediente, antes do fechamento.                           |
| **Suprimento**        | Adição de dinheiro ao caixa durante o expediente.                                                  |
| **Centavos**          | Moeda armazenada sempre como `Int` em centavos (ex.: R$ 12,50 → `1250`).                           |
| **Basis points**      | 1 bp = 0,01%. Usado para taxas de cartão e margens. Armazenado como `Int` para evitar float.       |
| **Snapshot de preço** | Cópia do preço/nome do produto no momento da venda, imune a alterações futuras no catálogo.        |
| **Idempotência de venda** | `Sale.uuid` garante que a mesma venda enviada duas vezes não seja registrada duas vezes.       |

### 3.2 Termos Técnicos do Projeto

| Termo          | Definição                                                                                          |
|----------------|----------------------------------------------------------------------------------------------------|
| **Soft delete**   | Registro marcado com `deleted_at` em vez de removido fisicamente do banco.                      |
| **WAL mode**      | Write-Ahead Logging — modo do SQLite que permite leituras concorrentes sem bloquear escrita.    |
| **mDNS**          | Multicast DNS — protocolo que resolve `pdv-caixa.local` sem servidor DNS central.              |
| **Kiosk**         | Modo de operação do servidor principal em tela cheia, sem interface de desktop padrão.          |
| **PWA**           | Progressive Web App — frontend servido pelo backend e instalável no terminal como app.          |
| **Monorepo**      | Repositório único com múltiplos pacotes (`apps/api`, `apps/web`, `packages/shared`).            |
| **ADR**           | Architecture Decision Record — registro formal de uma decisão arquitetural com contexto e consequências. |
| **RBAC**          | Role-Based Access Control — controle de acesso baseado em perfis de usuário.                    |
| **RPO**           | Recovery Point Objective — ponto máximo de perda de dados tolerável após um incidente.         |
| **RTO**           | Recovery Time Objective — tempo máximo para restauração do sistema após um incidente.           |

---

## 4. Regras de Negócio Fundamentais

> [!CAUTION]
> Esta seção documenta as **invariantes do domínio**. Qualquer implementação que as viole deve ser considerada um bug, independentemente de testes passando.

### 4.1 Dinheiro e Taxas

- Todo valor monetário é armazenado como `Int` em **centavos**. Nunca use `Float` para valores de moeda.
- Taxas de cartão e margens de lucro são armazenadas como `Int`. Margens de lucro usam fator escalonado (`toStoredRatio` × 10000) — ex.: 0.25 (25%) → `2500` no banco. Taxas de cartão usam **basis points** (1 bp = 0,01%).
- Os campos `Product.profit_margin` e `ProductType.profit_margin` foram migrados de `Float` para `Int` no schema (migração confirmada). A camada de repositório converte de/para float via `toStoredRatio`/`fromStoredRatio` (`apps/api/src/utils/percentage-scaling.ts`). A pendência [P17.1](#p171) está **resolvida** no nível de schema.
- Os campos `SalePayment.applied_rate`, `CardMachineRate.debit_rate`, `CardMachineRate.credit_base_rate` e `CardMachineRate.credit_incremental_rate` foram migrados de `Float` para `Int` (basis points). A pendência [P17.13](#p1713) está **resolvida**.
- Operações monetárias devem usar `@pdv/shared/utils/money.ts` (`formatCents`, `parseCentsFromString`, `sumCents`) para garantir consistência de formatação BRL. **Nenhum uso de `Intl.NumberFormat` foi encontrado no código** — `@pdv/shared` é o único ponto de formatação monetária.

> [!WARNING]
> O job `customer-debt-check.job.ts` (linhas 54, 74) formata valores monetários usando divisão manual (`current_debt_cents / 100`) em vez de `formatCents`. Isso é uma inconsistência de formatação — ver [P17.22](#p1722).

### 4.2 Venda e Idempotência

- `Sale.uuid` é único e gerado no cliente. Se a mesma venda for enviada duas vezes (reconexão de rede, duplo clique), a segunda chamada retorna silenciosamente os dados da venda existente (HTTP 200 com os dados da primeira venda — **não 409**).
  - Implementação: `apps/api/src/services/sale.service.ts:54` — `saleRepository.findByUuid(payload.uuid)`. Se `existing` é truthy, o método retorna `existing` sem criar nova venda.
  - Teste: `apps/api/src/services/sale.service.test.ts:48` — `"deve retornar 409 se uuid já existir"`. **Divergência: o teste espera 409 mas a implementação retorna a venda existente sem throw.** Verificar alinhamento (→ [P17.23](#p1723)).
- `SaleItem` armazena snapshot de `product_name` e `unit_price_cents` no momento da venda. Esses campos são **imutáveis após criação** por ausência de endpoint de update para `SaleItem` — não há middleware ou constraint explícita no banco que impeça modificação direta. A imutabilidade é garantida **por design na camada de API** (nenhuma rota PUT/PATCH expõe atualização de `SaleItem`).

### 4.3 Fiado e Crédito

- O limite de crédito (`credit_limit_cents`) é verificado em **duas camadas**:
  1. **Camada Service** — `apps/api/src/services/sale.service.ts:121-132`: verifica `credit_blocked`, calcula `availableCredit = credit_limit_cents - current_debt_cents`, lança `unprocessable` se o valor fiado excede o crédito disponível.
  2. **Camada Repository** — `apps/api/src/repositories/sale.repository.ts:344-350`: função `validateCreditAvailability` com verificação redundante de `credit_blocked` e `debtAfterSale <= credit_limit_cents`.
- `credit_blocked = true` impede novas vendas fiadas, mesmo que o limite não tenha sido atingido. **Não há cenários de bloqueio além de `credit_blocked = true`** (confirmado por grep — não existe lógica adicional de bloqueio automático baseada em percentual ou prazo).
- `current_debt_cents` é atualizado atomicamente usando `prisma.$transaction`:
  - **Venda fiado** — `apps/api/src/repositories/sale.repository.ts:104` (incremento via `$transaction`).
  - **Pagamento de dívida** — `apps/api/src/services/customer.service.ts:112` (decremento via `$transaction`).
  - **Cancelamento de venda** — `apps/api/src/repositories/sale.repository.ts:380` (reversão via `$transaction`).
  - **Estorno de venda** — `apps/api/src/repositories/sale.repository.ts:455` (reversão via `$transaction`).
- Quando a dívida é quitada completamente (`newDebt === 0`), o sistema desbloqueia automaticamente o crédito (`credit_blocked: false, is_active: true`) — `customer.service.ts:157`.

### 4.4 Caixa e Auditoria

- Um caixa (`CashRegister`) só pode estar `open` em um terminal por vez — validado em `cash-register.service.ts:35-40` (lança `conflict` se já existe caixa aberto naquele terminal).
- Operações fora de um caixa aberto retornam **HTTP 400** com mensagem `"Não há caixa aberto no sistema para registrar o pagamento de fiado."` (`customer.service.ts:150`) ou **HTTP 422** com mensagem `"Caixa não está aberto"` (`cash-register.repository.ts:97,129`), dependendo da operação.
- Todo evento relevante de negócio gera um registro em `AuditLog`. Os valores de `action` **efetivamente registrados no código** são:

  | Valor de `action`   | Service de origem           | Arquivo                         |
  |---------------------|-----------------------------|---------------------------------|
  | `login`             | Autenticação                | `auth.service.ts:67`            |
  | `login_failed`      | Autenticação                | `auth.service.ts:33,49`         |
  | `sale_cancelled`    | Cancelamento de venda       | `sale.service.ts:241`           |
  | `sale_refunded`     | Estorno de venda            | `sale.service.ts:278`           |
  | `password_changed`      | Alteração de senha          | `user.service.ts:57`            |
  | `pix_key_changed`       | Alteração de chave Pix      | `settings.service.ts:119`       |
  | `cash_register_opened`  | Abertura de caixa           | `cash-register.service.ts:44`   |
  | `cash_register_closed`  | Fechamento de caixa         | `cash-register.service.ts:60`   |
  | `cash_withdrawal`       | Sangria de caixa            | `cash-register.service.ts:80`   |
  | `cash_supply`           | Suprimento de caixa         | `cash-register.service.ts:109`  |
  | `product_price_updated` | Alteração de preço          | `product.service.ts:164`        |
  | `user_deleted`          | Exclusão de usuário         | `user.service.ts:73`            |

- O `AuditLog` é **append-only**: o `AuditLogRepository` expõe **apenas o método `create`** (`audit-log.repository.ts:14`). Não existe controller, rota, ou método para update/delete de `AuditLog`. Confirmado: **zero rotas DELETE ou UPDATE para AuditLog**.
- `Notification` com `severity = critical` requer `acknowledged_by` antes de ser considerada resolvida.

> [!WARNING]
> Ações de negócio que **não** estão gerando `AuditLog` mas deveriam considerar: abertura/fechamento de caixa, sangria/suprimento (`cash_in`/`cash_out`), alteração de preço de produto, exclusão de usuário. Adicionar cobertura de auditoria é dívida técnica (→ [P17.24](#p1724)).

---

## 5. Visão Arquitetural e Decisões (ADR)

### 5.1 Diagrama de Blocos do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│  Rede Local (LAN)                                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Servidor Principal (PC Kiosk)                           │   │
│  │                                                          │   │
│  │  ┌─────────────┐   ┌──────────────┐   ┌─────────────┐  │   │
│  │  │  apps/web   │   │  apps/api    │   │   SQLite    │  │   │
│  │  │  (PWA/Vite) │◄──│  (Node.js/  │◄──│   (WAL)     │  │   │
│  │  │  :5173 dev  │   │   Express)  │   │  data/*.db  │  │   │
│  │  │  :80 prod   │   │  :3000 HTTP │   └─────────────┘  │   │
│  │  └─────────────┘   │  :3000 WS   │         │           │   │
│  │       │ proxy       └──────┬───────┘         │ Backup     │   │
│  │       │ /api,/ws         │                │           │   │
│  │       └─────────────┘   ┌──────▼──────┐   ┌─────▼────────┐  │   │
│  │                    │  Impressora │   │  backups/    │  │   │
│  │                    │  (local)    │   │  *.db.gz.enc │  │   │
│  │                    └─────────────┘   └──────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│              mDNS: pdv-caixa.local                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Terminal PC │  │  Terminal PC │  │  Terminal Smartphone │  │
│  │  (Browser)   │  │  (Browser)   │  │  (Browser PWA)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│       máx. 3 terminais secundários simultâneos                  │
└─────────────────────────────────────────────────────────────────┘
         │ (opcional, não obrigatório para operação)
         ▼
   Internet / Cloud Backup
```

### 5.2 Visão Geral de ADRs

| Status | ADR | Referência |
|:-------|:----|:-----------|
| ✓ | ADR-001: SQLite com WAL mode | [Ver Seção 5.2](#52-architectural-decision-records-adrs) |
| ✓ | ADR-002: Monorepo pnpm | [Ver Seção 5.2](#52-architectural-decision-records-adrs) |
| ✓ | ADR-003: PWA para terminais | [Ver Seção 5.2](#52-architectural-decision-records-adrs) |
| ✓ | ADR-004: Backup customizado | [Ver Seção 5.2](#52-architectural-decision-records-adrs) |
| ✓ | ADR-005: Soft Delete Exclusivo | [Ver Seção 5.2](#52-architectural-decision-records-adrs) |
| ✓ | ADR-006: Gestão de Sessão (JWT) | [Ver Seção 10.1](#10-segurança-e-controle-de-acesso) |
| ✓ | ADR-007: Comunicação Assíncrona | [Ver Seção 8.4](#84-websocket-broker) |
| ✓ | ADR-008: Soft Delete em Eventos de Pagamento | [Ver Seção 5.2](#52-architectural-decision-records-adrs) |

### 5.2 Architectural Decision Records (ADRs)

#### ADR-008: Manutenção de Soft Delete em Eventos de Pagamento (SalePayment)

**Data:** 06/04/2026
**Status:** Aceito

**Contexto:**
A diretriz arquitetural ADR-005 estabelece que modelos puramente contábeis e de log (eventos imutáveis) não devem possuir mecanismo de "soft delete" (`deleted_at`). O modelo `SalePayment` (registro de pagamentos de uma venda) conceitualmente é um evento imutável de transação. No entanto, o campo `deleted_at` estava presente em seu esquema primitivo e é ativamente filtrado em dezenas de consultas de negócio essenciais (como fechamento de caixa e extrações analíticas) que exigem isolamento com base na cláusula `deleted_at: null`.

**Decisão:**
A regra rigorosa da ADR-005 será flexibilizada exclusivamente para o modelo `SalePayment`. O campo `deleted_at` e seu respectivo índice serão mantidos.

**Justificativa:**
Embora as rotinas correntes de sistema operem em modo append-only em `SalePayment`, a infraestrutura de leitura foi inteiramente acoplada a este filtro de segurança explícito. Remover o campo causaria fragilidade sistêmica severa devido a reescrita maciça nos repositórios (`sale.repository.ts`, `control.repository.ts`, etc.) com zero retorno prático de negócio nesse momento. Manter o campo abre via sistêmica para eventuais implementações limpas de estornos parciais com cancelamentos de `SalePayment` lógicos no futuro.

---

## 6. Stack Tecnológico

| Camada       | Tecnologia                   | Versão (package.json)                  | Justificativa (resumida)                                       | ADR     |
|--------------|------------------------------|----------------------------------------|----------------------------------------------------------------|---------|
| Monorepo     | pnpm workspaces              | `9.15.0`                               | Cache eficiente, workspaces nativos, lockfile determinístico   | ADR-002 |
| Runtime      | Node.js                      | `>=20.0.0`                             | LTS com suporte nativo a ESM e fetch; maturidade de ecossistema | —      |
| Linguagem    | TypeScript                   | `^5.5.0`                               | Tipagem estrita em todo o stack; erros detectados em CI        | —       |
| Banco        | SQLite (WAL)                 | via better-sqlite3 `^12.6.2`           | Zero custo operacional; adequado para hardware local modesto   | ADR-001 |
| ORM          | Prisma                       | `^7.4.2` (client) / `^7.6.0` (config) | Tipagem gerada automaticamente; adapter `better-sqlite3`       | —       |
| Autenticação | jsonwebtoken + bcryptjs      | `^9.0.2` / `^2.4.3`                   | JWT stateless, bcrypt custo 12, cookie httpOnly                | ADR-006 |
| WebSocket    | ws                           | `^8.18.0`                              | Notificações real-time via token efêmero HMAC                  | ADR-007 |
| HTTP Server  | Express                      | `^4.21.0`                              | Framework HTTP maduro, vasto ecossistema de middlewares        | —       |
| Backup       | Custom Service               | —                                      | WAL checkpoint + copyFile + GZIP + AES-256-GCM                 | ADR-004 |
| Frontend     | Vue 3                        | `^3.5.0`                               | SPA reativa, composables, build rápido                         | ADR-003 |
| Build FE     | Vite                         | `^6.0.0`                               | Build ESM nativo, HMR instantâneo                              | ADR-003 |
| CSS          | Tailwind v4                  | `^4.0.0`                               | Utilitário, sem CSS customizado em runtime                     | —       |
| PWA          | vite-plugin-pwa              | `^0.21.0`                              | Service worker, manifest, autoUpdate                           | ADR-003 |
| Router       | vue-router                   | `^4.4.0`                               | Navegação SPA com guards de autenticação                        | —       |
| State        | Pinia                        | `^2.2.0`                               | Store reativo global para autenticação e estado de app          | —       |
| Segurança    | helmet + cors + rate-limit   | `^8.0.0` / `^2.8.5` / `^7.4.0`        | Headers, CORS configurável, proteção brute force               | —       |
| Validação    | Zod                          | `^3.23.0`                              | Validação de schema em todas as rotas da API                   | —       |
| Testes       | Vitest                       | `^2.1.0`                               | Unit tests com coverage v8 (API + Web)                         | —       |
| E2E          | Playwright                   | `^1.53.2`                              | Testes E2E em Chromium para `@pdv/web`                         | —       |
| Agendamento  | node-cron                    | `^3.0.3`                               | Jobs periódicos (notificações, debt-check)                      | —       |
| Upload       | multer                       | `^1.4.5-lts.1`                         | Upload de arquivos (backup restore via API)                    | —       |
| QR Code      | qrcode + @zxing              | `^1.5.4` / `^0.1.5`                   | Geração Pix QR e leitura de barcode                            | —       |
| Build/Type   | tsc + vue-tsc + scripts pnpm | —                                      | Sem bundler proprietário; scripts reproduzíveis                 | —       |
| Shared pkg | `@pdv/shared`       | `0.1.0`      | Contrato tipado entre api e web sem publicação de pacote       | ADR-002 |
| Dev Docker | Docker Compose      | v2           | Ambiente de desenvolvimento isolado e reproduzível             | —       |
| CI         | GitHub Actions      | —            | Pipeline sequencial: lint → type → test → build                | —       |

---

## 7. Topologia e Rede

### 7.1 Nós da Rede Local

| Nó                  | Tipo          | Função                                                          | Endereço          |
|---------------------|---------------|-----------------------------------------------------------------|-------------------|
| Servidor principal  | PC Kiosk      | Backend API + banco + frontend + impressão                      | `pdv-caixa.local` |
| Terminal secundário | PC ou celular | Interface de operação via browser (até 3 simultâneos)           | DHCP dinâmico     |

### 7.2 Portas e Protocolos

| Serviço        | Porta (dev) | Porta (prod) | Protocolo | Origem permitida   |
|----------------|-------------|--------------|-----------|---------------------|
| API (Node.js)  | 3000        | 3000         | HTTP      | LAN local           |
| Web (Vite/PWA) | 5173        | 80           | HTTP      | LAN local           |
| mDNS           | 5353        | 5353         | UDP/mDNS  | LAN multicast       |
| Impressora     | —           | —            | USB/local | Servidor principal  |

> [!NOTE]
> Em produção, `apps/web` é servido como arquivos estáticos pelo próprio `apps/api` ou por um servidor estático simples (nginx/caddy). O Vite **não é executado** em produção.

### 7.3 Descoberta de Serviço (mDNS)

O hostname `pdv-caixa.local` é resolvido via Multicast DNS:

- **Linux:** Avahi daemon (`avahi-daemon`). Requer `avahi-daemon` instalado e ativo.
- **Windows:** Bonjour (instalado com iTunes ou via Bonjour Print Services). Alternativa: implementação custom no wrapper Tauri.
- **Comportamento de fallback:** Se o mDNS falhar, os terminais podem acessar diretamente pelo IP local do servidor (ex.: `192.168.1.100:3000`). O IP fixo deve ser configurado no roteador via reserva DHCP para o MAC address do servidor.

### 7.4 Limitações Conhecidas de Concorrência

O WAL mode do SQLite suporta múltiplos leitores simultâneos com um único escritor. Testes validaram até **3 terminais secundários simultâneos** em operação normal. Acima disso, existe risco de contenção de escrita e timeouts. Esta é a origem da premissa P5 (ver [Seção 2.2](#22-premissas-de-negócio-não-negociáveis)).

---

## 8. Inventário de Componentes

### 8.1 Mapa de Dependências

```
apps/api  ──────────────────────────────────► SQLite (data/*.db)
   │  └──► @pdv/shared (tipos, constantes, utils)
   │
apps/web  ──────────────────────────────────► apps/api (HTTP REST)
   └──► @pdv/shared (tipos, constantes, utils)

packages/shared  ◄── usado por api e web
   ├── src/types/        (contratos de dados)
   ├── src/constants/    (enums e defaults)
   └── src/utils/        (utilitários monetários)
```

### 8.2 `apps/api` — Backend REST

**Responsabilidade:** Processar todas as operações de negócio, persistir dados, executar backup, servir os assets do frontend em produção. É o único componente com acesso direto ao banco SQLite. Expõe o endpoint `/health` para healthcheck. Em produção, executa como serviço do sistema operacional (Windows Service ou systemd — via wrapper fora do escopo deste repositório).

- Dependências diretas: `@pdv/shared`, `prisma`, `SQLite`
- Porta padrão: `3000`

### 8.3 `apps/web` — Frontend PWA

**Responsabilidade:** Interface de operação para caixas e gestores. Instalável como PWA nos terminais. Consome exclusivamente a API REST do backend. Não acessa o banco diretamente em nenhuma circunstância.

- Dependências diretas: `@pdv/shared`, `apps/api` (via HTTP)
- Porta de desenvolvimento: `5173`

### 8.4 `packages/shared` — Contrato Compartilhado

**Responsabilidade:** Ser a única fonte de verdade de tipos TypeScript, constantes de domínio e utilitários monetários usados tanto pelo backend quanto pelo frontend. Qualquer tipo que precise existir em ambos os lados deve estar aqui — nunca duplicado nos workspaces.

- Versão atual: `0.1.0`
- Exposto via subpaths: `.`, `./types`, `./constants`, `./utils`

### 8.5 `prisma/schema.prisma` — Modelo de Dados

**Responsabilidade:** Definir o schema completo do banco. Localizado na raiz do monorepo para ser compartilhado entre `apps/api` e scripts de migração. Referenciado em `apps/api/prisma.config.ts`.

---

## 9. Arquitetura de Dados

### 9.1 Visão de Domínio

O schema é organizado em cinco domínios lógicos:

```
IDENTIDADE E ACESSO          CATÁLOGO                OPERAÇÕES DE VENDA
─────────────────────        ──────────────────       ──────────────────────
User                         Product ──────────────► SaleItem
  ├─ role (RBAC)               ├─ Brand                └─ Sale
  ├─ transactions              ├─ ProductType               ├─ SalePayment
  └─ stock_movements           └─ StockMovement              └─ Transaction

FINANCEIRO E SUPORTE         SISTEMA                 PAGAMENTO DIGITAL
────────────────────         ──────────────────────── ─────────────────
Customer                     Settings                PixTransaction
  └─ Transaction             Notification
CashRegister                 BackupHistory
  └─ Transaction             AuditLog
CardMachine
  └─ CardMachineRate
```

> [!NOTE]
> `PixTransaction` é um modelo novo adicionado para controle de pagamentos Pix, gerenciando o ciclo `pending → confirmed | failed | expired`. Opera de forma independente de `Sale` (sem FK direta entre eles).

### 9.2 Convenções do Schema

| Convenção             | Regra                                                                   | Status de conformidade |
|-----------------------|-------------------------------------------------------------------------|------------------------|
| Chave primária        | `String @id @default(uuid())` em todos os modelos                       | ✅ Todos os 18 modelos conformes |
| Nomes físicos         | Todos os modelos usam `@@map(...)` para mapear para snake_case          | ✅ Conforme |
| Soft delete           | `deleted_at DateTime?` apenas em modelos de entidade de domínio (ADR-005) | ⚠️ Ver nota abaixo |
| Dinheiro              | `Int` sufixado com `_cents` (ex.: `price_cents`, `total_cents`)          | ✅ Conforme |
| Taxas e margens       | `Int` em basis points ou fator escalonado (×10000)                       | ✅ Migração concluída (ex-Float → Int) |
| Timestamps            | `created_at DateTime @default(now())`, `updated_at DateTime @updatedAt` | ✅ Conforme (onde aplicável) |
| Índices               | Definidos por modelo para todos os campos de filtro operacional         | ✅ Conforme |

### 9.3 Inventário de Modelos (visão resumida)

| # | Modelo           | Domínio            | Soft delete | Observação crítica                                                                   |
|---|------------------|--------------------|-------------|--------------------------------------------------------------------------------------|
| 1  | `User`          | Identidade         | Sim         | Relações `transactions` e `stock_movements` adicionadas (FK de `operator_id`)        |
| 2  | `Customer`      | Financeiro         | Sim         | `current_debt_cents` exige atualização atômica — confirmada via `$transaction`        |
| 3  | `Product`       | Catálogo           | Sim         | `profit_margin` migrado para `Int` — [P17.1](#p171) **resolvido**                   |
| 4  | `StockMovement` | Catálogo           | Não         | Evento imutável; `operator_id` agora com FK declarada — [P17.2](#p172) **resolvido** |
| 5  | `Brand`         | Catálogo           | Sim         | —                                                                                    |
| 6  | `ProductType`   | Catálogo           | Sim         | `profit_margin` migrado para `Int` — [P17.1](#p171) **resolvido**                   |
| 7  | `Sale`          | Operações de venda | Sim         | Idempotência por `uuid` — retorno silencioso na duplicata                            |
| 8  | `SalePayment`   | Operações de venda | **Sim** ⚠️  | Evento imutável **com** `deleted_at`; tolerância concedida como exceção (ADR-008). |
| 9  | `SaleItem`      | Operações de venda | Não         | Evento imutável; snapshot de preço e nome — imutável por design de API               |
| 10 | `CashRegister`  | Financeiro         | Não         | Evento imutável; `status` continua como `String` (`"open" | "closed"`) — sem enum   |
| 11 | `Transaction`   | Financeiro         | Não         | Evento imutável; `operator_id` agora com FK declarada — [P17.2](#p172) **resolvido** |
| 12 | `AuditLog`      | Sistema            | Não         | Append-only; apenas método `create` no repository                                    |
| 13 | `CardMachine`   | Financeiro         | Sim         | Índices operacionais adicionados em `deleted_at` e `is_active` — [P17.8](#p178) **resolvido** |
| 14 | `CardMachineRate`| Financeiro        | Não         | Índice operacional em `card_machine_id` adicionado — [P17.8](#p178) **resolvido** |
| 15 | `Settings`      | Sistema            | Sim         | `backup_password` e `backup_cloud_token` em plaintext — **risco ativo** (→ [R1](#r1), [R2](#r2), [P17.3](#p173)) |
| 16 | `Notification`  | Sistema            | Não         | `severity` agora inclui `"high"` e `"medium"` (alteração dos valores anteriores `"warning"`)  |
| 17 | `BackupHistory` | Sistema            | Não         | Índices operacionais operacionais em `status` e `created_at` — [P17.9](#p179) **resolvido** |
| 18 | `PixTransaction`| Pagamento Digital  | Não         | **Modelo novo** — controle de ciclo Pix (`pending → confirmed | failed | expired`). Sem `deleted_at` (correto — evento imutável). Índices: `status`, `created_at`. |

### 9.4 Chaves de Settings (P17.15)

O modelo `Settings` utiliza identificadores dinâmicos, documentados abaixo como exigidos pelo domínio:

| Chave | Tipo Sugerido | Descrição |
|---|---|---|
| `backup_time` | string | Horário agendado para o dump automático. |
| `backup_frequency` | enum | Tempo rotineiro de replicação (ex: daily). |
| `backup_enabled` | bool | Boolean serializado de agendamento acionado. |
| `backup_path` | string | Diretório onde o `.db` é escrito fisicamente |
| `backup_encryption_enabled` | bool | Confirmação se o GCM/AES está injetado na cloud |
| `backup_password` | string (Crypto) | Senha simétrica em repouso guardada em plaintext ou encriptada com script rotativo |
| `backup_cloud_enabled` | bool | Trigger para retransmissões num Storage AWS S3 etc |
| `backup_cloud_token` | string (Crypto) | JWT ou API Key do provider em repouso |
| `backup_retention` | int | Capacidade e histórico (em dias) |
| `fiado_alert_on_due_day` | bool | O job diário envia aviso no fechamento? |
| `fiado_alert_at_90_percent` | bool | O job diário envia warning perante o volume limite do cliente atingido? |
| `cash_register_alert_amount_cents` | int | Total do caixa antes da interrupção de limite alcançado. |
| `refund_alert_limit_cents` | int | O threshold (R$) aceitável a ser estornado. |
| `discount_limit_daily` | int | Margem passível diaria |
| `discount_limit_weekly` | int | Margem passível semanal |
| `discount_limit_monthly` | int | Limite absoluto de refação |
| `stock_alert_type_{ID}` | int | Alertas dinâmicos com a entidade do tipo atrelada aos snapshots diários |

---

## 10. Segurança e Controle de Acesso

### 10.1 Autenticação e Sessão

O mecanismo de autenticação usa credenciais de usuário (`username` + `password_hash`) para sessão principal. Operações gerenciais sensíveis (ex.: cancelamento de venda, alteração de preço) podem requerer revalidação via **PIN gerencial** (`User.pin_hash`).

**Mecanismo documentado a partir do código (P17.14 e P17.16 resolvidos):**

| Aspecto | Configuração | Fonte |
|---------|-------------|-------|
| Biblioteca de hash | `bcryptjs@^2.4.3` | `apps/api/package.json` |
| Custo do bcrypt | 12 rounds | `user.service.ts:32` |
| `pin_hash` | Mesmo algoritmo (bcrypt custo 12) | `auth.service.ts:141` (`bcrypt.compare`) |
| Tipo de token | JWT (access) + cookie httpOnly (refresh) | `auth.controller.ts:16-21` |
| Access token TTL | `JWT_EXPIRES_IN \|\| "15m"` | `config/index.ts:10` |
| Refresh token TTL | `JWT_REFRESH_EXPIRES_IN \|\| "7d"` | `config/index.ts:11` |
| Algoritmo JWT | HS256 (default de `jsonwebtoken`) | `auth.service.ts:152` |
| Cookie flags | `httpOnly: true`, `secure: NODE_ENV === "production"`, `sameSite: "strict"` | `auth.controller.ts:17-19` |
| Rate limiting (login) | 10 req / 15 min por IP | `rate-limiter.middleware.ts:3-12` |
| Rate limiting (PIN) | 10 req / 15 min por IP | `rate-limiter.middleware.ts:14-23` |
| Bloqueio por usuário | **Não implementado** | — |
| Blacklist de refresh token | **Não implementada** — rotação simples | — |

**Skills** reutilizáveis:

| Skill                                  | Uso                                               |
|----------------------------------------|---------------------------------------------------|
| `skills/architecture-blueprint-generator/` | Geração de blueprints de arquitetura           |
| `skills/create-architectural-decision-record/` | Criação automatizada de ADRs              |
| `skills/polyglot-test-agent/`          | Agente de testes políglota                        |
| `skills/refactor/`                     | Automação de refactoring                          |
| `skills/sql-code-review/`              | Review automatizado de SQL                         |

**Hooks** (`.github/hooks/`):

| Hook                                   | Uso                                               |
|----------------------------------------|---------------------------------------------------|
| `hooks/commit-message.md`              | Padrões de mensagem de commit                     |
| `hooks/pull-request-description.md`    | Padrões de descrição de PR                         |
| `hooks/review-code.md`                 | Padrões de review de código                        |

**Scripts** (`.github/scripts/`):

| Script                                 | Uso                                               |
|----------------------------------------|---------------------------------------------------|
| `scripts/setup-dev.sh`                 | Script de setup automatizado para novos devs       |

---

### 10.4 Camadas de Segurança (Adicionado)

| Pipeline | Verificação de Dependências | **Sim** | O CI roda `pnpm audit --audit-level=high` para vetar introdução de vulnerabilidades de nível alto, e uso do `.github/dependabot.yml` para monitoramento constante. |

### 10.5 Adequação à LGPD (Plano)

| Direito/Obrigação | Estado atual | Ação necessária |
|---|---|---|
| Base legal para tratamento | Execução de contrato (venda fiada) | Documentar no ToS/contrato com estabelecimento |
| Direito de acesso | Soft delete preserva dados — acesso possível via admin | Criar endpoint de exportação de dados por cliente |
| Direito de exclusão | Soft delete — dados permanecem no banco e nos backups | Definir política de retenção e anonimização |
| Portabilidade | Não implementado | Criar endpoint de exportação JSON/CSV |
| Consentimento | Não há campo explícito no cadastro | Avaliar necessidade conforme base legal |

---

## 11. CI/CD (Adicionado)

### 11.4 Gaps Conhecidos do CI

*Observação: As vulnerabilidades (pnpm audit) e o test gate foram configurados e ativados. O CI agora bloqueia falhas de cobertura e CVEs no repositório.*

### 11.7 Estratégia de Branching e Merge

A estratégia ativa utilizada nos pull requests da governança é a de **Squash do Git** (`Squash and Merge`). Esse fluxo linear condensa múltiplos commits sem poluir o histórico `main`. Configuração via GitHub UI — não há `branch-protection.yml` no repositório.

**Política recomendada**:
- **Aprovações**: 1 (considerando uma equipe reduzida).
- **Proteção da branch principal (`main`)**: Require PR, verificar status (*required status checks*) para `lint-and-typecheck`, `test`, e `build`. Restringir pushes diretos e habilitar "dismiss stale reviews".

---

---

## 12. Observabilidade (Adicionado)

### 12.1 Logs

*Toda a aplicação agora emite JSON estruturado. O logging unificado foi resolvido eliminando falsos console.log e introduzindo `utils/logger.ts` transversal.*

---

## 17. Dívida Técnica e Roadmap

| ID | Item | Impacto | Responsável | Prazo sugerido | Esforço | Status |
|----|------|---------|-------------|----------------|---------|--------|
| <a name="p171"></a>P17.1 | `Product.profit_margin` e `ProductType.profit_margin` em `Float` — migrar para `Int` (fator escalonado) | Médio | Backend | Próximo sprint | Pequeno | **Resolvido** (05/04/2026) — Schema migrado para `Int`. Conversão via `toStoredRatio`/`fromStoredRatio`. |
| <a name="p172"></a>P17.2 | `operator_id` sem FK declarada em `StockMovement` e `Transaction` | Alto | Backend | Próximo sprint | Pequeno | **Resolvido** (05/04/2026) — FK declarada com `@relation` no schema. |
| <a name="p173"></a>P17.3 | `Settings.backup_password` e `backup_cloud_token` em plaintext no banco — credenciais expostas | Alto | Backend/Infra | Urgente | Médio | **Resolvido** (06/04/2026) — Criptografia AES-256-GCM em nível de aplicação via `SettingsRepository` |
| <a name="p174"></a>P17.4 | Healthcheck do `api` valida apenas execução de `fetch`, não status HTTP | Alto | Infra | Próximo sprint | Pequeno | **Resolvido** (05/04/2026) — `docker-compose.yml:22` agora verifica `response.ok`. |
| <a name="p175"></a>P17.5 | `.env.example` desatualizado (`PIX_KEY_TYPE`, `PIX_WEBHOOK_SECRET`, `APP_TIME_ZONE` ausentes) | Alto | Docs | Imediato | Trivial | **Resolvido** (05/04/2026) — `.env.example` contém todas as 15 variáveis com comentários. |
| <a name="p176"></a>P17.6 | Network do `docker-compose.yml` não declarada explicitamente | Médio | Infra | Próximo sprint | Trivial | **Resolvido** (05/04/2026) — `pdv-network` com driver `bridge` declarada em `docker-compose.yml:44-46`. |
| <a name="p177"></a>P17.7 | Política de cobertura mínima não configurada no CI como gate de falha | Médio | CI/QA | Próximo sprint | Pequeno | **Resolvido** (06/04/2026) — Configurada em ambos os apps (api=50, web=70) com barreira de CI no job test |
| <a name="p178"></a>P17.8 | `CardMachine` e `CardMachineRate` sem `@@index` explícito | Médio | Backend | Próximo sprint | Trivial | Aberto |
| <a name="p179"></a>P17.9 | `BackupHistory` sem `@@index` — risco de performance com histórico longo | Médio | Backend | Próximo sprint | Trivial | Aberto |
| <a name="p1710"></a>P17.10 | Tipos fortes para `Settings.key` (payload de atualização flexível) | Médio | Backend | Backlog | Médio | **Parcial** (06/04/2026) — Configurações documentadas; refatoração tipada pendente |
| <a name="p1711"></a>P17.11 | `pnpm audit` não está no pipeline de CI | Médio | CI/Infra | Backlog | Trivial | **Resolvido** (06/04/2026) — Job `Security Audit` de nível `high` ativado na pipeline principal |
| <a name="p1712"></a>P17.12 | Logging estruturado não implementado — API usa apenas stdout/stderr | Médio | Backend/Infra | Backlog | Médio | **Resolvido** (06/04/2026) — Logging unificado em JSON via utils/logger.ts com propagação de requestId. |
| <a name="p1713"></a>P17.13 | `SalePayment.applied_rate` e `CardMachineRate.debit_rate` em `Float` — risco de arredondamento | Médio | Backend | Backlog | Pequeno | **Resolvido** (05/04/2026) — Todos os campos migrados para `Int` (basis points). |
| <a name="p1714"></a>P17.14 | Documentar mecanismo de hash para `password_hash` e `pin_hash` (bcrypt? argon2?) | Baixo | Docs | Backlog | Trivial | **Resolvido** (05/04/2026) — `bcryptjs` custo 12, documentado na Seção 10.1 e ADR-006. |
| <a name="p1715"></a>P17.15 | Documentar matriz completa de chaves válidas de `Settings.key` | Baixo | Docs | Backlog | Trivial | **Resolvido** (06/04/2026) — Tabela formatada e unificada no repositório. |
| <a name="p1716"></a>P17.16 | Documentar mecanismo de sessão (JWT vs cookie), tempo de expiração, CORS e política de refresh | Alto | Backend/Docs | Próximo sprint | Pequeno | **Resolvido** (05/04/2026) — JWT access 15m + refresh 7d em cookie httpOnly, documentado na Seção 10.1, 10.3 e ADR-006. |
| <a name="p1717"></a>P17.17 | Avaliação e documentação formal de adequação à LGPD (bases legais, direito de exclusão, retenção) | Alto | Backend/Infra | Próximo sprint | Médio | Aberto |
| <a name="p1718"></a>P17.18 | Documentar estratégia formal de branching (nomenclatura, ciclo de vida de branches) | Médio | Docs/Tech Lead | Próximo sprint | Trivial | **Resolvido** (06/04/2026) — Política de Squash and Merge e proteções de branch documentadas na Seção 11.7. |
| <a name="p1719"></a>P17.19 | Implementar coleta de métricas operacionais (CPU, memória do processo, tamanho do banco, tamanho da pasta backups, latência da API, taxa de erros HTTP 5xx) | Médio | Infra | Backlog | Médio | Aberto |
| <a name="p1720"></a>P17.20 | Implementar canal de alerta proativo para `Notification` de severidade `critical` (webhook push via ntfy.sh ou Slack/WhatsApp) | Médio | Backend/Infra | Backlog | Médio | Aberto |
| <a name="p1721"></a>P17.21 | Preencher matriz de escalação de incidentes com contatos reais (Seção 14.3) | Alto | Tech Lead | Imediato | Trivial | Aberto |
| <a name="p1722"></a>P17.22 | `customer-debt-check.job.ts` formata valores monetários via divisão manual (`current_debt_cents / 100`) em vez de `formatCents` — inconsistência de formatação BRL | Baixo | Backend | Backlog | Trivial | **Resolvido** (06/04/2026) — Formatação convertida para `formatCents` nativo |
| <a name="p1723"></a>P17.23 | Divergência entre teste e implementação de idempotência de venda: teste espera 409 mas `sale.service.ts:56-57` retorna venda existente sem throw. Alinhar comportamento. | Médio | Backend | Próximo sprint | Pequeno | **Resolvido** (06/04/2026) — Teste renomeado e adaptado para refletir sucesso na idempotência HTTP 200/201 |
| <a name="p1724"></a>P17.24 | Cobertura de `AuditLog` incompleta: abertura/fechamento de caixa, sangria/suprimento, alteração de preço e exclusão de usuário não geram registros de auditoria | Alto | Backend | Próximo sprint | Médio | **Resolvido** (06/04/2026) — Repositório de auditoria implementado nas rotinas críticas |
| <a name="p1725"></a>P17.25 | `SalePayment` possui `deleted_at DateTime?` no schema — violação de ADR-005 (soft delete em modelo de evento imutável). Avaliar se intencional e documentar como ADR ou remover o campo. | Médio | Backend | Próximo sprint | Pequeno | **Resolvido** (06/04/2026) — Exceção avaliada, justificada e documentada (ADR-008). |
| <a name="p1726"></a>P17.26 | Diretório `prisma/migrations/` inexistente — não há migrations versionadas. O comando `prisma migrate deploy` documentado no deploy é inoperante. Inicializar migrations ou registrar ADR para uso de `db push` em produção. | Alto | Backend/Infra | Urgente | Pequeno | **Resolvido** (05/04/2026) — Migration inicial `0001_init` criada via `prisma migrate diff` e baselined com `prisma migrate resolve`. Script `db:migrate:deploy` operacional. |
| <a name="p1727"></a>P17.27 | Sem bloqueio por usuário após tentativas de login inválidas — rate limiting atual é apenas por IP (`express-rate-limit`). Um atacante com múltiplos IPs pode tentar brute force sem lockout. | Médio | Backend | Próximo sprint | Pequeno | **Resolvido** (06/04/2026) — Limiter por login configurado (`userLoginLimiter`). |
| <a name="p1728"></a>P17.28 | `JWT_SECRET` e `JWT_REFRESH_SECRET` com fallback vazio (`""`) em modo dev — risco de deploy em produção sem secrets configurados se `NODE_ENV` não estiver setado | Alto | Backend/Infra | Próximo sprint | Trivial | **Resolvido** (06/04/2026) — Falback removido; `assertRequiredSecrets` ativado para todos os perfis. |
| <a name="p1729"></a>P17.29 | Diretório `apps/web/public/` inexistente — ícones do manifest PWA (`/icons/icon-192x192.png`, `/icons/icon-512x512.png`) ausentes. Instalação da PWA vai falhar. | Alto | Frontend | Imediato | Trivial | **Resolvido** (06/04/2026) — Script de conversão de ícones adicionado no repositório |
| <a name="p1730"></a>P17.30 | WebSocket (`ws`) sem ADR formal — decisão documentada retroativamente como ADR-007 neste bloco | Baixo | Docs | Resolvido | Trivial | **Resolvido** (05/04/2026) — ADR-007 documentado. |
| <a name="p1731"></a>P17.31 | Logging misto: `index.ts` emite JSON estruturado mas restante da aplicação usa `console.log`/`console.error` com prefixos manuais — inconsistência de formato | Médio | Backend | Backlog | Médio | **Resolvido** (06/04/2026) — Todos os console.log foram substituídos por logInfo/logError integrados ao JSON logger. |
| <a name="p1732"></a>P17.32 | `.github/dependabot.yml` não existe — vulnerabilidades de dependências não são monitoradas automaticamente pelo GitHub | Médio | CI/Infra | Próximo sprint | Trivial | **Resolvido** (06/04/2026) — Dependabot configurado via grupos com varredura semanal para NPM e Actions |
| <a name="p1733"></a>P17.33 | Campos `Autores` e `Revisores` nos metadados do documento não preenchidos com nomes reais — impedindo status `Vigente` | Alto | Tech Lead | Imediato | Trivial | ✅ Resolvido (06/04/2026) |
| <a name="p1734"></a>P17.34 | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` e `SECURITY.md` inexistentes no repositório — governança incompleta para colaboradores externos | Baixo | Docs | Backlog | Pequeno | **Resolvido** (06/04/2026) — Arquivos de governança global implementados |

---

## 18. Referências

### 18.1 Referências Internas (repositório)

| Documento                            | Localização                                          |
|--------------------------------------|------------------------------------------------------|
| Requisitos arquiteturais de alto nível | `.github/ARCHITECTURE.md`                          |
| Padrões técnicos por domínio         | `.github/instructions/*.instructions.md`             |
| Definição de agentes de IA           | `.github/agents/*.md`                                |
| Schema de banco de dados             | `prisma/schema.prisma`                               |
| Configuração do Prisma               | `apps/api/prisma.config.ts`                          |
| Pipeline de CI                       | `.github/workflows/ci.yml`                           |
| Variáveis de ambiente de exemplo     | `.env.example`                                       |
| Instruções de segurança OWASP        | `.github/instructions/security-and-owasp.instructions.md` |
| Documentação de produto e contexto   | `docs/info-projeto/`                                 |
| Análise de responsividade            | `docs/info-projeto/analise-responsividade.md`        |
| Guia do Copilot                      | `docs/info-projeto/guia-copilot.md`                  |
| Informações gerais do projeto        | `docs/info-projeto/informacoes-do-projeto.md`        |

### 18.2 Referências Externas

| Documento                     | URL                                          |
|-------------------------------|----------------------------------------------|
| SQLite WAL mode               | https://www.sqlite.org/wal.html              |
| SQLite VACUUM INTO            | https://www.sqlite.org/lang_vacuum.html      |
| Documentação Prisma           | https://www.prisma.io/docs                   |
| OWASP Top 10                  | https://owasp.org/www-project-top-ten/       |
| LGPD — Lei 13.709/2018        | https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm |
| pnpm workspaces               | https://pnpm.io/workspaces                   |
| Prisma migrate deploy         | https://www.prisma.io/docs/reference/api-reference/command-reference#migrate-deploy |
| Express.js                    | https://expressjs.com/                       |
| JSON Web Tokens (RFC 7519)    | https://datatracker.ietf.org/doc/html/rfc7519 |
| Vite                          | https://vite.dev/                            |
| Vitest                        | https://vitest.dev/                          |
| Vue 3 Docs                    | https://vuejs.org/                           |
| Tailwind CSS v4               | https://tailwindcss.com/docs/v4              |
| Playwright                    | https://playwright.dev/                      |

---

## Apêndice A — Schema Prisma Detalhado

> Esta seção contém o detalhamento campo a campo de todos os modelos. Para a visão de domínio e convenções gerais, consulte a [Seção 9](#9-arquitetura-de-dados).

### User

| Campo                | Tipo      | Observação                                     |
|----------------------|-----------|------------------------------------------------|
| `id`                 | String    | PK `@id @default(uuid())`                      |
| `name`               | String    | Nome exibido                                   |
| `username`           | String    | Único — login                                  |
| `password_hash`      | String    | Hash da senha (`bcryptjs` custo 12 — **documentado**, [P17.14](#p1714) resolvido) |
| `pin_hash`           | String?   | Hash de PIN gerencial opcional                 |
| `role`               | String    | `admin\|manager\|stockist\|operator`           |
| `can_view_cost_price`| Boolean   | Default `false`                                |
| `is_active`          | Boolean   | Default `true`                                 |
| `created_at`         | DateTime  | `@default(now())`                              |
| `updated_at`         | DateTime  | `@updatedAt`                                   |
| `deleted_at`         | DateTime? | Soft delete                                    |

Relações: `sales`, `cash_registers`, `audit_logs`, `transactions`, `stock_movements`.
Índices: `username`, `role`.

---

### Customer

| Campo                | Tipo      | Observação                          |
|----------------------|-----------|-------------------------------------|
| `id`                 | String    | PK                                  |
| `name`               | String    | Nome do cliente                     |
| `phone`              | String?   | Telefone                            |
| `email`              | String?   | Email                               |
| `credit_limit_cents` | Int       | Limite de crédito fiado             |
| `current_debt_cents` | Int       | Dívida atual fiado                  |
| `payment_due_day`    | Int?      | Dia de vencimento mensal            |
| `credit_blocked`     | Boolean   | Bloqueia novas vendas fiadas        |
| `is_active`          | Boolean   | Ativo                               |
| `created_at`         | DateTime  | —                                   |
| `updated_at`         | DateTime  | `@updatedAt`                        |
| `deleted_at`         | DateTime? | Soft delete                         |

Relações: `sales`, `transactions`.
Índices: `name`, `[deleted_at, is_active]`, `[deleted_at, name]`, `[deleted_at, payment_due_day]`.

---

### Product

| Campo                | Tipo      | Observação                              |
|----------------------|-----------|-----------------------------------------|
| `id`                 | String    | PK                                      |
| `name`               | String    | Nome                                    |
| `barcode`            | String?   | Único                                   |
| `brand_id`           | String?   | FK opcional → Brand                     |
| `description`        | String?   | Descrição longa                         |
| `weight_value`       | Float?    | Valor numérico do peso                  |
| `weight_unit`        | String?   | Unidade (`kg`, `g`, etc.)               |
| `product_type_id`    | String?   | FK opcional → ProductType               |
| `profit_margin`      | Int?      | Margem de lucro como fator escalonado (×10000). Ex.: 0.25 (25%) → `2500`. **Migração concluída** (ex-Float). Conversão via `toStoredRatio`/`fromStoredRatio` (`apps/api/src/utils/percentage-scaling.ts`). |
| `price_cents`        | Int       | Preço de venda em centavos              |
| `cost_price_cents`   | Int       | Custo em centavos                       |
| `average_cost_cents` | Int       | Custo médio em centavos                 |
| `stock_quantity`     | Float     | Estoque atual (Float para granel)       |
| `min_stock_alert`    | Int       | Alerta de estoque mínimo                |
| `is_bulk`            | Boolean   | Produto vendido a granel                |
| `is_active`          | Boolean   | Ativo                                   |
| `created_at`         | DateTime  | —                                       |
| `updated_at`         | DateTime  | `@updatedAt`                            |
| `deleted_at`         | DateTime? | Soft delete                             |

Relações: `brand`, `product_type`, `sale_items`, `stock_movements`.
Índices: `barcode`, `name`, `brand_id`, `product_type_id`.

---

### StockMovement

| Campo             | Tipo     | Observação                                            |
|-------------------|----------|-------------------------------------------------------|
| `id`              | String   | PK                                                    |
| `product_id`      | String   | FK → Product                                          |
| `type`            | String   | `entry\|sale\|adjustment`                             |
| `quantity`        | Float    | Positivo: entrada; negativo: saída                    |
| `unit_cost_cents` | Int      | Custo unitário em centavos                            |
| `description`     | String?  | Observação                                            |
| `operator_id`     | String   | FK → User — **relação declarada** (`@relation(fields: [operator_id])` — [P17.2](#p172) **resolvido**) |
| `created_at`      | DateTime | —                                                     |

Relações: `product`, `operator` (FK declarada).
Índices: `operator_id`, `[product_id, created_at]`, `created_at`.

---

### Brand

| Campo        | Tipo      | Observação    |
|--------------|-----------|---------------|
| `id`         | String    | PK            |
| `name`       | String    | Único         |
| `created_at` | DateTime  | —             |
| `updated_at` | DateTime  | `@updatedAt`  |
| `deleted_at` | DateTime? | Soft delete   |

Relações: `products`. Índices: unique `name`.

---

### ProductType

| Campo          | Tipo      | Observação                                            |
|----------------|-----------|-------------------------------------------------------|
| `id`           | String    | PK                                                    |
| `name`         | String    | Único                                                 |
| `profit_margin`| Int?      | Margem de lucro como fator escalonado (×10000). **Migração concluída** (ex-Float). |
| `created_at`   | DateTime  | —                                                     |
| `updated_at`   | DateTime  | `@updatedAt`                                          |
| `deleted_at`   | DateTime? | Soft delete                                           |

Relações: `products`. Índices: unique `name`.

---

### Sale

| Campo            | Tipo      | Observação                              |
|------------------|-----------|-----------------------------------------|
| `id`             | String    | PK                                      |
| `uuid`           | String    | Único — garante idempotência de venda   |
| `operator_id`    | String    | FK → User                               |
| `customer_id`    | String?   | FK opcional → Customer                  |
| `terminal_id`    | String    | Identificação do terminal               |
| `payment_method` | String    | Método principal de pagamento           |
| `subtotal_cents` | Int       | Subtotal em centavos                    |
| `discount_cents` | Int       | Desconto em centavos                    |
| `total_cents`    | Int       | Total em centavos                       |
| `status`         | String    | Default `completed`                     |
| `created_at`     | DateTime  | —                                       |
| `updated_at`     | DateTime  | `@updatedAt`                            |
| `deleted_at`     | DateTime? | Soft delete                             |

Relações: `operator`, `customer`, `items`, `payments`, `transactions`.
Índices: `uuid`, `operator_id`, `customer_id`, `terminal_id`, `created_at`.

---

### SalePayment

| Campo          | Tipo     | Observação                                             |
|----------------|----------|--------------------------------------------------------|
| `id`           | String   | PK                                                     |
| `sale_id`      | String   | FK → Sale                                              |
| `method`       | String   | Meio de pagamento                                      |
| `amount_cents` | Int      | Valor em centavos                                      |
| `installments` | Int?     | Número de parcelas                                     |
| `applied_rate` | Int?     | Taxa aplicada em basis points — **migração concluída** (ex-Float) |
| `created_at`   | DateTime | —                                                      |
| `deleted_at`   | DateTime? | **⚠️ Soft delete em evento imutável** — possível violação de ADR-005 (→ [P17.25](#p1725)) |

Relações: `sale`. Índices: `deleted_at`, `sale_id`, `method`.

---

### SaleItem

| Campo              | Tipo     | Observação                           |
|--------------------|----------|--------------------------------------|
| `id`               | String   | PK                                   |
| `sale_id`          | String   | FK → Sale                            |
| `product_id`       | String   | FK → Product                         |
| `product_name`     | String   | Snapshot de nome no momento da venda |
| `quantity`         | Float    | Quantidade                           |
| `unit_price_cents` | Int      | Snapshot de preço unitário           |
| `discount_cents`   | Int      | Desconto no item                     |
| `total_cents`      | Int      | Total do item                        |

Relações: `sale`, `product`. Índices: `sale_id`, `product_id`.

---

### CashRegister

| Campo                    | Tipo      | Observação                         |
|--------------------------|-----------|------------------------------------|
| `id`                     | String    | PK                                 |
| `operator_id`            | String    | FK → User                          |
| `terminal_id`            | String    | Terminal de operação               |
| `opening_balance_cents`  | Int       | Fundo de troco inicial             |
| `closing_balance_cents`  | Int?      | Valor informado no fechamento      |
| `expected_balance_cents` | Int?      | Valor esperado calculado           |
| `difference_cents`       | Int?      | Diferença (`closing - expected`)   |
| `status`                 | String    | `open\|closed`                     |
| `opened_at`              | DateTime  | —                                  |
| `closed_at`              | DateTime? | —                                  |

Relações: `operator`, `transactions`. Índices: `terminal_id`, `operator_id`, `status`.

---

### Transaction

| Campo               | Tipo      | Observação                                       |
|---------------------|-----------|--------------------------------------------------|
| `id`                | String    | PK                                               |
| `type`              | String    | Tipo de transação                                |
| `amount_cents`      | Int       | Valor em centavos                                |
| `sale_id`           | String?   | FK opcional → Sale                               |
| `customer_id`       | String?   | FK opcional → Customer                           |
| `cash_register_id`  | String    | FK → CashRegister                                |
| `operator_id`       | String    | FK → User — **relação declarada** ([P17.2](#p172) **resolvido**)  |
| `debt_before_cents` | Int?      | Dívida do cliente antes da transação             |
| `description`       | String?   | Observação                                       |
| `created_at`        | DateTime  | —                                                |

Relações: `sale`, `customer`, `cash_register`, `operator`.
Índices: `type`, `sale_id`, `customer_id`, `cash_register_id`, `operator_id`, `created_at`.

---

### AuditLog

| Campo          | Tipo      | Observação                             |
|----------------|-----------|----------------------------------------|
| `id`           | String    | PK                                     |
| `action`       | String    | Nome da ação auditada                  |
| `actor_id`     | String    | FK → User                              |
| `entity_type`  | String    | Nome da entidade afetada               |
| `entity_id`    | String    | ID da entidade afetada                 |
| `details`      | String?   | JSON serializado com detalhes          |
| `ip_address`   | String?   | IP do terminal                         |
| `terminal_id`  | String?   | Terminal de origem                     |
| `created_at`   | DateTime  | —                                      |

Relações: `actor`. Índices: `actor_id`, `action`, `[entity_type, entity_id]`, `created_at`.

---

### CardMachine

| Campo        | Tipo      | Observação                                                          |
|--------------|-----------|---------------------------------------------------------------------|
| `id`         | String    | PK                                                                  |
| `name`       | String    | Nome/identificação da maquininha                                    |
| `is_active`  | Boolean   | Ativa                                                               |
| `absorb_fee` | Boolean   | Estabelecimento absorve a taxa (não repassa)                        |
| `created_at` | DateTime  | —                                                                   |
| `updated_at` | DateTime  | `@updatedAt`                                                        |
| `deleted_at` | DateTime? | Soft delete                                                         |

Relações: `rates`. **Sem `@@index` explícito — Pendência [P17.8](#p178).**

---

### CardMachineRate

| Campo                     | Tipo     | Observação                                             |
|---------------------------|----------|--------------------------------------------------------|
| `id`                      | String   | PK                                                     |
| `card_machine_id`         | String   | FK → CardMachine                                       |
| `debit_rate`              | Int      | Taxa débito em basis points — **migração concluída** (ex-Float) |
| `credit_base_rate`        | Int      | Taxa crédito base em basis points — **migração concluída** (ex-Float) |
| `credit_incremental_rate` | Int      | Taxa incremental por parcela em basis points            |
| `max_installments`        | Int      | Máximo de parcelas suportadas                          |
| `created_at`              | DateTime | —                                                      |
| `updated_at`              | DateTime | `@updatedAt`                                           |

Relações: `card_machine`. **Sem `@@index` explícito — Pendência [P17.8](#p178).**

---

### Settings

| Campo                       | Tipo      | Observação                                                    |
|-----------------------------|-----------|---------------------------------------------------------------|
| `id`                        | String    | PK                                                            |
| `key`                       | String    | Único — chave de configuração                                 |
| `value`                     | String    | Valor da configuração                                         |
| `backup_path`               | String?   | Caminho dos backups                                           |
| `backup_frequency`          | String?   | Frequência (cron pattern ou nome de frequência)               |
| `backup_retention`          | Int?      | Número de backups a manter                                    |
| `backup_cloud_enabled`      | Boolean   | Backup em nuvem ativo                                         |
| `backup_cloud_token`        | String?   | **Resolvido [R2](#r2)** — token criptografado (AES-256-GCM)   |
| `backup_encryption_enabled` | Boolean   | Criptografia ativa                                            |
| `backup_password`           | String?   | **Resolvido [R1](#r1)** — senha criptografada (AES-256-GCM)   |
| `backup_time`               | String?   | Horário sugerido para execução do backup                      |
| `updated_at`                | DateTime  | `@updatedAt`                                                  |
| `deleted_at`                | DateTime? | Soft delete                                                   |

Relações: não possui. Índices: unique `key`, `deleted_at`.

---

### Notification

| Campo             | Tipo      | Observação                                 |
|-------------------|-----------|--------------------------------------------|
| `id`              | String    | PK                                         |
| `type`            | String    | Tipo de notificação                        |
| `severity`        | String    | `critical\|high\|medium\|info`                  |
| `title`           | String    | Título exibido                             |
| `message`         | String    | Corpo da notificação                       |
| `meta`            | String?   | JSON serializado com dados extras          |
| `target_roles`    | String    | JSON serializado — roles destinatárias     |
| `read_at`         | DateTime? | Quando foi lida                            |
| `acknowledged_by` | String?   | ID do usuário que confirmou               |
| `created_at`      | DateTime  | —                                          |

Relações: não possui. Sem soft delete.
Índices: `[severity, created_at]`, `[read_at, created_at]`.

---

### BackupHistory

| Campo          | Tipo     | Observação                                                   |
|----------------|----------|--------------------------------------------------------------|
| `id`           | String   | PK                                                           |
| `createdAt`    | DateTime | Data de execução do backup                                   |
| `sizeBytes`    | Int      | Tamanho do arquivo de backup                                 |
| `status`       | String   | `success\|error\|pending`                                    |
| `filePath`     | String   | Caminho físico do arquivo gerado                             |
| `errorMessage` | String?  | Mensagem de erro se `status = error`                         |

Relações: não possui. **Sem `@@index` — Pendência [P17.9](#p179).**

---

### PixTransaction

| Campo              | Tipo      | Observação                                         |
|--------------------|-----------|-----------------------------------------------------|
| `id`               | String    | PK `@id @default(uuid())`                           |
| `tx_id`            | String    | Único — identificador da transação Pix (chave de correlação) |
| `amount_cents`     | Int       | Valor da cobrança em centavos                        |
| `status`           | String    | `pending \| confirmed \| failed \| expired`         |
| `created_at`       | DateTime  | `@default(now())`                                    |
| `expires_at`       | DateTime  | Timestamp de expiração da cobrança                   |
| `paid_at`          | DateTime? | Timestamp do pagamento confirmado                    |
| `paid_amount_cents`| Int?      | Valor efetivamente pago (pode diferir do solicitado) |
| `updated_at`       | DateTime  | `@updatedAt`                                         |

Relações: não possui (opera de forma independente de `Sale`).
Índices: `tx_id` (unique), `status`, `created_at`.
Mapeamento: `@@map("pix_transaction")`.

> [!NOTE]
> O estado de transações Pix em andamento é mantido em memória pelo `PixService` durante o ciclo de vida do processo. Um restart do servidor limpa esse estado in-memory — o `PixTransaction` no banco persiste o estado de longo prazo para reconciliação.

---

## Apêndice B — Índice de Arquivos

| Localização | Arquivo                               | Propósito resumido                                          |
|-------------|---------------------------------------|-------------------------------------------------------------|
| Root        | `package.json`                        | Scripts e metadados do monorepo                             |
| Root        | `pnpm-workspace.yaml`                 | Declaração de workspaces (`apps/*`, `packages/*`)           |
| Root        | `tsconfig.json`                       | Baseline TypeScript global (strict + ES2022)                |
| Root        | `docker-compose.yml`                  | Orquestração de `api` e `web` em desenvolvimento           |
| Root        | `.env.example`                        | Exemplo de variáveis de ambiente (**atualizado** — [P17.5](#p175) resolvido) |
| Root        | `.gitignore`                          | Exclusões de versionamento (inclui `.env`, `data/`)         |
| Root        | `.npmrc`                              | Ajustes de comportamento do pnpm                            |
| Root        | `.dockerignore`                       | Exclusões de build Docker                                   |
| Prisma      | `prisma/schema.prisma`                | Schema único de banco de dados do sistema                   |
| Prisma      | `prisma/prisma.config.ts`             | Configuração Prisma raíz (referência alternativa)            |
| API         | `apps/api/prisma.config.ts`           | Referência ao schema e URL do banco por ambiente            |
| API         | `apps/api/Dockerfile`                 | Build container da API                                      |
| API         | `apps/api/tsconfig.json`              | Configuração TypeScript da API                              |
| API         | `apps/api/package.json`               | Scripts e dependências do `@pdv/api`                        |
| Web         | `apps/web/Dockerfile`                 | Build container do frontend                                 |
| Web         | `apps/web/vite.config.ts`             | Configuração Vite (proxy, PWA, plugins)                     |
| Web         | `apps/web/vitest.config.ts`           | Configuração de testes unitários (jsdom, coverage)          |
| Web         | `apps/web/playwright.config.ts`       | Configuração de testes E2E (Chromium)                       |
| Web         | `apps/web/tsconfig.json`              | Configuração TypeScript do frontend                         |
| Web         | `apps/web/tsconfig.node.json`         | Configuração TypeScript para scripts Node (vite.config)     |
| Web         | `apps/web/env.d.ts`                   | Declarações de tipo para variáveis de ambiente Vite         |
| Web         | `apps/web/package.json`               | Scripts e dependências do `@pdv/web`                        |
| Shared      | `packages/shared/package.json`        | Metadados e exports do pacote compartilhado                 |
| Shared      | `packages/shared/tsconfig.json`       | Configuração TypeScript do shared                           |
| Shared      | `packages/shared/src/index.ts`        | Barrel principal do pacote compartilhado                    |
| Shared      | `packages/shared/src/types/*.ts`      | Contratos tipados da API e do domínio                       |
| Shared      | `packages/shared/src/constants/*.ts`  | Catálogos de constantes de domínio                          |
| Shared      | `packages/shared/src/utils/money.ts`  | Utilitários monetários (BRL, centavos)                      |
| GitHub      | `.github/ARCHITECTURE.md`             | Arquitetura e regras de negócio globais                     |
| GitHub      | `.github/copilot-instructions.md`     | Instruções de IA para o repositório                         |
| GitHub      | `.github/workflows/ci.yml`            | Pipeline de CI                                              |
| GitHub      | `.github/CODEOWNERS`                  | Ownership de código                                         |
| GitHub      | `.github/PULL_REQUEST_TEMPLATE.md`    | Template de Pull Request                                    |
| GitHub      | `.github/ISSUE_TEMPLATE/*.yml`        | Templates de issues (bug report, feature request)           |
| GitHub      | `.github/instructions/*.md`           | Guias técnicos por domínio (9 arquivos)                     |
| GitHub      | `.github/agents/*.md`                 | Agentes especializados de IA (4 arquivos)                   |
| GitHub      | `.github/prompts/*.md`                | Prompts prontos por tipo de tarefa (4 arquivos)             |
| GitHub      | `.github/skills/*/`                   | Skills reutilizáveis de IA (5 diretórios)                  |
| GitHub      | `.github/hooks/*.md`                  | Hooks de commit/PR/review (3 arquivos)                      |
| GitHub      | `.github/scripts/setup-dev.sh`        | Script automatizado de setup para novos devs                |
| Docs        | `docs/info-projeto/`                  | Documentação de produto e contexto de projeto               |

---

## Apêndice C — Histórico de Versões

| Versão  | Data       | Autor       | Descrição                                                                                              |
|---------|------------|-------------|--------------------------------------------------------------------------------------------------------|
| `4.1.0` | 06/04/2026 | @MoisesVNdev | Atualização de Governança 4.1.0: CONTRIBUTING/SECURITY/CODE_OF_CONDUCT implementados, Merge Strategy via Squash e proteções de PR definidos na Seção 11.7, Matriz de Settings exportada em Seção 9.4, LGPD abordada via 10.5 e unificação rigorosa de logs. Itens P17.18, 17.15, 17.10, 17.12, 17.31, 17.29, 17.3, 17.11 resolvidos ou atualizados no backlog. |
| `4.0.0` | 05/04/2026 | @MoisesVNdev | Bloco 3 — Governança e Roadmap: Seção 6 expandida (24 linhas de stack com versões reais), Seção 13 reescrita (15 env vars, inventário completo, staging inexistente documentado), Seção 15 reescrita (15 vars, scripts com comando real, Docker volumes detalhados), Seção 16 expandida (skills, hooks, scripts, ISSUE_TEMPLATE), Seção 18 expandida (7 novas referências externas, 4 novas internas), Apêndice A P17.14 resolvido, Apêndice B expandido (15 novos arquivos), P17.5/P17.7 resolvidos/parciais, novos P17.33–P17.34, versão 4.0.0 (major: consolidação de 3 blocos de auditoria completa) |
| `3.2.0` | 05/04/2026 | @MoisesVNdev | Bloco 2 — Rede, Segurança e Operações: diagrama corrigido (Express, WS, proxy), ADR-001 expandido (WAL pragmas, busy_timeout), ADR-003 expandido (VitePWA, public/ ausente), ADR-004 corrigido (copyFile vs VACUUM INTO), ADR-005 reclassificação Sale/SalePayment, novos ADR-006 (JWT) e ADR-007 (WebSocket), Seções 10.1/10.3/10.4 reescritas com dados do código, P17.4/P17.6/P17.14/P17.16 resolvidos, P17.12/P17.18 parciais, 7 novos itens de dívida técnica (P17.27–P17.32), risco R6 adicionado |
| `3.1.0` | 05/04/2026 | @MoisesVNdev | Bloco 1 — Dados e Arquitetura: migração Float→Int confirmada (P17.1, P17.13 resolvidos), FK de operator_id confirmada (P17.2 resolvido), modelo PixTransaction documentado, correção de backup (copyFile vs VACUUM INTO, incompatibilidade OpenSSL), SalePayment soft-delete identificado, 5 novos itens de dívida técnica (P17.22–P17.26), atualização de Notification.severity, atualização de procedimento de restore |
| `3.0.0` | 04/04/2026 | @MoisesVNdev | Reestruturação de nível sênior: reordenação de seções, apêndices separados da numeração principal, ADRs e runbooks com headings navegáveis, nova Seção 13 (Matriz de Ambientes), nova Seção 14 (Gestão de Incidentes), expansão de Segurança (CORS, LGPD, sessão), CI/CD com CD e rollback, correção ADR-005, callouts padronizados, cross-references com âncoras, 7 novos itens de dívida técnica (P17.15–P17.21) |
| `2.0.0` | 01/04/2026 | @MoisesVNdev | Reestruturação completa: contexto, operações, segurança, onboarding, ADRs                              |
| `1.0.0` | 29/03/2026 | @MoisesVNdev | Versão inicial — extração de infraestrutura do repo                                                    |

_Documento mantido por [Moisés Vila Nova De Oliveira](https://github.com/MoisesVNdev/MoisesVNdev) — contato: moisesvn.dev@gmail.com_