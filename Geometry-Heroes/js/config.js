// ================================================================
// config.js — configurações gerais do jogo (carregado primeiro)
// ================================================================

// Check de acessibilidade: identifica se o usuário prefere movimentos reduzidos no sistema operacional
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// CONFIGURAÇÕES DE MOVIMENTO (valores padrão; cada fase pode sobrescrever)
const MOVIMENTO = {
    forcaPulo: 700,       // velocidade inicial do pulo pra cima
    giroNoAr: 330,        // graus por segundo que o cubo gira enquanto está no ar
    coyoteTime: 90,       // ms que ainda dá pra pular depois de sair da beirada
    jumpBuffer: 120,      // ms que um aperto feito um pouco antes de cair ainda vale
    telaX: 260,           // posição X NA TELA onde o cubo aparece (a câmera segue ele)
    chaoY: 660,           // Y do topo do chão
    tetoY: 100,           // Y da parte de baixo do teto (linha brilhante em 100)
    gravidade: 2500       // Mesma gravidade do config do Phaser
};

// TEMAS DE CORES: um por fase (usados no fundo, no chão, no fade e no HUD)
const TEMAS = {
    // Paleta refinada na rodada 6 (veja REA_ESQUEMA.md): fundo saturado por herói, objetos pretos
    // (objeto) com contorno claro (neon) e brilho na cor de destaque (linha), como nos jogos de ritmo.
    // Tema azul padrão (menu)
    padrao: {
        fundo: '#1a2f9c',     // Cor de fundo da câmera
        grade: 0x8fb0ff,      // Cor das linhas da grade
        forma: 0x2a48c8,      // Cor das formas flutuantes
        bordaForma: 0x9cc0ff, // Borda das formas flutuantes
        faixa: 0x0e1c66,      // Cor das faixas do chão e do teto
        linha: 0x6fe6ff,      // Cor das linhas brilhantes (destaque)
        texto: '#ecf4ff',     // Cor do texto do HUD
        fade: [26, 47, 156],  // Cor (RGB) da transição de entrada/saída
        objeto: 0x070b22,     // Preenchimento dos objetos (blocos, espinhos)
        neon: 0xffffff        // Contorno dos objetos
    },
    // Homem-Aranha: azul vivo com destaque vermelho (o uniforme)
    aranha: {
        fundo: '#123aa6', grade: 0x8fb0ff, forma: 0x1d4bc4, bordaForma: 0xff6b80,
        faixa: 0x0a1f5c, linha: 0xff3b55, texto: '#ffeef0', fade: [18, 58, 166], objeto: 0x070b1e, neon: 0xffffff
    },
    // Homem de Ferro: vermelho da armadura com dourado
    ferro: {
        fundo: '#4c0a10', grade: 0xffa040, forma: 0x7a1218, bordaForma: 0xffc23d,
        faixa: 0x2e0508, linha: 0xffc23d, texto: '#fff3dc', fade: [76, 10, 16], objeto: 0x120305, neon: 0xffe2a0
    },
    // Hulk: verde (as seções do meio puxam pro roxo, as cores do herói)
    hulk: {
        fundo: '#1f5216', grade: 0xb8ff8a, forma: 0x2f7a1f, bordaForma: 0x9dff5a,
        faixa: 0x123a0c, linha: 0x9dff5a, texto: '#eeffe4', fade: [31, 82, 22], objeto: 0x061204, neon: 0xffffff
    },
    // Gavião Arqueiro: roxo com destaque limão
    gaviao: {
        fundo: '#4a1a8c', grade: 0xc9a6ff, forma: 0x5a24a6, bordaForma: 0xd6b8ff,
        faixa: 0x24094a, linha: 0xb8ff5a, texto: '#f1e8ff', fade: [74, 26, 140], objeto: 0x0c0418, neon: 0xffffff
    },
    // Doutor Estranho: azul-noite com laranja místico
    estranho: {
        fundo: '#14306a', grade: 0x7aa0ff, forma: 0x1d3f8a, bordaForma: 0xffa53d,
        faixa: 0x08183d, linha: 0xffa53d, texto: '#fff3e0', fade: [20, 48, 106], objeto: 0x060a1a, neon: 0xffdcae
    },
    // Doutor Estranho: dimensão espelhada (magenta)
    espelho: {
        fundo: '#5a1470', grade: 0xe0a6ff, forma: 0x6e1c8a, bordaForma: 0xff7ad9,
        faixa: 0x2a0838, linha: 0xff7ad9, texto: '#ffe6f7', fade: [90, 20, 112], objeto: 0x14041c, neon: 0xffd6f2
    },
    // Wanda: breu avermelhado com contorno vermelho (neon no escuro)
    wanda: {
        fundo: '#0e0107', grade: 0x8a1a2a, forma: 0x3a0812, bordaForma: 0xff2a3d,
        faixa: 0x100104, linha: 0xff2a3d, texto: '#ffdde2', fade: [34, 4, 10], objeto: 0x0a0103, neon: 0xff4d5e
    }
};

