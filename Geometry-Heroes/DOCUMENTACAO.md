# Geometry Heroes — documentação técnica

Este documento explica as tecnologias do projeto, como a engenharia reversa (REA) foi usada, quais Skills de Design foram consultadas, por que o trabalho foi dividido entre agentes e o que mudou em cada rodada. Ele descreve só o que aconteceu de fato; o que ficou pendente está marcado como pendente.

Complementos: `REA_ESQUEMA.md` (análise visual das referências), `IMPLEMENTATION_NOTES.md` (diário rodada a rodada) e `assets/herois/CREDITOS.md` (origem das imagens).

---

## 1. Tecnologias utilizadas

Levantadas a partir do código e da configuração reais (`index.html`, `js/`, `tests/`). O jogo não tem `package.json`, bundler nem servidor próprio: é uma página estática.

| Tecnologia | Função | Por que foi usada | Onde o projeto depende dela |
|---|---|---|---|
| **HTML5** | Estrutura das telas fora do canvas: menu, seleção de fases, pausa, conclusão, painéis, botões de toque | Telas em HTML têm foco de teclado, leitores de tela e layout responsivo de graça | `index.html` |
| **CSS3** (com *container queries* `cqw`, `clamp`, `aspect-ratio`) | Visual das telas e dos botões, tamanhos proporcionais ao jogo, animações de entrada, `prefers-reduced-motion` | O jogo tem proporção 16:9 fixa; medir em `cqw` (1% da largura do jogo) mantém a interface do mesmo tamanho relativo em qualquer tela | `style.css` |
| **JavaScript** (classes ES, scripts clássicos sem módulos) | Toda a lógica: fases, obstáculos, jogador, habilidades, cenários, progresso | É a linguagem do navegador; as classes deixam explícita a POO pedida no trabalho (`Fase` com método template, subclasses por herói, `Habilidade`, `Obstaculo`) | `main.js`, `js/**/*.js` (ordem de carga definida no `index.html`) |
| **Phaser 3** (carregado do CDN jsDelivr, `phaser@3`; versão 3.90.0 nos testes e na prévia) | Motor do jogo: cenas, câmera, física Arcade (gravidade, colisões, corpos), tweens, partículas, texturas geradas por código, entrada de teclado/ponteiro, carregamento de imagens | Motor 2D maduro, sem instalação, com física pronta e documentação extensa | Tudo em `js/` usa `Phaser.*`; `main.js` cria o `Phaser.Game`; `js/cenas.js` define `MenuScene` e `GameScene` |
| **Física Arcade do Phaser** | Gravidade, pulo, colisão com blocos/espinhos, passo de física em 60 Hz | Leve e determinística, adequada a plataforma rítmica | `js/player.js`, `js/fases/fase.js`, obstáculos |
| **Web Audio API** | Trilha e efeitos sintetizados na hora (batida no BPM de cada fase, sons de pulo, poderes) | Não precisa de arquivos de áudio nem de licença de música | `js/som.js` |
| **localStorage** | Progresso salvo (melhor %, melhor tempo, tentativas, % da prática) e preferência de som | Persistência simples no navegador, sem servidor. As chaves continuam `tracoGeometrico.*` para não apagar o progresso de quem já jogou | `js/progresso.js`, `js/som.js` |
| **Google Fonts — Bungee** | Fonte de letras grossas do título e dos botões | Dá a identidade "de jogo" ao título; tem fonte reserva (`Arial Black`, `Impact`) se não carregar | `index.html`, `style.css` |
| **Imagens WebP** | Fundos das fases (`assets/backgrounds/`) e retratos dos heróis (`assets/herois/`) | Boa qualidade com arquivos pequenos (cenas de 83 a 165 KB; retratos de 23 a 51 KB) | `js/config.js` (`CENARIOS_IMAGEM`), `js/cenarios.js`, `js/cenas.js`, `index.html` |
| **Python 3 + Playwright (Chromium headless)** | Testes automáticos: abre o jogo sem tela, avança quadro a quadro e usa pilotos automáticos que jogam com os mesmos controles do jogador | Testes reproduzíveis, independentes da velocidade da máquina | `tests/*.py` (só desenvolvimento; o jogo não depende disso) |
| **Pillow + OpenCV (Python)** | Preparação offline dos fundos: recorte da área de arte das prévias, remoção de textos/logo por *inpainting*, exportação em WebP | Tratamento reprodutível e registrado em script | `assets/backgrounds/recortar.py` (só desenvolvimento) |

