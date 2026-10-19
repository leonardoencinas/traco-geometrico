# Notas de implementação (Geometry Heroes, antes chamado Traço Geométrico) — fusão com o design de jogos de ritmo (estilo Geometry Dash)

## Como a referência foi estudada
- A skill de engenharia reversa (REA) serve para binários/pacotes distribuídos. Não havia binário do jogo de referência no projeto e não extraímos nada dele.
- A análise foi feita sobre o design público e conhecido do gênero: navegação, modos, objetos e ritmo. Nenhum asset, fonte, ícone, nome ou música do jogo original foi copiado; tudo foi desenhado com CSS/Phaser próprios.

## O que já existia (auditoria)
- Phaser 3 + Arcade Physics, scripts clássicos em `js/`, POO: `Fase` (template method), `Obstaculo`, `Habilidade`, `Player`.
- 6 fases/heróis: Homem-Aranha (teia), Homem de Ferro (voo), Hulk (fúria), Gavião (arco), Doutor Estranho (portais, dimensão espelho, Joia do Tempo), Wanda (troca de realidade).
- Checkpoints automáticos + barra % (`barraProgresso.js`), progresso salvo (`progresso.js`), sons sintetizados (`som.js`).

## Matriz de integração
| Elemento do gênero | Integração no nosso jogo | Arquivos | Teste |
|---|---|---|---|
| Pad amarelo (lança) | `PadSalto`: impulso 1,45×; Hulk passa parede alta; Aranha é lançado até as âncoras | `js/classicos.js`, `hulk.js`, `aranha.js` | `teste_classicos.py` |
| Orbe amarelo (pulo no ar) | `OrbeSalto`: apertar encostado dá um pulo novo (aceita apertar um pouco antes). Hulk: poça larga. Wanda: orbe que só existe na realidade azul | `classicos.js`, `fase.js` (aoPressionar), `wanda.js` | `teste_classicos.py` |
| Portal de gravidade | `PortalGravidade` (azul inverte, laranja volta). Hulk corre no teto pulando espinhos pendurados | `classicos.js`, `hulk.js` | `teste_classicos.py` |
| Portal de velocidade | `PortalVelocidade` ×1,25 / ×1 no final do Gavião (alvos chegam mais rápido) | `classicos.js`, `gaviao.js` | `teste_classicos.py` |
| Serra | `Serra` (herda de `Espinho`, gira). Hulk, Aranha, Wanda, Estranho, Gavião; corredores de serra no chão/teto do Homem de Ferro (como o modo "nave") | `classicos.js` + fases | suíte principal |
| Ritmo/música | Trilha sintetizada por batida (bumbo, chimbal, caixa, baixo, arpejo) no BPM de cada fase; fundo pulsa na batida | `som.js`, `fase.js`, `config.js` (bpm/raiz) | `teste_classicos.py` |
| "Tentativa N" no mundo | Texto grande onde o cubo nasce | `fase.js` | `teste_classicos.py` |
| Pausa | ESC/P/⏸: continuar, reiniciar, seleção, som. Congela física, tweens, timers e áudio | `index.html`, `fase.js`, `style.css` | fluxo + `teste_classicos.py` |
| Menu principal | 3 botões redondos (Heróis · JOGAR · Como jogar) + botão de som | `index.html`, `cenas.js`, `style.css` | fluxo |
| Seleção de fases | Carrossel com 1 cartão por vez, setas/teclado, bolinhas, dificuldade com estrelas, melhor % e recordes | `index.html`, `cenas.js`, `progresso.js`, `style.css` | `teste_classicos.py`, fluxo |

## Rodada 2 (referência: site de terceiros com uma cópia web do jogo)
- O site indicado é uma cópia não oficial do jogo de outra empresa. Não extraímos nem descompilamos código, fases ou imagens de lá.
- Usamos só o que se observa jogando: cores que mudam por trecho, chão com linha brilhante que pulsa na música e obstáculos encaixados na batida.
- **Cores por seção** (`CORES_SECOES` em `config.js`): a cada checkpoint o cenário muda de tom suavemente.
- **Chão estilizado** (`decorarChao` em `fase.js`): degradê, ladrilhos e linha de topo que acende em cada batida.
- **Trechos no ritmo** (`tipo: 'ritmo'` em `classicos.js`): cada caractere do padrão é uma batida (distância = velocidade × 60 / BPM). Usado no Hulk (antes do último grupo), no Gavião (depois do laser) e no Doutor Estranho (abertura).
- **Menu**: o fundo muda de cor devagar (azul, roxo, magenta, verde-azulado).

