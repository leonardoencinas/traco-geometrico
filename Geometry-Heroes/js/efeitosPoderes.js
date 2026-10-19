// ================================================================
// efeitosPoderes.js — CUBOS PERSONALIZADOS e EFEITOS DOS PODERES (rodada 7)
// Visual de cada herói, rastros, pousos, portais do Doutor Estranho e Joia do Tempo.
// Regras: o corpo de física continua 40×40 (só o DESENHO muda); triângulo é sempre perigo
// (nada de triângulos decorativos grandes); respeita "movimento reduzido"; partículas limitadas.
// ================================================================

// Cores de referência dos efeitos
const COR_PODER = {
    ouro: 0xffc94a, laranja: 0xffa53d, brasa: 0xff7b00, esmeralda: 0x3dff8a, esmeraldaClara: 0xb8ffd6,
    escarlate: 0xff1f4b, rosa: 0xff8fa3, verdeHulk: 0x6fdc4a, verdeClaro: 0xc6ffb0, roxo: 0x8c5cff,
    lilas: 0xe2d6ff, ciano: 0x5ce1ff, dourado: 0xffd166, branco: 0xffffff
};

// Menos coisa na tela com "movimento reduzido"
function fxQtd(n) { return reducedMotion.matches ? Math.max(1, Math.ceil(n / 3)) : n; }

// ---------------------------------------------------------------
// BLOCOS BÁSICOS DE EFEITO (reaproveitados por todos os heróis)
// ---------------------------------------------------------------

// Rajada de faíscas brilhantes (emissor de uma vez só, apagado sozinho)
function fxFaiscas(fase, x, y, cores, n = 12, vel = 240, vida = 420, extra = {}) {
    const cena = fase.cena;
    const e = cena.add.particles(x, y, 'faisca', Object.assign({
        emitting: false, speed: { min: vel * 0.35, max: vel }, angle: { min: 0, max: 360 },
        lifespan: { min: vida * 0.55, max: vida }, scale: { start: 1.1, end: 0 }, alpha: { start: 1, end: 0 },
        tint: Array.isArray(cores) ? cores : [cores], blendMode: 'ADD'
    }, extra)).setDepth(extra.profundidade || 13);
    e.explode(fxQtd(n));
    cena.time.delayedCall(vida + 80, () => e.destroy());
    return e;
}

// Onda (anel) que cresce e some; esp = espessura
function fxOnda(fase, x, y, cor, r0 = 20, r1 = 120, ms = 380, esp = 4, alpha = 0.9) {
    const c = fase.cena.add.circle(x, y, r0).setStrokeStyle(esp, cor, alpha).setDepth(12);
    c.isFilled = false;
    fase.cena.tweens.add({ targets: c, scale: r1 / r0, alpha: 0, duration: fase.efeitos.dur(ms), ease: 'Cubic.Out', onComplete: () => c.destroy() });
    return c;
}

// Onda achatada correndo pelo chão (impacto de pouso/soco)
function fxOndaChao(fase, x, yChao, cor, largura = 160, ms = 320) {
    const el = fase.cena.add.ellipse(x, yChao, 30, 10).setStrokeStyle(3, cor, 0.9).setDepth(12);
    el.isFilled = false;
    fase.cena.tweens.add({ targets: el, scaleX: largura / 30, scaleY: 1.6, alpha: 0, duration: fase.efeitos.dur(ms), ease: 'Cubic.Out', onComplete: () => el.destroy() });
}

// Imagem residual do personagem (quadrado na posição atual, apagando)
function fxResidual(fase, cor, alpha = 0.45, ms = 260, escala = 1) {
    const p = fase.player;
    const r = fase.cena.add.rectangle(p.x, p.y, 40 * escala, 40 * escala, cor, alpha * 0.5).setStrokeStyle(2, cor, alpha).setDepth(9).setRotation(p.rotation);
    fase.cena.tweens.add({ targets: r, alpha: 0, scale: escala * 1.15, duration: fase.efeitos.dur(ms), onComplete: () => r.destroy() });
}

// Glifos arcanos em volta de um círculo (círculos, quadrados, barras e arcos — sem triângulos)
function fxGlifos(g, raio, n, cor, alpha = 1, tam = 4) {
    g.lineStyle(2, cor, alpha); g.fillStyle(cor, alpha);
    for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, x = Math.cos(a) * raio, y = Math.sin(a) * raio;
        switch (i % 4) {
            case 0: g.fillCircle(x, y, tam * 0.8); break;
            case 1: g.strokeRect(x - tam * 0.8, y - tam * 0.8, tam * 1.6, tam * 1.6); break;
            case 2: g.lineBetween(x - Math.sin(a) * tam, y + Math.cos(a) * tam, x + Math.sin(a) * tam, y - Math.cos(a) * tam); break;
            default: g.beginPath(); g.arc(x, y, tam, a, a + Math.PI); g.strokePath();
        }
    }
}

