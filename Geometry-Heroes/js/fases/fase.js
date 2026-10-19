// ================================================================
// fase.js — CLASSE BASE Fase (sistema central de fases)
// Cada herói tem uma subclasse (FaseHulk, FaseFerro...) que sobrescreve só os "ganchos".
// POO: método template (criar/atualizar sempre na mesma ordem) + polimorfismo nos ganchos.
//
// Mapa das seções deste arquivo:
//   · CRIAR (template)     criar(): cenário → chão → jogador → colisões → HUD → entrada → câmera → checkpoints
//   · CENÁRIO / PARALLAX   criarCenario, moverParalaxe (camadas andam uma fração do scrollX da câmera)
//   · JOGADOR + CÂMERA     criarJogador (skin interpolada entre passos da física), configurarCamera, alinharCamera
//   · COLISÕES             criarColisoes: sólidos (pisar ok, bater de frente mata), mortais, gatilhos
//   · ENTRADA              configurarEntrada: teclado, mouse/toque (multitoque), botões DOM → ganchos aoPressionar/aoSoltar
//   · MORTE / CHECKPOINTS  morrer → reiniciar(cena) → voltarAoCheckpoint (posição, estado, câmera, respiro de 0,5 s)
//   · PRÁTICA / PAUSA / CONCLUSÃO
// A física do pulo (gravidade, força, coyote time e buffer) fica no Player (player.js).
// ================================================================

class Fase {

    // cena = GameScene; heroi = chave ('Hulk', 'Wanda'...); tentativa = número da tentativa
    constructor(cena, heroi, tentativa) {
        // Cena do Phaser onde a fase roda
        this.cena = cena;
        // Chave do herói
        this.heroi = heroi;
        // Número da tentativa
        this.tentativa = tentativa;
        // Configuração da fase (velocidade, comprimento, tema)
        this.cfg = CONFIG_FASES[heroi];
        // Cores da fase
        this.tema = TEMAS[this.cfg.tema];
        // Efeitos visuais reaproveitáveis
        this.efeitos = new Efeitos(cena);
        // Lista de todos os obstáculos da fase
        this.obstaculos = [];
        // Obstáculos destruídos esperando pra serem apagados
        this.paraApagar = [];
        // Mapa id → lista de obstáculos (ligações: alvo abre porta)
        this.porId = {};
        // Fator de tempo (1 = normal; a Joia do Tempo baixa pra 0.4)
        this.fatorTempo = 1;
        // Cronômetro da tentativa em ms (tempo real)
        this.tempo = 0;
        // Já chegou na linha de chegada?
        this.concluida = false;
        // Bater de lado em sólido mata? (o Homem-Aranha desliga isso)
        this.morteLateral = true;
        // Tecla/ponteiro de pulo segurado?
        this.segurandoTecla = false;
        // Texto de controles da linha 2 do HUD (cada fase escreve o seu)
        this.textoControles = 'Espaço/clique: pular';
        // Frase de objetivo mostrada na intro
        this.objetivo = '';
        // Funções que desligam os listeners no fim da cena
        this.desligadores = [];
        // Checkpoint recebido no reinício da cena ({ indice, tempo }) — null = começa do zero
        this.checkpointSalvo = cena.checkpointSalvo || null;
        // MODO PRÁTICA (como nos jogos de ritmo): o jogador marca checkpoints próprios (diamantes verdes)
        // e reaparece no último. Nada é salvo como recorde. null = partida normal.
        this.pratica = cena.pratica || null;
        // Ligações já acionadas nesta tentativa (alvo → porta…): o diamante guarda pra refazer ao reaparecer
        this.acionados = [];
        // Distância que o cubo anda em UMA batida da música (base do level design no ritmo)
        this.passoBatida = this.cfg.velocidade * 60 / (this.cfg.bpm || 128);
        // ABERTURA no estilo dos jogos de ritmo (antes do x = 0): só quando começa do zero
        // (um diamante da prática marcado dentro da abertura também precisa dela)
        const cps = this.checkpointSalvo;
        this.aberturaAtiva = this.temAbertura() && !MODO_TESTE.semAbertura && (!cps || !!(cps.diamante && cps.diamante.x < 0));
        // Onde o cubo nasce: 200 (sem abertura) ou bem antes do zero (com abertura de ~19 batidas)
        this.xInicio = this.aberturaAtiva ? -Math.round(500 + (this.batidasAbertura() + 3) * this.passoBatida) : 200;
        // Lista de checkpoints da fase (preenchida no criar, vem do gancho checkpoints())
        this.listaCheckpoints = [];
        // Quantos checkpoints já foram ativados nesta tentativa
        this.cpAtivados = 0;
        // Marcos visuais (bandeiras) de cada checkpoint
        this.marcosCheckpoint = [];
        // Barra de progresso percentual (criada no criar, se a classe BarraProgresso existir)
        this.barraPct = null;
    }

    // ---------------------------------------------------------------
    // MÉTODO TEMPLATE: monta a fase sempre na mesma ordem
    // ---------------------------------------------------------------
    criar() {
        // Textura de partículas (bolinha branca)
        this.criarTexturaFaisca();
        // Grupos de física
        this.criarGrupos();
        // Fundo, grade e paralaxe (gancho da subclasse)
        this.criarCenario();
        // Fundo geométrico (quadrados grandes em paralaxe lenta, tingidos pela cor da seção)
        this.criarFundoGeometrico();
        // Chão com vãos (segmentos)
        this.criarChao(this.segmentosChao());
        // Teto invisível (faixa do HUD é sólida)
        this.criarTeto();
        // Jogador e skin
        this.criarJogador();
        // Habilidade do herói (gancho)
        this.habilidade = this.criarHabilidade();
        // Obstáculos do roteiro
        this.roteiro().forEach((ev) => this.criarElemento(ev));
        // Abertura no ritmo (antes do x = 0), só começando do zero
        if (this.aberturaAtiva) this.criarAbertura();
        // Checkpoints (bandeiras); os anteriores ao checkpoint salvo já nascem acesos
        this.criarCheckpoints();
        // Diamantes verdes do modo prática (vêm da tentativa anterior)
        this.desenhoDiamantes = this.pratica ? this.pratica.diamantes.map((d) => this.desenharDiamante(d)) : [];
        // Linha de chegada
        new LinhaChegada(this, this.cfg.comprimento);
        // Colisões entre jogador e grupos
        this.criarColisoes();
        // HUD (textos, barras)
        this.criarHUD();
        // Barra de progresso percentual (do arquivo barraProgresso.js); null se o arquivo não carregou
        this.barraPct = (typeof BarraProgresso !== 'undefined') ? new BarraProgresso(this) : null;
        // Valor inicial da barra, sem animação (0% ou a porcentagem do checkpoint restaurado)
        if (this.barraPct) this.barraPct.definir(this.porcentagemAtual(), false);
        // Losangos na barra marcando a porcentagem de cada checkpoint (ex.: 33/67 ou 25/50/75)
        if (this.barraPct) this.barraPct.marcos(this.listaCheckpoints.map((cp, i) => Math.round(100 * (i + 1) / (this.listaCheckpoints.length + 1))));
        // Teclado, mouse, toque, botões DOM
        this.configurarEntrada();
        // Câmera seguindo o jogador
        this.configurarCamera();
        // Gancho extra da subclasse (efeitos contínuos, etc.)
        this.aoCriar();
        // Voltando de um checkpoint: põe o jogador lá e restaura o estado da fase
        if (this.checkpointSalvo) this.voltarAoCheckpoint();
        // Cartão de intro (só na primeira tentativa e nunca ao reaparecer num checkpoint)
        if (this.tentativa === 1 && !this.checkpointSalvo) this.mostrarIntro();
        // Texto "TENTATIVA N" no mundo, onde o cubo começa (passa pela tela como no clássico)
        this.cena.add.text(this.player.x + 340, 300, `TENTATIVA ${this.tentativa}`, {
            fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '46px', color: '#ffffff', stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5).setAlpha(0.85).setDepth(40);
        // Música: batida no ritmo da fase + pulso de luz no fundo a cada batida
        this.bpm = this.cfg.bpm || 128; this.relogioBatida = 0; this.indiceBatida = 0;
        this.pulsoFundo = this.cena.add.rectangle(640, 360, 1280, 720, this.tema.linha, 0).setScrollFactor(0).setDepth(-90);
        // Cor da seção: véu colorido entre o cenário e os obstáculos, que muda a cada checkpoint
        this.coresSecoes = (typeof CORES_SECOES !== 'undefined' && CORES_SECOES[this.heroi]) || null;
        this.veuSecao = this.cena.add.rectangle(640, 380, 1280, 560, this.coresSecoes ? this.coresSecoes[this.cpAtivados] || this.coresSecoes[0] : 0, this.coresSecoes ? this.alphaVeuSecao() : 0).setScrollFactor(0).setDepth(-50);
        this.corSecaoAtual = this.coresSecoes ? (this.coresSecoes[this.cpAtivados] || this.coresSecoes[0]) : 0;
        // Fade de entrada na cor da fase
        this.cena.cameras.main.fadeIn(reducedMotion.matches ? 0 : 380, ...this.tema.fade);
    }

    // Cria (uma vez só) a textura "faisca": uma bolinha branca usada pelas partículas
    criarTexturaFaisca() {
        // Se já existe, não cria de novo
        if (this.cena.textures.exists('faisca')) return;
        // Graphics fora da tela
        const g = this.cena.make.graphics({ x: 0, y: 0, add: false });
        // Branco (a cor vem depois com tint)
        g.fillStyle(0xffffff);
        // Bolinha de raio 4
        g.fillCircle(4, 4, 4);
        // Vira textura 8x8
        g.generateTexture('faisca', 8, 8);
        // Apaga o Graphics
        g.destroy();
    }

    // Grupos de física: sólidos, mortais e gatilhos (sem gravidade, imóveis)
    criarGrupos() {
        // Configuração comum dos grupos
        const cfg = { allowGravity: false, immovable: true };
        // Sólidos: dá pra pisar; bater de lado mata
        this.solidos = this.cena.physics.add.group(cfg);
        // Mortais: encostar mata
        this.mortais = this.cena.physics.add.group(cfg);
        // Gatilhos: encostar chama aoTocar()
        this.gatilhos = this.cena.physics.add.group(cfg);
    }

    // Coloca o obstáculo no grupo da categoria dele e guarda nas listas
    registrar(obs) {
        // Guarda na lista geral
        this.obstaculos.push(obs);
        // Se tiver id, guarda no mapa de ligações
        if (obs.id) (this.porId[obs.id] = this.porId[obs.id] || []).push(obs);
        // Escolhe o grupo pela categoria
        const grupo = { solido: this.solidos, mortal: this.mortais, gatilho: this.gatilhos }[obs.categoria];
        // Decoração não tem grupo (nem física)
        if (!grupo) return;
        // Adiciona (isso cria o corpo de física)
        grupo.add(obs.forma);
        // Garante sem gravidade
        obs.forma.body.setAllowGravity(false);
        // Garante imóvel (o jogador não empurra)
        obs.forma.body.setImmovable(true);
        // Não arrasta o jogador junto quando ele está em cima
        obs.forma.body.friction.x = 0;
    }

    // Aciona todos os obstáculos com aquele id (porta, laser, ponte...)
    acionar(id) {
        // Guarda (o diamante da prática refaz as ligações ao reaparecer)
        this.acionados.push(id);
        // Passa por cada obstáculo ligado
        (this.porId[id] || []).forEach((obs) => obs.acionar());
    }

    // ---------------------------------------------------------------
    // CENÁRIO
    // ---------------------------------------------------------------
    criarCenario() {
        // Cor que tinge o cenário de trás (cor da 1ª seção, clareada)
        this.corTingimento = (typeof CORES_SECOES !== 'undefined' && CORES_SECOES[this.heroi]) ? this.clarear(CORES_SECOES[this.heroi][0], 0.4) : null;
        // Cor de fundo da câmera
        this.cena.cameras.main.setBackgroundColor(this.tema.fundo);
        // Rodada 8: sem grade de marcação no fundo (parecia editor de fases). Fica só uma vinheta suave
        // que escurece as bordas da tela e dá profundidade ao cenário. (A Wanda faz essa camada tremer.)
        // (degradê radial liso num canvas: sem faixas nem linhas)
        if (!this.cena.textures.exists('vinheta')) {
            const tx = this.cena.textures.createCanvas('vinheta', 640, 280), ctx = tx.getContext();
            const rg = ctx.createRadialGradient(320, 150, 60, 320, 150, 380);
            rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.55, 'rgba(0,0,0,0.08)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)');
            ctx.fillStyle = rg; ctx.fillRect(0, 0, 640, 280); tx.refresh();
        }
        // (num container em x=0, pra quem faz "this.grade" tremer com x:4 continuar funcionando)
        const img = this.cena.add.image(640, 380, 'vinheta').setDisplaySize(1280, 560).setAlpha(0.8);
        this.grade = this.cena.add.container(0, 0, [img]).setScrollFactor(0).setDepth(-60);
        // Camadas de paralaxe (gancho da subclasse) e, se carregou, a arte de fundo da fase por baixo
        this.criarParalaxe();
        if (typeof Cenarios !== 'undefined' && Cenarios.fundoImagem) Cenarios.fundoImagem(this);
        // Partículas ambientes temáticas (como as brasas da Feiticeira), atrás dos obstáculos
        if (typeof Cenarios !== 'undefined' && Cenarios.ambiente) Cenarios.ambiente(this);
        // Faixa do teto (fixa na tela, também é o fundo do HUD)
        this.faixaTeto = this.cena.add.rectangle(640, 50, 1280, 100, this.tema.faixa).setScrollFactor(0).setDepth(50);
        // Linha brilhante do teto
        this.linhaTeto = this.cena.add.rectangle(640, 100, 1280, 2, this.tema.linha, 0.8).setScrollFactor(0).setDepth(50);
    }