**Atenção ao abrir o jogo:** abrindo o `index.html` direto do disco (`file://`), o navegador bloqueia o uso das imagens de fundo pelo WebGL, e as fases usam o cenário desenhado por código (sem erro). Para ver as artes, rode um servidor local na pasta (`python3 -m http.server 8000`) ou abra a versão publicada.

---

## 2. REA — Engenharia Reversa

### O que REA significa aqui
REA (*Reverse Engineering Analysis*) foi usada no sentido de **estudar referências para extrair a "gramática" do gênero e transformar isso em requisitos nossos**, não no sentido de abrir ou descompilar programas de terceiros.

### A Skill de REA disponível
A Skill `anthropic-skills:reverse-engineer-anything` (ferramenta REA, morluto/rea) **foi consultada**. Ela serve para binários, pacotes (APK, ASAR, ZIP), firmware, capturas de rede e páginas em execução, e orienta explicitamente a **não** usar as ferramentas REA quando se tem o código-fonte completo. Como o projeto é nosso (código-fonte completo) e as referências são imagens e texto, as ferramentas REA **não foram executadas**: a análise foi feita por observação, registrada em `REA_ESQUEMA.md`.

### Referências realmente usadas e o que virou requisito

| Referência | Como foi usada | Virou no jogo | Descartado |
|---|---|---|---|
| Texto público do site geometrylitepc.net (rodada 5) | Leitura da descrição dos elementos | Portais de modo (cubo/bola/UFO), pad e orbe azuis, modo prática com diamantes | Nenhum código, fase ou arte do site foi baixado |
| 5 capturas de tela do gênero enviadas pela equipe (rodada 6) | Observação por camadas (fundo, objetos, perigos, interface) | Objetos pretos com contorno neon e halo, blocos em grade, pirâmide invertida, plataformas com correntes, interface com letras grossas, pausa redonda, barras Normal/Prática | Triângulos decorativos no cenário (decisão da equipe: triângulo = perigo) |
| 9 imagens do arquivo `poo_game - Copia.7z` (rodada 8) | 6 retratos dos heróis integrados à tela inicial; tiara da Wanda como referência de desenho; 2 capturas do gênero só como referência de layout | Retratos no menu, nos cartões e no painel de heróis; cubo da Wanda com tiara desenhado por nós | As capturas do gênero e a foto da tiara não entram na interface |
| 6 prévias de cenário geradas no Gemini (rodada 8) | Recorte da área de arte limpa de cada prévia | Fundos das 6 fases (seção 5) | Textos, miniaturas, logo dos Vingadores e o chão/espinhos desenhados nas prévias |

**Inspiração visual × referência funcional × reprodução técnica:** as capturas e o site foram inspiração visual e referência funcional (o que existe no gênero e como se comporta). Nada foi reproduzido tecnicamente: física, fases, obstáculos e efeitos foram programados do zero. As únicas imagens de terceiros dentro do jogo são os retratos e os fundos fornecidos pela equipe, listados em `assets/herois/CREDITOS.md` e nesta documentação.

### Identidade própria
Cada fase gira em torno da habilidade do herói; os elementos do gênero entram entre os desafios da habilidade. Regras próprias: triângulo sempre é perigo, cubo de cada herói com o mesmo hitbox, cenário mais escuro que os obstáculos.