// Círculo místico (selo): anéis, dois quadrados cruzados (estrela de 8 pontas) e glifos
function fxDesenharSelo(g, raio, cor, alpha = 1) {
    g.lineStyle(2, cor, alpha).strokeCircle(0, 0, raio).strokeCircle(0, 0, raio * 0.78);
    const q = raio * 0.55;
    g.lineStyle(2, cor, alpha * 0.9).strokeRect(-q, -q, q * 2, q * 2);
    const pts = [0, 1, 2, 3].map((k) => ({ x: Math.cos(k * Math.PI / 2) * q * 1.414, y: Math.sin(k * Math.PI / 2) * q * 1.414 }));
    g.strokePoints(pts, true);
    g.lineStyle(1, cor, alpha * 0.7).strokeCircle(0, 0, raio * 0.3);
    fxGlifos(g, raio * 0.89, 12, cor, alpha, Math.max(2, raio * 0.07));
}

// Selo que aparece girando, cresce um pouco e some (ativação mística)
function fxSelo(fase, x, y, raio, cor, ms = 700, girar = 120) {
    const g = fase.cena.add.graphics({ x, y }).setDepth(12);
    fxDesenharSelo(g, raio, cor, 0.95);
    g.setScale(0.3).setAlpha(0);
    fase.cena.tweens.add({ targets: g, scale: 1, alpha: 1, duration: fase.efeitos.dur(ms * 0.35), ease: 'Back.Out' });
    fase.cena.tweens.add({ targets: g, angle: girar, duration: fase.efeitos.dur(ms) });
    fase.cena.tweens.add({ targets: g, alpha: 0, scale: 1.25, delay: fase.efeitos.dur(ms * 0.55), duration: fase.efeitos.dur(ms * 0.45), onComplete: () => g.destroy() });
    return g;
}

// Raio em zigue-zague (energia elétrica / caos)
function fxRaio(fase, x1, y1, x2, y2, cor, ms = 160, segs = 7, desvio = 14) {
    const g = fase.cena.add.graphics().setDepth(13);
    const pts = [{ x: x1, y: y1 }];
    for (let i = 1; i < segs; i++) { const t = i / segs; pts.push({ x: x1 + (x2 - x1) * t + Phaser.Math.Between(-desvio, desvio), y: y1 + (y2 - y1) * t + Phaser.Math.Between(-desvio, desvio) }); }
    pts.push({ x: x2, y: y2 });
    g.lineStyle(6, cor, 0.3).strokePoints(pts); g.lineStyle(2, 0xffffff, 1).strokePoints(pts);
    fase.cena.tweens.add({ targets: g, alpha: 0, duration: fase.efeitos.dur(ms), onComplete: () => g.destroy() });
}

// Rachaduras no chão saindo do ponto de pouso (somem devagar)
function fxRachaduras(fase, x, yChao, cor, n = 4, tam = 46) {
    const g = fase.cena.add.graphics().setDepth(2);
    g.lineStyle(2, cor, 0.85);
    for (let i = 0; i < n; i++) {
        const lado = i % 2 ? 1 : -1; let px = x + lado * 4, py = yChao + 1;
        g.beginPath(); g.moveTo(px, py);
        for (let k = 0; k < 3; k++) { px += lado * Phaser.Math.Between(8, tam / 3); py += Phaser.Math.Between(2, 7); g.lineTo(px, py); }
        g.strokePath();
    }
    fase.cena.tweens.add({ targets: g, alpha: 0, delay: 500, duration: fase.efeitos.dur(700), onComplete: () => g.destroy() });
}