## Rodada 3: estrutura das fases clássicas (pesquisa pública)
- Fontes: as wikis do jogo e um guia de padrões de fase, lidos só como descrição, nada copiado. Princípios aproveitados:
  - a dificuldade sobe aos pouco;
  - há espaço livre antes de cada mecânica nova;
  - cada mecânica é apresentada uma de cada vez (o pad primeiro ajuda, depois vira perigo);
  - as seções se alternam (cubo e nave);
  - existem rotas e pistas visuais.
- **Abertura no ritmo** (`criarAbertura` em `fase.js`): fica antes do x = 0, em Hulk, Gavião, Estranho, Wanda e Aranha. O Homem de Ferro voa a fase toda, como a "nave".
  - Sequência, 1 elemento por batida: espinho, espinho, duplo, plataforma sobre espinhos, pad + triplo, poço de 7 espinhos que exige o orbe, e um respiro antes da mecânica do herói.
  - Só aparece começando do zero, nunca ao reaparecer num checkpoint. Os testes antigos usam `MODO_TESTE.semAbertura`, e `tests/teste_abertura.py` testa a abertura.
- **Fundo geométrico** (`criarFundoGeometrico`): quadrados grandes em paralaxe lenta, desenhados por nós e tingidos pela cor da seção.

## Rodada 4: mais variedade de obstáculos
- Novos: `MiniEspinho` (meia altura), `SerraDescendo` (desce do alto conforme o cubo chega; acionada pela posição, sempre igual), pad rosa (fraco) e orbe rosa (pulinho).
- Abertura agora é diferente pra cada herói (`ABERTURAS` em config.js), escrita como padrão de símbolos por batida (legenda em `criarAbertura`). Inclui bloco pra subir, plataforma sobre espinhos, serras, pads e orbes amarelos/rosas.
- Nas fases: serra que desce (Hulk 9600, Gavião 12450, Estranho 7700, Wanda 2450, Aranha 11850) e mini espinhos (Gavião 7400/7440, Estranho 15000).

## Rodada 5: modos de jogo, gravidade azul e modo prática (referência: geometrylitepc.net)
- Como na rodada 2, o site é uma cópia não oficial do jogo de outra empresa. **Não fizemos engenharia reversa** dele: nada de código, fases, imagens ou sons foi baixado, descompilado ou copiado. A skill REA serve pra binários e pacotes; aqui só lemos o texto público da página e usamos o que qualquer pessoa vê jogando.
- O que a página descreve e ainda faltava no nosso jogo: portais que transformam em **bola** e **UFO**, anéis/pads que trocam a gravidade e **modo prática com diamantes verdes**.

| Elemento do gênero | Integração no nosso jogo | Arquivos | Teste |
|---|---|---|---|
| Portal de modo (cubo / bola / UFO) | `PortalModo` (■ verde, ● vermelho, ◓ roxo). Mantém a gravidade como estava | `classicos.js` | `teste_rodada5.py` |
| Modo bola | `Player.atualizarBola`: apertar encostado troca chão ↔ teto (com coyote e buffer); rola; anel desenhado por cima | `player.js` (`MODOS`) | `teste_rodada5.py` |
| Modo UFO | `Player.atualizarUfo`: cada aperto novo é um pulinho (no ar também), segurar não repete, queda limitada; disco desenhado | `player.js` | `teste_rodada5.py` |
| Pad azul / orbe azul | Variante `'azul'` de `PadSalto` e `OrbeSalto`: inverte a gravidade e empurra pro novo lado | `classicos.js` (`inverterClassico`) | `teste_rodada5.py` |
| Pilares (trecho de UFO/nave) | Tipo `'pilar'` na base `Fase` (coluna do chão + coluna do teto com vão) | `fase.js` | `teste_rodada5.py` |
| Modo prática | Pausa → "◆ Modo prática". **Z** marca diamante verde, **X** apaga, morrer volta ao último. Diamante guarda posição, velocidade, gravidade, modo, velocidade de corrida, ligações acionadas e o estado da fase (gancho `estadoPratica`). Nada vira recorde. Sair recomeça do zero | `fase.js`, `cenas.js`, `index.html`, `style.css`, ganchos em `wanda.js`, `estranho.js`, `gaviao.js`, `aranha.js` | `teste_rodada5.py` |

