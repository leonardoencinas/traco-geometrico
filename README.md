# Geometry Heroes

**[▶ Jogar online](https://paulomarcelli.github.io/Projetos/Projetos/Geometry-Heroes/)**

Jogo de **plataforma no ritmo da música** feito em JavaScript (POO) com Phaser 3. Cada fase é de um herói e cada herói tem uma habilidade diferente. Projeto da FECAP, curso de Análise e Desenvolvimento de Sistemas (ADS).

**Integrantes:** Paulo Marcelli, Pedro Henrique, Cauã Santos Nascimento e Leonardo Zachello.

## As 6 fases

| Herói | Habilidade | Dificuldade |
|---|---|---|
| Homem-Aranha | Teia: segure no ar para balançar | Fácil |
| Hulk | Fúria: cresce e atravessa o que quebra | Normal |
| Gavião Arqueiro | Mira: acerta alvos e abre caminho | Normal |
| Doutor Estranho | Portais, dimensão espelho e Joia do Tempo | Difícil |
| Homem de Ferro | Voo: segure para subir; repulsor derruba drones (encostar no túnel mata) | Insano |
| Feiticeira Escarlate | Troca de realidade: vermelha ◆ e azul ● | Insano |

## Como jogar

- **Espaço, seta para cima ou clique/toque:** pular
- **E, Shift ou botão na tela:** usar o poder do herói
- **R:** reiniciar · **ESC:** pausa · **Z / X:** marcar/apagar ponto no modo prática

## Como rodar

O jogo precisa ser aberto por um servidor local (abrir o `index.html` com duplo clique não carrega as imagens) e de internet, porque o Phaser é baixado de um CDN.

- **VS Code:** instale a extensão *Live Server* e clique em *Open with Live Server* no `index.html`.
- **Terminal:** na pasta do jogo, `python -m http.server 8000` e abra `http://localhost:8000`.

## Programação Orientada a Objetos

- **Classes e objetos:** 78 classes (fases, obstáculos, habilidades, jogador, efeitos, som).
- **Herança:** `Fase` é a base de `FaseHulk`, `FaseAranha`, `FaseGaviao`, `FaseFerro`, `FaseEstranho` e `FaseWanda`; `Obstaculo` tem cadeias como `Espinho → Serra → SerraDescendo`.
- **Polimorfismo:** a classe base chama ganchos (`checkpoints()`, `aoPressionar()`, `criarElemento()`) e cada fase responde do seu jeito (método template).
- **Encapsulamento:** a recarga de `Habilidade` só muda por `pronta()` e `ativar()`.

## Estrutura

| Pasta/arquivo | Conteúdo |
|---|---|
| `index.html`, `style.css`, `main.js` | telas, estilo e inicialização do Phaser |
| `js/` | classes do jogo (`js/fases/` tem uma por herói) |
| `assets/` | cenários em camadas e retratos dos heróis |
| `tests/` | testes automáticos em Python + Playwright |
| `apresentacao/` | scripts do vídeo de apresentação |
| `DOCUMENTACAO.md`, `IMPLEMENTATION_NOTES.md`, `REA_ESQUEMA.md`, `PROMPTS_MANUS.md` | documentação do projeto |

## Testes

São 7 suítes com 280 verificações (jogo completo de cada fase com piloto automático, pulo, interface, checkpoints, dificuldade e renascimento). Precisam de Python, Playwright e do arquivo `phaser.local.min.js` (Phaser 3.90) na pasta do jogo:

```
python tests/gerar_teste_html.py
python tests/rodar_testes.py
```

## Observação

A pasta `src/` tem o exemplo inicial de POO (playlist) que existia antes do jogo e não faz parte dele.