// Espiral de magia do caos (braços curvos girando e se abrindo)
function fxEspiral(fase, x, y, cor, raio = 70, ms = 520) {
    const g = fase.cena.add.graphics({ x, y }).setDepth(12);
    for (let b = 0; b < 3; b++) {
        g.lineStyle(3 - b * 0.6, cor, 0.85);
        g.beginPath();
        for (let t = 0; t <= 1.001; t += 0.05) {
            const a = b * Math.PI * 2 / 3 + t * Math.PI * 1.6, r = 6 + t * raio * 0.5;
            if (t === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r); else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.strokePath();
    }
    g.setScale(0.4);
    fase.cena.tweens.add({ targets: g, scale: 2, angle: 200, alpha: 0, duration: fase.efeitos.dur(ms), ease: 'Cubic.Out', onComplete: () => g.destroy() });
}

// Chamada segura do gancho de reação do cenário (o Agente de cenários implementa)
function fxCenario(fase, evento, dados) { if (typeof fase.cenarioReagir === 'function') fase.cenarioReagir(evento, dados); }

// ---------------------------------------------------------------
// PORTAL MÍSTICO (Doutor Estranho): anéis dourados em sentidos opostos, glifos, faíscas que
// correm pela borda, abertura progressiva, estabilização pulsando e fechamento que contrai.
// Só VISUAL: quem decide colisão/gatilho é o código do portal.
// w × h = tamanho da elipse; opcoes.abrir = anima a abertura
// ---------------------------------------------------------------
// ANEL RÚNICO (base visual única de todos os portais do Doutor Estranho): aro fino + glifos
// pequenos entre dois círculos. Usado no portal aberto, na runa "adormecida" e na marca de saída.
function desenharAnelRunico(g, raio, cor, alpha = 1) {
    g.lineStyle(1.5, cor, 0.7 * alpha).strokeCircle(0, 0, raio).strokeCircle(0, 0, raio - 9);
    fxGlifos(g, raio - 4.5, 12, cor, 0.85 * alpha, Math.max(1.8, raio * 0.05));
}

// PORTAL MÍSTICO (padrão único, estilo dos portais de faíscas do Doutor Estranho nos filmes):
// um anel de FAÍSCAS laranja-douradas girando rápido, faíscas soltando pela tangente e caindo,
// anel rúnico discreto por dentro e miolo escuro e transparente (o "outro lado").
// Sem roxo, sem espiral e sem neon: só fogo dourado. Formato: elipse w×h (pad deitado = achatado).
function criarPortalMistico(fase, x, y, w, h, opcoes = {}) {
    const cena = fase.cena, raio = w / 2, achatar = h / w;
    const prof = opcoes.profundidade || 5;
    // Textura do aro de faíscas (gerada uma vez): ~70 riscos curtos tangentes em volta do círculo,
    // com brilho variado — girando, parecem as faíscas correndo em círculo
    const kAro = 'portal-aro-faiscas';
    if (!cena.textures.exists(kAro)) {
        const R = 64, g = cena.make.graphics({ add: false }), rnd = new Phaser.Math.RandomDataGenerator(['portal-aro']);
        g.lineStyle(10, 0xff7b00, 0.16).strokeCircle(R + 12, R + 12, R);           // brilho largo
        g.lineStyle(4, 0xffa53d, 0.55).strokeCircle(R + 12, R + 12, R);            // aro
        for (let i = 0; i < 72; i++) {
            const a = i / 72 * Math.PI * 2 + rnd.realInRange(-0.03, 0.03), rr = R + rnd.realInRange(-3, 3);
            const L = rnd.realInRange(0.08, 0.22), cx = R + 12, cy = R + 12;
            g.lineStyle(rnd.pick([1.5, 2, 2.5]), rnd.pick([0xfff2b0, 0xffd166, 0xffc94a, 0xffa53d]), rnd.realInRange(0.6, 1));
            g.beginPath(); g.arc(cx, cy, rr, a, a + L); g.strokePath();
        }
        g.generateTexture(kAro, (R + 12) * 2, (R + 12) * 2); g.destroy();
    }
    const escAro = raio / 64;
    // Miolo escuro e transparente (o outro lado, sem roxo) + brilho laranja suave atrás
    const halo = cena.add.ellipse(x, y, w * 1.35, h * 1.35, COR_PODER.brasa, 0.10).setDepth(prof - 1).setBlendMode(Phaser.BlendModes.ADD);
    const miolo = cena.add.ellipse(x, y, w * 0.94, h * 0.94, 0x120806, 0.42).setDepth(prof);
    // Container achatado: tudo dentro é desenhado em círculo e vira elipse
    const caixa = cena.add.container(x, y).setDepth(prof + 1).setScale(1, achatar);
    const aro = cena.add.image(0, 0, kAro).setScale(escAro).setBlendMode(Phaser.BlendModes.ADD);
    const aro2 = cena.add.image(0, 0, kAro).setScale(escAro * 0.97).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setAngle(37);
    const runas = cena.add.graphics(); desenharAnelRunico(runas, raio * 0.78, COR_PODER.dourado, 0.6);
    caixa.add([runas, aro2, aro]);
    // Faíscas soltando da borda e caindo (gravidade), pequenas — não poluem a tela
    const faiscas = cena.add.particles(x, y, 'faisca', {
        emitZone: { type: 'edge', source: new Phaser.Geom.Ellipse(0, 0, w, h), quantity: 48 },
        speed: { min: 20, max: 60 }, gravityY: 260, lifespan: { min: 220, max: 460 }, scale: { start: 0.55, end: 0 },
        tint: [0xfff2b0, COR_PODER.ouro, COR_PODER.brasa], blendMode: 'ADD', frequency: reducedMotion.matches ? 160 : 30
    }).setDepth(prof + 2);
    // Giro: aro de faíscas rápido, segundo aro no sentido contrário, runas bem devagar; halo "respira"
    const giros = reducedMotion.matches ? [] : [
        cena.tweens.add({ targets: aro, angle: 360, duration: 900, repeat: -1 }),
        cena.tweens.add({ targets: aro2, angle: -323, duration: 1500, repeat: -1 }),
        cena.tweens.add({ targets: runas, angle: 360, duration: 9000, repeat: -1 }),
        cena.tweens.add({ targets: halo, alpha: 0.16, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    ];
    const partes = [halo, miolo, caixa, faiscas];
    // Portal deitado (pad no piso/teto): coluna de luz dourada saindo dele (fica fácil de ver)
    if (opcoes.coluna) {
        const dir = opcoes.coluna, coluna = cena.add.graphics({ x, y }).setDepth(prof - 1).setBlendMode(Phaser.BlendModes.ADD);
        for (let k = 0; k < 8; k++) { coluna.fillStyle(COR_PODER.laranja, 0.06 * (1 - k / 8)); coluna.fillRect(-w * 0.36, dir > 0 ? k * 12 : -(k + 1) * 12, w * 0.72, 12); }
        partes.push(coluna);
    }
    // Abertura: o anel "acende" crescendo a partir de um ponto de faísca (como nos filmes), ease-out
    if (opcoes.abrir !== false) {
        [halo, miolo].forEach((o) => { const sx = o.scaleX; o.setScale(0.2); cena.tweens.add({ targets: o, scale: 1, duration: fase.efeitos.dur(240), ease: 'Cubic.Out' }); });
        caixa.setScale(0.2, 0.2 * achatar); cena.tweens.add({ targets: caixa, scaleX: 1, scaleY: achatar, duration: fase.efeitos.dur(240), ease: 'Cubic.Out' });
        fxFaiscas(fase, x, y, [0xfff2b0, COR_PODER.ouro, COR_PODER.brasa], 14, 220, 420);
    }
    let fechado = false;
    return {
        partes, faiscas,
        // Transparência (fantasma do Dr. Estranho)
        setAlpha(a) { partes.forEach((o) => o.setAlpha(o === halo ? a * 0.6 : a)); return this; },
        // Fechar: o anel encolhe até sumir (rápido), soltando as últimas faíscas
        fechar(ms = 200) {
            if (fechado) return; fechado = true;
            faiscas.stop();
            fxFaiscas(fase, x, y, [COR_PODER.ouro, COR_PODER.brasa], 10, 140, 320);
            cena.tweens.add({ targets: [halo, miolo], scale: 0.1, alpha: 0, duration: fase.efeitos.dur(ms), ease: 'Cubic.In' });
            cena.tweens.add({ targets: caixa, scaleX: 0.1, scaleY: 0.1 * achatar, alpha: 0, duration: fase.efeitos.dur(ms), ease: 'Cubic.In', onComplete: () => this.destruir() });
        },
        destruir() { giros.forEach((t) => t.remove()); cena.tweens.killTweensOf(partes); cena.tweens.killTweensOf([aro, aro2, runas]); partes.forEach((o) => o.destroy()); }
    };
}

// ---------------------------------------------------------------
// CUBOS DOS HERÓIS: cores, desenho por cima do corpo, rastro, pouso e efeitos contínuos.
// O desenho é feito em coordenadas do cubo (centro = 0,0; vai de -20 a 20).
// ---------------------------------------------------------------
const VISUAIS_HEROIS = {
    // HOMEM-ARANHA: máscara vermelha com teia e olhos grandes brancos
    'Homem-Aranha': {
        cores: [0xd8202f, 0x3a0008],
        desenhar(g) {
            // Teia: raios do centro até bordas e cantos + anéis
            g.lineStyle(1.2, 0x5a000c, 0.9);
            const raios = [[-20, -20], [0, -20], [20, -20], [20, 0], [20, 20], [0, 20], [-20, 20], [-20, 0]];
            raios.forEach(([x, y]) => g.lineBetween(0, 0, x, y));
            [7, 13, 19].forEach((r) => { const pts = raios.map(([x, y]) => ({ x: x * r / 20, y: y * r / 20 })); g.strokePoints(pts, true); });
            // Olhos grandes: contorno preto grosso e miolo branco (formato de gota larga, inclinada pra cima)
            const olho = (s, k) => [[2, -1], [4, -8], [10, -12], [17, -11], [18, -4], [14, 3], [7, 5], [3, 3]]
                .map(([x, y]) => ({ x: (x * k + (1 - k) * 10) * s, y: y * k + (1 - k) * -3 }));
            [-1, 1].forEach((s) => { g.fillStyle(0x0a0a0a, 1).fillPoints(olho(s, 1), true); g.fillStyle(0xffffff, 1).fillPoints(olho(s, 0.72), true); });
        },
        rastro: { tint: [0xd8202f, 0x1d4bc4, 0xffffff], frequency: 26 },
        pouso(fase) {
            // Pousa "agachado": poeira branca + dois fios de teia curtos grudando no chão
            const p = fase.player, y = p.y + (p.invertido ? -20 : 20);
            const g = fase.cena.add.graphics().setDepth(8);
            g.lineStyle(1.5, 0xffffff, 0.8).lineBetween(p.x - 4, y, p.x - 22, y + (p.invertido ? -2 : 2)).lineBetween(p.x + 4, y, p.x + 20, y + (p.invertido ? -2 : 2));
            fase.cena.tweens.add({ targets: g, alpha: 0, duration: fase.efeitos.dur(400), onComplete: () => g.destroy() });
        }
    },

    // HOMEM DE FERRO: armadura vermelha e dourada com núcleo luminoso no peito
    'Homem de Ferro': {
        cores: [0xb3121e, 0xffc23d],
        desenhar(g) {
            // Placas douradas do peito e cinto
            g.fillStyle(0xffc23d, 1).fillRect(-16, -16, 13, 9).fillRect(3, -16, 13, 9).fillRect(-16, 11, 32, 5);
            g.lineStyle(1, 0x7a0a10, 1).strokeRect(-16, -16, 13, 9).strokeRect(3, -16, 13, 9);
            // Linhas da armadura
            g.lineStyle(1, 0x5a060c, 0.9).lineBetween(-20, 2, -11, 2).lineBetween(11, 2, 20, 2).lineBetween(0, -7, 0, -4);
            // Núcleo (arco reator): anel dourado, aro ciano e centro branco
            g.fillStyle(0x0d2a3a, 1).fillCircle(0, 2, 8);
            g.lineStyle(2, 0x9ff3ff, 1).strokeCircle(0, 2, 6.5);
            g.fillStyle(0xffffff, 1).fillCircle(0, 2, 3.5);
        },
        rastro: { tint: [0xffc23d, 0xff7b00, 0xffffff], frequency: 34 },
        // Brilho do núcleo pulsando + chama do propulsor (mais forte segurando)
        criarExtras(fase) {
            const nucleo = fase.cena.add.circle(0, 0, 13, 0x9ff3ff, 0.25).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
            const chama = fase.cena.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
            return { nucleo, chama };
        },
        atualizar(fase, ex, agora) {
            const p = fase.player, s = p.skin, vivo = p.vivo && !fase.concluida;
            ex.nucleo.setVisible(vivo).setPosition(s.x - Math.sin(p.rotation) * 2, s.y + Math.cos(p.rotation) * 2).setScale(1 + Math.sin(agora / 120) * 0.15);
            ex.chama.clear().setVisible(vivo);
            if (!vivo) return;
            // Propulsores nos "pés" (embaixo e atrás do cubo), virando junto com a inclinação
            const forte = fase.segurando && fase.segurando();
            const comp = (forte ? 26 : 12) + Math.random() * 6, cos = Math.cos(p.rotation), sin = Math.sin(p.rotation);
            [-9, 9].forEach((dx) => {
                const bx = s.x + dx * cos - 20 * sin, by = s.y + dx * sin + 20 * cos;
                ex.chama.fillStyle(0xff7b00, 0.55).fillEllipse(bx - sin * comp * 0.5, by + cos * comp * 0.5, 9, comp);
                ex.chama.fillStyle(0xbff6ff, 0.9).fillEllipse(bx - sin * comp * 0.3, by + cos * comp * 0.3, 4, comp * 0.55);
            });
        }
    },

    // HULK: verde robusto, cabelo escuro, testa franzida, punhos e calção roxo
    'Hulk': {
        cores: [0x4caf2a, 0x1a3d10],
        desenhar(g) {
            // Cabelo (franja em degraus)
            g.fillStyle(0x1b2414, 1).fillRect(-20, -20, 40, 7).fillRect(-16, -13, 8, 3).fillRect(-4, -13, 8, 4).fillRect(9, -13, 7, 3);
            // Sobrancelha grossa franzida e olhos bravos
            g.lineStyle(3, 0x1a3d10, 1).lineBetween(-13, -7, -3, -4).lineBetween(3, -4, 13, -7);
            g.fillStyle(0xeaffd8, 1).fillRect(-11, -3, 6, 3).fillRect(5, -3, 6, 3);
            // Boca cerrada
            g.lineStyle(2, 0x1a3d10, 1).lineBetween(-6, 6, 6, 6);
            // Cicatriz
            g.lineStyle(1.5, 0x2a6a18, 1).lineBetween(10, 0, 15, 8);
            // Punhos nas laterais e calção roxo
            g.fillStyle(0x6fdc4a, 1).fillRect(-20, 8, 8, 8).fillRect(12, 8, 8, 8);
            g.lineStyle(1.5, 0x1a3d10, 1).strokeRect(-20, 8, 8, 8).strokeRect(12, 8, 8, 8);
            g.fillStyle(0x6a2aa0, 1).fillRect(-12, 14, 24, 6);
        },
        rastro: { tint: [0x6fdc4a, 0xc6ffb0], frequency: 32 },
        pouso(fase) {
            // Impacto pesado: rachaduras e onda no chão (maiores na fúria)
            const p = fase.player, y = p.y + (p.invertido ? -20 : 20), furia = fase.emFuria && fase.emFuria();
            fxRachaduras(fase, p.x, y, furia ? 0x9dff5a : 0x1a3d10, furia ? 6 : 3, furia ? 70 : 40);
            fxOndaChao(fase, p.x, y, furia ? 0x9dff5a : 0xc6ffb0, furia ? 220 : 110, furia ? 380 : 260);
            if (furia) fxFaiscas(fase, p.x, y - 4, [0x8a8f86, 0x6fdc4a], 10, 220, 420);
        }
    },

    // GAVIÃO ARQUEIRO: roxo, arco curvado com corda e flecha atravessada
    'Gaviao': {
        cores: [0x5a2aa6, 0x1e0b3a],
        desenhar(g) {
            // Faixa da máscara (lilás) com dois olhos estreitos
            g.fillStyle(0xe2d6ff, 1).fillRect(-20, -14, 40, 7);
            g.fillStyle(0x1e0b3a, 1).fillRect(-12, -12, 7, 3).fillRect(5, -12, 7, 3);
            // Arco (curva) e corda
            g.lineStyle(3, 0x1e0b3a, 1); g.beginPath(); g.arc(-4, 5, 13, -1.25, 1.25); g.strokePath();
            g.lineStyle(1, 0xe2d6ff, 1).lineBetween(-4 + Math.cos(-1.25) * 13, 5 + Math.sin(-1.25) * 13, -4 + Math.cos(1.25) * 13, 5 + Math.sin(1.25) * 13);
            // Flecha atravessando (haste + ponta em "V" + penas)
            g.lineStyle(2, 0xffffff, 1).lineBetween(-14, 5, 15, 5);
            g.lineBetween(15, 5, 10, 1).lineBetween(15, 5, 10, 9);
            g.lineStyle(2, 0xff9f1c, 1).lineBetween(-14, 5, -18, 1).lineBetween(-14, 5, -18, 9);
        },
        rastro: { tint: [0x8c5cff, 0xe2d6ff], frequency: 30 }
    },

    // DOUTOR ESTRANHO: azul profundo com selo dourado (estrela de 8 pontas) no peito
    'DrEstranho': {
        cores: [0x1d2a8c, 0xffa53d],
        desenhar(g) {
            // Gola/manto: faixas vermelhas nos cantos de cima
            g.fillStyle(0xb3122e, 1).fillRect(-20, -20, 9, 40).fillRect(11, -20, 9, 40);
            // Selo dourado
            g.lineStyle(2, 0xffc94a, 1).strokeCircle(0, 0, 9.5);
            g.lineStyle(1.5, 0xffc94a, 1).strokeRect(-6, -6, 12, 12);
            g.strokePoints([{ x: 0, y: -8.5 }, { x: 8.5, y: 0 }, { x: 0, y: 8.5 }, { x: -8.5, y: 0 }], true);
            g.fillStyle(0x3dff8a, 1).fillCircle(0, 0, 2.6);
            // Pontinhos nas faixas (bordado místico)
            g.fillStyle(0xffc94a, 1); [-12, -4, 4, 12].forEach((y) => { g.fillCircle(-15.5, y, 1.3); g.fillCircle(15.5, y, 1.3); });
        },
        rastro: { tint: [0xffc94a, 0xff7b00, 0xffe8a8], frequency: 26, blendMode: 'ADD' },
        pouso(fase) {
            // Pequeno círculo dourado achatado sob os pés
            const p = fase.player, y = p.y + (p.invertido ? -20 : 20);
            fxOndaChao(fase, p.x, y, 0xffc94a, 90, 300);
        }
    },

    // WANDA: Feiticeira Escarlate — o cubo É a máscara: tiara com dois chifres curvos saindo das quinas
    // de cima, ponta em V descendo na testa e moldura pelas laterais do rosto (desenho próprio, sem copiar arte)
    'Wanda': {
        cores: [0x7a0c22, 0xff4d6d],
        // O corpo (skin) gira como todo cubo; o rosto com a tiara fica numa camada própria (por cima do
        // brilho) que acompanha exatamente a posição e a rotação do corpo.
        desenhar(g) {
            // Corpo: leve brilho escarlate de baixo pra cima (profundidade) — o rosto vem em desenharRosto
            g.fillStyle(0xff2447, 0.18).fillRect(-17, 6, 34, 11);
            g.fillStyle(0x1a0006, 0.25).fillRect(-17, -17, 34, 8);
        },
        desenharRosto(g) {
            // Rosto: sombra escura no miolo (contraste pros olhos e pra tiara)
            g.fillStyle(0x2a030c, 0.55).fillRect(-14, -8, 28, 22);
            // Tiara: silhueta única (chifres curvos + faixa + V na testa + laterais descendo)
            const tiara = [
                { x: -20, y: 2 }, { x: -20, y: -14 }, { x: -21.5, y: -20 }, { x: -21, y: -25 }, { x: -18.5, y: -30 },   // chifre esquerdo (curva pra fora e pra cima)
                { x: -16, y: -25 }, { x: -13, y: -21 }, { x: -7, y: -19.5 }, { x: 0, y: -17 },                         // faixa de cima até o centro
                { x: 7, y: -19.5 }, { x: 13, y: -21 }, { x: 16, y: -25 }, { x: 18.5, y: -30 },
                { x: 21, y: -25 }, { x: 21.5, y: -20 }, { x: 20, y: -14 }, { x: 20, y: 2 },                            // chifre direito
                { x: 15, y: 2 }, { x: 15, y: -9 }, { x: 9, y: -11 }, { x: 0, y: -4 },                                   // borda interna: V descendo na testa
                { x: -9, y: -11 }, { x: -15, y: -9 }, { x: -15, y: 2 }
            ];
            // Contorno escuro (separa a tiara do fundo vermelho em qualquer rotação) e corpo escarlate
            g.lineStyle(3, 0x1a0006, 1).strokePoints(tiara, true);
            g.fillStyle(0xff2447, 1).fillPoints(tiara, true);
            // Brilho metálico: filete claro acompanhando a borda de cima e o V
            g.lineStyle(1.5, 0xffb3c0, 0.9);
            g.strokePoints([{ x: -18.5, y: -27.5 }, { x: -15, y: -22.5 }, { x: -7, y: -18 }, { x: 0, y: -15.5 }, { x: 7, y: -18 }, { x: 15, y: -22.5 }, { x: 18.5, y: -27.5 }]);
            g.strokePoints([{ x: -8, y: -9.5 }, { x: 0, y: -2.5 }, { x: 8, y: -9.5 }]);
            // Joia no centro da testa (losango pequeno — personagem, não espinho)
            g.fillStyle(0xffe0e6, 1).fillPoints([{ x: 0, y: -14 }, { x: 2.5, y: -11 }, { x: 0, y: -8 }, { x: -2.5, y: -11 }], true);
            // Olhos brilhando com magia (rosado claro + halo)
            g.fillStyle(0xff4d6d, 0.35).fillRect(-11, 1, 9, 6).fillRect(2, 1, 9, 6);
            g.fillStyle(0xffd6de, 1).fillRect(-10, 2.5, 7, 3).fillRect(3, 2.5, 7, 3);
            // Energia do caos na boca/queixo: espiral pequena
            g.lineStyle(1.5, 0xff8fa3, 0.9); g.beginPath();
            for (let t = 0; t <= 1.001; t += 0.07) { const a = t * Math.PI * 3, r = 0.8 + t * 5; const x = Math.cos(a) * r, y = 12.5 + Math.sin(a) * r * 0.6; if (t === 0) g.moveTo(x, y); else g.lineTo(x, y); }
            g.strokePath();
        },
        rastro: { tint: [0xff1f4b, 0xff8fa3, 0x8a0f2a], frequency: 24, blendMode: 'ADD' },
        // Rosto com tiara (sempre) + partículas do caos orbitando o cubo (sem movimento reduzido)
        criarExtras(fase) {
            const rosto = fase.cena.add.graphics().setDepth(11.5);
            this.desenharRosto(rosto);
            if (reducedMotion.matches) return { rosto };
            const caos = fase.cena.add.particles(0, 0, 'faisca', {
                emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 30), quantity: 24 },
                speed: { min: 5, max: 25 }, lifespan: 500, scale: { start: 0.7, end: 0 }, alpha: { start: 0.9, end: 0 },
                tint: [0xff1f4b, 0xff8fa3], blendMode: 'ADD', frequency: 70
            }).setDepth(9);
            return { rosto, caos };
        },
        atualizar(fase, ex) {
            const s = fase.player.skin;
            if (ex.rosto && ex.rosto.active) {
                // Mesma posição/escala/alpha/rotação do corpo: o rosto gira junto no pulo, como em todo cubo.
                // (Antes girava só o resto até a quina mais próxima e "voltava" a cada 90°: como a tiara cobre
                // quase o cubo inteiro, o cubo parecia parado no ar.)
                ex.rosto.setPosition(s.x, s.y).setScale(s.scaleX, s.scaleY).setAlpha(s.alpha).setVisible(s.visible);
                ex.rosto.rotation = s.rotation;
            }
            if (!ex.caos) return;
            ex.caos.setPosition(s.x, s.y);
            if (!fase.player.vivo || fase.concluida) ex.caos.stop();
        }
    }
};

// Instala o visual do herói na fase (chamado por Fase.criarJogador depois da skin)
function instalarVisualHeroi(fase) {
    const v = VISUAIS_HEROIS[fase.heroi];
    if (!v) return null;
    const extras = v.criarExtras ? v.criarExtras(fase) : {};
    if (v.atualizar) {
        const tick = () => { if (fase.player && fase.player.skin && fase.player.skin.active) v.atualizar(fase, extras, fase.cena.time.now); };
        fase.cena.events.on('postupdate', tick);
        fase.cena.events.once('shutdown', () => fase.cena.events.off('postupdate', tick));
    }
    return { v, extras };
}

// Efeito de pouso do herói (chamado pelo gancho de pouso da Fase)
function pousoHeroi(fase) {
    const v = VISUAIS_HEROIS[fase.heroi];
    if (v && v.pouso && !reducedMotion.matches) v.pouso(fase);
}

// ---------------------------------------------------------------
// HOMEM-ARANHA: fio de teia com textura (fio principal + fio torcido + nós) e "thwip" do lançamento
// ---------------------------------------------------------------
function desenharTeiaFio(g, curva, ax, ay) {
    const pts = curva.getPoints(16);
    // Brilho fraco em volta do fio
    g.lineStyle(5, 0xffffff, 0.14).strokePoints(pts);
    // Fio principal
    g.lineStyle(2, 0xffffff, 0.95).strokePoints(pts);
    // Fio torcido (segue o principal com uma ondinha) e nós a cada 3 pontos
    const torcido = pts.map((p, i) => ({ x: p.x + Math.sin(i * 1.3) * 2.2, y: p.y + Math.cos(i * 1.3) * 2.2 }));
    g.lineStyle(1, 0xdfe8ff, 0.7).strokePoints(torcido);
    g.fillStyle(0xffffff, 0.9);
    for (let i = 3; i < pts.length - 1; i += 3) g.fillCircle(pts[i].x, pts[i].y, 1.6);
    // Teia grudada na âncora: 8 raios + anel ligando os raios
    const r = 11, raios = [];
    g.lineStyle(1.5, 0xffffff, 0.85);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.lineBetween(ax, ay, ax + Math.cos(a) * r, ay + Math.sin(a) * r); raios.push({ x: ax + Math.cos(a) * r * 0.6, y: ay + Math.sin(a) * r * 0.6 }); }
    g.lineStyle(1, 0xffffff, 0.7).strokePoints(raios, true);
}

