# Vídeo de apresentação (geração programática)

1. `python3 apresentacao/capturar.py <Herói> <pasta>/cap` — grava trechos reais do jogo (piloto automático dos testes, 30 fps).
2. `python3 apresentacao/menu.py <pasta>` e `ffmpeg -i <pasta>/menu/*.webm -vf fps=30 <pasta>/menu/f_%04d.jpg` — menu e seleção.
3. Fonte Bungee em `<pasta>/fontes/Bungee-Regular.ttf`.
4. `python3 apresentacao/compor2.py <pasta> musica.mp3 saida.mp4` — versão 2 (transições no estilo Marvel + zoom nas explicações); usa compor.py.

Rodar da raiz do jogo (precisa de `phaser.local.min.js` e Playwright 1.56). O MP4 e a música não ficam no repositório.
