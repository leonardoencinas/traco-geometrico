// ================================================================
// cenarios.js — CENÁRIOS TEMÁTICOS de cada fase (direção de arte, rodada 7)
// Camadas de fundo, iluminação, partículas e elementos animados por herói.
// Também implementa as REAÇÕES do cenário aos poderes (Fase.cenarioReagir).
//
// Regras de arte (REA_ESQUEMA.md):
//   · triângulo = perigo, SEMPRE: o cenário usa só retângulos, círculos, arcos, linhas e polígonos de 6+ lados;
//   · o cenário fica mais escuro e com menos contraste que os objetos neon (obstáculos sempre legíveis);
//   · texturas desenhadas UMA vez; poucos objetos animados (reciclados conforme a câmera anda);
//   · movimento reduzido (prefers-reduced-motion) desliga as animações ambientes.
//
// Profundidades (todas atrás do véu de seção em -50):
//   -99 céu · -98 nuvens/nebulosa · -96 silhuetas longe · -93 animados longe · -92 camada média
//   -86 feixes (rodada 8: sem quadrados/grade de fundo) · -84 camada perto · -80 animados perto · -60 reações
// ================================================================

const Cenarios = {
    // ---------------------------------------------------------------
    // UTILIDADES
    // ---------------------------------------------------------------

    // Mistura duas cores (t de 0 a 1)
    mistura(a, b, t) {
        const c1 = Phaser.Display.Color.IntegerToColor(a), c2 = Phaser.Display.Color.IntegerToColor(b);
        return Phaser.Display.Color.GetColor(
            Math.round(c1.red + (c2.red - c1.red) * t),
            Math.round(c1.green + (c2.green - c1.green) * t),
            Math.round(c1.blue + (c2.blue - c1.blue) * t));
    },

    // Gera uma textura uma vez só (nas próximas tentativas reaproveita)
    textura(cena, chave, w, h, desenhar) {
        if (cena.textures.exists(chave)) return chave;
        const g = cena.make.graphics({ x: 0, y: 0, add: false });
        desenhar(g, w, h);
        g.generateTexture(chave, w, h);
        g.destroy();
        return chave;
    },

    // Céu fixo na tela: degradê vertical em faixas finas (topo → meio → horizonte) + extras por cima
    ceu(fase, chave, cores, extra) {
        const k = this.textura(fase.cena, chave, 1280, 560, (g, w, h) => {
            const passos = 40;
            for (let i = 0; i < passos; i++) {
                const t = i / (passos - 1);
                const cor = t < 0.5 ? this.mistura(cores[0], cores[1], t * 2) : this.mistura(cores[1], cores[2], (t - 0.5) * 2);
                g.fillStyle(cor, 1); g.fillRect(0, Math.floor(i * h / passos), w, Math.ceil(h / passos) + 1);
            }
            if (extra) extra(g, w, h);
        });
        const img = fase.cena.add.image(640, 380, k).setScrollFactor(0).setDepth(-99);
        // Guardado pra sumir quando a fase tem arte de fundo (fundoImagem)
        if (fase.estadoCenario) (fase.estadoCenario.ceus = fase.estadoCenario.ceus || []).push(img);
        return img;
    },

    // Camada de paralaxe com as cores próprias (sem o tingimento da seção)
    camada(fase, fator, prof, desenhar, largura = 2048) {
        // estrutural = silhueta/prédio (some quando há arte de fundo); névoas marcam false
        const tile = fase.camadaParalaxe(fator, prof, desenhar, largura, { tingir: false });
        tile.estrutural = true;
        return tile;
    },

    // Estrelas espalhadas (pontinhos de brilho variado) na parte de cima do céu
    estrelas(g, w, h, semente, qtd = 120, cor = 0xffffff, altura = 0.6) {
        const rnd = new Phaser.Math.RandomDataGenerator([semente]);
        for (let i = 0; i < qtd; i++) {
            g.fillStyle(cor, rnd.realInRange(0.15, 0.7));
            g.fillRect(rnd.between(0, w), rnd.between(0, h * altura), rnd.pick([1, 1, 2]), rnd.pick([1, 1, 2]));
        }
    },

    // Registra uma animação por quadro (dt em ms reais) — desligada com movimento reduzido
    animar(fase, fn) {
        if (reducedMotion.matches) return;
        if (!fase.animacoesCenario) {
            fase.animacoesCenario = [];
            let antes = fase.cena.time.now;
            const passo = () => {
                if (fase.pausado) { antes = fase.cena.time.now; return; }
                const agora = fase.cena.time.now, dt = Math.min(50, Math.max(0, agora - antes)); antes = agora;
                const sx = fase.cena.cameras.main.scrollX;
                for (const f of fase.animacoesCenario) f(dt, agora, sx);
            };
            fase.cena.events.on('postupdate', passo);
            fase.cena.events.once('shutdown', () => fase.cena.events.off('postupdate', passo));
        }
        fase.animacoesCenario.push(fn);
    },

    // Objetos fixos na tela que "andam" com a câmera numa camada de fator f e voltam pelo outro lado
    // (poucos objetos cobrem a fase inteira). Cada objeto ganha .baseX (posição dentro do ciclo).
    reciclar(fase, objs, fator, ciclo, margem = 200) {
        objs.forEach((o, i) => { if (o.baseX === undefined) o.baseX = i * ciclo / objs.length; });
        const posicionar = (sx) => objs.forEach((o) => {
            const x = ((o.baseX - sx * fator) % ciclo + ciclo) % ciclo - margem;
            o.x = x;
        });
        posicionar(fase.cena.cameras.main.scrollX);
        this.animar(fase, (dt, agora, sx) => posicionar(sx));
        return objs;
    },

    // Partículas ambientes fixas na tela (área = retângulo da tela), pequenas pra não atrapalhar a leitura
    particulas(fase, cfg, prof = -87) {
        if (reducedMotion.matches) return null;
        return fase.cena.add.particles(0, 0, 'faisca', Object.assign({
            x: { min: 0, max: 1280 }, y: { min: 120, max: 640 }, lifespan: 4000, frequency: 160,
            scale: { start: 0.45, end: 0 }, alpha: { start: 0.5, end: 0 }, speedY: { min: -20, max: -6 }
        }, cfg)).setScrollFactor(0).setDepth(prof);
    },

    // Clarão colorido rápido atrás dos obstáculos (reações a poderes)
    clarao(fase, cor, alpha = 0.16, dur = 280) {
        const r = fase.cena.add.rectangle(640, 380, 1280, 560, cor, alpha).setScrollFactor(0).setDepth(-60);
        fase.cena.tweens.add({ targets: r, alpha: 0, duration: reducedMotion.matches ? 1 : dur, onComplete: () => r.destroy() });
    },

    // Anel que cresce e some (posição na TELA), atrás dos obstáculos
    anelTela(fase, x, y, cor, r0 = 20, r1 = 420, dur = 700, espessura = 4) {
        if (reducedMotion.matches) return;
        const g = fase.cena.add.graphics().setScrollFactor(0).setDepth(-60).setPosition(x, y);
        const estado = { r: r0, a: 0.7 };
        fase.cena.tweens.add({
            targets: estado, r: r1, a: 0, duration: dur, ease: 'Cubic.Out',
            onUpdate: () => { g.clear(); g.lineStyle(espessura, cor, estado.a).strokeCircle(0, 0, estado.r); },
            onComplete: () => g.destroy()
        });
    },

    // Polígono regular (6+ lados) — usado em mandalas e ondas hex (nunca triângulos)
    poligono(n, r, giro = 0) {
        const pts = [];
        for (let i = 0; i < n; i++) { const a = giro + i / n * Math.PI * 2; pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
        return pts;
    },

    // Posição do jogador na tela
    jogadorTela(fase) {
        const cam = fase.cena.cameras.main;
        return { x: fase.player.x - cam.scrollX, y: fase.player.y - cam.scrollY };
    },

    // Prepara a fase pro cenário detalhado (quadrados e feixes mais discretos por cima do cenário)
    // A fase tem sequência de imagens carregada? Então o cenário procedural (camadas em paralaxe, antenas,
    // luzes, partículas) não é criado: por cima da arte ele parecia flutuar e andar em outra velocidade.
    temSequencia(fase) {
        const def = (typeof CENARIOS_IMAGEM !== 'undefined') && CENARIOS_IMAGEM[fase.heroi], k = this.chaveFundo(fase.heroi);
        const sem = !!(def && ((def.sequencia && fase.cena.textures.exists(k + '-0')) || (def.camadas && fase.cena.textures.exists(k + '-c0')) || (def.soArte && fase.cena.textures.exists(k))));
        if (sem) fase.semProcedural = true;
        return sem;
    },

    preparar(fase) {
        fase.cenarioDetalhado = true;
        fase.estadoCenario = { criadoEm: fase.cena.time.now };
    },

    // ---------------------------------------------------------------
    // PARTÍCULAS AMBIENTES por herói (mesma receita das brasas/motas da Feiticeira): duas camadas
    // pequenas, presas à tela e atrás dos obstáculos — uma "principal" do tema e uma de motas lentas.
    // Derivam um pouco para a esquerda (o mundo passando). Desligadas com "reduzir movimento".
    // ---------------------------------------------------------------
    AMBIENTES: {
        'Homem-Aranha': [   // luzes da cidade subindo (vermelho/azul) + poeira de luz branca
            { tint: [0xff3b55, 0x5a8aff, 0xffffff], blendMode: 'ADD', frequency: 170, lifespan: 4200, scale: { start: 0.35, end: 0 }, alpha: { start: 0.55, end: 0 }, speedY: { min: -26, max: -8 }, speedX: { min: -24, max: -6 } },
            { tint: [0xcfe0ff], blendMode: 'ADD', frequency: 420, lifespan: 6500, scale: { start: 0.2, end: 0.45 }, alpha: { start: 0, end: 0.3, ease: 'Sine.InOut' }, speedY: { min: -6, max: 4 }, speedX: { min: -14, max: -4 } }
        ],
        'Hulk': [           // brasas de radiação gama subindo + poeira cinza carregada pelo vento
            { tint: [0x6fdc4a, 0xb8ff7a, 0x2aff6a], blendMode: 'ADD', frequency: 120, lifespan: 3800, scale: { start: 0.45, end: 0 }, alpha: { start: 0.7, end: 0 }, speedY: { min: -40, max: -12 }, speedX: { min: -20, max: 6 } },
            { tint: [0x8a9188, 0x5c625a], frequency: 260, lifespan: 6000, scale: { start: 0.6, end: 1.1 }, alpha: { start: 0, end: 0.22, ease: 'Sine.InOut' }, speedY: { min: -4, max: 6 }, speedX: { min: -40, max: -16 } }
        ],
        'Gaviao': [         // faíscas roxas e verde-limão (mira/tática) + motas lilás lentas
            { tint: [0xb8ff5a, 0x8c5cff, 0xe2d6ff], blendMode: 'ADD', frequency: 190, lifespan: 4200, scale: { start: 0.35, end: 0 }, alpha: { start: 0.6, end: 0 }, speedY: { min: -22, max: -6 }, speedX: { min: -30, max: -10 } },
            { tint: [0xcbb8ff], blendMode: 'ADD', frequency: 420, lifespan: 6500, scale: { start: 0.2, end: 0.5 }, alpha: { start: 0, end: 0.28, ease: 'Sine.InOut' }, speedY: { min: -5, max: 5 }, speedX: { min: -16, max: -4 } }
        ],
        'Homem de Ferro': [ // faíscas douradas do repulsor + partículas de dados ciano subindo
            { tint: [0xffc23d, 0xff7b00, 0xffe8a8], blendMode: 'ADD', frequency: 170, lifespan: 3200, scale: { start: 0.4, end: 0 }, alpha: { start: 0.65, end: 0 }, speedY: { min: -30, max: -10 }, speedX: { min: -26, max: -6 } },
            { tint: [0x5ce1ff, 0x2ad0ff], blendMode: 'ADD', frequency: 300, lifespan: 5200, scale: { start: 0.25, end: 0.1 }, alpha: { start: 0, end: 0.4, ease: 'Sine.InOut' }, speedY: { min: -18, max: -6 }, speedX: { min: -10, max: 0 } }
        ],
        'DrEstranho': [     // faíscas douradas dos feitiços subindo + motas lilases (energia mística)
            { tint: [0xffa53d, 0xffd166, 0xfff2b0], blendMode: 'ADD', frequency: 130, lifespan: 4000, scale: { start: 0.4, end: 0 }, alpha: { start: 0.7, end: 0 }, speedY: { min: -32, max: -10 }, speedX: { min: -18, max: 8 } },
            { tint: [0xb08cff, 0xe2d6ff], blendMode: 'ADD', frequency: 360, lifespan: 6500, scale: { start: 0.25, end: 0.6 }, alpha: { start: 0, end: 0.35, ease: 'Sine.InOut' }, speedY: { min: -8, max: 4 }, speedX: { min: -12, max: 4 } }
        ]
        // Feiticeira Escarlate: brasas e motas próprias em wanda() (a referência deste estilo)
    },

    ambiente(fase) {
        const lista = this.AMBIENTES[fase.heroi];
        if (!lista || reducedMotion.matches) return;
        const est = fase.estadoCenario || (fase.estadoCenario = {});
        est.ambiente = lista.map((cfg, i) => this.particulas(fase, cfg, i === 0 ? -89 : -91));
    },

    // ---------------------------------------------------------------
    // CHÃO: um MATERIAL por herói, todos na mesma linguagem (textura + borda de cima + linha neon do
    // tema onde se pisa). A textura é gerada uma vez (256×140) e repetida alinhada ao mundo.
    // ---------------------------------------------------------------
    texturaChao(cena, heroi) {
        const chave = 'chao-' + heroi;
        if (cena.textures.exists(chave)) return chave;
        const W = 256, H = 140, g = cena.make.graphics({ add: false }), rnd = new Phaser.Math.RandomDataGenerator(['chao-' + heroi]);
        const base = (cor) => { g.fillStyle(cor, 1).fillRect(0, 0, W, H); };
        switch (heroi) {
            case 'Homem-Aranha': {   // fachada de tijolos escuros (as janelas da fase vão por cima)
                base(0x1c2350);
                for (let y = 0, l = 0; y < H; y += 10, l++) {
                    g.fillStyle(0x141a3e, 1).fillRect(0, y, W, 1.5);
                    for (let x = (l % 2) * 16; x < W; x += 32) g.fillRect(x, y, 1.5, 10);
                }
                break;
            }
            case 'Hulk': {           // lajes de concreto rachado, rachaduras com brilho gama
                base(0x2c302b);
                for (let i = 0; i < 260; i++) { g.fillStyle(rnd.pick([0x232722, 0x363b34, 0x1d201c]), 0.8).fillRect(rnd.between(0, W), rnd.between(0, H), rnd.between(2, 5), rnd.between(2, 4)); }
                g.fillStyle(0x1a1d19, 1); for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 2, H);
                for (let k = 0; k < 4; k++) {
                    let x = rnd.between(10, W - 10), y = 0; const pts = [{ x, y }];
                    while (y < H) { x += rnd.between(-10, 10); y += rnd.between(10, 22); pts.push({ x, y }); }
                    g.lineStyle(3, 0x6fdc4a, 0.16).strokePoints(pts); g.lineStyle(1.2, 0x9dff5a, 0.55).strokePoints(pts);
                }
                break;
            }
            case 'Gaviao': {         // chapas de aço do telhado tático, com rebites
                base(0x1e1636);
                g.fillStyle(0x140e26, 1);
                for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 2, H);
                for (let y = 0; y < H; y += 35) g.fillRect(0, y, W, 2);
                g.fillStyle(0x5a4a88, 0.9);
                for (let x = 0; x < W; x += 64) for (let y = 0; y < H; y += 35) { g.fillCircle(x + 7, y + 7, 1.6); g.fillCircle(x + 57, y + 7, 1.6); }
                break;
            }
            case 'Homem de Ferro': { // painéis tecnológicos com frisos ciano e detalhes dourados
                base(0x0f1626);
                g.fillStyle(0x0a0f1a, 1);
                for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 2, H);
                for (let y = 0; y < H; y += 32) g.fillRect(0, y, W, 2);
                g.fillStyle(0x2ad0ff, 0.35); for (let x = 0; x < W; x += 64) g.fillRect(x + 10, 14, 30, 1.5);
                g.fillStyle(0xffc23d, 0.45); for (let x = 32; x < W; x += 128) g.fillRect(x, 48, 10, 3);
                break;
            }
            case 'DrEstranho': {     // pedra escura do santuário com runas douradas incrustadas
                base(0x1b1532);
                g.fillStyle(0x120e24, 1);
                for (let y = 0, l = 0; y < H; y += 40, l++) { g.fillRect(0, y, W, 2); for (let x = (l % 2) * 32; x < W; x += 64) g.fillRect(x, y, 2, 40); }
                g.lineStyle(1.2, 0xffa53d, 0.32);
                for (let x = 32; x < W; x += 128) { g.strokeCircle(x, 22, 7); g.lineBetween(x - 4, 22, x + 4, 22); }
                break;
            }
            case 'Wanda': {          // terra escura com raízes e veios de magia escarlate
                base(0x1a0509);
                for (let k = 0; k < 7; k++) {
                    const y0 = rnd.between(10, H - 10), pts = [];
                    for (let x = -10; x <= W + 10; x += 16) pts.push({ x, y: y0 + Math.sin(x / 30 + k) * 6 + rnd.between(-2, 2) });
                    g.lineStyle(rnd.between(3, 6), 0x0a0103, 1).strokePoints(pts);
                    if (k % 2 === 0) g.lineStyle(1, 0xff2a3d, 0.35).strokePoints(pts.map((p) => ({ x: p.x, y: p.y - 2 })));
                }
                break;
            }
            default: base(0x101830);
        }
        g.generateTexture(chave, W, H); g.destroy();
        return chave;
    },

    // ---------------------------------------------------------------
    // FUNDO EM IMAGEM (CENARIOS_IMAGEM em config.js; carregado no preload da GameScene)
    // ---------------------------------------------------------------
    // Chave da textura carregada e da textura dupla espelhada
    chaveFundo(heroi) { return 'cena-' + heroi; },

    // Põe a arte da fase atrás de tudo e esconde as camadas procedurais "de estrutura" (céu, silhuetas,
    // prédios) que brigariam com ela. Partículas, névoa, luzes animadas e reações continuam por cima.
    // Vídeo de fundo (VIDEOS_FUNDO): cobre a tela toda e é sincronizado com o progresso em sincronizarVideo()
    fundoVideo(fase) {
        const cena = fase.cena, chave = 'video-' + fase.heroi;
        if (!cena.cache.video.exists(chave)) return null;
        const def = (typeof CENARIOS_IMAGEM !== 'undefined' && CENARIOS_IMAGEM[fase.heroi]) || {};
        const v = cena.add.video(0, 0, chave).setOrigin(0, 0).setScrollFactor(0).setDepth(-98.5)
            .setTint(def.tom || 0xffffff);
        v.setMute(true);
        // Ajusta pra cobrir a tela (1280x720) assim que o tamanho do vídeo é conhecido
        const ajustar = () => { if (v.width) { const k = Math.max(1280 / v.width, 720 / v.height); v.setScale(k); v.setPosition((1280 - v.width * k) / 2, (720 - v.height * k) / 2); } };
        ajustar(); v.on('created', ajustar);
        v.fundoVideo = true; fase.fundoVideo = v;
        const est = fase.estadoCenario || {};
        (fase.camadas || []).forEach((c) => { if (c.estrutural) c.setVisible(false); });
        (est.estruturais || []).forEach((o) => o.setVisible(false));
        (est.ceus || []).forEach((o) => o.setVisible(false));
        if (fase.mandala) fase.mandala.setVisible(false);
        est.fundo = v; fase.fundoArte = v;
        return v;
    },

    // SEQUÊNCIA DE CENÁRIOS: as imagens ficam lado a lado (cada uma cobre a tela 1280x720) e a fila inteira
    // é percorrida entre o começo e o fim da câmera. Cada imagem, menos a primeira, tem a borda esquerda
    // esmaecida (textura montada uma vez) e entra por cima da anterior: a emenda vira uma fusão suave.
    fundoSequencia(fase, def) {
        const cena = fase.cena, base = this.chaveFundo(fase.heroi), SOBRE = 400;   // largura da fusão entre imagens
        const chaves = def.sequencia.map((_, i) => base + '-' + i).filter((k) => cena.textures.exists(k));
        if (!chaves.length) return null;
        const imgs = chaves.map((k, i) => {
            let chave = k;
            if (i > 0) {
                chave = k + '-fusao';
                if (!cena.textures.exists(chave)) {
                    const src = cena.textures.get(k).getSourceImage();
                    const tx = cena.textures.createCanvas(chave, 1280, 720), ctx = tx.getContext();
                    ctx.drawImage(src, 0, 0, 1280, 720);
                    const g = ctx.createLinearGradient(0, 0, SOBRE, 0);
                    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = g; ctx.fillRect(0, 0, SOBRE, 720);
                    tx.refresh();
                }
            }
            return cena.add.image(0, 0, chave).setOrigin(0, 0).setDisplaySize(1280, 720).setScrollFactor(0)
                .setDepth(-98.6 + i * 0.001).setTint(def.tom || 0xffffff);
        });
        const largura = imgs.length * 1280 - (imgs.length - 1) * SOBRE;
        // Percurso: do jogador na largada (x = 0) até a chegada; antes (abertura) fica a 1ª imagem e na
        // chegada aparece a última inteira. Usa o x do jogador (não o scrollX) porque cada fase enquadra a câmera
        // de um jeito (o Aranha, por exemplo, afasta o zoom); a câmera segue o jogador sem atraso, então dá igual.
        fase.fundoSeq = { imgs, passo: 1280 - SOBRE, max: largura - 1280 };
        const est = fase.estadoCenario || {};
        (fase.camadas || []).forEach((c) => { if (c.estrutural) c.setVisible(false); });
        (est.estruturais || []).forEach((o) => o.setVisible(false));
        (est.ceus || []).forEach((o) => o.setVisible(false));
        if (fase.mandala) fase.mandala.setVisible(false);
        est.fundo = imgs[0]; fase.fundoArte = imgs[0];
        this.moverSequencia(fase);
        return imgs[0];
    },

    // Chamado a cada quadro (moverParalaxe): posiciona as imagens e só deixa visíveis as que estão na tela
    moverSequencia(fase) {
        const s = fase.fundoSeq; if (!s) return;
        const desl = Math.max(0, Math.min(1, fase.player ? fase.player.x / fase.cfg.comprimento : 0)) * s.max;
        s.imgs.forEach((img, i) => { const x = i * s.passo - desl; img.x = x; img.setVisible(x < 1280 && x > -1280); });
    },

    // Textura [imagem | imagem espelhada], montada uma vez: repete sem emenda em qualquer imagem
    texturaEspelhada(cena, chave) {
        const dupla = chave + '-dupla';
        if (!cena.textures.exists(dupla)) {
            const src = cena.textures.get(chave).getSourceImage(), w = src.width, h = src.height;
            const tx = cena.textures.createCanvas(dupla, w * 2, h), ctx = tx.getContext();
            ctx.drawImage(src, 0, 0);
            ctx.save(); ctx.translate(w * 2, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0); ctx.restore();
            tx.refresh();
        }
        return dupla;
    },

    // CAMADAS EM PARALLAX (arte já separada em planos): cada uma cobre a tela e anda numa fração da câmera
    // (rolagem linear, presa ao movimento do herói); as do fundo quase param, as da frente andam um pouco mais
    fundoCamadas(fase, def) {
        const cena = fase.cena, base = this.chaveFundo(fase.heroi), reduz = reducedMotion.matches ? 0.35 : 1;
        const tiles = [];
        def.camadas.forEach((c, i) => {
            const k = base + '-c' + i;
            if (!cena.textures.exists(k)) return;
            const dupla = this.texturaEspelhada(cena, k), h = cena.textures.get(dupla).getSourceImage().height, esc = 720 / h;
            const t = cena.add.tileSprite(0, 0, 1280, 720, dupla).setOrigin(0, 0).setScrollFactor(0)
                .setDepth(-98.9 + i * 0.05).setTileScale(esc, esc).setTint(def.tom || 0xffffff);
            t.fatorParalaxe = c.fator / esc * reduz; t.tingir = false; t.estrutural = false; t.fundoImagem = true;
            if (c.deriva && !reducedMotion.matches) t.deriva = c.deriva / esc;
            // respira: opacidade sobe e desce devagar (senoide de ~6 s), sem piscar
            if (c.respira) this.animar(fase, (dt, agora) => t.setAlpha(0.7 + 0.3 * Math.sin(agora / 950 + i)));
            (fase.camadas = fase.camadas || []).push(t); tiles.push(t);
        });
        if (!tiles.length) return null;
        const est = fase.estadoCenario || {};
        (fase.camadas || []).forEach((c) => { if (c.estrutural) c.setVisible(false); });
        (est.estruturais || []).forEach((o) => o.setVisible(false));
        (est.ceus || []).forEach((o) => o.setVisible(false));
        est.fundo = tiles[0]; fase.fundoArte = tiles[0]; fase.fundoCamadas = tiles;
        if (fase.mandala) fase.mandala.setVisible(false);
        fase.moverParalaxe();
        return tiles[0];
    },

    fundoImagem(fase) {
        if (this.fundoVideo(fase)) return fase.fundoVideo;
        const def = (typeof CENARIOS_IMAGEM !== 'undefined') && CENARIOS_IMAGEM[fase.heroi];
        if (def && def.camadas) return this.fundoCamadas(fase, def);
        if (def && def.sequencia) return this.fundoSequencia(fase, def);
        const cena = fase.cena, chave = this.chaveFundo(fase.heroi);
        if (!def || !cena.textures.exists(chave)) return null;   // sem imagem: fica o procedural
        // Textura dupla [imagem | imagem espelhada], montada UMA vez: repete sem emenda visível
        // espelhar: false = a imagem já repete sem emenda (panorama preparado), usa direto
        const dupla = def.espelhar === false ? chave : chave + '-dupla';
        if (!cena.textures.exists(dupla)) {
            const src = cena.textures.get(chave).getSourceImage();
            // Respeita o limite de textura da GPU (celulares costumam aceitar só 4096 px): reduz se precisar
            const max = (cena.renderer && cena.renderer.getMaxTextureSize && cena.renderer.getMaxTextureSize()) || 4096;
            const k = Math.min(1, Math.min(4096, max) / (src.width * 2)), w = Math.floor(src.width * k), h = Math.floor(src.height * k);
            const tx = cena.textures.createCanvas(dupla, w * 2, h), ctx = tx.getContext();
            ctx.drawImage(src, 0, 0, w, h);
            ctx.save(); ctx.translate(w * 2, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0, w, h); ctx.restore();
            tx.refresh();
        }
        const h = cena.textures.get(dupla).getSourceImage().height, escala = def.alto / h;
        const fundo = cena.add.tileSprite(0, def.y, 1280, def.alto, dupla).setOrigin(0, 0).setScrollFactor(0)
            .setDepth(-98.5).setTileScale(escala, escala).setTint(def.tom || 0xffffff);
        // tilePosition é em pixels da textura; com "reduzir movimento" o fundo anda bem menos
        fundo.fatorParalaxe = def.fator / escala * (reducedMotion.matches ? 0.35 : 1);
        fundo.tingir = false; fundo.estrutural = false; fundo.fundoImagem = true;
        (fase.camadas = fase.camadas || []).push(fundo);
        // Esconde a estrutura procedural (marcada em ceu()/camada() ou pela fase em est.estruturais)
        const est = fase.estadoCenario || {};
        (fase.camadas || []).forEach((c) => { if (c.estrutural) c.setVisible(false); });
        (est.estruturais || []).forEach((o) => o.setVisible(false));
        (est.ceus || []).forEach((o) => o.setVisible(false));
        if (fase.mandala) fase.mandala.setVisible(false);
        est.fundo = fundo; fase.fundoArte = fundo;
        fase.moverParalaxe();
        return fundo;
    },

    // ---------------------------------------------------------------
    // HOMEM-ARANHA — cidade à noite: céu com lua, skyline em camadas, caixas d'água,
    // antenas piscando, holofotes varrendo o céu e janelas acendendo
    // ---------------------------------------------------------------
    aranha(fase) {
        this.preparar(fase);
        if (this.temSequencia(fase)) return;   // arte em sequência: sem cenário procedural por cima
        const cena = fase.cena;
        // Céu noturno: azul profundo → horizonte com brilho da cidade
        this.ceu(fase, 'cen-aranha-ceu', [0x040822, 0x0b1d5c, 0x2b3f9e], (g, w, h) => {
            this.estrelas(g, w, h, 'aranha-estrelas', 140, 0xcfe0ff, 0.55);
            // Brilho da cidade no horizonte (faixas largas e transparentes)
            for (let i = 0; i < 6; i++) { g.fillStyle(0x6a7dff, 0.035); g.fillRect(0, h - 60 - i * 30, w, 60 + i * 30); }
            // Lua cheia com crateras e halo
            g.fillStyle(0xdfe8ff, 0.08); g.fillCircle(1010, 120, 92);
            g.fillStyle(0xdfe8ff, 0.12); g.fillCircle(1010, 120, 70);
            g.fillStyle(0xeef3ff, 1); g.fillCircle(1010, 120, 50);
            g.fillStyle(0xc8d3f0, 1); g.fillCircle(992, 108, 9); g.fillCircle(1024, 134, 12); g.fillCircle(1028, 102, 5);
        });
        // Nuvens finas passando devagar (camada própria que anda sozinha)
        const nuvens = this.camada(fase, 0.02, -98, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['aranha-nuvens']);
            for (let i = 0; i < 9; i++) { g.fillStyle(0xaabfff, 0.06); g.fillEllipse(rnd.between(0, L), rnd.between(140, 330), rnd.between(260, 520), rnd.between(24, 44)); }
        });
        this.animar(fase, (dt) => { nuvens.tilePositionX += dt * 0.006; });
        // Skyline distante: torres em degraus com pináculos e janelinhas
        this.camada(fase, 0.05, -96, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['aranha-longe']);
            for (let x = 0; x < L - 60; x += rnd.between(40, 90)) {
                const w = rnd.between(40, 80), h = rnd.between(160, 360), y = 660 - h;
                g.fillStyle(0x0c1a52, 1); g.fillRect(x, y, w, h);
                // Recuos no topo (art déco) e pináculo
                if (rnd.frac() > 0.5) { g.fillRect(x + w * 0.2, y - 30, w * 0.6, 30); g.fillRect(x + w * 0.35, y - 55, w * 0.3, 25); g.fillRect(x + w * 0.48, y - 95, 3, 40); }
                g.fillStyle(0x8fb0ff, 0.35);
                for (let jy = y + 10; jy < 640; jy += 14) for (let jx = x + 5; jx < x + w - 5; jx += 9) if (rnd.frac() > 0.78) g.fillRect(jx, jy, 3, 4);
            }
        });
        // Prédios do meio com janelas acesas, caixas d'água e letreiros
        this.camada(fase, 0.15, -92, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['aranha-meio']);
            for (let x = 0; x < L - 120; x += rnd.between(110, 190)) {
                const w = rnd.between(90, 140), h = rnd.between(170, 300), y = 660 - h;
                g.fillStyle(0x0a1648, 1); g.fillRect(x, y, w, h);
                g.lineStyle(2, 0x2a4ab8, 0.5); g.lineBetween(x, y, x + w, y);
                // Janelas (algumas acesas em amarelo, outras em azul de TV)
                for (let jy = y + 16; jy < 640; jy += 22) for (let jx = x + 10; jx < x + w - 14; jx += 18) {
                    const r = rnd.frac();
                    g.fillStyle(r > 0.82 ? 0xffd98a : r > 0.7 ? 0x7fd0ff : 0x08113a, r > 0.7 ? 0.7 : 1); g.fillRect(jx, jy, 9, 12);
                }
                // Caixa d'água: tanque com tampa arredondada e pernas
                if (rnd.frac() > 0.45) {
                    const cx = x + rnd.between(20, w - 40);
                    g.fillStyle(0x070f33, 1); g.fillRect(cx, y - 42, 26, 28); g.fillEllipse(cx + 13, y - 42, 30, 12);
                    g.lineStyle(3, 0x070f33, 1); g.lineBetween(cx + 3, y - 14, cx, y); g.lineBetween(cx + 23, y - 14, cx + 26, y);
                }
                // Letreiro de cobertura
                if (rnd.frac() > 0.75) { g.fillStyle(0x070f33, 1); g.fillRect(x + 10, y - 34, w - 20, 26); g.lineStyle(2, 0xff3b55, 0.45); g.strokeRect(x + 14, y - 30, w - 28, 18); }
            }
        });
        // Telhados perto: escadas de incêndio, aparelhos de ar e parapeitos
        this.camada(fase, 0.38, -84, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['aranha-perto']);
            for (let x = 0; x < L - 200; x += rnd.between(220, 360)) {
                const w = rnd.between(160, 240), h = rnd.between(80, 150), y = 660 - h;
                g.fillStyle(0x060d2c, 1); g.fillRect(x, y, w, h);
                g.fillStyle(0x0d1b55, 1); g.fillRect(x - 4, y - 6, w + 8, 6);
                // Ar-condicionado
                g.fillStyle(0x0d1b55, 1); g.fillRect(x + 20, y - 22, 34, 16); g.lineStyle(1, 0x2a4ab8, 0.5); g.strokeCircle(x + 37, y - 14, 6);
                // Escada de incêndio em zigue-zague (linhas)
                g.lineStyle(2, 0x1d2f80, 0.8);
                for (let k = 0; k < 3; k++) { const yy = y + 20 + k * 30; g.lineBetween(x + w - 50, yy, x + w - 10, yy); g.lineBetween(x + w - 50, yy, x + w - 10, yy + 30); }
            }
        });
        // Holofotes varrendo o céu (feixes largos e transparentes saindo do horizonte)
        const holofotes = [0, 1].map((i) => {
            const g = cena.add.graphics().setScrollFactor(0).setDepth(-97);
            g.fillStyle(0xbfd4ff, 0.05).fillRect(-14, -620, 28, 620);
            g.fillStyle(0xbfd4ff, 0.04).fillRect(-30, -620, 60, 620);
            g.y = 660; g.baseX = i * 700 + 250; g.fase0 = i * 2;
            return g;
        });
        this.reciclar(fase, holofotes, 0.06, 1400, 100);
        this.animar(fase, (dt, agora) => holofotes.forEach((h) => { h.rotation = Math.sin(agora / 2600 + h.fase0) * 0.5; }));
        // Antenas com luz vermelha piscando
        const antenas = [0, 1, 2, 3].map((i) => {
            const g = cena.add.graphics().setScrollFactor(0).setDepth(-93);
            const alto = 120 + (i % 2) * 60;
            g.lineStyle(2, 0x0a1648, 1).lineBetween(0, 0, 0, alto);
            g.lineStyle(1, 0x0a1648, 1).lineBetween(-8, alto * 0.5, 0, alto * 0.3).lineBetween(8, alto * 0.5, 0, alto * 0.3);
            g.y = 660 - 230 - alto; g.luz = cena.add.circle(0, g.y, 4, 0xff3b55).setScrollFactor(0).setDepth(-93);
            g.baseX = i * 380 + 120; g.fase0 = i * 0.7;
            return g;
        });
        this.reciclar(fase, antenas, 0.15, 1520, 60);
        this.animar(fase, (dt, agora) => antenas.forEach((a) => { a.luz.x = a.x; a.luz.setAlpha(Math.sin(agora / 380 + a.fase0 * 4) > 0.3 ? 1 : 0.15); }));
        // Janelas que acendem e apagam (grupinhos na camada do meio)
        const janelas = [0, 1, 2, 3, 4, 5].map((i) => {
            const r = cena.add.rectangle(0, 360 + (i % 3) * 70, 9, 12, 0xffd98a, 0).setScrollFactor(0).setDepth(-91);
            r.baseX = i * 300 + 60; r.fase0 = i * 1.3; return r;
        });
        this.reciclar(fase, janelas, 0.15, 1800, 60);
        this.animar(fase, (dt, agora) => janelas.forEach((j) => j.setAlpha(Math.sin(agora / 1700 + j.fase0) > 0.2 ? 0.8 : 0)));
    },

    // ---------------------------------------------------------------
    // HOMEM DE FERRO — metrópole futurista de alta tecnologia à noite: arranha-céus de metal,
    // veios de energia azul, frisos dourados, balizas piscando e tráfego aéreo em pontinhos
    // ---------------------------------------------------------------
    ferro(fase) {
        // Rodada 8: METRÓPOLE FUTURISTA à noite — céu azul-noite, arranha-céus de metal (cinza, vermelho metálico
        // e dourado), linhas de energia azul na arquitetura, luzes amarelas e tráfego aéreo em pontinhos.
        // Sem lasers nem faixas que pareçam obstáculo, sem logos. Bem diferente da cidade do Aranha (prédios
        // de tijolo e janelas) e do porto do Gavião.
        this.preparar(fase);
        if (this.temSequencia(fase)) return;   // arte em sequência: sem cenário procedural por cima
        const cena = fase.cena, est = fase.estadoCenario;
        this.ceu(fase, 'cen-ferro-ceu2', [0x020409, 0x0a1428, 0x2a1c26], (g, w, h) => {
            this.estrelas(g, w, h, 'ferro-estrelas', 40, 0xcfe0ff, 0.35);
            // Brilho dourado e vermelho da cidade no horizonte
            for (let i = 0; i < 8; i++) { g.fillStyle(i < 4 ? 0xffb347 : 0xff3a2a, 0.025); g.fillRect(0, h - 30 - i * 22, w, 30 + i * 22); }
            // Nuvens finas iluminadas por baixo
            const rnd = new Phaser.Math.RandomDataGenerator(['ferro-nuvens']);
            for (let i = 0; i < 8; i++) { g.fillStyle(0x6a7aa0, 0.06); g.fillEllipse(rnd.between(0, w), rnd.between(90, 300), rnd.between(260, 520), rnd.between(10, 22)); }
        });
        // Skyline distante: torres afuniladas com coroas e antenas (cinza-azulado), luzinhas douradas
        this.camada(fase, 0.08, -96, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['ferro-longe2']);
            for (let x = 0; x < L - 60; x += rnd.between(44, 90)) {
                const w = rnd.between(28, 56), h = rnd.between(180, 400), y = 660 - h, af = rnd.between(4, 12);
                g.fillStyle(0x121a2a, 1); g.fillPoints([{ x, y: 660 }, { x: x + w, y: 660 }, { x: x + w - af, y }, { x: x + af, y }], true);
                if (rnd.frac() > 0.5) g.fillRect(x + w / 2 - 1, y - rnd.between(20, 50), 2, 50);
                g.lineStyle(1, 0x3a6aff, 0.18); g.lineBetween(x + w / 2, y + 6, x + w / 2, 660);
                g.fillStyle(0xffd84a, 0.25); for (let k = 0; k < 4; k++) g.fillRect(x + rnd.between(6, w - 8), y + rnd.between(20, h - 20), 2, 2);
            }
        });
        // Torres médias (desenho reaproveitado pra camada de energia, mesma semente)
        const torresMedias = (g, L, soEnergia) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['ferro-meio2']);
            let anterior = null;
            for (let x = 20; x < L - 160; x += rnd.between(200, 300)) {
                const w = rnd.between(70, 110), h = rnd.between(260, 430), y = 660 - h, chanfro = rnd.between(14, 30), vermelha = rnd.frac() > 0.5;
                const corpo = [{ x, y: 660 }, { x: x + w, y: 660 }, { x: x + w, y: y + chanfro }, { x: x + w - chanfro, y }, { x: x + 10, y }, { x, y: y + 10 }];
                if (!soEnergia) {
                    g.fillStyle(0x1a1f2c, 1); g.fillPoints(corpo, true);
                    // Painel lateral de metal vermelho ou cinza, com friso dourado
                    g.fillStyle(vermelha ? 0x4a0e14 : 0x2a3040, 1); g.fillRect(x + w * 0.62, y + chanfro + 6, w * 0.3, h - chanfro - 6);
                    g.lineStyle(2, 0xd4a43a, 0.45); g.lineBetween(x + w * 0.62, y + chanfro + 6, x + w * 0.62, 660);
                    // Faixas de luz amarela verticais (andares iluminados), não grade de janelas
                    g.fillStyle(0xffd84a, 0.16); g.fillRect(x + 12, y + 24, 4, h - 40); g.fillRect(x + 24, y + 40, 3, h - 60);
                    // Coroa: anel dourado no topo e mastro
                    g.fillStyle(0xd4a43a, 0.5); g.fillRect(x + 10, y + 6, w - chanfro - 10, 3);
                    g.fillStyle(0x2a3040, 1); g.fillRect(x + w / 2 - 2, y - 36, 4, 36);
                }
                // Energia azul: veios correndo pela fachada e pela passarela
                g.lineStyle(soEnergia ? 2 : 1, 0x3a7aff, soEnergia ? 0.7 : 0.3);
                g.lineBetween(x + w * 0.45, y + chanfro, x + w * 0.45, 660);
                g.lineBetween(x + 4, y + h * 0.35, x + w * 0.45, y + h * 0.35);
                if (anterior && rnd.frac() > 0.35) {
                    const py = Math.max(anterior.y, y) + 50;
                    if (!soEnergia) { g.fillStyle(0x161b28, 1); g.fillRect(anterior.x + anterior.w, py, x - anterior.x - anterior.w, 9); }
                    g.lineStyle(soEnergia ? 2 : 1, 0x3a7aff, soEnergia ? 0.6 : 0.3); g.lineBetween(anterior.x + anterior.w, py + 9, x, py + 9);
                }
                anterior = { x, y, w };
            }
        };
        this.camada(fase, 0.22, -92, (g, L) => torresMedias(g, L, false));
        est.energia = this.camada(fase, 0.22, -91.5, (g, L) => torresMedias(g, L, true));
        est.energia.setBlendMode('ADD').setAlpha(0.35);
        // Perto: estruturas de metal baixas (pilares curvos e trilho suspenso com luz azul por baixo)
        this.camada(fase, 0.5, -84, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['ferro-perto2']);
            g.fillStyle(0x0c0f18, 1); g.fillRect(0, 618, L, 8);
            g.fillStyle(0x3a7aff, 0.22); g.fillRect(0, 626, L, 2);
            for (let x = 30; x < L - 60; x += rnd.between(240, 380)) {
                g.fillStyle(0x0c0f18, 1); g.fillPoints([{ x: x - 14, y: 660 }, { x: x + 14, y: 660 }, { x: x + 8, y: 626 }, { x: x - 8, y: 626 }], true);
                g.lineStyle(2, 0xd4a43a, 0.35); g.lineBetween(x - 8, 628, x - 13, 658);
                g.fillStyle(0xffd84a, 0.5); g.fillRect(x - 2, 630, 4, 3);
            }
        });
        // Luzes de topo piscando (vermelho/dourado) e tráfego aéreo em pontinhos lentos
        const balizas = [0, 1, 2, 3, 4, 5].map((i) => {
            const c = cena.add.circle(0, 230 + (i * 47) % 160, 2.5, i % 2 ? 0xff3a2a : 0xffd84a).setScrollFactor(0).setDepth(-91);
            c.baseX = i * 330 + 60; c.fase0 = i * 1.1; return c;
        });
        this.reciclar(fase, balizas, 0.22, 1980, 40);
        est.estruturais = balizas;   // presas às torres procedurais: somem junto quando há arte de fundo
        const trafego = [];
        if (!reducedMotion.matches) for (let i = 0; i < 6; i++) {
            const c = cena.add.circle(Phaser.Math.Between(0, 1280), 180 + i * 38, 1.6, i % 3 ? 0xffe8a8 : 0x8ab4ff, 0.8).setScrollFactor(0).setDepth(-93);
            c.vel = (i % 2 ? -1 : 1) * Phaser.Math.Between(30, 70); trafego.push(c);
        }
        est.poeira = this.particulas(fase, { tint: [0xffd84a, 0x8ab4ff], frequency: 260, scale: { start: 0.3, end: 0 }, alpha: { start: 0.35, end: 0 } }, -89);
        est.brilhoHolo = 0;
        this.animar(fase, (dt, agora) => {
            trafego.forEach((t) => { t.x += t.vel * dt / 1000; if (t.x > 1300) t.x = -20; if (t.x < -20) t.x = 1300; });
            balizas.forEach((b) => b.setAlpha(Math.sin(agora / 400 + b.fase0 * 2) > 0.2 ? 1 : 0.2));
            // Energia "respira" e acende com o repulsor (reação 'repulsor')
            est.brilhoHolo = Math.max(0, est.brilhoHolo - dt / 400);
            est.energia.setAlpha(Math.min(1, 0.3 + 0.1 * Math.sin(agora / 900) + est.brilhoHolo));
        });
    },

    // ---------------------------------------------------------------
    // HULK — cidade em ruínas: névoa gama, prédios tombados com vigas expostas,
    // colunas de fumaça, faíscas e raios verdes no céu
    // ---------------------------------------------------------------
    hulk(fase) {
        this.preparar(fase);
        if (this.temSequencia(fase)) return;   // arte em sequência: sem cenário procedural por cima
        const cena = fase.cena;
        this.ceu(fase, 'cen-hulk-ceu', [0x050d06, 0x163a12, 0x4f8a24], (g, w, h) => {
            // Névoa gama (manchas verdes) e nuvens de fumaça escura
            const rnd = new Phaser.Math.RandomDataGenerator(['hulk-ceu']);
            for (let i = 0; i < 12; i++) { g.fillStyle(0x9dff5a, 0.04); g.fillEllipse(rnd.between(0, w), rnd.between(250, 520), rnd.between(300, 600), rnd.between(60, 140)); }
            for (let i = 0; i < 10; i++) { g.fillStyle(0x020602, 0.3); g.fillEllipse(rnd.between(0, w), rnd.between(40, 220), rnd.between(260, 520), rnd.between(50, 110)); }
        });
        // Skyline quebrado ao longe (prédios com pedaços faltando e alguns inclinados)
        this.camada(fase, 0.06, -96, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['hulk-longe']);
            for (let x = 0; x < L - 80; x += rnd.between(55, 110)) {
                const w = rnd.between(45, 90), h = rnd.between(140, 330), y = 660 - h, t = rnd.between(-12, 12);
                g.fillStyle(0x0c200d, 1);
                g.fillPoints([{ x, y: 660 }, { x: x + w, y: 660 }, { x: x + w + t, y }, { x: x + t, y }], true);
                // Pedaço arrancado do topo (degrau)
                g.fillStyle(0x163a12, 1); if (rnd.frac() > 0.5) g.fillRect(x + t + w * 0.55, y - 1, w * 0.45, rnd.between(20, 50));
            }
        });
        // Prédios destruídos no meio, com vigas expostas e buracos de janela
        this.camada(fase, 0.2, -92, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['hulk-meio']);
            for (let x = 0; x < L - 160; x += rnd.between(170, 280)) {
                const w = rnd.between(90, 150), h = rnd.between(170, 290), y = 660 - h;
                g.fillStyle(0x10260f, 1); g.fillRect(x, y + 30, w, h - 30);
                // Andares de cima destruídos: só a estrutura de vigas
                g.lineStyle(3, 0x1d3f18, 1);
                for (let k = 0; k <= 3; k++) g.lineBetween(x + k * w / 3, y + 30, x + k * w / 3 + rnd.between(-6, 6), y - 10);
                g.lineBetween(x, y + 6, x + w * 0.8, y + 2);
                g.lineStyle(2, 0x1d3f18, 1); g.lineBetween(x, y + 30, x + w / 3, y + 6); g.lineBetween(x + w / 3, y + 30, x + 2 * w / 3, y + 6);
                // Buracos de janela (alguns com brilho verde de dentro)
                for (let jy = y + 46; jy < 640; jy += 30) for (let jx = x + 10; jx < x + w - 18; jx += 24) {
                    const r = rnd.frac(); g.fillStyle(r > 0.9 ? 0x9dff5a : 0x061206, r > 0.9 ? 0.35 : 1); if (r > 0.2) g.fillRect(jx, jy, 12, 16);
                }
            }
        });
        // Entulho perto: montes de concreto, postes tortos e carros amassados
        const rnd = new Phaser.Math.RandomDataGenerator(['hulk']);
        this.camada(fase, 0.55, -84, (c3, L) => {
            for (let x = 30; x < L - 200; x += rnd.between(240, 420)) {
                c3.fillStyle(0x0b1d0a, 1);
                for (let k = 0; k < 5; k++) c3.fillRect(x + k * 18 + rnd.between(-6, 6), 660 - rnd.between(12, 40) + k * 2, rnd.between(26, 44), 50);
            }
            fase.desenharEntulho(c3, L, rnd);
        });
        // Colunas de fumaça subindo de incêndios (partículas recicladas por ponto)
        if (!reducedMotion.matches) {
            const focos = [0, 1, 2].map((i) => {
                const brasa = cena.add.circle(0, 640, 26, 0xff8a2a, 0.12).setScrollFactor(0).setDepth(-91);
                brasa.baseX = i * 560 + 180;
                brasa.fumaca = cena.add.particles(0, 0, 'faisca', {
                    x: 0, y: 630, lifespan: 5200, frequency: 260, speedY: { min: -40, max: -24 }, speedX: { min: -8, max: 14 },
                    scale: { start: 2.4, end: 7 }, alpha: { start: 0.16, end: 0 }, tint: 0x0a140a
                }).setScrollFactor(0).setDepth(-92);
                return brasa;
            });
            this.reciclar(fase, focos, 0.2, 1680, 120);
            this.animar(fase, (dt, agora) => focos.forEach((f) => { f.fumaca.x = f.x; f.setAlpha(0.08 + 0.06 * Math.sin(agora / 140 + f.baseX)); }));
        }
        // Raios gama: de vez em quando um raio verde corta o céu (e na fúria, sempre)
        const raio = cena.add.graphics().setScrollFactor(0).setDepth(-97);
        fase.estadoCenario.proximoRaio = cena.time.now + 2500;
        fase.estadoCenario.disparaRaio = (forte) => {
            raio.clear();
            // Raio fino, curto e nas laterais do céu (longe do centro, onde ficam o título e os obstáculos)
            let x = Phaser.Math.Between(0, 1) ? Phaser.Math.Between(120, 360) : Phaser.Math.Between(920, 1160), y = 105;
            raio.lineStyle(forte ? 3 : 2, 0xb8ff7a, 0.75);
            raio.beginPath(); raio.moveTo(x, y);
            while (y < 250) { x += Phaser.Math.Between(-18, 18); y += Phaser.Math.Between(22, 36); raio.lineTo(x, y); }
            raio.strokePath(); raio.setAlpha(forte ? 0.9 : 0.6);
            cena.tweens.add({ targets: raio, alpha: 0, duration: 380 });
            this.clarao(fase, 0x9dff5a, forte ? 0.14 : 0.07, 300);
        };
        this.animar(fase, (dt, agora) => {
            if (agora > fase.estadoCenario.proximoRaio) { fase.estadoCenario.disparaRaio(false); fase.estadoCenario.proximoRaio = agora + Phaser.Math.Between(3500, 7000); }
            // Fúria liga: raio forte (mesmo sem o aviso do Agente dos poderes)
            const furia = fase.emFuria ? fase.emFuria() : false;
            if (furia && !fase.estadoCenario.furiaVista) Cenarios.reagir(fase, 'furia');
            fase.estadoCenario.furiaVista = furia;
        });
        // Poeira na frente (já existia)
        fase.criarPoeiraAmbiente();
    },

    // ---------------------------------------------------------------
    // GAVIÃO ARQUEIRO — base tática à noite: hangares, torre de controle, radares girando,
    // holofotes varrendo, contêineres, cercas e luzes de pista em sequência
    // ---------------------------------------------------------------
    gaviao(fase) {
        this.preparar(fase);
        if (this.temSequencia(fase)) return;   // arte em sequência: sem cenário procedural por cima
        const cena = fase.cena;
        this.ceu(fase, 'cen-gaviao-ceu', [0x07021a, 0x23094d, 0x5a2a9a], (g, w, h) => {
            this.estrelas(g, w, h, 'gaviao-estrelas', 90, 0xe6d8ff, 0.5);
            for (let i = 0; i < 5; i++) { g.fillStyle(0xb8ff5a, 0.025); g.fillRect(0, h - 40 - i * 24, w, 40 + i * 24); }
        });
        // Hangares (telhado arredondado) e torre de controle ao longe
        this.camada(fase, 0.05, -96, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['gaviao-longe']);
            for (let x = 0; x < L - 300; x += rnd.between(260, 420)) {
                const w = rnd.between(180, 260), h = rnd.between(70, 110), y = 660 - h;
                g.fillStyle(0x16063a, 1); g.fillRect(x, y, w, h); g.fillEllipse(x + w / 2, y, w, 70);
                g.fillStyle(0x0c0326, 1); g.fillRect(x + w * 0.3, y + 20, w * 0.4, h - 20);
                if (rnd.frac() > 0.5) {
                    const tx = x + w + 40;
                    g.fillStyle(0x16063a, 1); g.fillRect(tx, 660 - 260, 26, 260); g.fillRect(tx - 22, 660 - 300, 70, 40);
                    g.fillStyle(0xb8ff5a, 0.5); g.fillRect(tx - 16, 660 - 292, 58, 14);
                }
            }
        });
        // Contêineres empilhados, passarelas e cercas no meio
        this.camada(fase, 0.18, -92, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['gaviao-meio']);
            const cores = [0x2a0f5a, 0x1d2a5a, 0x3a1450];
            for (let x = 0; x < L - 200; x += rnd.between(200, 320)) {
                const pilha = rnd.between(1, 3);
                for (let k = 0; k < pilha; k++) {
                    const cx = x + rnd.between(-10, 10), cy = 660 - (k + 1) * 46, cw = rnd.between(110, 150);
                    g.fillStyle(rnd.pick(cores), 1); g.fillRect(cx, cy, cw, 44);
                    g.lineStyle(1, 0x0c0326, 0.8); for (let r = cx + 8; r < cx + cw; r += 10) g.lineBetween(r, cy + 3, r, cy + 41);
                }
                // Passarela treliçada (linhas cruzadas) e cerca de arame (grade)
                g.lineStyle(2, 0x3a1a6a, 0.9); g.lineBetween(x + 160, 400, x + 300, 400); g.lineBetween(x + 160, 420, x + 300, 420);
                for (let k = 0; k < 7; k++) g.lineBetween(x + 160 + k * 20, 400, x + 180 + k * 20, 420);
                g.lineStyle(1, 0x5a3a9a, 0.35);
                for (let k = 0; k < 10; k++) { g.lineBetween(x + k * 14, 600, x + k * 14 + 30, 660); g.lineBetween(x + k * 14 + 30, 600, x + k * 14, 660); }
            }
        });
        // Barreiras de segurança perto, com listras de alerta e postes de holofote
        this.camada(fase, 0.45, -84, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['gaviao-perto']);
            for (let x = 0; x < L - 200; x += rnd.between(280, 460)) {
                g.fillStyle(0x12052e, 1); g.fillRect(x, 628, 120, 32);
                g.lineStyle(5, 0xb8ff5a, 0.25); for (let k = 0; k < 6; k++) g.lineBetween(x + 6 + k * 20, 656, x + 18 + k * 20, 632);
                g.fillStyle(0x12052e, 1); g.fillRect(x + 170, 470, 6, 190); g.fillRect(x + 158, 466, 30, 10);
                g.fillStyle(0xe6ffb8, 0.6); g.fillRect(x + 162, 476, 22, 4);
            }
        });
        // Holofotes varrendo (verde-limão bem transparente)
        const feixes = [0, 1].map((i) => {
            const g = cena.add.graphics().setScrollFactor(0).setDepth(-97);
            g.fillStyle(0xe6ffb8, 0.05).fillRect(-18, -600, 36, 600);
            g.y = 660; g.baseX = i * 650 + 300; g.fase0 = i * 3;
            return g;
        });
        this.reciclar(fase, feixes, 0.05, 1300, 100);
        this.animar(fase, (dt, agora) => feixes.forEach((f) => { f.rotation = Math.sin(agora / 1900 + f.fase0) * 0.7; }));
        // Radares girando no alto dos prédios do meio
        const radares = [0, 1, 2].map((i) => {
            const base = cena.add.rectangle(0, 660 - 160, 6, 60, 0x2a0f5a).setOrigin(0.5, 0).setScrollFactor(0).setDepth(-91);
            const prato = cena.add.ellipse(0, 660 - 168, 54, 22, 0x3a1a6a).setStrokeStyle(2, 0xb8ff5a, 0.5).setScrollFactor(0).setDepth(-91);
            base.prato = prato; base.baseX = i * 520 + 150; base.fase0 = i;
            return base;
        });
        this.reciclar(fase, radares, 0.18, 1560, 80);
        this.animar(fase, (dt, agora) => radares.forEach((r) => { r.prato.x = r.x; r.prato.scaleX = Math.cos(agora / 700 + r.fase0); }));
        // Luzes de pista acendendo em sequência rente ao chão
        const luzes = [];
        for (let i = 0; i < 16; i++) { const c = cena.add.circle(0, 652, 3, 0xb8ff5a, 0.2).setScrollFactor(0).setDepth(-83); c.baseX = i * 100; c.indice = i; luzes.push(c); }
        this.reciclar(fase, luzes, 0.45, 1600, 40);
        this.animar(fase, (dt, agora) => { const atual = Math.floor(agora / 90) % 16; luzes.forEach((l) => l.setAlpha(l.indice === atual ? 1 : 0.2)); });
    },

    // ---------------------------------------------------------------
    // DOUTOR ESTRANHO (especial) — santuário místico entre dimensões:
    // céu com nebulosas, círculo mágico gigante em dois anéis, arcos e cúpulas flutuantes,
    // estantes arcanas suspensas, portais ao fundo, selos girando e faíscas de energia.
    // Tudo existe em duas versões (Normal e Espelho) e gira conforme o relógio da fase
    // (a Joia do Tempo desacelera e REVERTE o cenário junto).
    // ---------------------------------------------------------------
    estranho(fase) {
        this.preparar(fase);
        if (this.temSequencia(fase)) return;   // arte em sequência: sem cenário procedural por cima
        const cena = fase.cena, est = fase.estadoCenario;
        est.porDim = { N: [], E: [] };
        const paletas = {
            N: { ceu: [0x05061c, 0x16194f, 0x3a2470], neb: [0x7a2ad0, 0x10a08a], pedra: 0x12153e, pedra2: 0x1b1f55, ouro: 0xffa53d, brilho: 0xffd27a, livro: [0xffa53d, 0x2adf9a, 0xa04adf, 0xd03a4a] },
            E: { ceu: [0x0c0214, 0x2a0a3c, 0x521a4e], neb: [0xff4ad2, 0x2ad0ff], pedra: 0x240a34, pedra2: 0x34104a, ouro: 0xff7ad9, brilho: 0xffc2ee, livro: [0xff7ad9, 0x2ad0ff, 0xffd27a, 0x8a4aff] }
        };
        // Cada camada é desenhada "de pé"; no Espelho a mesma arte é virada de cabeça pra baixo
        // (flipY + deslocamento de 40 px = mesma conta do espelharY: y → 760 - y)
        const virar = (tile, dim) => { if (dim === 'E') { tile.setFlipY(true); tile.y = 40; } return tile; };
        ['N', 'E'].forEach((dim) => {
            const p = paletas[dim], marca = (o) => { o.dimensao = dim; est.porDim[dim].push(o); return o; };
            // Céu com nebulosas e estrelas
            marca(this.ceu(fase, `cen-estranho-ceu-${dim}`, p.ceu, (g, w, h) => {
                const rnd = new Phaser.Math.RandomDataGenerator(['nebulosa' + dim]);
                for (let i = 0; i < 16; i++) { g.fillStyle(rnd.pick(p.neb), 0.05); g.fillEllipse(rnd.between(0, w), rnd.between(40, h - 60), rnd.between(260, 620), rnd.between(80, 200)); }
                this.estrelas(g, w, h, 'estranho-estrelas' + dim, 160, 0xfff0d8, 0.95);
            }));
            // Arquitetura flutuante ao longe: arcos com colunas, cúpulas e ilhas de pedra suspensas
            marca(virar(this.camada(fase, 0.05, dim === 'E' ? -95.5 : -96, (g, L) => {
                const rnd = new Phaser.Math.RandomDataGenerator(['santuario' + dim]);
                for (let x = 40; x < L - 260; x += rnd.between(240, 380)) {
                    const base = rnd.between(400, 520), w = rnd.between(120, 180), topo = base - rnd.between(110, 170);
                    // Ilha de pedra com degraus de rocha pendurada embaixo
                    // (rocha afunilada com borda irregular — antes eram degraus que pareciam pixels/quadrados)
                    g.fillStyle(p.pedra, 1); g.fillRect(x - 20, base, w + 40, 18);
                    const rocha = [{ x: x - 20, y: base + 18 }];
                    for (let k = 1; k < 6; k++) { const t = k / 6; rocha.push({ x: x - 20 + (w + 40) * t, y: base + 18 + Math.sin(t * Math.PI) * (40 + rnd.between(-8, 10)) }); }
                    rocha.push({ x: x + w + 20, y: base + 18 });
                    g.fillPoints(rocha, true);
                    // Duas colunas com arco no meio (e um arco dourado por dentro)
                    g.fillRect(x, topo, 18, base - topo); g.fillRect(x + w - 18, topo, 18, base - topo);
                    g.lineStyle(14, p.pedra, 1); g.beginPath(); g.arc(x + w / 2, topo, w / 2 - 9, Math.PI, Math.PI * 2); g.strokePath();
                    g.lineStyle(2, p.ouro, 0.3); g.beginPath(); g.arc(x + w / 2, topo, w / 2 - 18, Math.PI, Math.PI * 2); g.strokePath();
                    // Cúpula com mastro em cima de algumas
                    if (rnd.frac() > 0.5) { g.fillStyle(p.pedra2, 1); g.fillEllipse(x + w / 2, topo - w / 2 + 6, w * 0.7, w * 0.5); g.fillRect(x + w / 2 - 2, topo - w / 2 - 40, 4, 30); }
                    // Janela circular com brilho dourado
                    g.fillStyle(p.ouro, 0.18); g.fillCircle(x + w / 2, topo + 30, 12);
                }
            }), dim));
            // Estantes arcanas suspensas por correntes (livros coloridos) e lanternas
            marca(virar(this.camada(fase, 0.18, dim === 'E' ? -91.5 : -92, (g, L) => {
                const rnd = new Phaser.Math.RandomDataGenerator(['biblioteca' + dim]);
                for (let x = 20; x < L - 220; x += rnd.between(260, 420)) {
                    const y = rnd.between(220, 460), w = rnd.between(110, 160), andares = rnd.between(2, 3);
                    g.lineStyle(2, p.pedra2, 1); g.lineBetween(x + 10, 100, x + 10, y); g.lineBetween(x + w - 10, 100, x + w - 10, y);
                    g.fillStyle(0x1a0f24, 1); g.fillRect(x, y, w, andares * 34 + 6);
                    for (let a = 0; a < andares; a++) {
                        const prat = y + 4 + a * 34;
                        for (let bx = x + 6; bx < x + w - 10;) {
                            const bw = rnd.between(5, 10), bh = rnd.between(20, 28);
                            g.fillStyle(rnd.pick(p.livro), 0.55); g.fillRect(bx, prat + 30 - bh, bw, bh);
                            bx += bw + 1;
                        }
                        g.fillStyle(0x2a1a36, 1); g.fillRect(x, prat + 30, w, 4);
                    }
                    const lx = x + w + 40, ly = rnd.between(180, 300);
                    g.lineStyle(1, p.pedra2, 1); g.lineBetween(lx, 100, lx, ly);
                    g.fillStyle(p.brilho, 0.12); g.fillCircle(lx, ly + 10, 22); g.fillStyle(p.ouro, 0.7); g.fillRect(lx - 6, ly, 12, 18);
                }
            }), dim));
            // Escadas impossíveis perto (identidade da fase), com leve ondulação dimensional
            const escadas = marca(virar(this.camada(fase, 0.36, dim === 'E' ? -83.5 : -84, (g, L) => {
                const rnd = new Phaser.Math.RandomDataGenerator(['escadas' + dim]);
                for (let x = 40; x < L - 220; x += rnd.between(280, 440)) {
                    // Escada contínua (perfil de degraus + viga por baixo), não blocos soltos
                    const perfil = [{ x, y: 612 }];
                    for (let d = 0; d < 7; d++) { perfil.push({ x: x + d * 22, y: 600 - d * 28 }); perfil.push({ x: x + d * 22 + 22, y: 600 - d * 28 }); }
                    perfil.push({ x: x + 154, y: 600 - 6 * 28 + 14 }); perfil.push({ x: x + 10, y: 624 });
                    g.fillStyle(p.pedra2, 0.85); g.fillPoints(perfil, true);
                    g.lineStyle(2, p.ouro, 0.22); g.lineBetween(x + 170, 330, x + 250, 290);
                }
            }), dim));
            escadas.distorce = true; escadas.yBase = escadas.y;
        });
        // Círculo mágico gigante (desenho da fase em this.mandala) + anel externo girando ao contrário
        est.anelExterno = cena.add.graphics().setScrollFactor(0).setDepth(-94.5).setPosition(820, 380);
        est.anelInterno = cena.add.graphics().setScrollFactor(0).setDepth(-94.4).setPosition(820, 380);
        this.desenharCirculoMagico(fase, paletas.N.ouro);
        // Portais ao fundo: anéis de faíscas girando com interior escuro
        const portais = [0, 1, 2].map((i) => {
            const g = cena.add.graphics().setScrollFactor(0).setDepth(-93);
            g.y = 220 + (i % 2) * 140; g.raio = 46 + (i % 3) * 14; g.baseX = i * 640 + 300; g.fase0 = i;
            return g;
        });
        est.portaisFundo = portais;
        // Com arte de fundo (que já tem portais e arcos), o círculo mágico e os portais procedurais somem
        est.estruturais = [est.anelExterno, est.anelInterno].concat(portais);
        this.reciclar(fase, portais, 0.1, 1920, 150);
        // Selos arcanos flutuando (círculos com quadrados girados e pontos)
        const selos = [0, 1, 2, 3, 4, 5].map((i) => {
            const g = cena.add.graphics().setScrollFactor(0).setDepth(-90);
            g.y0 = 180 + (i * 67) % 380; g.baseX = i * 320 + 80; g.fase0 = i * 1.7; g.tam = 14 + (i % 3) * 6;
            return g;
        });
        est.selos = selos;
        this.reciclar(fase, selos, 0.3, 1920, 60);
        this.desenharPortaisESelos(fase, paletas.N);
        // Faíscas de energia subindo (douradas, laranja e esmeralda), bem pequenas
        est.faiscas = this.particulas(fase, { tint: [0xffa53d, 0xffd27a, 0x2adf9a], frequency: 120, speedY: { min: -26, max: -8 }, speedX: { min: -6, max: 6 } }, -89);
        // Animação: tudo gira pelo relógio da fase (Joia desacelera e reverte junto)
        est.giro = 0;
        this.animar(fase, (dt, agora) => {
            const f = fase.fatorTempo === undefined ? 1 : fase.fatorTempo;
            est.giro += dt / 1000 * f;
            est.anelExterno.rotation = -est.giro * 0.08;
            est.anelInterno.rotation = est.giro * 0.14;
            portais.forEach((p) => { p.rotation = est.giro * (0.6 + p.fase0 * 0.15) * (p.fase0 % 2 ? -1 : 1); });
            selos.forEach((s) => { s.rotation = est.giro * 0.5 + s.fase0; s.y = s.y0 + Math.sin(est.giro * 0.9 + s.fase0) * 10; });
            // Distorção sutil (ondulação) nas camadas marcadas
            (fase.camadas || []).forEach((c) => { if (c.distorce) c.y = c.yBase + Math.sin(est.giro * 1.3) * 3; });
            // Faíscas acompanham o tempo (devagar com a Joia, descem quando o tempo reverte)
            if (est.faiscas) est.faiscas.timeScale = Math.max(0.15, Math.abs(f));
            // Detecta a Joia pelo estado real da fase (funciona mesmo sem o aviso explícito)
            const joia = !!fase.joiaAtiva, rev = !!fase.revertendo;
            if (joia && !est.joiaVista) Cenarios.reagir(fase, 'joiaInicio');
            if (joia && rev !== !!est.revVista) Cenarios.reagir(fase, 'joiaReverso');
            if (!joia && est.joiaVista) Cenarios.reagir(fase, 'joiaFim');
            // Pulsação esmeralda enquanto a Joia está ativa
            if (est.veuJoia && est.joiaVista) est.veuJoia.setAlpha(0.13 + 0.05 * Math.sin(agora / 160));
        });
        // Começa na Normal
        this.mostrarDimensao(fase, 'N');
    },

    // Círculo mágico em dois anéis: externo com runas quadradas, interno com estrela de quadrados e hexágono
    desenharCirculoMagico(fase, cor) {
        const est = fase.estadoCenario, a = est.anelExterno, b = est.anelInterno;
        a.clear(); b.clear();
        a.lineStyle(2, cor, 0.16).strokeCircle(0, 0, 330).strokeCircle(0, 0, 312);
        for (let i = 0; i < 36; i++) {
            const ang = i / 36 * Math.PI * 2, x = Math.cos(ang) * 321, y = Math.sin(ang) * 321;
            a.fillStyle(cor, i % 3 ? 0.12 : 0.24); a.fillRect(x - 3, y - 3, 6, 6);
        }
        b.lineStyle(2, cor, 0.14);
        b.strokePoints(this.poligono(4, 230, 0), true); b.strokePoints(this.poligono(4, 230, Math.PI / 4), true);
        b.strokePoints(this.poligono(6, 150, 0), true); b.strokeCircle(0, 0, 170);
        b.lineStyle(2, 0x2adf9a, 0.12).strokeCircle(0, 0, 96);
    },

    // Redesenha portais do fundo e selos na cor da dimensão
    desenharPortaisESelos(fase, p) {
        const est = fase.estadoCenario;
        est.portaisFundo.forEach((g) => {
            g.clear();
            g.fillStyle(0x0a0420, 0.55).fillCircle(0, 0, g.raio - 6);
            g.fillStyle(p.neb[0], 0.12).fillCircle(0, 0, g.raio - 14);
            g.lineStyle(5, p.ouro, 0.4).strokeCircle(0, 0, g.raio);
            for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.fillStyle(p.brilho, 0.5); g.fillRect(Math.cos(a) * (g.raio + 7) - 2, Math.sin(a) * (g.raio + 7) - 2, 4, 4); }
        });
        est.selos.forEach((g) => {
            g.clear();
            g.lineStyle(2, p.ouro, 0.3).strokeCircle(0, 0, g.tam);
            g.strokePoints(this.poligono(4, g.tam * 0.75, Math.PI / 4), true);
            g.fillStyle(p.brilho, 0.35).fillCircle(0, 0, 2.5);
            for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.fillRect(Math.cos(a) * g.tam - 1.5, Math.sin(a) * g.tam - 1.5, 3, 3); }
        });
        this.desenharCirculoMagico(fase, p.ouro);
    },

    // Mostra só o cenário da dimensão ativa (chamado pela troca de paleta da fase)
    mostrarDimensao(fase, dim) {
        const est = fase.estadoCenario;
        // Sequência: no Espelho as imagens viram de cabeça para baixo e ganham tom magenta
        // Camadas: no Espelho tudo vira de cabeça para baixo e ganha tom magenta
        if (fase.fundoCamadas) {
            fase.fundoCamadas.forEach((t) => t.setFlipY(dim === 'E').setTint(dim === 'E' ? 0xe08ad0 : ((CENARIOS_IMAGEM[fase.heroi] || {}).tom || 0xffffff)));
            return;
        }
        if (fase.fundoSeq) {
            const tom = (CENARIOS_IMAGEM[fase.heroi] || {}).tom || 0xffffff;
            fase.fundoSeq.imgs.forEach((img) => img.setFlipY(dim === 'E').setTint(dim === 'E' ? 0xe08ad0 : tom));
            return;
        }
        if (!est || !est.porDim) return;
        // Com arte de fundo, a estrutura procedural fica escondida; a própria arte vira de cabeça pra baixo
        // e ganha a paleta magenta no Espelho (mesma conta do espelharY: y → 760 - y)
        if (fase.fundoArte) {
            const def = CENARIOS_IMAGEM[fase.heroi], f = fase.fundoArte;
            f.setFlipY(dim === 'E').setTint(dim === 'E' ? 0xe08ad0 : (def.tom || 0xffffff));
            if (!f.fundoVideo) f.y = dim === 'E' ? 760 - def.y - def.alto : def.y;
        } else ['N', 'E'].forEach((d) => est.porDim[d].forEach((o) => o.setVisible(d === dim)));
        const p = dim === 'E'
            ? { neb: [0xff4ad2, 0x2ad0ff], ouro: 0xff7ad9, brilho: 0xffc2ee }
            : { neb: [0x7a2ad0, 0x10a08a], ouro: 0xffa53d, brilho: 0xffd27a };
        if (est.portaisFundo) this.desenharPortaisESelos(fase, p);
    },

    // ---------------------------------------------------------------
    // WANDA — floresta amaldiçoada pela magia do caos (rodada 8): céu quase preto com brasa vermelha no horizonte,
    // lua encoberta por nuvens, floresta distante afogada na névoa, árvores gigantes retorcidas com galhos secos
    // e raízes expostas, vegetação corrompida, filamentos orgânicos de energia escarlate e fragmentos flutuando.
    // Nada de prédios, torres, portais dourados ou anéis/mandalas (identidade do Estranho). Centro da tela limpo.
    // ---------------------------------------------------------------

    // Árvore retorcida (tronco afunilado por uma espinha curva + galhos secos recursivos + raízes expostas)
    arvoreRetorcida(g, x0, base, altura, larg, rnd, c) {
        const n = 14, fase0 = rnd.realInRange(0, 6), curva = rnd.realInRange(18, 46) * (rnd.frac() > 0.5 ? 1 : -1);
        const esp = [];
        for (let i = 0; i <= n; i++) { const t = i / n; esp.push({ x: x0 + Math.sin(t * Math.PI * 1.6 + fase0) * curva * t + curva * 0.3 * t, y: base - altura * t, w: larg * (1 - t * 0.8) / 2 }); }
        const esq = esp.map((p) => ({ x: p.x - p.w, y: p.y })), dir = esp.map((p) => ({ x: p.x + p.w, y: p.y })).reverse();
        // Raízes expostas (curvas grossas abrindo pros lados, por baixo do tronco)
        for (let k = 0; k < 4; k++) {
            const lado = k % 2 ? 1 : -1, alcance = rnd.between(40, 110) * (k < 2 ? 1 : 0.6);
            const raiz = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0 + lado * larg * 0.2, base - rnd.between(30, 60)), new Phaser.Math.Vector2(x0 + lado * (larg * 0.5 + alcance * 0.4), base - 22), new Phaser.Math.Vector2(x0 + lado * (larg * 0.5 + alcance), base + 2));
            g.lineStyle(k < 2 ? 9 : 5, c.tronco, 1).strokePoints(raiz.getPoints(10));
        }
        g.fillStyle(c.tronco, 1).fillPoints(esq.concat(dir), true);
        // Luz vermelha batendo de um lado (aro) e veias de energia corrompida subindo pelo tronco
        g.lineStyle(2, c.aro, c.aroA).strokePoints(dir);
        if (c.veia) { g.lineStyle(1.5, c.veia, 0.35); g.strokePoints(esp.slice(0, 9).map((p, i) => ({ x: p.x + Math.sin(i * 1.7) * p.w * 0.5, y: p.y }))); }
        // Galhos secos (recursivos, cada vez mais finos), saindo do terço de cima
        const galho = (x, y, ang, comp, esp2, nivel) => {
            const mx = x + Math.cos(ang) * comp * 0.5 + rnd.between(-8, 8), my = y + Math.sin(ang) * comp * 0.5 + rnd.between(-8, 8);
            const fx = x + Math.cos(ang) * comp, fy = y + Math.sin(ang) * comp;
            g.lineStyle(esp2, c.tronco, 1).strokePoints([{ x, y }, { x: mx, y: my }, { x: fx, y: fy }]);
            if (nivel <= 0) return;
            galho(fx, fy, ang - rnd.realInRange(0.3, 0.7), comp * 0.62, Math.max(1, esp2 * 0.6), nivel - 1);
            galho(fx, fy, ang + rnd.realInRange(0.3, 0.7), comp * 0.62, Math.max(1, esp2 * 0.6), nivel - 1);
        };
        for (let k = 0; k < c.galhos; k++) {
            const p = esp[Math.floor(n * rnd.realInRange(0.45, 0.95))], lado = k % 2 ? 1 : -1;
            galho(p.x, p.y, -Math.PI / 2 + lado * rnd.realInRange(0.5, 1.2), altura * rnd.realInRange(0.22, 0.34), Math.max(2, larg * 0.18), 3);
        }
        const topo = esp[n]; galho(topo.x, topo.y, -Math.PI / 2 + rnd.realInRange(-0.3, 0.3), altura * 0.2, Math.max(2, larg * 0.14), 2);
    },

    wanda(fase) {
        this.preparar(fase);
        if (this.temSequencia(fase)) return;   // arte em sequência: sem cenário procedural por cima
        const cena = fase.cena, est = fase.estadoCenario;
        // Com a arte de fundo carregada, por cima vai só atmosfera (névoa, luz, brasas): nada sólido solto
        // andando em outra velocidade (lascas e filamentos pareciam flutuar sobre a imagem)
        const comArte = cena.textures.exists(this.chaveFundo(fase.heroi));
        // Céu: breu no topo, roxo-vinho no meio e brasa carmesim no horizonte; lua pálida encoberta por nuvens
        this.ceu(fase, 'cen-wanda-ceu4', [0x020003, 0x0f0214, 0x3e0616], (g, w, h) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['wanda-nebulosa']);
            for (let i = 0; i < 12; i++) { g.fillStyle(rnd.pick([0x4a0a40, 0x2e0628, 0x6a0a22]), 0.07); g.fillEllipse(rnd.between(0, w), rnd.between(30, h * 0.55), rnd.between(280, 620), rnd.between(60, 150)); }
            this.estrelas(g, w, h, 'wanda-estrelas', 26, 0xffb3c0, 0.4);
            // Lua (halo rosado + disco) atrás de faixas de nuvem escura
            const lx = 230, ly = 150;
            for (let k = 5; k > 0; k--) { g.fillStyle(0xff4d6d, 0.03); g.fillCircle(lx, ly, 46 + k * 14); }
            g.fillStyle(0xf2c6cf, 0.9); g.fillCircle(lx, ly, 44);
            g.fillStyle(0xd89aa8, 0.5); g.fillCircle(lx - 12, ly - 8, 9); g.fillCircle(lx + 14, ly + 10, 6);
            [[lx + 10, ly + 6, 200, 26], [lx - 30, ly + 30, 240, 22], [lx + 40, ly - 22, 150, 16]].forEach(([x, y, cw, ch]) => { g.fillStyle(0x12030f, 0.92); g.fillEllipse(x, y, cw, ch); });
            g.fillStyle(0x2a0620, 0.6); g.fillEllipse(lx - 60, ly + 2, 180, 12);
            // Brilho vermelho subindo do horizonte
            for (let i = 0; i < 8; i++) { g.fillStyle(0xff1a3a, 0.022); g.fillRect(0, h - 40 - i * 22, w, 40 + i * 22); }
        });
        // Feixes de luz vermelha caindo entre as copas (iluminação sutil e diagonal)
        const kFeixes = this.textura(cena, 'cen-wanda-feixes', 1280, 560, (g, w, h) => {
            [[420, 70], [760, 110], [1080, 60]].forEach(([x, l]) => {
                for (let k = 0; k < 10; k++) { g.fillStyle(0xff2a4d, 0.011); g.fillPoints([{ x: x - k * 3, y: 0 }, { x: x + l + k * 3, y: 0 }, { x: x + l * 0.4 + 140 + k * 6, y: h }, { x: x - 110 - k * 6, y: h }], true); }
            });
        });
        est.feixesVermelhos = cena.add.image(640, 380, kFeixes).setScrollFactor(0).setDepth(-97.8).setBlendMode('ADD');
        // Floresta distante afogada na névoa (troncos finos e tortos, bem apagados)
        this.camada(fase, 0.06, -96, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['wanda-floresta-longe']);
            for (let x = 10; x < L - 60; x += rnd.between(38, 80)) this.arvoreRetorcida(g, x, 640, rnd.between(170, 300), rnd.between(8, 16), rnd, { tronco: 0x1c0518, aro: 0xff2a4d, aroA: 0.08, galhos: 3 });
            for (let i = 0; i < 10; i++) { g.fillStyle(0x3a0a2c, 0.35); g.fillEllipse(rnd.between(0, L), rnd.between(560, 640), rnd.between(400, 800), rnd.between(50, 90)); }
        });
        // Névoa vinho entre as camadas (profundidade)
        const nevoaFundo = this.camada(fase, 0.12, -94, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['wanda-nevoa-fundo']);
            for (let i = 0; i < 12; i++) { g.fillStyle(0x7a0a3a, 0.07); g.fillEllipse(rnd.between(0, L), rnd.between(470, 640), rnd.between(360, 700), rnd.between(40, 90)); }
        });
        // Árvores gigantes retorcidas (galhos secos que emolduram o alto da tela) + arbustos corrompidos
        this.camada(fase, 0.22, -92, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['wanda-arvores']);
            for (let x = 60; x < L - 200; x += rnd.between(340, 520)) {
                this.arvoreRetorcida(g, x, 664, rnd.between(420, 540), rnd.between(42, 64), rnd, { tronco: 0x0e020a, aro: 0xff2a4d, aroA: 0.3, veia: 0xff2a4d, galhos: 5 });
                // Arbusto corrompido: tufos de galhinhos curvos com brilho vinho
                const bx = x + rnd.between(130, 220);
                for (let k = 0; k < 7; k++) {
                    const a = -Math.PI / 2 + (k - 3) * 0.32, cmp = rnd.between(24, 46);
                    const curva = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(bx, 662), new Phaser.Math.Vector2(bx + Math.cos(a) * cmp * 0.6 + 8, 662 + Math.sin(a) * cmp * 0.6), new Phaser.Math.Vector2(bx + Math.cos(a) * cmp, 662 + Math.sin(a) * cmp));
                    g.lineStyle(3, 0x14030e, 1).strokePoints(curva.getPoints(8));
                }
                g.fillStyle(0xb0103a, 0.18); g.fillCircle(bx, 650, 10); g.fillCircle(bx + 14, 646, 6);
            }
        });
        // Névoa perto (vinho e roxa) correndo
        const nevoa = this.camada(fase, comArte ? 0.14 : 0.32, -86, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['wanda-nevoa']);
            for (let i = 0; i < 14; i++) { g.fillStyle(rnd.pick([0xff2a4d, 0x9a1aff]), 0.045); g.fillEllipse(rnd.between(0, L), rnd.between(510, 655), rnd.between(320, 640), rnd.between(26, 60)); }
        });
        // Primeiro plano: raízes retorcidas no pé da tela e galhos pendendo do alto (bordas; centro livre)
        this.camada(fase, 0.55, -84, (g, L) => {
            const rnd = new Phaser.Math.RandomDataGenerator(['wanda-perto']);
            for (let x = 0; x < L - 200; x += rnd.between(380, 620)) {
                for (let k = 0; k < 3; k++) {
                    const x1 = x + k * 40, alto = rnd.between(18, 36);
                    const raiz = new Phaser.Curves.CubicBezier(new Phaser.Math.Vector2(x1, 664), new Phaser.Math.Vector2(x1 + 30, 664 - alto), new Phaser.Math.Vector2(x1 + 90, 664 - alto), new Phaser.Math.Vector2(x1 + 130, 664));
                    g.lineStyle(7 - k * 2, 0x080006, 1).strokePoints(raiz.getPoints(12));
                    g.lineStyle(1, 0xff2a4d, 0.25).strokePoints(raiz.getPoints(12).map((p) => ({ x: p.x, y: p.y - 3 })));
                }
                if (rnd.frac() > 0.4) {
                    const gx = x + rnd.between(150, 300), comp = rnd.between(40, 80);
                    const pend = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(gx - 60, 100), new Phaser.Math.Vector2(gx, 100 + comp), new Phaser.Math.Vector2(gx + 50, 100 + comp * 0.6));
                    g.lineStyle(5, 0x080006, 1).strokePoints(pend.getPoints(10));
                    g.lineStyle(2, 0x080006, 1).lineBetween(gx, 100 + comp * 0.8, gx - 10, 100 + comp * 1.25).lineBetween(gx + 30, 100 + comp * 0.7, gx + 38, 100 + comp * 1.1);
                }
            }
        });
        est.nevoa = nevoa; est.nevoaFundo = nevoaFundo;
        nevoa.estrutural = false; nevoaFundo.estrutural = false;   // névoa fica por cima da arte
        this.animar(fase, (dt) => { nevoa.tilePositionX += dt * 0.02; nevoaFundo.tilePositionX -= dt * 0.008; });
        // Filamentos orgânicos de energia escarlate (curvas desenhadas uma vez; só pulsam e flutuam)
        const filamentos = [], frags = [];
        if (!comArte) {
        for (let i = 0; i < 6; i++) {
            const g = cena.add.graphics().setScrollFactor(0).setDepth(-89).setBlendMode('ADD');
            const rnd = new Phaser.Math.RandomDataGenerator(['filamento' + i]);
            const pts = []; let x = 0, y = 0, a = rnd.realInRange(-0.6, 0.6);
            for (let k = 0; k < 18; k++) { a += rnd.realInRange(-0.5, 0.5); x += Math.cos(a) * 9; y += Math.sin(a) * 9; pts.push({ x, y }); }
            g.lineStyle(5, 0xff1f4b, 0.12).strokePoints(pts); g.lineStyle(1.5, 0xff8fa3, 0.6).strokePoints(pts);
            g.fillStyle(0xffc2cd, 0.8).fillCircle(x, y, 2);
            g.y0 = i % 2 ? 470 + (i * 37) % 120 : 150 + (i * 41) % 90; g.baseX = i * 330 + 90; g.fase0 = i * 1.3; filamentos.push(g);
        }
        est.filamentos = filamentos;
        this.reciclar(fase, filamentos, 0.28, 1980, 120);
        filamentos.forEach((f) => { f.y = f.y0; });
        // Fragmentos flutuando (lascas de casca e pedra), escuros com aro escarlate
        for (let i = 0; i < 8; i++) {
            const r = cena.add.rectangle(0, 0, 8 + (i % 3) * 6, 5 + (i % 2) * 5, 0x1e030c).setStrokeStyle(1, 0xff2a3d, 0.45).setScrollFactor(0).setDepth(-90);
            r.y0 = 160 + (i * 59) % 360; r.baseX = i * 225 + 40; r.fase0 = i * 0.9; frags.push(r);
        }
        this.reciclar(fase, frags, 0.25, 1800, 60);
        }
        // Partículas mágicas: brasas escarlates subindo + motas roxas lentas (pequenas, atrás dos obstáculos)
        est.brasas = this.particulas(fase, { tint: [0xff1f4b, 0xff6a85, 0xff3a00], blendMode: 'ADD', frequency: 110, scale: { start: 0.4, end: 0 }, alpha: { start: 0.7, end: 0 }, speedY: { min: -40, max: -12 }, speedX: { min: -10, max: 10 } }, -89);
        est.motas = this.particulas(fase, { tint: [0xb03aff, 0xff4dd2], blendMode: 'ADD', frequency: 380, lifespan: 6000, scale: { start: 0.25, end: 0.6 }, alpha: { start: 0, end: 0.35, ease: 'Sine.InOut' }, speedY: { min: -8, max: 4 }, speedX: { min: -12, max: 12 } }, -91);
        // Animação ambiente: tudo em senoides lentas (sem tranco); a luz "respira"
        this.animar(fase, (dt, agora) => {
            frags.forEach((f) => { f.rotation += dt / 1000 * (0.3 + f.fase0 * 0.05); f.y = f.y0 + Math.sin(agora / 900 + f.fase0) * 14; });
            filamentos.forEach((f) => { f.y = f.y0 + Math.sin(agora / 1400 + f.fase0) * 12; f.rotation = Math.sin(agora / 2300 + f.fase0) * 0.25; f.setAlpha(0.55 + 0.45 * Math.sin(agora / 700 + f.fase0 * 2)); });
            est.feixesVermelhos.setAlpha(0.75 + 0.25 * Math.sin(agora / 1700));
            // Troca de realidade detectada pelo estado real da fase
            if (fase.realidade && fase.realidade !== est.realidadeVista) Cenarios.reagir(fase, 'realidade', { realidade: fase.realidade });
        });
    },

    // ---------------------------------------------------------------
    // REAÇÕES DO CENÁRIO AOS PODERES (contrato com Fase.cenarioReagir)
    // Idempotentes: podem vir do aviso explícito do poder ou da detecção pelo estado da fase.
    // ---------------------------------------------------------------
    reagir(fase, evento, dados = {}) {
        const est = fase.estadoCenario;
        if (!est) return;
        const agora = fase.cena.time.now;
        switch (evento) {
            // Joia do Tempo: véu esmeralda atrás dos obstáculos, onda verde e runas no círculo mágico
            case 'joiaInicio': {
                if (est.joiaVista) return;
                est.joiaVista = true; est.revVista = !!fase.revertendo;
                if (!est.veuJoia) est.veuJoia = fase.cena.add.rectangle(640, 380, 1280, 560, 0x2adf9a, 0).setScrollFactor(0).setDepth(-61);
                fase.cena.tweens.killTweensOf(est.veuJoia);
                fase.cena.tweens.add({ targets: est.veuJoia, alpha: 0.15, duration: reducedMotion.matches ? 1 : 260 });
                const pt = this.jogadorTela(fase);
                this.anelTela(fase, pt.x, pt.y, 0x2adf9a, 20, 700, 900, 5);
                if (est.anelInterno) this.desenharCirculoMagico(fase, 0x2adf9a);
                if (est.faiscas) est.faiscas.setParticleTint(0x2adf9a);
                break;
            }
            case 'joiaReverso': {
                est.revVista = !!fase.revertendo;
                const pt = this.jogadorTela(fase);
                // Anel que ENCOLHE (tempo voltando)
                this.anelTela(fase, pt.x, pt.y, 0x7affc8, 520, 20, 700, 4);
                this.clarao(fase, 0x2adf9a, 0.1, 240);
                break;
            }
            case 'joiaFim': {
                if (!est.joiaVista) return;
                est.joiaVista = false; est.revVista = false;
                if (est.veuJoia) { fase.cena.tweens.killTweensOf(est.veuJoia); fase.cena.tweens.add({ targets: est.veuJoia, alpha: 0, duration: reducedMotion.matches ? 1 : 700 }); }
                if (est.anelInterno) this.desenharCirculoMagico(fase, fase.dim === 'E' ? 0xff7ad9 : 0xffa53d);
                if (est.faiscas) est.faiscas.setParticleTint(0xffa53d);
                break;
            }
            // Portais: clarão dourado curto e o círculo mágico "respira"
            case 'portalAbre':
            case 'portalFecha': {
                if (agora - (est.ultimoPortal || 0) < 120) return;
                est.ultimoPortal = agora;
                this.clarao(fase, 0xffb347, evento === 'portalAbre' ? 0.14 : 0.08, 260);
                if (est.anelExterno && !reducedMotion.matches) fase.cena.tweens.add({ targets: [est.anelExterno, est.anelInterno], scale: 1.08, duration: 160, yoyo: true });
                break;
            }
            // Troca de dimensão: luz muda de cor e as camadas "dobram" (o espaço vira)
            case 'dimensao': {
                if (agora - (est.ultimaDim || 0) < 200) return;
                est.ultimaDim = agora;
                const dim = (dados && dados.dim) || fase.dim;
                this.clarao(fase, dim === 'E' ? 0xff7ad9 : 0xffa53d, 0.2, 380);
                if (!reducedMotion.matches) (fase.camadas || []).forEach((c) => { if (c.visible) fase.cena.tweens.add({ targets: c, scaleY: { from: 0.94, to: 1 }, duration: 320, ease: 'Back.Out' }); });
                break;
            }
            // Hulk: raio gama forte e clarão verde
            case 'furia': {
                if (est.disparaRaio) est.disparaRaio(true);
                break;
            }
            // Homem de Ferro: hologramas acendem com o disparo
            case 'repulsor': {
                est.brilhoHolo = 0.6;
                break;
            }
            // Wanda: a luz da floresta muda de cor com a realidade (vermelha ↔ azul, claro só de olhar o fundo)
            case 'realidade': {
                const real = (dados && dados.realidade) || fase.realidade;
                if (real === est.realidadeVista) return;
                const primeira = est.realidadeVista === undefined;
                est.realidadeVista = real;
                const azul = real === 'B';
                if (est.nevoa) est.nevoa.setTint(azul ? 0x8ab4ff : 0xffffff);
                if (est.nevoaFundo) est.nevoaFundo.setTint(azul ? 0x6a8aff : 0xffffff);
                if (est.feixesVermelhos) est.feixesVermelhos.setTint(azul ? 0x4a8aff : 0xffffff);
                if (est.fundo) est.fundo.setTint(azul ? 0x6a8ae8 : (CENARIOS_IMAGEM.Wanda.tom || 0xffffff));
                if (est.brasas) est.brasas.setParticleTint(azul ? 0x5ff2ff : 0xff1f4b);
                if (est.motas) est.motas.setParticleTint(azul ? 0x7a9aff : 0xb03aff);
                // Clarão curto (atrás dos obstáculos) na cor da nova realidade
                if (!primeira) this.clarao(fase, azul ? 0x4a8aff : 0xff1f4b, 0.12, 300);
                break;
            }
            // Flechas e teia: o cenário fica quieto (são frequentes demais pra piscar a tela)
            default: break;
        }
    }
};
