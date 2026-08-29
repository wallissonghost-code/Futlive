# Futlive — arquitetura estabilizada

Baseline: **BETA 0.73 / stabilization-1**.

## Regra principal

Uma responsabilidade possui uma autoridade explícita. Módulos podem complementar uma função somente quando a cadeia estiver declarada no auditor `scripts/architecture-audit.js`. Carregamento dinâmico de módulos centrais é proibido.

## Autoridades

- `components/football-engine-v032.js`: estado físico base, loop, bola, jogadores e primitivas da engine. É a única engine carregada.
- `components/football-ai-system.js`: IA base de posse, bola livre e deslocamento.
- `components/football-tactics-system.js`: formação, linhas, marcação e ajuste tático sobre a IA base.
- `components/player-intelligence-system.js`: decisão individual e qualidade técnica.
- `components/ai-runtime-coordinator.js`: cadência/performance da IA; não define estratégia.
- `components/goalkeeper-intelligence-system.js`: decisão do goleiro.
- `components/goalkeeper-liveness-system.js`: watchdog; recupera falha, não cria comportamento tático.
- `components/ball-contact-system.js`: contato visual pé/bola e sincronização da bola com o sprite.
- `components/ground-gameplay-system.js`: pressão/contato físico no chão.
- `components/player-tackle-system.js`: carrinho e resultado do tackle.
- `components/set-piece-system.js`: **somente faltas e pênaltis**.
- `components/boundary-restart-system.js`: **somente lateral, escanteio e tiro de meta**.
- `components/out-of-play-system.js`: detector de saída; encaminha exclusivamente ao boundary restart.
- `app/gameplay-v036.js`: UI de gol/retorno e compatibilidade física temporária do goleiro; não decide passe/chute.
- `app/system-health.js`: valida dependências e duplicação em runtime.

## Ordem crítica

`set-piece-system` → `boundary-restart-system` → `out-of-play-system`.

O `index.html` é a fonte única da ordem de carregamento. Um componente não pode criar `<script>` para carregar outro componente central.

## CI / QA

Toda alteração em `main` passa por:

1. `scripts/architecture-audit.js` — versões paralelas, duplicidade, ordem e autoridade.
2. `node --check` — sintaxe de todos os JS ativos e scripts de QA.
3. Playwright — arquitetura em runtime, kickoff, coordenadas finitas, bola/sprite, recepção, lateral, tackle e partidas completas com watchdog de goleiro.

## Fallback

O estado anterior à estabilização está preservado na branch:

`backup/pre-stabilization-0.72-2026-08-29`

Commit-base: `1b5a753363a996e685c4fc9eb5ff356a285e04f0`.

Se a estabilização causar regressão grave, essa branch é o ponto de restauração integral.

## Próxima migração

Depois que o baseline 0.73 estiver verde no CI, migrar nomes versionados (`football-engine-v032`, `gameplay-v036`, `lineup-v032`) para nomes canônicos sem `vNNN`, em uma alteração isolada. Não misturar essa renomeação com mudanças de gameplay.
