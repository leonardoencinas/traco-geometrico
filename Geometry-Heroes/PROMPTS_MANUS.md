# Prompts do Gemini: cenários em 4 camadas (Geometry Heroes)

Cada fase tem 4 camadas, geradas em prompts separados (uma imagem por prompt). Total: 24 imagens.

| Camada | Nome | Velocidade (parallax) | Formato |
|:-:|---|:-:|---|
| 1 | Céu / horizonte | 0.05 | PNG opaco |
| 2 | Silhuetas distantes | 0.12 | PNG com fundo transparente |
| 3 | Plano médio | 0.25 | PNG com fundo transparente |
| 4 | Plano próximo (borda) | 0.40 | PNG com fundo transparente |

Arquivos: `assets/backgrounds/<heroi>/<heroi>_c1.png` ... `_c4.png`.

## Bloco comum (cole no começo de TODO prompt)

```
Imagem para fundo de jogo de plataforma 2D estilo Geometry Dash, vista lateral, SEM personagens.
Tamanho 2048x720 px, horizontal e SEM EMENDA: a borda esquerda tem que encaixar na direita.
Estilo ilustração digital vetorial/pintura suave, cores escuras e de baixo contraste,
para que obstáculos e o cubo do jogador sempre se destaquem por cima.
Proibido: grade, quadriculado, linhas de guia, texto, logotipo, marca d'água,
personagens, rostos, e QUALQUER triângulo ou espinho decorativo (triângulo no jogo significa perigo).
Mantenha o centro vertical (y 250 a 600) mais limpo e vazio; detalhes nas bordas de cima e de baixo.
```

Em camadas 2, 3 e 4: "fundo 100% transparente (PNG com alfa), só os elementos". Na camada 1: "fundo opaco, sem elementos soltos".

---

## 1. Homem-Aranha (suburbio/cidade à noite, azul e vermelho escuros)
- **C1:** céu noturno azul-marinho com gradiente para roxo no horizonte, lua grande e difusa, poucas estrelas, nuvens baixas finas.
- **C2:** skyline distante de Nova York em silhueta azul-escura, prédios altos com poucas janelas acesas, sem detalhes.
- **C3:** prédios médios de tijolo com janelas acesas em amarelo e laranja, caixas d'água de telhado, escadas de incêndio, fios de poste.
- **C4:** só nas bordas: postes, fios elétricos caídos em curva, antenas de telhado, placas lisas sem texto, teias de aranha brancas finas nos cantos.

## 2. Hulk (ruínas industriais, verde-radioativo, tempestade)
- **C1:** céu de tempestade verde-acinzentado, nuvens pesadas, brilho esverdeado no horizonte.
- **C2:** silhuetas de fábricas destruídas e chaminés quebradas ao longe, névoa verde.
- **C3:** ruínas de concreto, vigas de aço tortas, tanques rachados, vazamento de líquido verde brilhante, rachaduras no chão.
- **C4:** nas bordas: pedaços de concreto, vergalhões, cabos soltos, poças de líquido verde e poeira flutuando.

## 3. Gavião Arqueiro (base tática, floresta/penhasco, marrom e roxo escuro)
- **C1:** céu crepuscular roxo e laranja queimado, nuvens alongadas, uma ave de rapina distante bem pequena.
- **C2:** montanhas e penhascos em camadas, pinheiros em silhueta, neblina entre as camadas.
- **C3:** torre de observação, plataformas de madeira e metal, redes de camuflagem, alvos redondos e antenas (formas arredondadas e retangulares, nada pontudo).
- **C4:** nas bordas: galhos e folhagem escura, cordas, caixas de suprimento, faixas de camuflagem.

## 4. Homem de Ferro (metrópole futurista, azul-ciano e dourado)
- **C1:** céu noturno limpo azul-petróleo, brilho ciano no horizonte, linhas de luz de tráfego aéreo ao longe.
- **C2:** skyline futurista em silhueta com prédios de vidro, uma torre central grande com anel luminoso (sem texto nem logotipo).
- **C3:** arranha-céus com janelas em ciano e dourado, passarelas e trilhos aéreos, painéis holográficos com formas abstratas (sem texto), drones pequenos distantes.
- **C4:** nas bordas: cabos suspensos, estruturas metálicas, luzes de neon ciano, vapor e circuitos luminosos.