    // Cria uma camada de paralaxe que se repete (desenhada UMA vez numa textura, rápida de mostrar).
    // fator = quanto ela anda com a câmera (0 = parada, 1 = junto); desenhar(g, largura) desenha o pedaço
    // opcoes.tingir = false deixa a camada com as cores próprias (cenários detalhados da rodada 7)
    camadaParalaxe(fator, profundidade, desenhar, largura = 2048, opcoes = {}) {
        // Nome único da textura (fase + número da camada)
        const chave = `paralaxe-${this.heroi}-${profundidade}`;
        // Só desenha a textura uma vez (nas próximas tentativas reaproveita)
        if (!this.cena.textures.exists(chave)) {
            // Graphics fora da tela
            const g = this.cena.make.graphics({ x: 0, y: 0, add: false });
            // A fase desenha o pedaço de cenário (de 0 até "largura")
            desenhar(g, largura);
            // Transforma o desenho em textura
            g.generateTexture(chave, largura, 720);
            // Apaga o Graphics (a textura fica guardada)
            g.destroy();
        }
        // TileSprite: mostra a textura repetida, fixa na tela
        const tile = this.cena.add.tileSprite(0, 0, 1280, 720, chave).setOrigin(0, 0).setScrollFactor(0).setDepth(profundidade);
        // Guarda o fator de velocidade
        tile.fatorParalaxe = fator;
        // Cenário monocromático: tingido com a cor da seção (clareada), como os fundos dos jogos de ritmo
        tile.tingir = opcoes.tingir !== false;
        if (this.corTingimento && tile.tingir) tile.setTint(this.corTingimento);
        // Guarda na lista (o atualizar move todas)
        (this.camadas = this.camadas || []).push(tile);
        // Devolve (algumas fases mexem na camada)
        return tile;
    }

    // Move as camadas de paralaxe conforme a câmera anda
    moverParalaxe() {
        // Posição da câmera
        const sx = this.cena.cameras.main.scrollX;
        // Cada camada anda uma fração do movimento da câmera
        // (deriva = px/s de movimento próprio, independente da câmera: partículas no ar)
        const seg = this.cena.time.now / 1000;
        (this.camadas || []).forEach((t) => { t.tilePositionX = sx * t.fatorParalaxe + (t.deriva ? seg * t.deriva : 0); });
        if (this.fundoSeq) Cenarios.moverSequencia(this);
    }

