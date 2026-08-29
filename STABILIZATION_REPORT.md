# Futlive — Stabilization Report

Baseline analisado: BETA 0.72. Baseline de limpeza: **BETA 0.73 / stabilization-1**.

## Motivo da estabilização

O jogo acumulou módulos que substituem funções da engine em cadeia. Isso torna a ordem de carregamento parte do comportamento do jogo: um módulo captura a função anterior, redefine a função e o próximo módulo captura essa nova versão. Sem contrato explícito, uma mudança aparentemente isolada pode alterar IA, bola, física ou restart.

## Achados críticos

### 1. Engines e versões paralelas

Havia `football-engine.js`, `football-engine-v031.js` e `football-engine-v032.js` no branch principal, além de `gameplay-v035/v036` e `lineup-v031/v032`. As versões antigas foram removidas do `main`; o fallback integral permanece na branch de backup.

### 2. Dois sistemas concorrentes de bola fora

`set-piece-system` possuía lateral/escanteio/tiro de meta e `boundary-restart-system` também. `out-of-play-system` ainda carregava o boundary dinamicamente e depois emitia um evento que acionava o set-piece. O primeiro sistema a marcar `state.busy` ganhava a corrida.

Correção 0.73:
- `set-piece-system`: faltas e pênaltis.
- `boundary-restart-system`: lateral, escanteio e tiro de meta.
- `out-of-play-system`: apenas detecta e encaminha para o boundary.
- ordem explícita no `index.html`.

### 3. Carregadores dinâmicos escondidos

`ball-contact-system`, `out-of-play-system` e `throw-in-rules-system` já carregaram módulos centrais criando `<script>` em runtime. Isso cria versões/cache diferentes e duplicação dependendo do timing.

Correção 0.73: módulos centrais passam a ser responsabilidade do `index.html`. O CI proíbe novo loader central dinâmico.

### 4. Gameplay alterando IA

`app/gameplay-v036.js` alterava `choosePassTarget`, atributos de chute e `pinGoalkeeper`, apesar de existirem módulos dedicados de IA/tática/goleiro.

Correção 0.73: gameplay deixou de decidir passe/chute/atributo. O override físico de `pinGoalkeeper` permanece temporariamente apenas como compatibilidade até a próxima migração da engine core.

## Cadeias de monkey patch congeladas no baseline

O auditor descobriu que as seguintes primitivas ainda possuem vários donos. Elas estão agora explicitamente registradas no CI; nenhum módulo novo pode entrar na cadeia sem falhar o build.

- `moveToward`: IA base → tática → inteligência individual → contexto → ball contact → ground gameplay → tackle → referee.
- `takePossession`: tática → inteligência individual → contexto → ações técnicas → bola aérea → emoção → ground gameplay → foul bridge → regras de lateral.
- `pass`: tática → inteligência individual → contexto → ações técnicas → bola aérea → emoção → orientação do passe.
- `ownedAI`: IA base → tática → inteligência individual → contexto → ações técnicas → runtime coordinator → estabilidade.
- `freeAI`: IA base → tática → contexto → runtime coordinator → estabilidade → loose-ball reactivity.
- `intercept`: IA base → ações técnicas → bola aérea → runtime coordinator.
- `physics`: ações técnicas → bola aérea → out-of-play → regras de lateral.

Essas cadeias são o principal débito técnico restante. Elas não serão reescritas todas de uma vez; serão migradas uma primitiva por vez, mantendo QA verde entre etapas.

## Infraestrutura adicionada

- branch de fallback: `backup/pre-stabilization-0.72-2026-08-29`.
- `scripts/architecture-audit.js`.
- `app/system-health.js`.
- CI com Architecture Audit antes de syntax/Playwright.
- QA runtime verifica dependências, autoridade única de boundary, scripts duplicados, bola/sprite, recepção, lateral, tackle e partidas completas.

## Plano de limpeza seguro

### Fase 1 — concluída nesta baseline

Congelar versão, backup, remover versões antigas óbvias, declarar autoridades, eliminar loaders centrais escondidos, separar restart de boundary de falta/pênalti e criar gates de CI/QA.

### Fase 2 — próxima

Migrar `takePossession` para uma API de eventos/hooks única. É a cadeia mais longa e afeta posse, regras, emoção, bola aérea e faltas. Após migrar, nenhum módulo poderá substituir diretamente `e.takePossession`.

### Fase 3

Migrar `physics` para pipeline explícito: física base → bola aérea/técnica → regras → boundary. Remove wrappers encadeados de física.

### Fase 4

Migrar `ownedAI/freeAI` para coordenador único de decisão. IA tática, contexto e inteligência individual passam a fornecer intenção/score em vez de substituir a função principal.

### Fase 5

Migrar `moveToward` para steering pipeline único e remover a compatibilidade de goleiro do `gameplay`.

### Fase 6

Renomear arquivos canônicos (`football-engine-v032`, `gameplay-v036`, `lineup-v032`) somente após CI verde, sem misturar com mudança de gameplay.

## Critério de avanço

Não adicionar feature nova enquanto Architecture Audit, syntax e Playwright não estiverem verdes no mesmo commit de baseline. Se uma etapa de migração falhar, restaurar apenas a etapa ou voltar à branch de backup; não empilhar correção nova em cima de baseline vermelho.
