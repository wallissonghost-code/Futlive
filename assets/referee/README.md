# Sprites do árbitro

Mapeamento usado pela Beta 0.42:

- `idle_down_01.png` … `idle_down_04.png`: idle/frente.
- `walk_down_01.png` … `walk_down_04.png`: caminhada para baixo.
- `walk_right_01.png` … `walk_right_08.png`: caminhada para direita.
- `walk_up_01.png` … `walk_up_08.png`: caminhada para cima.
- `walk_left_01.png` … `walk_left_04.png`: caminhada para esquerda.
- `card_yellow_01.png` … `card_yellow_02.png`: cartão amarelo.
- `card_red_01.png` … `card_red_02.png`: cartão vermelho.

O controlador visual está em `components/referee-sprite.js`. Para substituir a arte futuramente sem alterar código, mantenha estes nomes de arquivo e sobrescreva os PNGs correspondentes.