function fxTeiaLancada(fase, x1, y1, x2, y2) {
    // Fio sendo disparado: linha brilhante que some rápido
    const g = fase.cena.add.graphics().setDepth(12);
    g.lineStyle(6, 0xffffff, 0.25).lineBetween(x1, y1, x2, y2);
    g.lineStyle(2, 0xffffff, 1).lineBetween(x1, y1, x2, y2);
    fase.cena.tweens.add({ targets: g, alpha: 0, duration: fase.efeitos.dur(180), onComplete: () => g.destroy() });
    // Respingo de teia na âncora e anel
    fxOnda(fase, x2, y2, 0xffffff, 6, 26, 220, 2);
    fxFaiscas(fase, x2, y2, [0xffffff, 0xdfe8ff], 6, 120, 260);
}

// Energia convergindo para um ponto (bolinhas vindo de um círculo e sumindo no centro)
function fxConvergir(fase, x, y, cor, n = 12, raio = 120, ms = 360) {
    if (reducedMotion.matches) return;
    for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + Math.random() * 0.4;
        const b = fase.cena.add.circle(x + Math.cos(a) * raio, y + Math.sin(a) * raio, 3, cor, 1).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        fase.cena.tweens.add({ targets: b, x, y, scale: 0.3, alpha: 0.2, duration: ms * (0.7 + Math.random() * 0.3), ease: 'Cubic.In', onComplete: () => b.destroy() });
    }
}

