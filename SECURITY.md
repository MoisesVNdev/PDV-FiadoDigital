# Política de Segurança - PDV FiadoDigital

Levamos a segurança e proteção do nosso sistema operante e de nossos associados a sério. Nós apreciamos profundamente todo e qualquer esforço de transparência focado na comunidade e nos pesquisadores que levam ao aviso antecipado e responsável de possíveis problemas em nossos produtos.

## 1. Versões suportadas

Monitoramos de modo unificado as avaliações da branch referenciada na versão base atual. Atualmente somente o último e imediato código implantado na branch recebe resoluções de patch e relatórios:

| Versão | Suportada          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |

*Outras branches de histórico e desenvolvimento (*`feature/`*, *`fix/`*) não são mantidas globalmente para aplicação estendida.*

## 2. Reportando uma vulnerabilidade

A segurança é de extrema importância. Em caso de encontrar brechas de acessos, **solicitamos que a vulnerabilidade NÃO SEJA DESCRITA PUBLICAMENTE (evite abrir uma "Issue" pública)**.

Entre em contato de maneira totalmente discricionada e privada enviando detalhes para o representante responsável pela proteção digital por meio do contato: `[CONTATO_A_PREENCHER]`.

Forneça descrições técnicas na medida do possível:
- Qual o impacto e a gravidade explorada
- Se a exploração possui um "proof-of-concept" ou passos passíveis para reprodução autêntica
- Qualquer pacote de terceiros / stack corrompida

## 3. Tempo de resposta esperado

Encorajamos a comunicação responsiva rápida do time. Seguiremos esta SLA:
- **Prioridade 0 (P0 - Crítica):** Investigação inicial respondida e mitigação ou hotfix em **≤ 2 horas**.
- **Outras métricas (P1, P2):** Primeira triagem dentro de até de 2-3 dias úteis.

## 4. Escopo 

O escopo das garantias de auditoria propostas é válido inteiramente para referências da infraestrutura servida na arquitetura do Monorepo e seus artefatos resultantes de build interno, seja `@pdv/api` ou `@pdv/web`.
Adentrar limites do contexto móvel envolto ao design base da estrutura (exemplo: **Wrapper oficial via projeto Tauri**) será tratado estritamente de escopo e não é abalizado ativamente sob essa matriz neste repositório.