---

## 3. Skills de Design (e outras Skills) realmente consultadas

Só entram aqui Skills invocadas de fato nesta etapa (rodada 8). Os nomes são os nomes exatos do ambiente.

| Skill | Quem usou | Propósito | O que mudou por causa dela |
|---|---|---|---|
| `anthropic-skills:reverse-engineer-anything` | Coordenador | Avaliar se a ferramenta REA se aplicava | Definiu que a REA seria por observação (seção 2) |
| `anthropic-skills:emil-design-eng` | Agente 1 | Polimento visual e de movimento | Animações de cenário com senoides lentas, sem tranco; partículas surgem por transparência; tudo desliga com "reduzir movimento" |
| `design:design-critique` | Agentes 1 e 3 | Crítica estruturada de usabilidade e hierarquia | Agente 1: tom das artes do Aranha, Estranho e Wanda baixado para não competir com portais e obstáculos. Agente 3: elenco em volta do título, título em duas cores, cubos afastados da coluna central, selo "6 HERÓIS · 6 FASES", fim do texto "01 / INÍCIO" |
| `design:ux-copy` | Agente 3 | Textos da interface | Frase "Pule no ritmo. Salve o dia.", rodapé "PROJETO ESCOLAR DE POO · FEITO EM EQUIPE", som "LIGADO/DESLIGADO" igual à pausa |
| `design:accessibility-review` | Agente 3 | Auditoria WCAG 2.1 AA | Contraste medido (branco sobre verde era 2,88:1): rótulos com contorno escuro e botão Fechar em #2a7a10 (5,4:1); foco amarelo visível; elenco decorativo com `aria-hidden`; `aria-describedby` no Jogar |
| `anthropic-skills:animate` | Agente 3 | Decidir se, onde e como animar | Entrada do menu em sequência (30–150 ms; título e botões em 320 ms) só ao abrir a cena; só Estranho e Wanda flutuam; hover só com mouse; tudo desligado com "reduzir movimento" |
| `engineering:debug` | Agente 2 | Fluxo reproduzir → isolar → diagnosticar → corrigir | Guiou a medição quadro a quadro que achou a causa do atraso do pulo (seção 6) |

Nas rodadas anteriores (5 a 7) nenhum relatório registrou Skills invocadas; por isso elas não aparecem aqui. A página de prévia usa as orientações de publicação de página do ambiente (Artifact), que não são uma Skill de Design do jogo.

---

## 4. Por que vários agentes

### Divisão efetivamente usada
- **Rodada 7** (cenários, obstáculos, poderes): Agente 1 cenários; Agente 2 level design; Agente 3 cubos, poderes, portais, Joia do Tempo e cadência do Homem de Ferro.
- **Rodada 8** (esta): Agente 1 visual (grades, fundos das prévias do Gemini, Wanda, cubo com tiara); Agente 2 gameplay (atraso do pulo, fluidez); Agente 3 interface (nome, tela inicial, retratos). **A documentação, a troca do nome da pasta e a integração ficaram com o coordenador**, porque dependem do resultado dos três.

### Como funcionou
- Cada agente trabalhou numa **cópia isolada do repositório** (git worktree), em branch própria, a partir do mesmo commit base (`8b4a125`).
- Antes de começar, cada um recebeu uma **área de código exclusiva** (arquivos e métodos) para evitar edição simultânea do mesmo trecho.
- O coordenador juntou as branches com `git merge`, rodou a suíte completa na versão integrada e corrigiu o que apareceu.

