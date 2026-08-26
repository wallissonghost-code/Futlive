# Compatibilidade do mapa

O mapa enviado é horizontal (aprox. 3:2). O jogo atual usa uma área de partida vertical com gols à esquerda e à direita. Aplicar a imagem com `background-size: 100% 100%` deforma toda a geometria (círculo vira oval, áreas ficam esticadas e traves cortadas).

Por isso, a versão segura mantém o mapa e as traves em `assets/` para uma futura adaptação própria, enquanto o campo ativo continua desenhado proporcionalmente por CSS. A física permanece independente do asset visual.