// CONFIGURAÇÃO DE CADA FASE (velocidade de corrida, comprimento até a chegada, tema)
const CONFIG_FASES = {
    'Hulk':           { nome: 'HULK',            tema: 'hulk',     velocidade: 450, comprimento: 21100, bpm: 128, raiz: 55,  dificuldade: 'Normal' },
    'Homem de Ferro': { nome: 'HOMEM DE FERRO',  tema: 'ferro',    velocidade: 540, comprimento: 21800, bpm: 140, raiz: 73.4, dificuldade: 'Insano' },   // túnel: encostar mata
    'Gaviao':         { nome: 'GAVIÃO ARQUEIRO', tema: 'gaviao',   velocidade: 400, comprimento: 21000, bpm: 120, raiz: 61.7, dificuldade: 'Normal' },
    'Homem-Aranha':   { nome: 'HOMEM-ARANHA',    tema: 'aranha',   velocidade: 420, comprimento: 15000, bpm: 132, raiz: 65.4, dificuldade: 'Fácil' },
    'DrEstranho':     { nome: 'DOUTOR ESTRANHO', tema: 'estranho', velocidade: 470, comprimento: 20600, bpm: 124, raiz: 58.3, dificuldade: 'Difícil' },
    'Wanda':          { nome: 'FEITICEIRA ESCARLATE', tema: 'wanda',    velocidade: 470, comprimento: 16200, bpm: 136, raiz: 51.9, dificuldade: 'Insano' }
};

// MODO DE TESTE (usado só pelos testes automáticos: deixa o cubo invencível)
const MODO_TESTE = { invencivel: false, semAbertura: false };

// INFORMAÇÕES DOS HERÓIS (painel "Heróis" do menu e cartões da seleção)
const HEROIS_INFO = {
    // Mesma ordem da seleção de fases (por dificuldade)
    'Homem-Aranha':   { habilidade: 'Teia: segure no ar pra balançar e solte pra voar', cor: '#ff5a6e' },
    'Hulk':           { habilidade: 'Fúria: cresce e atravessa o que quebra (E)', cor: '#6fdc4a' },
    'Gaviao':         { habilidade: 'Arco: E ou clique acerta alvos e abre caminho', cor: '#a77bff' },
    'Homem de Ferro': { habilidade: 'Voo: segure pra subir; E = repulsor', cor: '#ffc23d' },
    'DrEstranho':     { habilidade: 'Portais (Q), dimensão espelho e Joia do Tempo (E)', cor: '#3dff8a' },
    'Wanda':          { habilidade: 'Realidade: E troca entre vermelha ◆ e azul ●', cor: '#ff2a4d' }
};

