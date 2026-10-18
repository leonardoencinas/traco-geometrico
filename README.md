<div align="center">

<img src="images/icon-v2.svg" alt="Ícone do Traço Geométrico" width="96" height="96">

# Traço Geométrico

**Um jogo de plataforma no ritmo da música, com heróis e uma habilidade diferente em cada fase.**

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-f5a623?style=for-the-badge)
![Phaser](https://img.shields.io/badge/Phaser-3.90-8a2be2?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-POO-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)
![Plataforma](https://img.shields.io/badge/navegador-desktop%20%26%20celular-3dff8a?style=for-the-badge)

*Um salto de cada vez.*

</div>

---

> [!WARNING]
> **Jogo em desenvolvimento.** As fases já são jogáveis do começo ao fim, mas ainda estamos ajustando dificuldade, visual e efeitos. Coisas podem mudar (ou quebrar) entre uma versão e outra.

## Sobre o jogo

O cubo corre sozinho pra direita e você controla o salto, no compasso da trilha. A ideia vem dos jogos de plataforma rítmica: espinhos, pads, orbes e portais encaixados na batida. O diferencial é que **cada fase tem um herói, e a habilidade dele é o centro do desafio**. Os elementos clássicos entram entre um desafio e outro da habilidade, sem tomar o lugar dela.

O projeto é um trabalho de **Programação Orientada a Objetos**, feito em equipe: cada fase é uma subclasse de `Fase` (método template) e cada habilidade, uma subclasse de `Habilidade`.

## Fases

As fases estão em ordem de dificuldade; a mais difícil fica por último.

| # | Herói | Dificuldade | Habilidade | O que a fase pede |
|:-:|---|:-:|---|---|
| 1 | 🕷️ **Homem-Aranha** | ★★ Fácil | Teia | Segure no ar pra prender a teia numa âncora e solte na hora certa pra voar sobre os vãos |
| 2 | 💚 **Hulk** | ★★★ Normal | Fúria (E) | Cresça e atravesse caixas, vidro e concreto; termina num trecho no **modo bola** |
| 3 | 🏹 **Gavião Arqueiro** | ★★★ Normal | Arco (clique / E) | Acerte alvos pra abrir portas, desligar lasers e estender pontes; termina num trecho de **UFO** |
| 4 | 🦾 **Homem de Ferro** | ★★★★★ Difícil | Voo + repulsor (E) | Segure pra subir, solte pra descer e derrube drones, torretas e núcleos |
| 5 | ✨ **Doutor Estranho** | ★★★★★ Difícil | Portais (Q) e Joia do Tempo (E) | Leia a rota "fantasma", troque de dimensão e desacelere o tempo |
| 6 | 🔴 **Wanda Maximoff** | ★★★★★★★★ Insano | Realidade (E) | Troque entre a realidade vermelha e a azul: só existe o que é da realidade atual |

## O que já tem

- 🎵 **Ritmo de verdade:** trilha sintetizada no BPM de cada fase, com o cenário pulsando na batida.
- 🧩 **Elementos clássicos do gênero:** pads e orbes amarelos, rosas e azuis, portais de gravidade, de velocidade e de modo (cubo, bola e UFO), serras e espinhos que brotam do chão.
- 🦸 **Um cubo pra cada herói**, com rastro, efeito ao pousar e efeitos próprios de cada poder.
- 🏙️ **Cenários temáticos** com várias camadas: cidade à noite, metrópole futurista, ruínas, base tática, santuário místico e o subúrbio do caos.
- 🚩 **Checkpoints automáticos** e barra de progresso em %.
- ◆ **Modo prática** (na pausa): **Z** marca um diamante verde, **X** apaga, e morrer te leva de volta ao último diamante. Não conta como recorde.
- 💾 **Progresso salvo** no navegador: melhor %, melhor tempo e menos tentativas por fase.
- ♿ **Acessibilidade:** controles por teclado, mouse e toque, e respeito à opção de "reduzir movimento" do sistema.

## Controles

| Ação | Teclado | Mouse / toque |
|---|---|---|
| Pular / ação principal | `Espaço`, `↑` ou `W` | Clique / toque |
| Habilidade do herói | `E` (ou `Shift`) | Botão da habilidade |
| Portal (Doutor Estranho) | `Q` | — |
| Pausar | `Esc` ou `P` | Botão ❚❚ |
| Reiniciar | `R` | — |
| Som | `M` | Botão de som |
| Modo prática: marcar / apagar | `Z` / `X` | Botões ◆ / ✕ |

## Como jogar no computador

O jogo é feito só com HTML, CSS e JavaScript (o [Phaser 3](https://phaser.io/) vem de um CDN), então não precisa instalar nada.

1. Baixe ou clone o repositório.
2. Abra o `index.html` no navegador.

Se o navegador bloquear algo ao abrir o arquivo direto, rode um servidor local simples na pasta do projeto e abra `http://localhost:8000`:

```bash
python3 -m http.server 8000
```

## Estrutura do projeto

```text
traco-geometrico/
├── index.html              # Telas (menu, seleção, pausa, conclusão) e ordem dos scripts
├── style.css               # Visual das telas e dos botões
├── main.js                 # Configuração e início do Phaser
├── images/                 # Ícone do jogo
├── js/
│   ├── config.js           # Temas, cores, velocidade e dificuldade de cada fase
│   ├── player.js           # O cubo: pulo, gravidade e modos (cubo, bola, UFO)
│   ├── obstaculos.js       # Classe base Obstaculo + bloco, espinho, plataforma
│   ├── classicos.js        # Pads, orbes, portais e serras
│   ├── obstaculosTematicos.js  # Obstáculos novos de cada fase
│   ├── cenarios.js         # Cenários temáticos e reação aos poderes
│   ├── efeitosPoderes.js   # Cubos dos heróis e efeitos dos poderes
│   ├── cenas.js            # Cenas do Phaser: menu e jogo
│   └── fases/              # Fase base + uma subclasse por herói
├── tests/                  # Testes automáticos (Playwright + piloto automático)
├── IMPLEMENTATION_NOTES.md # Diário de desenvolvimento, rodada por rodada
└── REA_ESQUEMA.md          # Análise visual das referências usada no design
```

## Testes

Os testes abrem o jogo num navegador sem tela e usam um **piloto automático** que joga cada fase usando os mesmos controles do jogador (sem invencibilidade).

```bash
pip install playwright
# coloque uma cópia do Phaser em ./phaser.local.min.js (os testes não usam o CDN)
python3 tests/rodar_testes.py
```

Outras suítes: `teste_rodada5.py`, `teste_checkpoints.py`, `teste_classicos.py`, `teste_dificuldade.py`, `teste_abertura.py`, `teste_cadencia_ferro.py`, `testes_extras.py`, `testes_finais.py` e `teste_barra.py`.

## Próximos passos

- [ ] Rodada de testes de jogabilidade com pessoas (a dificuldade foi medida só pelo piloto automático)
- [ ] Música própria pra cada fase (hoje é sintetizada e simples)
- [ ] Música própria no modo prática e diamantes salvos entre sessões
- [ ] Mais modos de jogo (onda, robô, portal de tamanho)
- [ ] Publicar uma versão jogável online

## Créditos e aviso

Projeto escolar feito em equipe, **sem fins comerciais**. Os personagens pertencem à Marvel, e a mecânica de plataforma rítmica é inspirada no gênero popularizado por jogos como *Geometry Dash*. **Nenhum código, fase, imagem, fonte ou som desses jogos foi copiado:** tudo foi desenhado e programado pela equipe, e as referências foram estudadas só por observação (veja `REA_ESQUEMA.md`).