### Dependências e conflitos coordenados (rodada 8)
- **Carregamento das imagens:** a `GameScene` (em `js/cenas.js`, área do Agente 3) precisava de um `preload()` para os fundos do Agente 1. O Agente 1 foi autorizado a adicionar só esse método.
- **Página de teste:** os dois agentes mudaram `tests/gerar_teste_html.py` (retratos em `../assets/` e fundos embutidos). Deu conflito de merge, resolvido juntando as duas mudanças.
- **Fora da área, por necessidade:** o Agente 1 trocou a vinheta da Wanda (`wanda.js`) e uma linha de `trocarPaleta` no `estranho.js`; ambos declarados no relatório.
- **Mudança de requisito no meio do caminho:** chegou um prompt novo (cenários do Gemini) com os agentes já rodando; o Agente 1 recebeu os requisitos por mensagem. Depois, a pedido do usuário, os fundos passaram a ser feitos sobre as prévias: o coordenador fez os recortes e o Agente 1 integrou.
- **Pausas:** nas rodadas 7 e 8 os agentes pararam por limite de uso da sessão e foram retomados de onde estavam.

### Limitações da abordagem
- Mais agentes não significam resultado melhor: cada um parte com o contexto inteiro, o que consome muito mais tokens, e conflitos crescem com o número de frentes. Três frentes independentes (visual, gameplay, interface) foram suficientes aqui.
- Testes isolados não garantem a versão junta; por isso a suíte completa roda de novo após a integração.
- O coordenador revisou fotos e relatórios, mas não jogou como uma pessoa; a sensação de jogo precisa de teste humano.

---

## 5. Inventário dos seis cenários

**Origem:** as 6 prévias geradas no Gemini (JPG 2752×1536, 16:9). Não chegou ZIP com camadas separadas; por isso cada fase usa **uma camada de arte** recortada da prévia, com as camadas procedurais leves por cima. As prévias originais ficam guardadas em cada pasta como `<heroi>_previa_gemini.jpg` (não são carregadas no jogo). O script `assets/backgrounds/recortar.py` reproduz os recortes.

Comum a todas: WebP opaca (sem canal alfa), 720 px de altura; desenhada como `tileSprite` fixo na tela de y 100 a 680 (580 px, escala ≈ 0,806), profundidade -98,5; repetição horizontal com **cópia espelhada alternada** (textura dupla [imagem | espelho] montada uma vez, limitada a 4096 px de largura); carregada só a imagem do herói da fase (`preload` da `GameScene`). Se a imagem falhar, a fase usa o cenário procedural.

| Herói | Conceito | Arquivo | Recorte da prévia (px) | Arquivo usado (px) | Textura no jogo (px) | Parallax | Tratamento |
|---|---|---|---|---|---|---|---|
| Homem-Aranha | Nova York à noite, telhados (rodada 9: sequência) | `homem-aranha/stage-01..06.webp` (450 KB no total) | 6 × 2560×1440 | 6 × 1280×720 | — | percurso da fase | Sem edição; ordem do envio. A stage-06 tem painéis com formas triangulares (revisar: triângulo = perigo) |
| Hulk | Cidade em ruínas sob céu verde (rodada 9: sequência) | `hulk/stage-01..06.webp` (600 KB no total) | 6 × 2560×1440 | 6 × 1280×720 | — | percurso da fase | Sem edição; ordem do envio |
| Gavião Arqueiro | Telhados de Nova York à noite (rodada 9: sequência) | `gaviao/stage-01..05.webp` (315 KB no total) | 5 × 2560×1440 | 5 × 1280×720 | — | percurso da fase | Sem edição; ordem do envio. **Falta a stage-06** (vieram 5 imagens) |
| Homem de Ferro | Metrópole futurista (diurna, como na prévia) | `homem-de-ferro/homem-de-ferro_cena.webp` (161 KB) | 2752×982 | 2018×720 | 4036×720 | 0,18 | Logo dos Vingadores apagado; miniaturas cortadas |
| Doutor Estranho | Dimensão mística, arquitetura impossível | `dr-estranho/dr-estranho_cena.webp` (114 KB) | 1921×675 | 2049×720 | 4096×719 (reduzida) | 0,12 | Faixa de céu separada e plataformas flutuantes cortadas; na dimensão espelho a mesma arte vira de cabeça para baixo e ganha tom magenta |
| Wanda | Floresta amaldiçoada pela magia do caos | `wanda/wanda_cena.webp` (144 KB) | 2752×686 | 2888×720 | 4096×510 (reduzida) | 0,12 | Banner superior da prévia, sem alterações; na realidade azul a arte é tingida de azul |