// Ícone e estrelas de cada dificuldade (desenho próprio, sem assets de outros jogos)
const DIFICULDADES = {
    'Fácil':   { estrelas: 2, cor: '#3ad1ff' },
    'Normal':  { estrelas: 3, cor: '#3dff8a' },
    'Difícil': { estrelas: 5, cor: '#ffd400' },
    'Insano':  { estrelas: 8, cor: '#ff4d6d' }
};

// CORES POR SEÇÃO (como os "gatilhos de cor" dos jogos de ritmo): a cada checkpoint o cenário
// muda de tom suavemente. Uma cor por trecho: início, depois do 1º, 2º, 3º (e 4º) checkpoint.
const CORES_SECOES = {
    'Homem-Aranha':   [0x1f5fff, 0x7a2aff, 0xff2a55, 0x00b4d8],
    'Homem de Ferro': [0xff2a2a, 0xffb000, 0xff6a00, 0xffd84a],
    'Hulk':           [0x4cff2a, 0x9dff00, 0xa02aff, 0x2affb0, 0xc22aff],
    'Gaviao':         [0x8a3cff, 0xb8ff2a, 0xff3cd2, 0x3cd2ff, 0x6a2aff],
    'DrEstranho':     [0x2a6aff, 0xff8a00, 0x00e0a0, 0xd02aff],
    'Wanda':          [0x9a0a2a, 0x7a0848, 0x4a0a7a, 0xb0101e]   // vinho, vinho-roxo, roxo e escarlate escuro (véu sombrio)
};