    // Vídeo de fundo (se houver): toca numa velocidade que faz o vídeo inteiro durar o tempo da fase e
    // se reajusta pelo progresso do jogador quando sai do compasso (morte, checkpoint)
    sincronizarVideo() {
        const v = this.fundoVideo, el = v && v.video;
        if (!el || !el.duration || !isFinite(el.duration)) return;
        const rodando = this.player.vivo && !this.pausado && !this.concluida;
        const alvo = Math.max(0, Math.min(1, this.player.x / this.cfg.comprimento)) * Math.max(0, el.duration - 0.2);
        el.playbackRate = Math.max(0.0625, Math.min(4, el.duration / (this.cfg.comprimento / this.cfg.velocidade)));
        if (Math.abs(el.currentTime - alvo) > 0.4) el.currentTime = alvo;
        if (rodando && el.paused) { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); }
        else if (!rodando && !el.paused) el.pause();
    }

    // Gancho: cada fase desenha suas camadas
    criarParalaxe() {}

    // Segmentos do chão [x inicial, x final]; padrão = chão inteiro sem vãos
    segmentosChao() {
        // Um segmento só, do começo até depois da chegada
        return [[this.xMin(), this.cfg.comprimento + 1600]];
    }

    // Cria o chão como blocos sólidos (permite vãos entre eles)
    criarChao(segmentos, yTopo = MOVIMENTO.chaoY) {
        // Guarda os segmentos (algumas fases consultam)
        this.chao = [];
        // Um bloco por segmento
        segmentos.forEach(([x0, x1, topo]) => {
            // Topo do segmento (padrão = chão normal)
            const y = topo || yTopo;
            // Bloco do topo até embaixo da tela
            const b = new Bloco(this, x0, y, x1 - x0, 760 - y, this.tema.faixa, this.tema.linha);
            // Marca como chão (não mata de lado na maioria das fases)
            b.ehChao = true;
            // Visual de chão de jogo de ritmo: degradê escurecendo pra baixo, ladrilhos e linha de topo brilhante
            this.decorarChao(x0, x1, y);
            // Guarda
            this.chao.push(b);
        });
    }

    // Fundo de quadrados grandes (desenho nosso, inspirado nos fundos geométricos dos jogos de ritmo)
    criarFundoGeometrico() {
        // Rodada 8: o tile de quadrados grandes ("fundo geométrico") foi removido de todas as fases —
        // parecia marcação de editor. O cenário temático de cada fase (cenarios.js) faz esse papel.
        this.fundoGeo = null;
        // Feixes de luz subindo do chão (pulsam na batida)
        this.criarFeixes();
    }

    // Feixes de luz verticais subindo do chão (camada fixa na tela, tingida pela cor da seção)
    criarFeixes() {
        // Com arte em sequência os feixes não entram (andariam por cima da imagem em outra velocidade)
        if (this.fundoSeq || this.semProcedural) return;
        if (!this.cena.textures.exists('feixes')) {
            const g = this.cena.make.graphics({ add: false }), rnd = new Phaser.Math.RandomDataGenerator(['feixes']);
            // Cada feixe: várias faixas finas empilhadas, mais fortes embaixo (degradê)
            for (let x = 20; x < 1000; x += rnd.between(60, 150)) {
                const alto = rnd.between(120, 340), larg = rnd.between(3, 9);
                for (let k = 0; k < 12; k++) { g.fillStyle(0xffffff, 0.05 * (1 - k / 12)); g.fillRect(x, 560 - alto * (k + 1) / 12, larg, alto / 12 + 1); }
            }
            g.generateTexture('feixes', 1024, 560); g.destroy();
        }
        // (com cenário detalhado os feixes ficam mais discretos, pra não parecerem colunas/grade)
        this.feixes = this.cena.add.tileSprite(640, 380, 1280, 560, 'feixes').setScrollFactor(0).setDepth(-86).setAlpha(this.cenarioDetalhado ? 0.35 : 0.8);
        const cor = (typeof CORES_SECOES !== 'undefined' && CORES_SECOES[this.heroi]) ? CORES_SECOES[this.heroi][0] : this.tema.linha;
        this.feixes.setTint(cor);
        const rolar = () => { if (this.feixes && this.feixes.active) this.feixes.tilePositionX = this.cena.cameras.main.scrollX * 0.25; };
        this.cena.events.on('postupdate', rolar);
        this.cena.events.once('shutdown', () => this.cena.events.off('postupdate', rolar));
    }

    // Mistura uma cor com branco (t = 0 nada, 1 branco) — usado pra tingir o cenário de trás
    clarear(cor, t) {
        const c = Phaser.Display.Color.IntegerToColor(cor);
        return Phaser.Display.Color.GetColor(c.red + (255 - c.red) * t, c.green + (255 - c.green) * t, c.blue + (255 - c.blue) * t);
    }

    // Esta fase tem a abertura no ritmo? (o Homem de Ferro voa o tempo todo: não tem)
    temAbertura() { return true; }

    // Ponto mais à esquerda do mundo (chão e câmera começam aqui)
    xMin() { return Math.min(-400, this.xInicio - 600); }

    // ABERTURA NO RITMO (antes do x = 0): ensina a pular no compasso, como as fases clássicas do gênero.
    // Cada herói tem a SUA sequência (ABERTURAS em config.js); cada símbolo ocupa batidas inteiras:
    //   . pausa (1) · ^ espinho (1) · 2 duplo (1) · m mini espinho (1) · S serra (1) · 3 triplo (2)
    //   D serra que desce (2) · B bloco pra subir (2) · _ plataforma sobre espinhos (4)
    //   P pad amarelo + triplo (4) · p pad rosa + duplo (3) · O poço com orbe amarelo (4) · o poço curto com orbe rosa (3)
    //   e espinho que brota do chão (1) · l laser de piso no ritmo (2)
    // Os objetos ficam marcados com .abertura (pros testes e pro piloto automático).
    padraoAbertura() { return (typeof ABERTURAS !== 'undefined' && ABERTURAS[this.heroi]) || '^.^.2.._P.O.'; }

    // Quantas batidas a sequência ocupa
    batidasAbertura(padrao = this.padraoAbertura()) {
        // Largura de cada símbolo em batidas
        const larg = { '3': 2, 'D': 2, 'B': 2, '_': 4, 'P': 4, 'p': 3, 'O': 4, 'o': 3, 'l': 2 };
        // Soma
        return [...padrao].reduce((t, ch) => t + (larg[ch] || 1), 0);
    }

    criarAbertura() {
        // Passo (1 batida), começo e topo do chão nesse trecho
        const P = this.passoBatida, S = this.xInicio + 500, t = this.topoChaoEm(this.xInicio + 100);
        // Marca o objeto como parte da abertura
        const marca = (o) => { o.abertura = true; return o; };
        // Espinho no topo do chão desse trecho
        const esp = (x) => marca(new Espinho(this, Math.round(x), false, null, null, t));
        // Dica inicial
        new Dica(this, this.xInicio + 120, 'Pule no ritmo da música!');
        // Larguras (iguais às de batidasAbertura)
        const larg = { '3': 2, 'D': 2, 'B': 2, '_': 4, 'P': 4, 'p': 3, 'O': 4, 'o': 3, 'l': 2 };
        // Percorre o padrão, batida a batida
        let b = 0;
        for (const ch of this.padraoAbertura()) {
            // Posição dessa batida
            const x = Math.round(S + b * P);
            // Cria o elemento do símbolo
            switch (ch) {
                case '^': esp(x); break;
                case '2': esp(x); esp(x + 40); break;
                case '3': esp(x); esp(x + 40); esp(x + 80); break;
                case 'm': marca(new MiniEspinho(this, x, t)); break;
                // Rodada 7: espinho que brota do chão (1) e laser de piso no ritmo (2)
                case 'e': if (typeof EspinhoEmergente !== 'undefined') marca(new EspinhoEmergente(this, x, t)); break;
                case 'l': if (typeof LaserPiso !== 'undefined') marca(new LaserPiso(this, x, 100, '1110', t)); break;
                case 'S': marca(new Serra(this, x, false, t)); break;
                case 'D': marca(new SerraDescendo(this, x, t)); break;
                // Bloco 40×40 (suba nele; bater de lado mata)
                case 'B': marca(new BlocoNeon(this, x, t - 40, 40, 40)); break;
                // Plataforma por cima de espinhos (suba e pule na beirada)
                case '_': {
                    // Plataforma presa no teto por correntes (visual da rodada 6)
                    const lp = Math.round(2.5 * P); marca(new PlataformaSuspensa(this, x, t - 70, lp));
                    for (let xx = x + 20; xx < x + lp + 60; xx += 40) esp(xx);
                    break;
                }
                // Pad amarelo + triplo / pad rosa + duplo
                case 'P': marca(new PadSalto(this, x)); [0, 40, 80].forEach((d) => esp(x + 110 + d)); break;
                case 'p': marca(new PadSalto(this, x, false, true)); [0, 40].forEach((d) => esp(x + 110 + d)); break;
                // Poço longo com orbe amarelo / poço curto com orbe rosa
                case 'O': for (let i = 0; i < 7; i++) esp(x + i * 40); marca(new OrbeSalto(this, x + 110, t - 105)); break;
                case 'o': for (let i = 0; i < 5; i++) esp(x + i * 40); marca(new OrbeSalto(this, x + 100, t - 100, true)); break;
            }
            // Avança as batidas do símbolo
            b += larg[ch] || 1;
        }
        // Respiro e aviso da mecânica do herói
        new Dica(this, Math.round(S + (b + 1) * P), 'Agora é com a habilidade do herói!');
    }

    // Decoração de um trecho de chão (só visual; a linha do topo pulsa na batida)
    decorarChao(x0, x1, y) {
        // Limita ao trecho visível da fase (o primeiro segmento começa antes do zero)
        const a = Math.max(x0, this.xMin()), bx = Math.min(x1, this.cfg.comprimento + 1400), larg = bx - a;
        // Material do herói (cenarios.js), alinhado ao mundo: segmentos vizinhos continuam o mesmo desenho
        if (typeof Cenarios !== 'undefined' && Cenarios.texturaChao) {
            const t = this.cena.add.tileSprite(a, y, larg, 760 - y, Cenarios.texturaChao(this.cena, this.heroi)).setOrigin(0, 0).setDepth(0.9);
            t.tilePositionX = a;
        }
        // Graphics do chão (por cima do material, atrás do jogador)
        const g = this.cena.add.graphics().setDepth(1);
        // Profundidade: escurece para baixo (o olho lê a superfície em cima)
        for (let k = 0; k < 6; k++) { g.fillStyle(0x000000, 0.07 * k); g.fillRect(a, y + 14 + k * 18, larg, 18); }
        // Borda de cima (beiral/laje): faixa mais clara e sombra logo abaixo — separa "onde se pisa"
        g.fillStyle(0xffffff, 0.10).fillRect(a, y, larg, 9);
        g.fillStyle(0x000000, 0.35).fillRect(a, y + 9, larg, 3);
        // Quinas nos vãos: fio do neon descendo um pouco e sombra na face lateral
        if (x0 >= this.xMin()) { g.fillStyle(this.tema.linha, 0.7).fillRect(a, y, 2, 26); g.fillStyle(0x000000, 0.3).fillRect(a + 2, y + 12, 6, 760 - y); }
        if (x1 <= this.cfg.comprimento + 1400) { g.fillStyle(this.tema.linha, 0.7).fillRect(bx - 2, y, 2, 26); g.fillStyle(0x000000, 0.3).fillRect(bx - 8, y + 12, 6, 760 - y); }
        // Linha de topo brilhante (guardada pra pulsar) = a superfície jogável
        const linha = this.cena.add.rectangle((a + bx) / 2, y + 1, larg, 4, this.tema.linha).setDepth(2);
        // Guarda
        (this.linhasChao = this.linhasChao || []).push(linha);
    }

    // Teto invisível na faixa do HUD (0 a 100): segura o cubo
    criarTeto() {
        // Retângulo invisível bem largo
        const teto = this.cena.add.rectangle((this.cfg.comprimento + 1600) / 2, 50, this.cfg.comprimento + 4000, 100, 0x000000, 0);
        // Corpo estático
        this.cena.physics.add.existing(teto, true);
        // Guarda (o collider é criado em criarColisoes)
        this.teto = teto;
    }

    // ---------------------------------------------------------------
    // JOGADOR
    // ---------------------------------------------------------------
    criarJogador() {
        // Cores do corpo do cubo (gancho)
        const [cor, borda] = this.coresCubo();
        // Cria o cubo em x=200, em cima do chão
        this.player = new Player(this.cena, this.xInicio, MOVIMENTO.chaoY - 20, cor, borda);
        // Velocidade de corrida da fase
        this.player.velocidadeX = this.cfg.velocidade;
        // Desenho do personagem (o corpo de física fica invisível; quem aparece é a skin, que anima)
        this.player.skin = this.cena.add.graphics().setDepth(11);
        // Corpo do cubo na cor da fase
        this.player.skin.fillStyle(cor, 1).fillRect(-20, -20, 40, 40).lineStyle(3, borda, 1).strokeRect(-20, -20, 40, 40);
        // A subclasse desenha os detalhes por cima
        this.desenharSkin(this.player.skin);
        // Esconde o retângulo da física (continua colidindo normalmente)
        this.player.setVisible(false);
        // Skin acompanha o corpo DEPOIS do passo da física (evento 'postupdate', o mesmo momento em que a
        // câmera lê a posição). Antes era copiada no update da fase, um quadro atrasada em relação à câmera;
        // como o tempo de cada quadro varia (telas de 90/120 Hz), o atraso variava e o cubo tremia na tela.
        // Registrado antes dos extras do herói (tiara, chamas...), que copiam a skin.
        // SUAVIZAÇÃO (interpolação): a física anda em passos fixos de 1/60 s; numa tela de 90/120 Hz há quadros
        // com 0 ou 2 passos e o mundo andava aos trancos (0, 7, 0, 8 px). O desenho e a câmera usam a posição
        // ENTRE os dois últimos passos, na proporção do tempo que sobrou — a física (pulo, colisões) não muda.
        const mundo = this.cena.physics.world, it = { x0: null, y0: null, x1: null, y1: null };
        const aoPasso = () => {
            const b = this.player && this.player.body; if (!b) return;
            const cx = b.position.x + b.halfWidth, cy = b.position.y + b.halfHeight;
            if (it.x1 === null) { it.x0 = cx; it.y0 = cy; } else { it.x0 = it.x1; it.y0 = it.y1; }
            it.x1 = cx; it.y1 = cy;
        };
        mundo.on('worldstep', aoPasso);
        this.cena.events.once('shutdown', () => mundo.off('worldstep', aoPasso));
        this.foco = { x: this.player.x, y: this.player.y };   // alvo da câmera (posição suavizada)
        const sincronizar = () => {
            const p = this.player; if (!p || !p.skin || !p.skin.active) return;
            // Teleporte fora do passo (checkpoint, portal, reset) ou ainda sem dois passos: usa a posição real
            if (it.x1 === null || Math.abs(p.x - it.x1) > 1 || Math.abs(p.y - it.y1) > 1 || Math.abs(it.x1 - it.x0) > 120 || Math.abs(it.y1 - it.y0) > 120) {
                it.x0 = it.x1 = p.x; it.y0 = it.y1 = p.y;
            }
            const a = Phaser.Math.Clamp(mundo._elapsed / (mundo._frameTimeMS || 16.667), 0, 1);
            p.visX = it.x0 + (it.x1 - it.x0) * a; p.visY = it.y0 + (it.y1 - it.y0) * a;
            this.foco.x = p.visX; this.foco.y = p.visY;
            p.sincronizarSkin(Math.min(50, this.cena.game.loop.delta || 16));
        };
        this.cena.events.on('postupdate', sincronizar);
        this.cena.events.once('shutdown', () => this.cena.events.off('postupdate', sincronizar));
        // Visual próprio do herói (efeitosPoderes.js): extras animados (núcleo, chamas, caos...)
        const visual = (typeof instalarVisualHeroi === 'function') ? instalarVisualHeroi(this) : null;
        this.visualHeroi = visual;
        // Rastro atrás do personagem (cores do herói), desligado com movimento reduzido
        if (!reducedMotion.matches) {
            const r = (visual && visual.v.rastro) || {};
            this.rastro = this.cena.add.particles(0, 0, 'faisca', {
                // Rastro curto e nítido (estilo dos jogos de ritmo): faíscas pequenas, ~0,2 s, sem virar borrão
                follow: this.foco, followOffset: { x: -14, y: 0 }, speedX: { min: -40, max: -10 }, speedY: { min: -8, max: 8 },
                lifespan: 200, scale: { start: 0.6, end: 0 }, alpha: { start: 0.6, end: 0 }, frequency: (r.frequency || 28) + 8,
                tint: r.tint || [cor, borda], blendMode: r.blendMode || 'NORMAL'
            }).setDepth(9);
        }
    }

    // Gancho: cores do cubo [corpo, borda]
    coresCubo() { return [0xb7f65b, 0xefffc6]; }

    // Gancho: desenha detalhes da skin (coordenadas relativas ao centro do cubo)
    desenharSkin(g) {}

    // Câmera: segue o cubo só no eixo X, com ele aparecendo em x≈260 na tela
    configurarCamera() {
        // Limites do mundo
        this.cena.cameras.main.setBounds(Math.min(0, this.xMin() + 400), 0, this.cfg.comprimento + 1600 - Math.min(0, this.xMin() + 400), 720);
        // Segue o jogador (lerp X = 1, Y = 0), deslocado pra ele ficar à esquerda
        this.cena.cameras.main.startFollow(this.foco || this.player, true, 1, 0, -(640 - MOVIMENTO.telaX), 0);
    }

    // ---------------------------------------------------------------
    // HABILIDADE E ROTEIRO (ganchos)
    // ---------------------------------------------------------------

    // Gancho: retorna a habilidade da fase
    criarHabilidade() { return null; }

    // Gancho: lista de eventos da fase (desenhada à mão)
    roteiro() { return []; }

    // Cria um elemento do roteiro; a base conhece os tipos comuns, a subclasse os dela
    criarElemento(ev) {
        // Elementos clássicos (pad, orbe, portais, serra) valem pra todas as fases
        if (typeof criarClassico !== 'undefined' && criarClassico(this, ev)) return;
        // Obstáculos temáticos da rodada 7 (emergente, laser de piso, torreta, minas, carro, holofote...)
        if (typeof criarTematico !== 'undefined' && criarTematico(this, ev)) return;
        // Escolhe pelo tipo
        switch (ev.tipo) {
            // Texto de tutorial
            case 'dica': new Dica(this, ev.x, ev.txt); break;
            // Espinho no chão (ou no teto)
            case 'espinho': new Espinho(this, ev.x, !!ev.teto); break;
            // Bloco 40x40 (andar = quantos blocos acima do chão)
            case 'bloco': new BlocoNeon(this, ev.x, MOVIMENTO.chaoY - 40 - (ev.andar || 0) * 40, 40, 40, ev.id); break;
            // Fileira de espinhos colados no chão e/ou no teto, de x até ate (corredor de dentes)
            case 'fileira': {
                for (let xx = ev.x; xx + 40 <= ev.ate; xx += 40) {
                    if (ev.chao !== false) new Espinho(this, xx, false);
                    if (ev.teto) new Espinho(this, xx, true);
                }
                break;
            }
            // Pirâmide invertida presa no teto: linhas de blocos (de cima pra baixo) com espinhos por baixo
            case 'piramide': {
                const linhas = ev.linhas || [6, 4, 2], larg0 = linhas[0] * 40, meio = ev.x + larg0 / 2;
                linhas.forEach((n, i) => {
                    const y = MOVIMENTO.tetoY + i * 40, esq = meio - n * 20;
                    new BlocoNeon(this, esq, y, n * 40, 40);
                    // Parte de baixo exposta desta linha (onde a linha seguinte não cobre) ganha espinhos
                    const prox = linhas[i + 1] || 0, cobreEsq = meio - prox * 20, cobreDir = meio + prox * 20;
                    for (let xx = esq; xx < esq + n * 40; xx += 40) if (xx + 40 <= cobreEsq || xx >= cobreDir) new Espinho(this, xx, true, null, null, y + 80);
                });
                break;
            }
            // Plataforma presa no teto por correntes
            case 'plataformaSuspensa': new PlataformaSuspensa(this, ev.x, ev.y || 520, ev.largura || 120); break;
            // Pilar duplo (trecho de UFO/nave): coluna do chão e coluna do teto com um vão no meio
            case 'pilar': {
                const meio = (ev.vao || 200) / 2, larg = ev.largura || 60, topoVao = ev.centro - meio, baseVao = ev.centro + meio;
                // entra = os dois pedaços deslizam até o lugar (de cima e de baixo) quando o jogador se aproxima
                const cima = ev.entra ? new BlocoEntrada(this, ev.x, MOVIMENTO.tetoY, larg, topoVao - MOVIMENTO.tetoY, -260) : new BlocoNeon(this, ev.x, MOVIMENTO.tetoY, larg, topoVao - MOVIMENTO.tetoY);
                const baixo = ev.entra ? new BlocoEntrada(this, ev.x, baseVao, larg, MOVIMENTO.chaoY - baseVao, 260) : new BlocoNeon(this, ev.x, baseVao, larg, MOVIMENTO.chaoY - baseVao);
                // Marca (pro piloto automático dos testes saber onde é o vão)
                cima.pilar = baixo.pilar = { centro: ev.centro, x: ev.x, largura: larg };
                break;
            }
        }
    }

    // ---------------------------------------------------------------
    // COLISÕES
    // ---------------------------------------------------------------
    criarColisoes() {
        // Física da cena
        const fis = this.cena.physics;
        // Jogador x teto
        fis.add.collider(this.player, this.teto);
        // Jogador x sólidos: bater de lado mata (se a fase quiser)
        fis.add.collider(this.player, this.solidos, (p, forma) => this.aoBaterSolido(forma.obstaculo),
            // processCallback: a subclasse pode deixar atravessar (retornar false)
            (p, forma) => this.podeColidir(forma.obstaculo));
        // Jogador x mortais: morre
        fis.add.overlap(this.player, this.mortais, (p, forma) => {
            // Só mata se o obstáculo ainda estiver ativo
            if (forma.obstaculo && forma.obstaculo.ativo) this.morrer();
        });
        // Jogador x gatilhos: avisa o obstáculo
        fis.add.overlap(this.player, this.gatilhos, (p, forma) => {
            // Só se ainda estiver ativo
            if (forma.obstaculo && forma.obstaculo.ativo) forma.obstaculo.aoTocar();
        });
    }

    // Gancho: permite atravessar um sólido (retornar false)
    podeColidir(obs) { return true; }

    // Regra padrão: bater de lado num sólido mata
    aoBaterSolido(obs) {
        // Fase sem morte lateral, ou obstáculo que não mata de lado: ignora
        if (!this.morteLateral || !obs || obs.semMorteLateral) return;
        // Corpo do jogador
        const b = this.player.body;
        // Se o topo do obstáculo está quase na altura do pé do cubo, é só um "degrau" (emenda de chão): não mata
        if (obs.forma.body && obs.forma.body.top >= b.bottom - 8) return;
        // Encostou do lado direito?
        if (b.touching.right || b.blocked.right) this.morrer();
    }

    // ---------------------------------------------------------------
    // HUD
    // ---------------------------------------------------------------
    criarHUD() {
        // Estilo de texto principal
        const estilo = { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: this.tema.texto, fontStyle: 'bold' };
        // Linha 1: nome · tentativa · tempo
        this.hudTitulo = this.cena.add.text(210, 22, '', estilo).setScrollFactor(0).setDepth(100);
        // Linha 2: controles da fase
        this.hudControles = this.cena.add.text(210, 56, this.textoControles, {
            fontFamily: 'Arial, sans-serif', fontSize: '16px', color: this.tema.texto,
            wordWrap: { width: 780 }                 // Quebra a linha antes de encostar no texto da direita
        }).setScrollFactor(0).setDepth(100).setAlpha(0.75);
        // Se a fase tem habilidade, mostra nome + barra de recarga à direita
        if (this.habilidade) {
            // Nome da habilidade
            this.cena.add.text(1240, 20, this.habilidade.nome, estilo).setOrigin(1, 0).setScrollFactor(0).setDepth(100).setFontSize(16);
            // Fundo da barra
            this.cena.add.rectangle(1240, 52, 180, 10, 0x000000, 0.5).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100);
            // Parte cheia da barra
            this.barraRecarga = this.cena.add.rectangle(1060, 52, 180, 10, this.habilidade.cor).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
        }
        // Texto extra da fase (contadores), abaixo da barra
        this.hudExtra = this.cena.add.text(1240, 66, '', {
            fontFamily: 'Arial, sans-serif', fontSize: '15px', color: this.tema.texto, fontStyle: 'bold'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        // Botão DOM da habilidade (útil no celular)
        this.botaoHabilidade = document.getElementById('ability-button');
        // Mostra o botão se houver habilidade
        this.botaoHabilidade.hidden = !this.habilidade;
        // Escreve o nome da habilidade no botão (o <span> guarda a tecla)
        if (this.habilidade) this.botaoHabilidade.firstChild.textContent = this.habilidade.nome + ' ';
        // Botão na cor da habilidade da fase (variável CSS --cor-hab)
        if (this.habilidade) this.botaoHabilidade.style.setProperty('--cor-hab', '#' + this.habilidade.cor.toString(16).padStart(6, '0'));
    }

    // Atualiza HUD todo frame
    atualizarHUD(agora) {
        // Linha 1
        this.hudTitulo.setText(`${this.cfg.nome}  ·  ${this.pratica ? 'PRÁTICA ◆ ' + this.pratica.diamantes.length : 'TENTATIVA ' + this.tentativa}  ·  ${Progresso.formatar(this.tempo)}`);
        // Barra de recarga
        if (this.habilidade) {
            // Quanto já recarregou (a subclasse pode mostrar outra coisa, ex.: duração da Joia)
            const p = this.progressoHabilidade(agora);
            // Largura proporcional
            this.barraRecarga.setSize(180 * p, 10);
            // Botão fica apagado enquanto recarrega
            this.botaoHabilidade.classList.toggle('recarregando', p < 1);
        }
        // Texto extra da fase
        this.hudExtra.setText(this.textoExtra());
    }

    // Gancho: valor da barra de habilidade (padrão = recarga)
    progressoHabilidade(agora) { return this.habilidade.progresso(agora); }

    // Gancho: texto extra do HUD (contadores)
    textoExtra() { return ''; }

    // Cartão de intro no centro da tela (nome + objetivo), some sozinho
    mostrarIntro() {
        // Título grande
        const titulo = this.cena.add.text(640, 300, this.cfg.nome, {
            fontFamily: 'Arial, sans-serif', fontSize: '54px', fontStyle: 'bold', color: this.tema.texto,
            stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5).setScrollFactor(0).setDepth(120);
        // Objetivo embaixo
        const sub = this.cena.add.text(640, 360, this.objetivo, {
            fontFamily: 'Arial, sans-serif', fontSize: '22px', color: this.tema.texto,
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(120);
        // Some depois de 1,6 s
        this.cena.tweens.add({ targets: [titulo, sub], alpha: 0, delay: 1400, duration: 500, onComplete: () => { titulo.destroy(); sub.destroy(); } });
    }

    // ---------------------------------------------------------------
    // ENTRADA (teclado, mouse, toque, botões DOM)
    // ---------------------------------------------------------------
    configurarEntrada() {
        // Atalho pro teclado do Phaser
        const tec = this.cena.input.keyboard;
        // Teclas de pulo/ação contínua (false = não bloqueia o Espaço em botões da página)
        this.teclas = tec.addKeys('SPACE,UP,W,DOWN,S', false);
        // Desliga o menu do botão direito (algumas fases usam o botão direito)
        this.cena.input.mouse.disableContextMenu();

        // Tecla de pulo apertada
        const onPulo = (e) => {
            // Pausado: o Espaço fica com os botões da tela de pausa
            if (this.pausado) return;
            // Foco esquecido num botão da página (ex.: depois de clicar ⏸ ou "Continuar"): antes o pulo
            // era descartado aqui e parecia "travado". Agora tira o foco do botão (ele não é acionado)
            // e devolve pro canvas — o pulo vale na hora.
            if (document.activeElement?.tagName === 'BUTTON') { document.activeElement.blur(); this.cena.game.canvas.focus({ preventScroll: true }); }
            // Evita rolar a página
            e.preventDefault();
            // Ignora repetição automática do teclado (segurar já é tratado como pulo contínuo)
            if (e.repeat) return;
            // Marca como segurando
            this.segurandoTecla = true;
            // Gancho da fase
            this.aoPressionar('teclado');
        };
        // Tecla de pulo solta
        const onSoltaPulo = () => {
            // Só solta de verdade se nenhuma das 3 teclas estiver segurada
            if (this.teclas.SPACE.isDown || this.teclas.UP.isDown || this.teclas.W.isDown) return;
            // Não está mais segurando
            this.segurandoTecla = false;
            // Gancho da fase
            this.aoSoltar();
        };
        // Habilidade (E / Shift / botão DOM)
        const onAcao = (e) => {
            // Evita outras ações do navegador
            if (e && e.preventDefault) e.preventDefault();
            // Gancho da fase (não funciona pausado)
            if (!this.concluida && !this.pausado) this.aoAcao();
            // Devolve o foco pro canvas (senão o Espaço apertaria o botão)
            this.cena.game.canvas.focus({ preventScroll: true });
        };
        // Reiniciar na hora (R) — na prática também apaga os diamantes (recomeça do zero)
        const onReiniciar = () => { if (!this.concluida) { this.esconderPausa(); if (this.pratica) this.pratica.diamantes = []; this.reiniciar(this.tentativa + 1); } };
        // Prática: Z marca diamante, X apaga o último (botões de toque fazem o mesmo)
        const onMarcar = (e) => { if (e && e.preventDefault) e.preventDefault(); this.marcarDiamante(); this.cena.game.canvas.focus({ preventScroll: true }); };
        const onApagar = (e) => { if (e && e.preventDefault) e.preventDefault(); this.apagarDiamante(); this.cena.game.canvas.focus({ preventScroll: true }); };
        const botaoMarcar = document.getElementById('pratica-marcar'), botaoApagar = document.getElementById('pratica-apagar');
        // ESC / P / botão ⏸: abre ou fecha a pausa
        const onMenu = () => { if (!this.concluida) this.alternarPausa(); };
        // Ligar/desligar som (M)
        const onMudo = () => this.efeitos.textoFlutuante(this.player.x, this.player.y - 60, som.alternarMudo() ? 'SOM DESLIGADO' : 'SOM LIGADO');

        // Clique/toque no canvas
        const onPonteiro = (ponteiro) => {
            // Foca o canvas (teclado volta a funcionar)
            this.cena.game.canvas.focus({ preventScroll: true });
            // Fase concluída ou pausada: ignora
            if (this.concluida || this.pausado) return;
            // Botão direito = ação secundária
            if (ponteiro.rightButtonDown()) { this.aoAcaoSecundaria(ponteiro); return; }
            // Se a fase usou o clique em algum objeto do mundo, não pula
            if (this.aoClicarMundo(ponteiro)) return;
            // Marca o ponteiro como "segurando pulo"
            this.ponteiroPulo = true;
            // Gancho da fase
            this.aoPressionar('ponteiro');
        };
        // Soltou o clique/toque
        const onSoltaPonteiro = () => {
            // Só conta se esse clique tinha virado pulo
            if (!this.ponteiroPulo) return;
            // Com vários dedos na tela, só solta quando o último sair
            if (this.ponteiroSegurado()) return;
            // Não está mais segurando
            this.ponteiroPulo = false;
            // Gancho da fase
            this.aoSoltar();
        };

        // Liga tudo
        tec.on('keydown-SPACE', onPulo); tec.on('keydown-UP', onPulo); tec.on('keydown-W', onPulo);
        tec.on('keyup-SPACE', onSoltaPulo); tec.on('keyup-UP', onSoltaPulo); tec.on('keyup-W', onSoltaPulo);
        tec.on('keydown-E', onAcao); tec.on('keydown-SHIFT', onAcao); tec.on('keydown-F', onAcao);
        tec.on('keydown-R', onReiniciar); tec.on('keydown-ESC', onMenu); tec.on('keydown-P', onMenu); tec.on('keydown-M', onMudo);
        tec.on('keydown-Z', onMarcar); tec.on('keydown-X', onApagar);
        if (botaoMarcar) botaoMarcar.addEventListener('click', onMarcar);
        if (botaoApagar) botaoApagar.addEventListener('click', onApagar);
        this.atualizarBotoesPratica();
        this.cena.input.on('pointerdown', onPonteiro);
        this.cena.input.on('pointerup', onSoltaPonteiro);
        // Teclas extras da fase (ex.: 1/2/3 do Gavião)
        this.teclasExtras(tec);

        // Botão voltar (DOM) — durante a partida vira o botão de PAUSA (⏸)
        const back = document.getElementById('back-button');
        // Mostra
        back.hidden = false; back.innerHTML = '<span class="pausa-icone" aria-hidden="true">❚❚</span>'; back.setAttribute('aria-label', 'Pausa (ESC)'); back.classList.add('botao-pausa');
        // Botões da tela de pausa
        this.ligarPausa(onReiniciar);
        // Clique volta pro menu
        back.addEventListener('click', onMenu);
        // Botão de habilidade (DOM)
        this.botaoHabilidade.addEventListener('click', onAcao);

        // Acessibilidade do canvas: descrição com os controles
        this.cena.game.canvas.tabIndex = 0;
        this.cena.game.canvas.setAttribute('aria-label', `Fase ${this.cfg.nome}. ${this.textoControles}. R reinicia. Escape pausa.`);
        this.cena.game.canvas.focus({ preventScroll: true });

        // Limpeza de listeners quando a cena acabar (reinício ou menu)
        this.cena.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            // Esconde e desliga o botão voltar
            back.hidden = true; back.removeEventListener('click', onMenu); back.classList.remove('botao-pausa'); back.removeAttribute('aria-label');
            // Esconde e desliga o botão de habilidade
            this.botaoHabilidade.hidden = true; this.botaoHabilidade.removeEventListener('click', onAcao);
            // Remove os eventos do teclado
            tec.off('keydown-SPACE', onPulo); tec.off('keydown-UP', onPulo); tec.off('keydown-W', onPulo);
            tec.off('keyup-SPACE', onSoltaPulo); tec.off('keyup-UP', onSoltaPulo); tec.off('keyup-W', onSoltaPulo);
            tec.off('keydown-E', onAcao); tec.off('keydown-SHIFT', onAcao); tec.off('keydown-F', onAcao);
            tec.off('keydown-R', onReiniciar); tec.off('keydown-ESC', onMenu); tec.off('keydown-P', onMenu); tec.off('keydown-M', onMudo);
            tec.off('keydown-Z', onMarcar); tec.off('keydown-X', onApagar);
            if (botaoMarcar) { botaoMarcar.hidden = true; botaoMarcar.removeEventListener('click', onMarcar); }
            if (botaoApagar) { botaoApagar.hidden = true; botaoApagar.removeEventListener('click', onApagar); }
            // Some com a tela de pausa (e desliga os botões dela)
            this.esconderPausa(); this.desligarPausa();
            // Remove os eventos do ponteiro
            this.cena.input.off('pointerdown', onPonteiro);
            this.cena.input.off('pointerup', onSoltaPonteiro);
            // Desligadores extras da fase (sons contínuos etc.)
            this.desligadores.forEach((f) => f());
        });
    }

    // Gancho: teclas extras da fase
    teclasExtras(tec) {}

    // Está segurando pulo (tecla ou ponteiro)?
    segurando() {
        // Tecla segurada ou ponteiro segurado
        return this.segurandoTecla || (this.ponteiroPulo && this.ponteiroSegurado());
    }

    // Algum ponteiro (mouse ou qualquer um dos dedos) está apertado? (multitoque: activePointers = 3)
    ponteiroSegurado() {
        const ent = this.cena.input;
        return ent.activePointer.isDown || (ent.manager.pointers || []).some((pt) => pt && pt.isDown);
    }

    // Ganchos de entrada (padrão = runner com pulo)
    aoPressionar(fonte) { if (this.usarOrbe()) return; this.player.apertarPulo(this.cena.time.now); }

    // Orbe de salto encostado no cubo? Usa (pulo no ar) e devolve true
    usarOrbe() { const o = (this.orbesClassicos || []).find((x) => x.alcance()); return !!(o && o.usar()); }
    aoSoltar() {}
    aoAcao() { if (this.habilidade) this.habilidade.ativar(this.cena.time.now); }
    aoAcaoSecundaria(ponteiro) { this.aoAcao(); }
    aoClicarMundo(ponteiro) { return false; }

    // ---------------------------------------------------------------
    // ATUALIZAÇÃO (método template, chamado todo frame)
    // ---------------------------------------------------------------
    atualizar(time, delta) {
        // Pausado: o mundo fica congelado
        if (this.pausado) return;
        // Relógio da cena (o mesmo usado nas teclas e habilidades)
        const agora = this.cena.time.now;
        // Ritmo: conta o tempo real e toca uma batida a cada 60000/BPM ms (o fundo pulsa junto)
        this.atualizarBatida(Math.min(delta, 50));
        // Delta real limitado (evita saltos se a aba travar)
        const dtReal = Math.min(delta, 50);
        // Delta escalado pela Joia do Tempo
        const dt = dtReal * this.fatorTempo;
        // Conta o cronômetro (tempo real) enquanto joga
        if (this.player.vivo && !this.concluida) this.tempo += dtReal;
        // Atualiza cada obstáculo
        for (let i = 0; i < this.obstaculos.length; i++) {
            // Só os ativos
            if (this.obstaculos[i].ativo) this.obstaculos[i].atualizar(dt, agora);
        }
        // Quem controla o cubo é decidido de novo a cada quadro: player.atualizar (corrida) liga emCorrida;
        // se a fase assumir (voo, balanço) ou a fase acabou, fica desligado e o aperto não vira pulo de corrida
        this.player.emCorrida = false;
        // Movimento do jogador: a fase pode assumir (voo, balanço); senão, corrida padrão
        if (this.player.vivo && !this.concluida && !this.atualizarMovimento(agora, dtReal)) {
            // Corrida + pulo padrão
            this.player.atualizar(agora, dtReal, this.segurando());
        }
        // Pisca enquanto invencível
        this.player.alpha = (agora < this.player.invencivelAte && this.player.vivo) ? (Math.floor(agora / 80) % 2 ? 0.45 : 1) : (this.player.vivo ? 1 : this.player.alpha);
        // (a skin acompanha o cubo no 'postupdate', depois da física — ver criarJogador)
        // Acabou de pousar: poeira nos pés + gancho da fase (o Hulk faz tremer)
        if (this.player.acabouDePousar) { this.player.acabouDePousar = false; this.efeitos.poeiraPouso(this.player.x, this.player.y + (this.player.invertido ? -20 : 20), this.tema.bordaForma, this.player.invertido ? -1 : 1); this.aoPousar(); }
        // Fundo em camadas acompanha a câmera
        this.moverParalaxe();
        this.sincronizarVideo();
        // Mecânica própria da fase (gancho)
        this.atualizarMecanica(agora, dtReal, dt);
        // Caiu no vão ou saiu da tela: morre
        if (this.player.vivo && (this.player.y > 780 || this.player.y < -80)) this.morrer(true);
        // Passou de algum checkpoint? (gatilho só pelo x: funciona correndo, voando ou balançando)
        this.verificarCheckpoints();
        // Chegou na linha de chegada
        if (this.player.vivo && !this.concluida && this.player.x >= this.cfg.comprimento) this.concluir();
        // Atualiza o HUD
        this.atualizarHUD(agora);
        // Apaga obstáculos destruídos
        while (this.paraApagar.length) {
            // Tira da lista de espera
            const obs = this.paraApagar.pop();
            // Tira da lista geral
            Phaser.Utils.Array.Remove(this.obstaculos, obs);
            // Apaga a forma
            obs.forma.destroy();
        }
    }

    // Gancho: retorna true se a fase cuidou do movimento do jogador neste frame
    atualizarMovimento(agora, dt) { return false; }

    // Gancho: chamado quando o personagem pousa (cada fase pode dar seu "peso").
    // Padrão: efeito de pouso do herói (rachaduras do Hulk, teia do Aranha, selo do Estranho...)
    aoPousar() { if (typeof pousoHeroi === 'function') pousoHeroi(this); }

    // Gancho: mecânica própria por frame
    atualizarMecanica(agora, dtReal, dt) {}

    // Gancho: chamado no fim do criar()
    aoCriar() {}

    // Força do véu colorido da seção: fraco quando a fase tem arte de fundo (não "suja" as cores da imagem)
    alphaVeuSecao() { return this.fundoArte ? 0.05 : 0.16; }

    // Gancho: o CENÁRIO reage a um poder ou momento da fase (ex.: 'joiaInicio', 'joiaFim', 'portalAbre',
    // 'portalFecha', 'dimensao', 'furia', 'repulsor'...). Padrão: nada. Os cenários (cenarios.js) sobrescrevem.
    cenarioReagir(evento, dados) {}

    // ---------------------------------------------------------------
    // MORTE, CONCLUSÃO, REINÍCIO
    // ---------------------------------------------------------------
    morrer(queda = false) {
        // Já morto ou já concluiu: ignora
        if (!this.player.vivo || this.concluida) return;
        // Invencível (teste automático ou depois de teleporte): ignora (menos queda no vão, que reposiciona no teste)
        if (MODO_TESTE.invencivel || this.cena.time.now < this.player.invencivelAte) {
            // No modo teste, se caiu, coloca de volta em cima
            if (queda && MODO_TESTE.invencivel) { this.player.body.reset(this.player.x + 200, 300); return; }
            // Respiro do reaparecimento não salva de cair no vão
            if (!queda || MODO_TESTE.invencivel) return;
        }
        // Congela a física
        this.cena.physics.pause();
        // Som de morte
        som.tocar('morte');
        // Tremor
        this.efeitos.tremor(180, 0.008);
        // Estilhaços na cor do cubo
        this.efeitos.estilhacos(this.player.x, this.player.y, this.player.corBase, 14);
        // Gancho (ex.: desligar som contínuo)
        this.aoMorrer();
        // Rastro para
        if (this.rastro) this.rastro.stop();
        // Anima a morte (some em 260 ms)
        this.player.morrer();
        // Reinicia com a próxima tentativa meio segundo depois (pelo relógio do jogo),
        // a partir do último checkpoint ativado (ou do começo, se nenhum foi ativado)
        this.cena.time.delayedCall(520, () => this.reiniciar(this.tentativa + 1, this.dadosCheckpoint()));
    }

    // Gancho ao morrer
    aoMorrer() {}

    // ---------------------------------------------------------------
    // CHECKPOINTS
    // ---------------------------------------------------------------

    // Gancho: lista de checkpoints da fase, DECLARATIVA: { x, y?, teto?, ...estado da fase }
    // (o estado — realidade, dimensão — é o que o jogador deve ter ao reaparecer ali)
    checkpoints() { return []; }

    // Gancho: a subclasse restaura o estado declarado no checkpoint (realidade, dimensão...)
    restaurarCheckpoint(cp) {}

    // Cria as bandeiras e decide quantas já estão ativas (vindas do reinício)
    criarCheckpoints() {
        // Lista da fase em ordem de x
        this.listaCheckpoints = this.checkpoints().slice().sort((a, b) => a.x - b.x);
        // Checkpoint salvo no reinício
        const salvo = this.checkpointSalvo;
        // Índice inválido (lista mudou, dado estranho): ignora e começa do zero
        // (com diamante da prática, o índice pode ser -1: nenhuma bandeira ativada ainda)
        if (salvo && salvo.diamante) salvo.indice = Math.min(Math.max(-1, salvo.indice), this.listaCheckpoints.length - 1);
        else if (salvo && !(salvo.indice >= 0 && salvo.indice < this.listaCheckpoints.length)) this.checkpointSalvo = null;
        // Ativados = todos até o salvo (inclusive); sem salvo = nenhum
        this.cpAtivados = this.checkpointSalvo ? this.checkpointSalvo.indice + 1 : 0;
        // Uma bandeira por checkpoint (as já ativadas nascem acesas, sem efeito)
        this.marcosCheckpoint = this.listaCheckpoints.map((cp, i) => new MarcoCheckpoint(this, cp, i < this.cpAtivados));
    }

    // Altura do topo do chão no x dado (telhados/segmentos podem ter topo próprio)
    topoChaoEm(x) {
        // Segmento que contém o x
        const seg = this.segmentosChao().find((s) => x >= s[0] && x <= s[1]);
        // Topo do segmento (3º valor) ou o chão padrão
        return seg && seg[2] !== undefined ? seg[2] : MOVIMENTO.chaoY;
    }

    // Y do centro do jogador ao reaparecer no checkpoint
    yDoCheckpoint(cp) {
        // Y fixo declarado (ex.: voo do Homem de Ferro)
        if (cp.y !== undefined) return cp.y;
        // No teto (dimensão espelho do Dr. Estranho)
        if (cp.teto) return MOVIMENTO.tetoY + 20;
        // Em cima do chão daquele trecho
        return this.topoChaoEm(cp.x) - 20;
    }

    // Reaparece no último checkpoint salvo (chamado no fim do criar)
    voltarAoCheckpoint() {
        // Modo prática: reaparece no diamante
        if (this.checkpointSalvo.diamante) { this.voltarAoDiamante(this.checkpointSalvo.diamante); return; }
        // Checkpoint onde reaparece
        const cp = this.listaCheckpoints[this.cpAtivados - 1];
        // Coloca o jogador lá (reset zera a velocidade do corpo)
        this.player.body.reset(cp.x, this.yDoCheckpoint(cp));
        // Cronômetro continua de onde parou
        this.tempo = this.checkpointSalvo.tempo || 0;
        // Estado próprio da fase (gancho)
        this.restaurarCheckpoint(cp);
        // Câmera e cenário já no lugar certo (sem "viagem" da câmera desde o começo da fase)
        this.alinharCamera();
        // Respiro ao reaparecer: meio segundo piscando sem morrer (o perigo mais próximo fica a ≥1 s,
        // ver checkpoints() de cada fase; isto só evita a morte instantânea se algo cruzar o ponto)
        this.player.invencivelAte = this.cena.time.now + 500;
        // Brilho curto onde reaparece (sem texto: o checkpoint já tinha sido anunciado)
        this.efeitos.anel(this.player.x, this.player.y, this.tema.linha, 26, 2.2, 360);
    }

    // Põe a câmera (e o alvo suavizado que ela segue) direto no jogador. Sem isso, nas fases com
    // câmera suave (Homem-Aranha, lerp 0,15) a câmera partia do x inicial e o cubo reaparecia fora da tela.
    alinharCamera() {
        const cam = this.cena.cameras.main, p = this.player;
        // Alvo da câmera = posição atual do jogador (a interpolação visual recomeça daqui)
        if (this.foco) { this.foco.x = p.x; this.foco.y = p.y; }
        p.visX = p.x; p.visY = p.y;
        // Mesma conta do "seguir" do Phaser, com lerp 1 só neste quadro (os limites do mundo são aplicados no preRender)
        if (cam._follow) cam.scrollX = (cam._follow.x - cam.followOffset.x) - cam.width * cam.originX;
        // O cenário em camadas lê o scrollX: atualiza já, sem esperar o próximo quadro
        if (this.moverParalaxe) this.moverParalaxe(0);
    }

    // ---------------------------------------------------------------
    // MODO PRÁTICA (diamantes verdes)
    // ---------------------------------------------------------------

    // Gancho: dá pra marcar um diamante agora? (o Homem-Aranha não deixa no meio do balanço)
    podeMarcarPratica() { return true; }

    // Gancho: estado próprio da fase que o diamante precisa guardar (realidade, dimensão, flechas…)
    estadoPratica() { return {}; }

    // Z: marca um diamante onde o jogador está (posição, velocidade, gravidade, modo e estado da fase)
    marcarDiamante() {
        // Só na prática, jogando
        if (!this.pratica || this.pausado || this.concluida || !this.player.vivo) return false;
        const p = this.player;
        // Lugar proibido pela fase
        if (!this.podeMarcarPratica()) { this.efeitos.textoFlutuante(p.x, p.y - 60, 'AQUI NÃO DÁ', '#ffd34d'); return false; }
        // Foto do momento
        const d = {
            x: Math.round(p.x), y: Math.round(p.y), vy: Math.round(p.body.velocity.y),
            invertido: p.invertido, modo: p.modo, velX: p.velocidadeX,
            tempo: this.tempo, acionados: this.acionados.slice(), estado: this.estadoPratica()
        };
        this.pratica.diamantes.push(d);
        this.desenhoDiamantes.push(this.desenharDiamante(d, true));
        som.tom('triangle', 880, 1320, 90, 0.05);
        return true;
    }

    // X: apaga o último diamante
    apagarDiamante() {
        if (!this.pratica || !this.pratica.diamantes.length) return false;
        this.pratica.diamantes.pop();
        const g = this.desenhoDiamantes.pop(); if (g) g.destroy();
        som.tom('triangle', 660, 330, 90, 0.05);
        return true;
    }

    // Desenho do diamante verde no mundo
    desenharDiamante(d, animar = false) {
        const g = this.cena.add.graphics({ x: d.x, y: d.y }).setDepth(9);
        g.fillStyle(0x3dff8a, 0.85).fillPoints([{ x: 0, y: -16 }, { x: 12, y: 0 }, { x: 0, y: 16 }, { x: -12, y: 0 }], true);
        g.lineStyle(2, 0xffffff, 1).strokePoints([{ x: 0, y: -16 }, { x: 12, y: 0 }, { x: 0, y: 16 }, { x: -12, y: 0 }], true);
        if (animar) { g.setScale(0.2); this.cena.tweens.add({ targets: g, scale: 1, duration: this.efeitos.dur(160), ease: 'Back.Out' }); }
        return g;
    }

    // Reaparece no diamante: refaz as ligações, restaura o estado da fase e a física do momento
    voltarAoDiamante(d) {
        const p = this.player;
        // Cronômetro do momento do diamante
        this.tempo = d.tempo || 0;
        // Portas/pontes/lasers que já estavam abertos
        (d.acionados || []).forEach((id) => this.acionar(id));
        // Estado próprio da fase (mesmo formato dos checkpoints: { x, teto, realidade, dim… })
        this.restaurarCheckpoint(Object.assign({ x: d.x, teto: d.invertido }, d.estado || {}));
        // Física do momento
        p.body.reset(d.x, d.y);
        p.inverterGravidade(!!d.invertido);
        p.definirModo(d.modo || 'cubo');
        if (d.velX) p.velocidadeX = d.velX;
        p.body.setVelocityY(d.vy || 0);
        // Brilho verde
        this.alinharCamera();
        this.efeitos.anel(p.x, p.y, 0x3dff8a, 26, 2.2, 360);
    }

    // Liga/desliga a prática (botão da pausa). Ligar continua daqui; desligar recomeça do zero.
    alternarPratica() {
        if (this.pratica) { this.pausado = false; this.cena.time.paused = false; this.cena.tweens.resumeAll(); if (som.ctx && som.ctx.state === 'suspended') som.ctx.resume(); this.esconderPausa(); this.reiniciar(this.tentativa + 1, null, null); return; }
        this.pratica = { diamantes: [] };
        this.atualizarBotoesPratica();
        this.retomar();
        this.efeitos.textoFlutuante(this.player.x, this.player.y - 60, 'MODO PRÁTICA: Z marca ◆', '#3dff8a');
    }

    // Mostra/esconde os botões de toque da prática
    atualizarBotoesPratica() {
        const bm = document.getElementById('pratica-marcar'), ba = document.getElementById('pratica-apagar');
        if (bm) bm.hidden = !this.pratica; if (ba) ba.hidden = !this.pratica;
    }

    // Confere, todo frame, se o jogador passou do próximo checkpoint
    verificarCheckpoints() {
        // Morto ou já concluído: nada
        if (!this.player.vivo || this.concluida) return;
        // Pode passar de mais de um no mesmo frame (ex.: teleporte): ativa em ordem
        while (this.cpAtivados < this.listaCheckpoints.length && this.player.x >= this.listaCheckpoints[this.cpAtivados].x) {
            // Ativa o próximo
            this.ativarCheckpoint(this.cpAtivados);
        }
    }

    // Ativa o checkpoint de índice i (só uma vez: cpAtivados passa a ser i + 1)
    ativarCheckpoint(i) {
        // Conta como ativado
        this.cpAtivados = i + 1;
        // Bandeira acende com efeito
        this.marcosCheckpoint[i].acender(true);
        // Som curto de duas notas subindo (não interrompe nada)
        som.tom('triangle', 660, 990, 120, 0.07); som.tom('triangle', 990, 1320, 160, 0.06, 110);
        // Aviso rápido no alto da tela
        this.avisoCheckpoint();
        // Nova porcentagem
        const porcentagem = this.porcentagemAtual();
        // Atualiza a barra percentual (animada)
        if (this.barraPct) this.barraPct.definir(porcentagem, true);
        // Guarda o melhor % alcançado nessa fase (aparece no cartão da seleção) — na prática não conta
        if (!this.pratica) Progresso.registrarPct(this.heroi, porcentagem); else if (Progresso.registrarPctPratica) Progresso.registrarPctPratica(this.heroi, porcentagem);
        // Avisa quem estiver ouvindo (barra, testes)
        this.cena.events.emit('checkpoint', { indice: i, total: this.listaCheckpoints.length, porcentagem });
    }

    // Texto "CHECKPOINT ALCANÇADO!" que aparece e some rápido (fixo na tela)
    avisoCheckpoint() {
        // Texto centralizado abaixo do HUD
        const t = this.cena.add.text(640, 150, 'CHECKPOINT ALCANÇADO!', {
            fontFamily: 'Arial, sans-serif', fontSize: '26px', fontStyle: 'bold', color: this.tema.texto,
            stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(110).setScale(0.6);
        // Entra crescendo
        this.cena.tweens.add({ targets: t, scale: 1, duration: this.efeitos.dur(160), ease: 'Back.Out' });
        // Sobe um pouco e some (≈1 s no total)
        this.cena.tweens.add({ targets: t, alpha: 0, y: 130, delay: 650, duration: 350, onComplete: () => t.destroy() });
    }

    // Porcentagem pelos checkpoints: ativados / (N + 1) — 100% só existe na vitória (concluir)
    porcentagemAtual() {
        // Total de checkpoints
        const n = this.listaCheckpoints.length;
        // Arredonda (2 → 33/67; 3 → 25/50/75)
        return Math.round(100 * this.cpAtivados / (n + 1));
    }

    // Dados pro reinício: último checkpoint ativado + cronômetro acumulado (null = do zero)
    dadosCheckpoint() {
        // Prática com diamante: reaparece no último diamante
        if (this.pratica && this.pratica.diamantes.length) return { indice: this.cpAtivados - 1, tempo: this.tempo, diamante: this.pratica.diamantes[this.pratica.diamantes.length - 1] };
        // Nenhum ativado: recomeça do início
        if (this.cpAtivados === 0) return null;
        // Índice do último ativado e o tempo até agora
        return { indice: this.cpAtivados - 1, tempo: this.tempo };
    }

    // Reinicia a fase com o número de tentativa dado
    // checkpoint = { indice, tempo } pra reaparecer nele; null (padrão) = do zero (R, "Jogar de novo")
    // pratica = estado do modo prática a manter (padrão: o atual; null desliga)
    reiniciar(tentativa, checkpoint = null, pratica = this.pratica) {
        // Garante tempo normal (a Joia pode ter mudado)
        this.restaurarTempo();
        // Reinicia a cena com o mesmo herói (a cena recria tudo limpo: obstáculos, portas, estados)
        this.cena.scene.restart({ hero: this.heroi, tentativa, checkpoint, pratica });
    }

    // Volta tudo ao tempo normal (física, tweens, relógio)
    restaurarTempo() {
        // Física normal
        this.cena.physics.world.timeScale = 1;
        // Tweens normais
        this.cena.tweens.timeScale = 1;
        // Relógio normal
        this.cena.time.timeScale = 1;
        // Fator dos obstáculos normal
        this.fatorTempo = 1;
    }

    // ---------------------------------------------------------------
    // PAUSA (tela no estilo dos jogos de ritmo: continuar, reiniciar, seleção, som)
    // ---------------------------------------------------------------
    // Abre ou fecha
    alternarPausa() { if (this.pausado) this.retomar(); else this.pausar(); }

    // Pausa tudo: física, animações, relógio da cena e o loop da fase
    pausar() {
        // Morto/concluído: não pausa (já está trocando de tela)
        if (this.pausado || this.concluida || !this.player.vivo) return;
        // Marca
        this.pausado = true;
        // Para física, tweens e timers
        this.cena.physics.world.pause(); this.cena.tweens.pauseAll(); this.cena.time.paused = true;
        // Para o som contínuo da fase, se houver
        if (som.ctx && som.ctx.state === 'running') som.ctx.suspend();
        // Mostra a tela
        const tela = document.getElementById('pausa');
        tela.hidden = false;
        // Progresso atual e tentativa na tela
        document.getElementById('pausa-info').textContent = `${this.cfg.nome} · TENTATIVA ${this.tentativa} · ${this.porcentagemAtual()}%`;
        // Texto do botão de som
        document.getElementById('pausa-som').textContent = som.mudo ? 'Som: DESLIGADO' : 'Som: LIGADO';
        // Texto do botão da prática
        const bp = document.getElementById('pausa-pratica'); if (bp) bp.textContent = this.pratica ? '◆ Sair da prática' : '◆ Modo prática';
        // Foco no "Continuar"
        document.getElementById('pausa-continuar').focus({ preventScroll: true });
    }

    // Volta ao jogo
    retomar() {
        // Não está pausado: nada
        if (!this.pausado) return;
        // Desmarca
        this.pausado = false;
        // Volta física, tweens, timers e áudio
        this.cena.physics.world.resume(); this.cena.tweens.resumeAll(); this.cena.time.paused = false;
        if (som.ctx && som.ctx.state === 'suspended') som.ctx.resume();
        // Esconde a tela e devolve o foco pro jogo
        this.esconderPausa();
        this.cena.game.canvas.focus({ preventScroll: true });
        // Esquece o pulo segurado de antes da pausa
        this.segurandoTecla = false;
    }

    // Batidas da música (só enquanto joga) e o pulso do fundo
    atualizarBatida(dtReal) {
        // Sem pulso criado (fase antiga) ou já concluída: nada
        if (!this.pulsoFundo || this.concluida) return;
        // Intervalo entre batidas
        const intervalo = 60000 / this.bpm;
        // Conta
        this.relogioBatida += dtReal;
        // Passou uma batida
        if (this.relogioBatida >= intervalo) {
            // Desconta (mantém o ritmo certinho)
            this.relogioBatida -= intervalo;
            // Toca a batida da trilha
            som.batidaMusica(this.indiceBatida++, this.cfg.raiz || 55, intervalo);
            // Fundo acende (mais forte no primeiro tempo do compasso)
            if (!reducedMotion.matches) this.pulsoFundo.setFillStyle(this.tema.linha, this.indiceBatida % 4 === 1 ? 0.07 : 0.04);
            // Linha do chão acende
            if (!reducedMotion.matches) this.brilhoChao = 1;
        }
        // O pulso apaga devagar
        this.pulsoFundo.fillAlpha = Math.max(0, this.pulsoFundo.fillAlpha - dtReal / 3000);
        // Linha do chão: acende na batida e volta a 55%
        if (this.linhasChao) {
            // Brilho alvo desta batida (decai)
            this.brilhoChao = Math.max(0.55, (this.brilhoChao || 0.55) - dtReal / 350);
            this.linhasChao.forEach((l) => l.setAlpha(this.brilhoChao));
            if (this.feixes) this.feixes.setAlpha((0.45 + 0.55 * this.brilhoChao) * (this.cenarioDetalhado ? 0.5 : 1));
        }
        // Cor da seção: vai suavemente até a cor do trecho atual
        if (this.coresSecoes) {
            // Cor alvo (do número de checkpoints já ativados)
            const alvo = this.coresSecoes[Math.min(this.cpAtivados, this.coresSecoes.length - 1)];
            // Mistura 4% por quadro
            if (alvo !== this.corSecaoAtual) {
                const c0 = Phaser.Display.Color.IntegerToColor(this.corSecaoAtual), c1 = Phaser.Display.Color.IntegerToColor(alvo);
                const m = Phaser.Display.Color.Interpolate.ColorWithColor(c0, c1, 100, 8);
                const nova = Phaser.Display.Color.GetColor(m.r, m.g, m.b);
                this.corSecaoAtual = (nova === this.corSecaoAtual) ? alvo : nova;
                this.veuSecao.setFillStyle(this.corSecaoAtual, this.alphaVeuSecao());
                // Fundo geométrico, feixes e cenário de trás acompanham a cor
                if (this.fundoGeo) this.fundoGeo.setTint(this.corSecaoAtual);
                if (this.feixes) this.feixes.setTint(this.corSecaoAtual);
                const tinta = this.clarear(this.corSecaoAtual, 0.4);
                (this.camadas || []).forEach((t) => { if (t.tingir) t.setTint(tinta); });
            }
        }
    }

    // Só esconde a tela de pausa
    esconderPausa() { const t = document.getElementById('pausa'); if (t) t.hidden = true; }

    // Liga os botões da tela de pausa (guarda os handlers pra desligar no fim da cena)
    ligarPausa(onReiniciar) {
        // Handlers
        this.pausaHandlers = {
            'pausa-continuar': () => this.retomar(),
            'pausa-reiniciar': () => { this.pausado = false; this.cena.time.paused = false; this.cena.tweens.resumeAll(); if (som.ctx && som.ctx.state === 'suspended') som.ctx.resume(); onReiniciar(); },
            'pausa-selecao': () => { this.pausado = false; this.cena.time.paused = false; if (som.ctx && som.ctx.state === 'suspended') som.ctx.resume(); this.esconderPausa(); this.irParaMenu(true); },
            'pausa-som': () => { const mudo = som.alternarMudo(); document.getElementById('pausa-som').textContent = mudo ? 'Som: DESLIGADO' : 'Som: LIGADO'; },
            'pausa-pratica': () => this.alternarPratica()
        };
        // Liga cada um (se o botão existir na página)
        Object.entries(this.pausaHandlers).forEach(([id, fn]) => { const b = document.getElementById(id); if (b) b.addEventListener('click', fn); });
    }

    // Desliga os botões da pausa
    desligarPausa() { Object.entries(this.pausaHandlers || {}).forEach(([id, fn]) => { const b = document.getElementById(id); if (b) b.removeEventListener('click', fn); }); }

    // Volta ao menu (abrirSelecao = true abre direto a seleção de fases)
    irParaMenu(abrirSelecao) {
        // Tempo normal
        this.restaurarTempo();
        // Troca de cena
        this.cena.scene.start('Menu', { abrirSelecao });
    }

    // Chegou na linha de chegada
    concluir() {
        // Marca como concluída
        this.concluida = true;
        // Fica invencível
        this.player.invencivelAte = Infinity;
        // Câmera para de seguir (o cubo sai correndo da tela)
        this.cena.cameras.main.stopFollow();
        // Gancho (ex.: desligar som do jato)
        this.aoMorrer();
        // Som de chegada
        som.tocar('chegada');
        // Partículas na cor da fase
        this.efeitos.estilhacos(this.player.x, this.player.y, [this.tema.linha, 0xffffff], 30, 380);
        // Salva o progresso (uma vez só: concluir() só roda uma vez por causa do "concluida").
        // Na prática não salva: mostra só o melhor tempo que já existia (ou o desta corrida)
        if (this.pratica && Progresso.registrarPctPratica) Progresso.registrarPctPratica(this.heroi, 100);
        const salvo = this.pratica ? (Progresso.ler()[this.heroi] || { melhorTempo: this.tempo }) : Progresso.salvar(this.heroi, this.tempo, this.tentativa);
        // Barra percentual chega a 100% SÓ aqui (vitória de verdade)
        if (this.barraPct) this.barraPct.definir(100, true);
        // Desliga o corpo de física (a animação final move o personagem livremente)
        this.player.body.enable = false;
        // Animação de encerramento própria do herói (gancho)
        this.animacaoFinal();
        // Texto grande no meio da tela
        const t = this.cena.add.text(640, 300, this.fraseCurta || 'CONCLUÍDO!', {
            fontFamily: 'Arial, sans-serif', fontSize: '60px', fontStyle: 'bold', color: this.tema.texto, stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5).setScrollFactor(0).setDepth(130).setScale(0.3);
        // Entra crescendo
        this.cena.tweens.add({ targets: t, scale: 1, duration: this.efeitos.dur(300), ease: 'Back.Out' });
        // Mostra a tela de conclusão depois da animação (1,6 s)
        this.cena.time.delayedCall(1600, () => this.mostrarTelaConclusao(salvo));
    }

    // Gancho: animação de encerramento (padrão: o cubo continua correndo e some)
    animacaoFinal() {
        // Corre pra fora da tela
        this.cena.tweens.add({ targets: this.player, x: this.player.x + 900, duration: 1400 });
    }

    // Próxima fase na ordem da tela de seleção (null se for a última)
    proximaFase() {
        // Ordem dos botões no HTML
        const ordem = [...document.querySelectorAll('.level-btn')].map((b) => b.getAttribute('data-level'));
        // Índice da atual
        const i = ordem.indexOf(this.heroi);
        // Próxima (ou null)
        return i >= 0 && i < ordem.length - 1 ? ordem[i + 1] : null;
    }

    // Tela "FASE CONCLUÍDA" (feita em HTML pra ter foco e acessibilidade)
    mostrarTelaConclusao(salvo) {
        // Elementos da tela
        const tela = document.getElementById('fase-concluida');
        // Nome do herói
        document.getElementById('fc-heroi').textContent = this.fraseFinal ? `${this.cfg.nome} — ${this.fraseFinal}` : this.cfg.nome;
        // Cor do título na cor da fase
        document.getElementById('fc-titulo').style.color = '#' + this.tema.linha.toString(16).padStart(6, '0');
        // Título: prática não vale como conclusão de verdade
        document.getElementById('fc-titulo').textContent = this.pratica ? 'PRÁTICA CONCLUÍDA' : 'FASE CONCLUÍDA';
        // Tentativas
        document.getElementById('fc-tentativas').textContent = this.tentativa;
        // Tempo desta tentativa
        document.getElementById('fc-tempo').textContent = Progresso.formatar(this.tempo);
        // Melhor tempo salvo
        document.getElementById('fc-melhor').textContent = Progresso.formatar(salvo.melhorTempo);
        // Mostra a tela
        tela.hidden = false;
        // Esconde os botões do jogo
        document.getElementById('back-button').hidden = true;
        this.botaoHabilidade.hidden = true;
        // Botões da tela
        const deNovo = document.getElementById('fc-de-novo');
        const escolher = document.getElementById('fc-escolher');
        // Fecha a tela e tira os listeners
        const fechar = () => {
            // Esconde
            tela.hidden = true;
            // Tira os listeners
            deNovo.removeEventListener('click', jogarDeNovo);
            escolher.removeEventListener('click', escolherFase);
            proxima.removeEventListener('click', irProxima);
            window.removeEventListener('keydown', teclas);
        };
        // Jogar de novo: reinicia na tentativa 1 (partida normal, sem prática)
        const jogarDeNovo = () => { fechar(); this.reiniciar(1, null, null); };
        // Escolher fase: volta pra seleção
        const escolherFase = () => { fechar(); this.irParaMenu(true); };
        // Próxima fase (se existir)
        const proxima = document.getElementById('fc-proxima'), heroiProximo = this.proximaFase();
        // Esconde o botão na última fase
        proxima.hidden = !heroiProximo;
        // Vai pra próxima fase, tentativa 1
        const irProxima = () => { fechar(); this.restaurarTempo(); this.cena.scene.restart({ hero: heroiProximo, tentativa: 1 }); };
        // ESC = escolher fase (Enter já aperta o botão focado)
        const teclas = (e) => { if (e.key === 'Escape') escolherFase(); };
        // Liga os listeners
        deNovo.addEventListener('click', jogarDeNovo);
        escolher.addEventListener('click', escolherFase);
        proxima.addEventListener('click', irProxima);
        window.addEventListener('keydown', teclas);
        // Foco no botão principal: "Próxima fase" (ou "Jogar de novo" na última)
        (heroiProximo ? proxima : deNovo).focus({ preventScroll: true });
    }
}

// ================================================================
// MARCO DE CHECKPOINT: bandeira fincada no chão (ou pendurada no teto) na cor da fase.
// Só visual: o gatilho é o x do jogador (Fase.verificarCheckpoints), então não atrapalha o movimento.
// ================================================================
class MarcoCheckpoint {
    // fase = dona; cp = { x, teto?, ... }; aceso = já nasce ativado (reaparecendo depois dele)
    constructor(fase, cp, aceso) {
        // Fase dona
        this.fase = fase;
        // Cena (atalho)
        const cena = fase.cena;
        // Pendurado no teto? (dimensão espelho)
        this.teto = !!cp.teto;
        // Sentido do mastro: -1 sobe a partir do chão, +1 desce a partir do teto
        const s = this.teto ? 1 : -1;
        // Y da base (topo do chão daquele trecho, ou a linha do teto)
        const yBase = this.teto ? MOVIMENTO.tetoY : fase.topoChaoEm(cp.x);
        // Y da ponta do mastro (90 px de altura)
        const yPonta = yBase + s * 90;
        // Guarda posições pros efeitos
        this.x = cp.x; this.yPonta = yPonta;
        // Cores da fase
        this.cor = fase.tema.linha; this.corApagada = fase.tema.bordaForma;
        // Brilho redondo atrás da bandeira (aparece ao acender)
        this.brilho = cena.add.circle(cp.x + 18, yPonta - s * 14, 34, this.cor, 0).setDepth(3);
        // Mastro + pé (desenho fixo)
        this.mastro = cena.add.graphics().setDepth(4);
        // Pé: placa larga encostada no chão/teto
        this.mastro.fillStyle(0x000000, 0.45).fillRect(cp.x - 14, this.teto ? yBase : yBase - 6, 28, 6);
        // Haste fina
        this.mastro.fillStyle(this.corApagada, 0.9).fillRect(cp.x - 2, Math.min(yBase, yPonta), 4, 90);
        // Bandeira triangular presa no alto do mastro (aponta pra frente)
        // (pontos relativos ao alto do mastro: desce 28 px no chão, sobe 28 px no teto)
        this.bandeira = cena.add.triangle(cp.x + 2, yPonta, 0, 0, 34, -s * 14, 0, -s * 28, this.corApagada, 0.45).setOrigin(0, 0).setDepth(4);
        // Losango no topo (vira "lâmpada" ao acender)
        this.luz = cena.add.rectangle(cp.x, yPonta, 10, 10, this.corApagada, 0.6).setAngle(45).setDepth(5);
        // Estado
        this.aceso = false;
        // Já ativado antes do reinício: acende sem efeito
        if (aceso) this.acender(false);
    }

    // Acende a bandeira; animar = com anel, partículas e balanço
    acender(animar) {
        // Só uma vez
        if (this.aceso) return;
        // Marca
        this.aceso = true;
        // Bandeira e luz na cor da fase, opacas
        this.bandeira.setFillStyle(this.cor, 1);
        this.luz.setFillStyle(0xffffff, 1).setStrokeStyle(2, this.cor);
        // Brilho fraco permanente
        this.brilho.setAlpha(0.18);
        // Sem animação (reaparecendo): para aqui
        if (!animar) return;
        // Atalhos
        const fase = this.fase, cena = fase.cena;
        // Anel crescendo na ponta + outro no pé
        fase.efeitos.anel(this.x, this.yPonta, this.cor, 22, 3, 420);
        fase.efeitos.anel(this.x, this.yPonta, 0xffffff, 12, 2, 300);
        // Faíscas na cor da fase e brancas
        fase.efeitos.estilhacos(this.x, this.yPonta, [this.cor, 0xffffff], 14, 260);
        // Bandeira "tremula" (estica e volta) — só visual
        cena.tweens.add({ targets: this.bandeira, scaleX: 1.35, yoyo: true, duration: fase.efeitos.dur(140), repeat: 1 });
        // Brilho pulsa forte e acomoda
        cena.tweens.add({ targets: this.brilho, alpha: { from: 0.6, to: 0.18 }, scale: { from: 1.6, to: 1 }, duration: fase.efeitos.dur(500) });
    }
}