// Relógio místico da Joia do Tempo (desenhado a cada quadro em volta do personagem)
// t = tempo em ms (gira os anéis), alpha = transparência, revertendo = ponteiros andam pra trás
function desenharRelogioJoia(g, t, alpha, revertendo) {
    const s = revertendo ? -1 : 1, cor = COR_PODER.esmeralda;
    // Halo suave
    g.fillStyle(cor, 0.07 * alpha).fillCircle(0, 0, 58);
    // Anéis
    g.lineStyle(2, cor, alpha).strokeCircle(0, 0, 34).strokeCircle(0, 0, 46);
    g.lineStyle(1, COR_PODER.esmeraldaClara, 0.6 * alpha).strokeCircle(0, 0, 52);
    // 12 marcas de hora (girando devagar)
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + s * t / 2400, r1 = 40, r2 = i % 3 === 0 ? 50 : 45;
        g.lineStyle(i % 3 === 0 ? 3 : 1.5, cor, alpha).lineBetween(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2);
    }
    // Glifos girando no anel de fora (sentido contrário)
    const off = -s * t / 1600;
    g.fillStyle(COR_PODER.esmeraldaClara, alpha); g.lineStyle(1.5, COR_PODER.esmeraldaClara, alpha);
    for (let i = 0; i < 8; i++) {
        const a = off + i / 8 * Math.PI * 2, x = Math.cos(a) * 56, y = Math.sin(a) * 56;
        if (i % 2) g.fillCircle(x, y, 2.2); else g.strokeRect(x - 2.5, y - 2.5, 5, 5);
    }
    // Ponteiros
    const a1 = s * t / 300, a2 = s * t / 900;
    g.lineStyle(2, cor, alpha).lineBetween(0, 0, Math.cos(a1) * 44, Math.sin(a1) * 44);
    g.lineStyle(3, cor, alpha).lineBetween(0, 0, Math.cos(a2) * 30, Math.sin(a2) * 30);
    g.fillStyle(COR_PODER.esmeraldaClara, alpha).fillCircle(0, 0, 3);
}
