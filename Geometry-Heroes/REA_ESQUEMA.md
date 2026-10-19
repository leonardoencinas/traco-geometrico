# Esquema REA — level design e interface (rodada 6)

REA aqui é **análise por observação** das 5 capturas de tela enviadas pela equipe (4 fases e o menu principal de um jogo de ritmo conhecido). Nada foi baixado, descompilado ou copiado: nenhum código, fase, imagem, fonte, logotipo ou som. O que segue é a "gramática visual" que dá pra ler olhando as imagens, traduzida pra regras nossas e desenhada do zero no Phaser/CSS.

## 1. Método

| Passo | O que fizemos |
|---|---|
| Observar | Cada captura foi dividida em camadas: fundo, cenário de trás, objetos de jogo, perigos, jogador, interface. |
| Isolar padrões | Para cada camada, anotamos forma, cor, contorno, brilho e como o objeto conversa com o ritmo e com o caminho do jogador. |
| Virar regra | Cada padrão vira uma regra curta ("perigo = preto com contorno claro e brilho na cor da fase"). |
| Implementar do nosso jeito | A regra entra como classe/tipo de roteiro reaproveitável, nunca como cópia de desenho. |
| Testar | Pilotos automáticos e testes de Playwright confirmam que nada ficou injusto ou quebrou. |

## 2. Leitura de cada captura

### Captura 1 — fase vermelha escura ("neon no breu")
- **Fundo**: quase preto avermelhado; profundidade vem de **feixes de luz verticais** subindo do chão, que pulsam.
- **Objetos**: blocos e espinhos **pretos com contorno vermelho brilhante**. Serra preta com dentes contornados.
- **Composição**: espinhos no chão e pendurados no teto formando um "corredor de dentes"; blocos em degrau saindo do teto.
- **Regra**: em fase escura, o contorno faz todo o trabalho; preenchimento some.
- **No jogo**: tema da **Wanda** (vermelho carmesim), contorno vermelho em vez de branco, feixes de luz em todas as fases.

### Captura 2 — fase roxa com bola ("arquitetura pendurada")
- **Fundo**: roxo saturado com quadrados grandes mais claros e **triângulos vazados** bem apagados.
- **Objetos**: fileiras de espinhos pretos de contorno branco **no chão e no teto inteiros**, com espinhos-folha verde-limão atrás (decoração). **Pirâmide invertida** de blocos presa no teto, com espinhos nas bordas. **Plataformas presas por correntes**. Anéis verdes.
- **Jogador**: rastro atrás do personagem.
- **Orbe**: núcleo amarelo, anel branco e halo grande e suave.
- **Regra**: perigo contínuo no chão e no teto + estrutura no meio = trecho de "corredor" pra bola/UFO.
- **No jogo**: tema do **Gavião** (roxo + limão); trecho do UFO ganhou grupos curtos de espinhos no chão e uma pirâmide invertida; plataformas da abertura ganharam correntes; orbes redesenhados com halo; rastro no jogador.

### Captura 3 — fase roxa clara ("chão em grade")
- **Chão de blocos em grade**: retângulo preto subdividido em ladrilhos com contorno claro.
- **Poço** com um tapete de espinhos baixinhos e pretos (decoração de borda).
- **Parede em grade** mais alta logo depois do poço.
- **Regra**: bloco = grade de ladrilhos; poço sempre "avisa" com espinhos decorativos.
- **No jogo**: `BlocoNeon` (bloco preto com grade de ladrilhos e contorno brilhante) em blocos genéricos, pilares e na abertura. Os espinhos decorativos **não** entraram: pedido da equipe, triângulo é só obstáculo.

### Captura 4 — fase rosa ("degraus flutuantes")
- **Plataformas flutuantes** em degraus, algumas com espinho em cima; espinho pendurado no teto.
- **Tapete de espinhos baixos com brilho amarelo** cobrindo o chão.
- **Orbe pequeno** com partículas; botão de pausa redondo verde no canto.
- **Regra**: chão proibido + plataformas em escada = leitura de caminho clara; brilho quente indica perigo.
- **No jogo**: espinhos ganharam halo na cor da fase; pausa virou botão redondo.

### Captura 5 — menu principal
- **Título** em letras grossas e "blocadas", verde com contorno escuro e sombra 3D.
- **Três botões grandes**, o do meio (jogar) maior; uma **fileira de botões redondos** embaixo.
- **Fundo** azul com quadrados grandes e uma faixa de chão com linha clara.
- **No jogo**: título com fonte de letras grossas (Google Fonts, com fonte reserva), botões com contorno grosso e chanfro, fileira de botões redondos (som), chão do menu com linha clara. Nada de logotipo, ícones ou desenho de botão do jogo original: tudo redesenhado.

## 3. Gramática visual extraída → regra nossa

| Padrão observado | Regra | Onde está no código |
|---|---|---|
| Objeto preto + contorno claro + brilho | `tema.objeto` (preenchimento) + `tema.neon` (contorno) + halo na cor da fase | `obstaculos.js` (`Espinho`, `BlocoNeon`), `classicos.js` (`Serra`) |
| Bloco em grade | Ladrilhos de 40 px desenhados dentro do bloco | `BlocoNeon` |
| Fundo monocromático saturado | Cor de fundo saturada por herói; cenário de trás tingido na cor da seção | `config.js` (`TEMAS`, `CORES_SECOES`), `Fase.camadaParalaxe` |
| Feixes de luz verticais | Camada `feixes` fixa na tela, pulsando na batida | `Fase.criarFeixes` |
| Triângulos vazados no fundo / tufos de espinhos decorativos | **Descartado**: no nosso jogo triângulo sempre significa perigo, então nada de triângulo no cenário | — |
| Corredor de espinhos | Tipo de roteiro `fileira`, usado em **grupos curtos** onde têm função (não forrando a fase toda) | `Fase.criarElemento` |
| Pirâmide invertida no teto | Tipo de roteiro `piramide` | `Fase.criarElemento` |
| Plataforma em correntes | Correntes desenhadas nas plataformas suspensas | `Fase.criarAbertura` (`_`) e tipo `plataformaSuspensa` |
| Rastro do jogador | Partículas seguindo o personagem | `Fase.criarJogador` |
| Orbe com halo | Núcleo + anel + halo suave | `OrbeSalto` |
| Pausa redonda / título blocado / botões chanfrados | CSS | `style.css`, `index.html` |
| Progresso normal e prática no cartão | Duas barras no cartão da fase | `progresso.js` |

**Regra de leitura (decisão da equipe):** triângulo = perigo, sempre. O cenário usa só quadrados, retângulos, feixes de luz e silhuetas.

## 4. Paleta por fase (refinada)

| Fase | Fundo | Destaque (linha) | Contorno dos objetos | Ideia |
|---|---|---|---|---|
| Homem-Aranha | azul vivo | vermelho | branco | Uniforme do herói, leitura fácil (fase Fácil) |
| Homem de Ferro | vermelho escuro | dourado | dourado claro | Armadura |
| Hulk | verde | verde-limão | branco | Seções viram roxo no meio (as cores do Hulk) |
| Gavião Arqueiro | roxo | limão | branco | Captura 2 |
| Doutor Estranho | azul-noite | laranja místico | creme | Dimensão espelho em magenta |
| Wanda | breu avermelhado | vermelho | vermelho | Captura 1 (fase Insana, mais tensa) |

As cores de seção (`CORES_SECOES`) seguem a mesma família de cada fase, como os gatilhos de cor dos jogos de ritmo.