// CENÁRIOS EM IMAGEM (rodada 8): arte de fundo de cada fase, recortada das prévias do Gemini
// (assets/backgrounds/<pasta>/<pasta>_cena.webp, 720 px de altura, opaca). Carregada no preload da GameScene
// (só a do herói da fase). Fica num tileSprite fixo na tela que repete na horizontal com cópia espelhada
// alternada ([imagem | imagem espelhada], textura montada uma vez), atrás das partículas/névoa/reações.
// Fases com `sequencia`: cada imagem (1280x720) ocupa a tela inteira e a fila toda é percorrida do começo
// ao fim da fase (parallax calculado pelo comprimento). Se o arquivo falhar (ou a página estiver em file://, onde o WebGL não aceita a imagem), a fase usa
// o cenário procedural de cenarios.js, sem erro no console.
//   fator: paralaxe (0.12–0.18) · y/alto: faixa da tela ocupada (entre o HUD em 100 e o chão em 660)
//   tom: tint multiplicado (baixa o contraste pra os obstáculos neon continuarem na frente)
const CENARIOS_IMAGEM = {
    // Sequência de cenários (stage-01..N): as imagens aparecem em ordem ao longo da fase, com fusão nas emendas
    'Hulk':           { camadas: [
        { arquivo: 'assets/backgrounds/hulk/hulk-c1-ceu.webp',    fator: 0.01 },
        { arquivo: 'assets/backgrounds/hulk/hulk-c2-longe.webp',  fator: 0.03 },
        { arquivo: 'assets/backgrounds/hulk/hulk-c3-meio.webp',   fator: 0.07 },
        { arquivo: 'assets/backgrounds/hulk/hulk-c4-perto.webp',  fator: 0.14 },
        { arquivo: 'assets/backgrounds/hulk/hulk-c5-poeira.webp', fator: 0.18, deriva: 10, respira: true }
    ] },
    'Gaviao':         { camadas: [
        { arquivo: 'assets/backgrounds/gaviao/gaviao-c1-ceu.webp',   fator: 0.01 },
        { arquivo: 'assets/backgrounds/gaviao/gaviao-c2-longe.webp', fator: 0.03 },
        { arquivo: 'assets/backgrounds/gaviao/gaviao-c3-meio.webp',  fator: 0.07 },
        { arquivo: 'assets/backgrounds/gaviao/gaviao-c4-perto.webp', fator: 0.14 },
        { arquivo: 'assets/backgrounds/gaviao/gaviao-c5-luzes.webp', fator: 0.18, deriva: 8, respira: true }
    ] },
    'Homem-Aranha':   { camadas: [
        { arquivo: 'assets/backgrounds/homem-aranha/aranha-c1-ceu.webp',       fator: 0.01 },
        { arquivo: 'assets/backgrounds/homem-aranha/aranha-c2-skyline.webp',   fator: 0.03 },
        { arquivo: 'assets/backgrounds/homem-aranha/aranha-c3-meio.webp',      fator: 0.07 },
        { arquivo: 'assets/backgrounds/homem-aranha/aranha-c5-atmosfera.webp', fator: 0.18, deriva: 8, respira: true }
    ] },
    // Camadas em parallax (do fundo para a frente), cada uma em loop espelhado; fator = quanto anda com a câmera
    'Homem de Ferro': { camadas: [
        { arquivo: 'assets/backgrounds/homem-de-ferro/ferro-c1-ceu.webp',     fator: 0.01 },
        { arquivo: 'assets/backgrounds/homem-de-ferro/ferro-c2-skyline.webp', fator: 0.03 },
        { arquivo: 'assets/backgrounds/homem-de-ferro/ferro-c3-meio.webp',    fator: 0.07 },
        { arquivo: 'assets/backgrounds/homem-de-ferro/ferro-c4-perto.webp',   fator: 0.14 },
        { arquivo: 'assets/backgrounds/homem-de-ferro/ferro-c5-energia.webp', fator: 0.18 }
    ] },
    'DrEstranho':     { camadas: [
        { arquivo: 'assets/backgrounds/dr-estranho/estranho-c1-ceu.webp',    fator: 0.01 },
        { arquivo: 'assets/backgrounds/dr-estranho/estranho-c2-longe.webp',  fator: 0.03 },
        { arquivo: 'assets/backgrounds/dr-estranho/estranho-c3-meio.webp',   fator: 0.07 },
        { arquivo: 'assets/backgrounds/dr-estranho/estranho-c4-perto.webp',  fator: 0.14 },
        { arquivo: 'assets/backgrounds/dr-estranho/estranho-c5-arcano.webp', fator: 0.18 }
    ], tom: 0xa8a4bc },
    // Imagem única espelhada em loop (a sequência da Wanda vem depois)
    'Wanda':          { arquivo: 'assets/backgrounds/wanda/wanda_cena.webp',                   fator: 0.12, y: 100, alto: 580, tom: 0x9c8a92 }
};
// Caminhos assets/backgrounds/<pasta>/stage-01.webp ... stage-NN.webp
function seq(pasta, n) { return Array.from({ length: n }, (_, i) => `assets/backgrounds/${pasta}/stage-${String(i + 1).padStart(2, '0')}.webp`); }

// VÍDEO DE FUNDO (opcional): se a fase tiver entrada aqui, o vídeo vira o fundo no lugar da imagem.
// Ele é sincronizado com o progresso da fase (começo do vídeo = largada, fim = chegada), então é
// pra ser uma câmera lateral andando pelo cenário (ideal ~60 s, sem personagens, sem emenda).
// Funciona só por http(s); se faltar o arquivo ou falhar, cai na imagem e depois no cenário procedural.
// Aceita mais de um formato (o navegador escolhe o que toca). Exemplo:
//   'Hulk': ['assets/backgrounds/hulk/hulk_video.mp4', 'assets/backgrounds/hulk/hulk_video.webm']
const VIDEOS_FUNDO = {};

// ABERTURA NO RITMO de cada fase (um símbolo por batida; legenda em criarAbertura no fase.js)
// Cada herói tem uma mistura diferente de obstáculos clássicos
const ABERTURAS = {
    'Hulk':         '^.^.2..B.S.._P.e..O.',
    'Gaviao':       '^.m.^..l..p.D..O.',
    'DrEstranho':   '^..3..e..D.._o..O.',
    'Wanda':        '^.2..m.l..p.._.O.',
    'Homem-Aranha': '^..S..e..2.._P.O.'
};
