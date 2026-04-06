# Guia de Contribuição - PDV FiadoDigital

Obrigado pelo seu interesse em contribuir! Este documento traça as diretrizes para participar do desenvolvimento do repositório.

## 1. Pré-requisitos

Para ambiente local, você precisará ter instalado:
- **Node.js** (v20)
- **pnpm** (v9)
- **Git**

Consulte o passo-a-passo e o setup detalhado na **Seção 15** do `docs/info-projeto/resumo-infraestrutura-projeto.md`.

## 2. Fluxo de Trabalho (Workflow)

Seguimos um GitHub Flow simplificado:
1. **Branching**: Crie branches a partir da `main` no formato `<tipo>/<nome-com-hifens>`, como por exemplo: `feature/adicionar-pagamento`, `fix/corrigir-crash-venda`.
2. **Commits**: Utilize o padrão de *Conventional Commits*:
   - `feat:` Nova funcionalidade
   - `fix:` Correção de bug
   - `chore:` Tarefas de build, config e manutenção geral
   - `docs:` Mudanças na documentação
3. **Mergindo**: Abra um Pull Request (PR) direcionado à `main`. Aguarde o pipeline de CI (lint, testes, build, e cobertura de código) aprovar com "verde".

## 3. Padrões de Código e Arquitetura

Respeitamos padrões estritos de código definidos em `.github/instructions/`:
- **TypeScript Estrito:** A utilização de `any` não é recomendada sob nenhuma circunstância.
- **Domínio Monetário:** Jamais utilize o tipo `Float` para guardar dinheiro. Represente transações financeiras em formato estrito de **CENTAVOS** com o tipo `Int`.
- **Formatação**: Utilize a função `formatCents` disponível em `@pdv/shared` para conversões monetárias em componentes de UI.

Leia também a pasta `.github/instructions/` para diretrizes de componentes web, design responsivo, etc.

## 4. Como Executar os Testes

As requisições dependem de uma cobertura de testes de qualidade para serem aceitas.
Para executar testes na raiz do projeto (ou no pacote em que for trabalhar):

```bash
pnpm test:unit
```

## 5. Como Abrir um Pull Request (PR)

- Ao abrir o PR, a sua descrição deve basear-se no nosso *template* de submissão encontrado em `.github/PULL_REQUEST_TEMPLATE.md`.
- Preencha o status das alterações, as evidências necessárias e inclua, sempre que apropriado, screenshots descritivas do seu trabalho.
- Aguarde aprovação gerencial.