- **Hulk, ato 4 (17050–20800)**: portal ● → espinhos alternando chão/teto (bola) → portal ■ ainda no teto → pad azul no teto devolve ao chão → orbe azul sobre um poço de 8 espinhos → portal laranja. Novo checkpoint em 16950 (agora 4: 20/40/60/80%). Comprimento 16800 → 21100.
- **Gavião, final extra (17500–20700)**: portal ◓ → 4 pilares com vãos em alturas diferentes; no meio, um alvo abre a porta (a flecha continua sendo a mecânica central, mesmo voando). Novo checkpoint em 17350. Comprimento 17600 → 21000.
- Prática por herói: Wanda guarda a realidade, Estranho a dimensão, Gavião as flechas especiais e as portas abertas, e o Aranha só deixa marcar com os pés num telhado (não dá pra refazer a teia no ar).
- Pilotos automáticos (`rodar_testes.py`): Hulk sabe jogar a bola e o orbe azul, e só pula espinho do lado em que está; Gavião voa o UFO mirando no vão do próximo pilar.

## Rodada 6: visual neon, level design das capturas e interface (esquema em `REA_ESQUEMA.md`)
- Base: 5 capturas de tela enviadas pela equipe, analisadas só por observação (nada extraído). O esquema completo está em `REA_ESQUEMA.md`.
- **Objetos neon**: espinhos, serras e blocos genéricos agora são pretos (`tema.objeto`) com contorno claro (`tema.neon`) e halo na cor de destaque. `BlocoNeon` desenha a grade de ladrilhos; `PlataformaSuspensa` tem correntes.
- **Cores das fases** refinadas (`TEMAS`, `CORES_SECOES`): Aranha azul/vermelho, Ferro vermelho/dourado, Hulk verde→roxo, Gavião roxo/limão, Estranho azul-noite/laranja (espelho magenta), Wanda breu/vermelho. O cenário de trás é tingido pela cor da seção; feixes de luz pulsam na batida; rastro de partículas no jogador.
- **Level design novo**: tipos `fileira` (grupos de espinhos no chão/teto), `piramide` (pirâmide invertida com espinhos por baixo) e `plataformaSuspensa`. Gavião (UFO): 3 grupos curtos de espinhos + pirâmide. Ferro: corredor curto de espinhos no chão e no teto. Abertura: plataformas com correntes e blocos em grade.
- **Regra da equipe**: triângulo = perigo, sempre. Tiramos triângulos do cenário (fundo, tufos de chão, topo dos prédios do Hulk, telhados da Wanda, fragmentos do Estranho) e reduzimos as fileiras de espinhos a grupos curtos com função.
- **Interface**: título e botões com fonte de letras grossas (Bungee, Google Fonts, com reserva), botões chanfrados com contorno escuro, pausa redonda verde, painel de pausa e cartão da fase com duas barras (Normal e Prática). `Progresso.registrarPctPratica` guarda o melhor % da prática.

## Ajustes pedidos pela equipe (depois da rodada 6)
- **Aljavas do Gavião** agora são desenhadas como flecha (haste, ponta e penas, inclinada): laranja com bolinha = explosiva, ciano com raio = elétrica. A área de toque continua invisível por baixo.
- **Homem-Aranha sem habilidade no E**: o puxão de teia foi retirado (classe `PuxaoTeia`, dica e texto de controles). A teia (segurar/soltar) é a mecânica toda; a fase não mostra botão de habilidade.
- **Ordem das fases por dificuldade**: Homem-Aranha (Fácil) → Hulk → Gavião (Normal) → Homem de Ferro → Doutor Estranho (Difícil) → Wanda (Insano, por último). Vale pro carrossel, pro botão "Próxima fase" e pro painel de heróis.