**Por cima da arte** ficam só efeitos leves: névoa, partículas, filamentos, feixes de luz discretos e as reações aos poderes (Joia do Tempo, portais, fúria, troca de realidade). As camadas de prédios e silhuetas desenhadas por código saem quando há arte. O véu colorido de cada seção fica mais fraco (5%) sobre a arte, para não sujar as cores da imagem.

**Pendências dos cenários:**
- Camadas separadas (céu, distante, meio, perto, efeitos) dariam parallax de verdade em profundidade; hoje é uma camada de arte por fase.
- O Homem de Ferro ficou de dia, seguindo a prévia; o pedido original falava em noite.
- Leves manchas de *inpainting* onde havia texto ou aros (Homem-Aranha).
- A pasta `assets` soma cerca de 4,9 MB por causa das prévias JPG guardadas como fonte.

---

### Sequência de cenários (rodada 9: Homem-Aranha, Hulk e Gavião)
- `CENARIOS_IMAGEM[heroi].sequencia` (config.js) lista `stage-01..NN.webp`; `GameScene.preload()` carrega só as do herói da fase.
- `Cenarios.fundoSequencia()` põe as imagens lado a lado (cada uma cobre a tela 1280×720). Da 2ª em diante, a borda esquerda (240 px) é esmaecida numa textura montada uma vez e entra por cima da anterior: a emenda vira uma fusão, sem corte nem espaço vazio.
- `Cenarios.moverSequencia()` (a cada quadro, via `moverParalaxe`) desloca a fila na proporção do progresso do jogador: largada = começo da 1ª imagem, chegada = última imagem inteira. Só ficam visíveis as imagens que estão na tela.
- O deslocamento equivale a um parallax de ~0,2 a 0,35 da câmera (depende do comprimento da fase). As imagens são achatadas, então não foram recortadas em camadas (recorte automático deixaria buracos e bordas falsas); a profundidade extra vem das partículas, da névoa e das luzes procedurais por cima, que continuam ativas.
- Os fundos são só visuais: nenhuma colisão foi criada a partir deles.
- Ordem de prioridade do fundo: vídeo (`VIDEOS_FUNDO`) → sequência → imagem única → cenário procedural.

## 6. Decisões e resultados (rodada 8)

