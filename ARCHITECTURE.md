# Futlive — arquitetura

Versão de organização: 0.23.

## Responsabilidades

- `index.html`: somente estrutura da tela e ordem de carregamento.
- `styles/game.css`: visual do campo, placar, modal e efeitos gerais.
- `components/live-gift-hud.*`: HUD reutilizável de presentes.
- `components/player-sprite.js`: sprites e animações dos jogadores.
- `components/football-engine.js`: simulação da partida, IA, bola e colisões.
- `app/bootstrap.js`: cria HUD, instancia jogadores, pausa e efeitos locais.
- `app/panel-connection.js`: conexão PeerJS com o Projeto Daniel e protocolo do painel.
- `config/runtime.js`: versão, times, presentes e parâmetros compartilhados.
- `config/assets.json`: inventário de assets, sem duplicar listas de 32 arquivos.
- `assets/players/team-N/`: frames de cada uniforme.
- `assets/ball/`, `assets/goals/`, `assets/maps/`: áreas reservadas para novos assets.

## Regra daqui para frente

Não colocar CSS, lógica do painel ou correções temporárias dentro do `index.html`. Mudança de conexão vai em `app/panel-connection.js`; inicialização em `app/bootstrap.js`; HUD nos componentes de HUD; mecânica da partida na engine. Evitar arquivos `tmp`, versões paralelas e engines antigas no branch principal.

O antigo `components/game-engine.js` foi removido por ser uma engine 0.18 não utilizada e concorrente da engine atual.