## Rodada 7: cenários, obstáculos e poderes (3 agentes em paralelo)
- **Cenários** (`js/cenarios.js` + `criarParalaxe` de cada fase): fundos temáticos com várias camadas e elementos animados por herói (cidade noturna, metrópole futurista, ruínas gama, base tática, santuário místico do Estranho com círculos mágicos e portais ao fundo, subúrbio do caos da Wanda). `Fase.cenarioReagir(evento)` faz o fundo reagir aos poderes (Joia, portais, dimensão, fúria, repulsor, realidade).
- **Obstáculos** (`js/obstaculosTematicos.js`): espinho que brota, laser de piso no ritmo, bloco que desliza até o lugar, torreta, minas flutuantes, carro arremessado e holofote-alvo, espalhados por fase e nas aberturas (símbolos `e` e `l`). Tudo determinístico e com aviso antes.
- **Heróis e poderes** (`js/efeitosPoderes.js`): cubos próprios dos 6 heróis (mesma hitbox), rastros e pousos, efeitos novos de fúria, repulsor, flechas, teia, troca de realidade; portais místicos redesenhados (só visual) e Joia do Tempo esmeralda sincronizada com início, reverso e fim. Repulsor do Homem de Ferro: recarga de 400 ms para 150 ms, com disparo contínuo segurando E (`tests/teste_cadencia_ferro.py`).
- Integração: os três trabalhos entraram sem conflito; a suíte completa passou na versão junta.

## Rodada 8: Geometry Heroes (3 agentes em paralelo)
- Nome do jogo: **Geometry Heroes** (pasta `Projetos/Geometry-Heroes`); chaves do localStorage mantidas como `tracoGeometrico.*`.
- Fundos: arte recortada das 6 prévias do Gemini (`assets/backgrounds/`, `CENARIOS_IMAGEM`), grade e quadrados removidos de todas as fases, Wanda em floresta amaldiçoada, cubo da Wanda com tiara.
- Pulo: decidido já no evento de entrada e por passo de física (de 2 para 1 quadro de atraso a 60 fps; tempo de ar igual em 30/60/144 fps). `tests/teste_pulo.py`.
- Tela inicial nova com os 6 retratos (`assets/herois/`, ver `CREDITOS.md`).
- Detalhes, inventário dos cenários, Skills e agentes: `DOCUMENTACAO.md`.

## Decisões
- As habilidades dos heróis continuam sendo o centro de cada fase. Os elementos clássicos entram como preparação e ritmo entre os desafios da habilidade, nunca no lugar dela.
- Portal de gravidade só no Hulk: o Doutor Estranho já tem a dimensão espelho, e a Wanda e o Aranha dependem do chão.
- Portal de velocidade só no Gavião: Hulk e Wanda dependem de distâncias calculadas para fúria e plataformas ⌛, e o Estranho já tem faixas rápidas.
- A porcentagem continua vindo dos checkpoints (pedido anterior). O cartão mostra o melhor % alcançado.
- Dificuldade dos cartões: Aranha Fácil, Hulk e Gavião Normal, Ferro e Estranho Difícil, Wanda Insano (`config.js`). A seleção segue essa ordem (a mais difícil por último).

## Pendências / limites conhecidos
- Modo prática existe (rodada 5), mas não tem música própria e os diamantes somem ao voltar pro menu.
- Modos de jogo: cubo, bola e UFO (rodada 5); o voo do Homem de Ferro faz o papel de "nave". Ainda não há onda, robô, aranha nem portal de tamanho (mini).
- A música é sintetizada e simples; os obstáculos não foram reposicionados batida a batida.
- Os testes usam um piloto automático; a sensação de dificuldade para pessoas não foi medida.

## Rodada 9 — Sequência de cenários (Aranha, Hulk, Gavião)
- 17 imagens enviadas viraram `stage-NN.webp` 1280×720 (1,37 MB no total); as antigas `_cena.webp` desses 3 heróis saíram.
- Fundo em sequência com fusão nas emendas e percurso amarrado ao progresso da fase (ver DOCUMENTACAO.md §5).
- Suporte a vídeo de fundo (`VIDEOS_FUNDO`), ainda sem vídeos.
- Testes: rodar_testes.py 48/48; capturas em 2%, 50% e 98% das 3 fases sem erro de console. Outras suítes não rodadas.
- Pendente: stage-06 do Gavião; sequências do Ferro, Estranho e Wanda.

## Retomada
Esquema visual: `REA_ESQUEMA.md`. Testes: `python3 tests/rodar_testes.py`, `teste_rodada5.py`, `teste_checkpoints.py`, `teste_dificuldade.py`, `teste_classicos.py`, `testes_extras.py`, `testes_finais.py`, `teste_barra.py`.