| Problema | Causa | Solução | Arquivos | Testes |
|---|---|---|---|---|
| Quadrados e grades no fundo de todas as fases, com cara de editor | Grade fixa de 80 px, textura `fundoGeo` e ladrilhos do chão, todos gerados por código | Removidos na origem; vinheta radial lisa no lugar; chão só com degradê e brilho | `js/fases/fase.js`, `js/cenarios.js` | Fotos das 6 fases e das 2 dimensões do Estranho |
| Fundos genéricos | — | Arte das prévias do Gemini como camada principal + efeitos procedurais | `assets/backgrounds/`, `js/config.js` (`CENARIOS_IMAGEM`), `js/cenarios.js`, `js/cenas.js` (`preload`), `tests/gerar_teste_html.py` | Suíte completa na versão integrada |
| Fase da Wanda pouco sombria | — | Floresta amaldiçoada (arte) e versão procedural também em floresta; vinheta trocada | `js/cenarios.js`, `js/fases/wanda.js` | `rodar_testes.py Wanda` |
| Cubo da Wanda pouco reconhecível | — | Máscara com tiara (chifres curvos, V na testa, joia), olhos brilhando; o rosto sempre na face de cima; hitbox 40×40 intacto | `js/efeitosPoderes.js`, `js/fases/wanda.js` | Fotos de perto; pilotos concluem |
| Atraso no pulo | A tecla era lida antes do passo de física, mas o pulo só era decidido depois dele, então valia no passo seguinte | Pulo decidido já no evento de entrada quando a corrida padrão está no controle; pulo guardado e coyote atualizados a cada passo de física | `js/player.js`, `js/fases/fase.js` | `teste_pulo.py` (novo): antes 32/46, depois 46/46 |
| Física variando com o fps | Tempo de ar dependia do quadro de decisão | Mesmo gancho por passo de física | `js/player.js` | Tempo de ar 533,3 ms a 30 e 60 fps; 534,7 ms a 144 fps; altura 92,2 px |
| Nome antigo | — | **Geometry Heroes** em tudo que o jogador vê, metadados e pasta (`Projetos/Geometry-Heroes`). Chaves do localStorage mantidas | `index.html`, `js/cenas.js`, `style.css`, `README.md` | `rodar_testes.py fluxo`, `testes_extras.py` |
| Tela inicial sem identidade | — | Elenco dos 6 heróis em volta do título, título em duas cores, botões chanfrados, fundo do menu sem grade, animação de entrada | `index.html`, `style.css`, `js/cenas.js`, `assets/herois/` | Fotos em 640, 900, 1280 e 1600 px de largura |
| Raio do Hulk enorme no meio da tela; Gavião esverdeado sobre a arte | Raio procedural do tamanho do céu; véu da seção a 16% | Raio fino, curto e nas laterais; véu a 5% quando há arte | `js/cenarios.js`, `js/fases/fase.js` | Suíte completa |

Valores de controle: coyote time 90 ms e jump buffer 120 ms (mantidos). Medidos: aperto 60 ms antes de pousar pula, 210 ms antes não; 50 ms depois de sair da beirada pula, 150 ms depois não. Latência entrada→pulo a 60 fps: de 2 quadros (33,3 ms) para 1 quadro (16,7 ms).

---

## 7. Resultado dos testes (versão integrada, depois do merge dos 3 agentes)

| Suíte | Resultado |
|---|---|
| `teste_pulo.py` (novo) | 46/46 |
| `teste_rodada5.py` | 33/33 |
| `teste_classicos.py` | 18/18 |
| `rodar_testes.py` (pilotos concluem as 6 fases sem invencibilidade) | 48/48 |
| `teste_checkpoints.py` | 90/90 |
| `teste_dificuldade.py` | 18/19 na primeira execução; 19/19 depois de corrigir o teste |

**A falha do `teste_dificuldade.py` era do teste, não do jogo.** Ele media os ganchos de guindaste do Homem-Aranha com 700 ms de intervalo. O gancho faz um vai-e-vem senoidal, e esse intervalo caiu em dois pontos simétricos do movimento, então a posição "não mudou". Conferido à parte que os 4 ganchos andam; o intervalo do teste passou para 400 ms.

**Não executadas na versão integrada** (paradas a pedido da equipe, que fará os testes de jogabilidade): `testes_extras.py`, `testes_finais.py`, `teste_barra.py`, `teste_abertura.py` e `teste_cadencia_ferro.py`. Antes do merge, os agentes rodaram nas suas cópias: Agente 2 `teste_abertura.py` 20/20; Agente 3 `testes_extras.py` 18/18; a rodada 7 rodou `teste_cadencia_ferro.py` 6/6.

---

## 8. Limitações conhecidas e próximos passos
- Teste de jogabilidade com pessoas (a dificuldade foi medida por pilotos automáticos).
- Camadas de cenário separadas por profundidade.
- Imagens de terceiros (retratos e fundos gerados) devem ser substituídas por arte própria antes de qualquer publicação.
- No celular em pé, só parte do elenco aparece na tela inicial.
- Música própria por fase e no modo prática.