## 5. Doutor Estranho (santuário místico, roxo e dourado)
- **C1:** vazio cósmico roxo-escuro com nebulosa dourada, estrelas, fendas de luz.
- **C2:** arquitetura impossível flutuando ao longe: arcos, escadarias e torres em silhueta, mandalas gigantes translúcidas.
- **C3:** colunas e arcos do santuário, janelas circulares, runas e círculos mágicos dourados brilhando (círculos, nunca triângulos), tapeçarias.
- **C4:** nas bordas: fumaça mística, fagulhas douradas, pedaços de pedra flutuando, tecido da capa em movimento.
(A dimensão espelho é feita no código: a mesma imagem invertida e colorida.)

## 6. Wanda (floresta amaldiçoada, vermelho e preto, mística)
- **C1:** céu preto-avermelhado com lua vermelha enorme, névoa magenta, sem estrelas claras.
- **C2:** floresta distante em silhueta preta com troncos retorcidos, névoa vermelha subindo do chão.
- **C3:** árvores secas e retorcidas grandes, raízes expostas, runas vermelhas brilhando nos troncos, vaga-lumes de luz vermelha.
- **C4:** nas bordas: galhos pretos sobrepostos, folhas secas, névoa baixa, fios de energia escarlate fraca.

---
Depois de gerar: salve com os nomes acima e me avise. Eu ligo as 4 camadas ao parallax e aposento as imagens atuais de camada única.

---

# Alternativa: vídeo de 60 s por fase (Veo)

O jogo aceita um vídeo de fundo por fase (`VIDEOS_FUNDO` em `js/config.js`). O começo do vídeo é a largada e o fim é a chegada.
O jogo acelera ou segura o vídeo para casar com o tempo da fase (35 a 52 s), então 60 s sobram.

Regras do vídeo: câmera lateral andando sempre para a DIREITA em velocidade constante (travelling), sem cortes,
sem personagens, sem texto, sem triângulos, 16:9 (1280x720 ou maior), sem áudio, e o centro da imagem limpo.
Salvar como MP4 (H.264) e, se possível, WebM também: `assets/backgrounds/<heroi>/<heroi>_video.mp4`.
Se o gerador só faz clipes curtos (8 s), gere vários com o mesmo prompt e junte (o fim de um começa igual ao começo do próximo: peça "continue da última imagem").

## Prompt base (cole antes do tema)
```
Vídeo de 60 segundos para fundo de jogo de plataforma 2D lateral. Câmera em travelling lateral lento e constante para a direita, sem cortes, sem zoom, sem tremor. Paralaxe natural: céu quase parado, silhuetas distantes lentas, plano médio e primeiro plano mais rápidos. Cores escuras e de baixo contraste. Sem personagens, sem pessoas, sem texto, sem logotipo, sem grade, sem triângulos. Centro da imagem limpo e vazio, detalhes nas bordas de cima e de baixo. Sem áudio. Tema:
```

- **Homem-Aranha:** noite em Nova York, azul e roxo, telhados de tijolo, caixas d'água, janelas acesas, fios de poste, lua grande, holofote varrendo o céu.
- **Hulk:** ruínas industriais sob tempestade verde, chaminés quebradas, vigas tortas, poças de líquido verde brilhante, raios verdes ao longe.
- **Gavião Arqueiro:** crepúsculo roxo e laranja, penhascos e pinheiros em camadas com neblina, torre de observação de madeira, redes de camuflagem.
- **Homem de Ferro:** metrópole futurista à noite, ciano e dourado, arranha-céus de vidro, trilhos aéreos, painéis holográficos abstratos sem texto, drones distantes.
- **Doutor Estranho:** vazio cósmico roxo e dourado, arcos e escadarias flutuando, círculos mágicos dourados girando devagar, fagulhas e fumaça.
- **Wanda:** floresta amaldiçoada, céu preto-avermelhado, lua vermelha enorme, troncos retorcidos com runas vermelhas brilhando, névoa vermelha no chão.
