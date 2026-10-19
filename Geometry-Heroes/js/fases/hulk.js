// ================================================================
// hulk.js — FASE DO HULK: "Solte a FÚRIA na hora certa"
// Mecânica: E / clique / botão ativa a FÚRIA por alguns segundos.
//   Com fúria: o bloco cresce, ganha uma aura verde de raiva e ATRAVESSA tudo que quebra (caixa, vidro, concreto).
//   Sem fúria: o que quebra vira parede (bater de lado mata).
//   Listras amarelas NUNCA quebram: pule (viga baixa) ou passe por baixo (viga no alto).
//   A fúria acaba sozinha e precisa recarregar — o desafio é escolher o momento de ativar.
// ================================================================

// Constantes da fase (ajuste aqui o balanceamento)
const HULK = {
    duracaoFuria: 3000,   // ms que a fúria dura
    esperaFuria: 1500,    // ms de recarga depois que a fúria acaba (era 3000: ciclo total caiu de 6 s para 4,5 s)
    escalaFuria: 1.35,    // quanto o bloco cresce na fúria (só o desenho; a caixa de colisão não muda)
    avisoDistancia: 700   // px à frente em que os quebráveis mostram o aviso "FÚRIA"
};

// QUEBRÁVEL: obstáculo sólido com vida (HP). Frágil = 1 golpe; resistente = vários
class Quebravel extends Bloco {
    // tipo = 'caixa' | 'vidro' | 'concreto'
    constructor(fase, x, yTopo, largura, altura, hp, tipo) {
        // Cores por tipo
        const cores = { caixa: [0xc9d36a, 0xf2f7b5], vidro: [0x9fe6d8, 0xe8fffa], concreto: [0x8a8f86, 0xc7ccc2] }[tipo];
        // Cria o bloco (sólido)
        super(fase, x, yTopo, largura, altura, cores[0], cores[1]);
        // Vidro é meio transparente
        if (tipo === 'vidro') this.forma.setFillStyle(cores[0], 0.6);
        // Tipo (muda os efeitos)
        this.tipo = tipo;
        // Vida atual
        this.hp = hp;
        // Vida inicial (pra saber quantas rachaduras desenhar)
        this.hpMax = hp;
        // Cor (usada nos estilhaços)
        this.cor = cores[0];
        // Desenho das rachaduras (por cima do bloco)
        this.rachaduras = fase.cena.add.graphics().setDepth(5);
        // Linha horizontal de detalhe pros caixotes (parece madeira) e pro concreto (blocos)
        const det = fase.cena.add.graphics().setDepth(4);
        // Cor do detalhe
        det.lineStyle(2, 0x000000, 0.25);
        // Faixas horizontais a cada 40 px
        for (let yy = yTopo + 40; yy < yTopo + altura; yy += 40) det.lineBetween(x + 2, yy, x + largura - 2, yy);
        // X nos caixotes (ripas)
        if (tipo === 'caixa') for (let yy = yTopo; yy < yTopo + altura; yy += 40) { det.lineBetween(x + 4, yy + 4, x + largura - 4, yy + 36); }
        // Guarda o detalhe pra apagar junto
        this.detalhe = det;
    }

    // Levou um golpe
    aoAcertar(dano) {
        // Perde vida
        this.hp -= dano;
        // Efeitos da fase
        const ef = this.fase.efeitos;
        // Ainda tem vida: racha
        if (this.hp > 0) {
            // Desenha uma rachadura nova
            this.desenharRachadura();
            // Lascas cinzas
            ef.estilhacos(this.forma.x, this.forma.y, 0xb0b5ab, 5, 160);
            // Som de golpe que acertou
            som.ruido(90, 0.16, 900); som.tom('square', 140, 70, 90, 0.1);
            // Mostra quantos golpes faltam
            ef.textoFlutuante(this.forma.x, this.forma.y - this.forma.height / 2 - 10, `${this.hp}`, '#ffd34d');
            // Reagiu
            return true;
        }
        // Quebrou! Resistente quebra com mais força
        if (this.tipo === 'concreto') {
            // Muitas lascas
            ef.estilhacos(this.forma.x, this.forma.y, [0x8a8f86, 0xc7ccc2, 0x5a5f56], 16, 320);
            // Poeira
            ef.poeira(this.forma.x, this.forma.y + this.forma.height / 2 - 10, 0x9a9f96, 10);
            // Tremor forte
            ef.tremor(120, 0.007);
            // Som pesado
            som.ruido(260, 0.2, 600); som.tom('sawtooth', 110, 45, 260, 0.12);
        } else {
            // Estilhaços da cor do frágil
            ef.estilhacos(this.forma.x, this.forma.y, [this.cor, 0xffffff], 10, 260);
            // Um pouco de poeira
            ef.poeira(this.forma.x, this.forma.y, 0x9a9f96, 4);
            // Som de quebra leve
            som.ruido(160, 0.14, 3000); som.tom('triangle', 900, 300, 120, 0.08);
        }
        // Remove o obstáculo
        this.destruir();
        // Reagiu
        return true;
    }

    // Desenha uma rachadura em zigue-zague (uma por golpe levado)
    desenharRachadura() {
        // Forma do bloco
        const f = this.forma;
        // Linha escura
        this.rachaduras.lineStyle(2, 0x2a2d29, 1);
        // Começa num ponto aleatório da borda de cima
        let px = f.x - f.width / 2 + Phaser.Math.Between(8, f.width - 8);
        // Topo do bloco
        let py = f.y - f.height / 2;
        // Caminho da rachadura
        this.rachaduras.beginPath();
        // Ponto inicial
        this.rachaduras.moveTo(px, py);
        // 5 segmentos descendo em zigue-zague
        for (let i = 0; i < 5; i++) {
            // Desvia pro lado
            px = Phaser.Math.Clamp(px + Phaser.Math.Between(-14, 14), f.x - f.width / 2 + 4, f.x + f.width / 2 - 4);
            // Desce
            py += f.height / 5;
            // Liga até o novo ponto
            this.rachaduras.lineTo(px, py);
        }
        // Desenha
        this.rachaduras.strokePath();
    }

    // Some com os desenhos extras junto
    destruir() {
        // Apaga rachaduras, detalhe e rótulo
        this.rachaduras.destroy(); this.detalhe.destroy(); if (this.rotulo) this.rotulo.destroy();
        // Destruição padrão
        super.destruir();
    }
}

// INDESTRUTÍVEL: viga de aço com listras amarelas (o sinal de "não quebra")
class Indestrutivel extends Bloco {
    constructor(fase, x, yTopo, largura, altura) {
        // Bloco cinza-azulado
        super(fase, x, yTopo, largura, altura, 0x3b4250, 0x8892a6);
        // Listras diagonais amarelas
        const g = fase.cena.add.graphics().setDepth(4);
        // Amarelo forte
        g.lineStyle(6, 0xe0b000, 0.9);
        // Máscara geométrica: desenha listras só dentro do retângulo (corta nas bordas)
        for (let d = -altura; d < largura; d += 22) {
            // Ponto inicial da listra (canto de baixo)
            const x1 = x + Math.max(0, d), y1 = yTopo + altura - Math.max(0, -d);
            // Comprimento possível da listra dentro do retângulo
            const comp = Math.min(largura - Math.max(0, d), altura - Math.max(0, -d));
            // Desenha a listra diagonal
            g.lineBetween(x1, y1, x1 + comp, y1 - comp);
        }
        // Guarda as listras
        this.listras = g;
    }

    // Golpe não faz nada: CLANG
    aoAcertar() {
        // Faíscas amarelas
        this.fase.efeitos.estilhacos(this.forma.x - this.forma.width / 2, this.forma.y, 0xffd34d, 6, 200);
        // Texto
        this.fase.efeitos.textoFlutuante(this.forma.x, this.forma.y - 30, 'CLANG', '#ffd34d');
        // Som metálico
        som.tom('square', 1400, 1300, 120, 0.06); som.tom('triangle', 2100, 2000, 160, 0.04);
        // Reagiu (mas sem dano)
        return true;
    }
}

// PLATAFORMA INSTÁVEL: dá pra pisar, mas desmorona pouco depois (não fique parado nela)
class PlataformaFragil extends Plataforma {
    constructor(fase, x, yTopo, largura = 120) {
        // Plataforma cinza rachada (one-way, herda da Plataforma)
        super(fase, x, yTopo, largura, 0x7d8577, 0xc7ccc2);
        // Contagem até cair (ms); null = ninguém pisou ainda
        this.timer = null;
        // Rachaduras desenhadas por cima (avisa que é frágil)
        const g = fase.cena.add.graphics().setDepth(4);
        // Traços escuros em zigue-zague
        g.lineStyle(2, 0x2a2e27, 0.8);
        // Uma rachadura a cada 40 px
        for (let xx = x + 14; xx < x + largura - 10; xx += 40) { g.lineBetween(xx, yTopo + 2, xx + 8, yTopo + 9); g.lineBetween(xx + 8, yTopo + 9, xx + 2, yTopo + 15); }
        // Guarda o desenho
        this.rachas = g;
        // Posição original (o tremor oscila em volta dela)
        this.baseX = this.forma.x;
    }

    // Cada quadro: se o jogador está em cima, conta; ao zerar, cai
    atualizar(dt) {
        // Já caiu: nada
        if (!this.ativo) return;
        // Jogador e corpo
        const p = this.fase.player, f = this.forma;
        // Está pisando nela? (pé na altura do topo e dentro da largura)
        const pisando = (p.body.blocked.down || p.body.touching.down) && Math.abs(p.body.bottom - f.body.top) < 4 && p.x + 20 > f.body.left && p.x - 20 < f.body.right;
        // Primeira pisada: começa a contar 380 ms
        if (pisando && this.timer === null) { this.timer = 380; som.ruido(80, 0.06, 1200); }
        // Contando: treme e desconta
        if (this.timer !== null) {
            // Desconta o tempo
            this.timer -= dt;
            // Treme (só o desenho)
            f.x = this.baseX + (Math.random() - 0.5) * 3;
            // Acabou: desmorona
            if (this.timer <= 0) {
                // Pedaços caindo e poeira
                this.fase.efeitos.estilhacos(f.body.center.x, f.body.center.y, [0x7d8577, 0xc7ccc2], 8, 220);
                this.fase.efeitos.poeira(f.body.center.x, f.body.center.y, 0x9a9f96, 4);
                // Som de desabar
                som.ruido(160, 0.12, 700);
                // Some
                this.destruir();
            }
        }
    }

    // Some com as rachaduras também
    destruir() { this.rachas.destroy(); super.destruir(); }
}

// POÇA TÓXICA: perigo no chão que NÃO quebra (nem com fúria): tem que pular
class PocaToxica extends Obstaculo {
    constructor(fase, x, largura = 120) {
        // Faixa verde-amarelada brilhante no chão
        const forma = fase.cena.add.rectangle(x + largura / 2, MOVIMENTO.chaoY - 6, largura, 12, 0xb8e000).setStrokeStyle(2, 0xf4ff9a);
        // Mortal
        super(fase, forma, 'mortal');
        // Hitbox um pouco menor (mais justo)
        forma.body.setSize(largura - 16, 10, false).setOffset(8, 2);
        // Bolhas subindo (decoração)
        this.bolhas = fase.cena.add.particles(0, 0, 'faisca', {
            x: { min: x + 6, max: x + largura - 6 }, y: MOVIMENTO.chaoY - 10,     // saem da poça
            speedY: { min: -60, max: -25 }, scale: { start: 0.5, end: 0 },       // sobem e diminuem
            lifespan: 700, frequency: 140, tint: 0xd8ff4a, alpha: { start: 0.8, end: 0 }
        }).setDepth(3);
        // Aviso fixo em cima
        this.aviso = fase.cena.add.text(x + largura / 2, MOVIMENTO.chaoY - 40, '☣ PULE', {
            fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#e8ff7a', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(30);
    }

    // Some com as bolhas e o aviso
    destruir() { this.bolhas.destroy(); this.aviso.destroy(); super.destruir(); }
}

// BLOCO QUE CAI: concreto pendurado que despenca quando o jogador chega perto.
// Ao cair vira parede (pule por cima ou esmague com fúria). Se cair em cima: morte — a não ser com fúria.
class BlocoQueda extends Quebravel {
    constructor(fase, x) {
        // Concreto 60x80 (2 golpes) pendurado logo abaixo do teto
        super(fase, x, MOVIMENTO.tetoY + 30, 60, 80, 2, 'concreto');
        // Estado: 'preso' → 'caindo' → 'no chão'
        this.estado = 'preso';
        // Corrente desenhada do teto até o bloco
        this.corrente = fase.cena.add.line(0, 0, x + 30, MOVIMENTO.tetoY, x + 30, MOVIMENTO.tetoY + 30, 0x9a9f96).setOrigin(0, 0).setLineWidth(3).setDepth(3);
        // Sombra no chão (cresce quando vai cair)
        this.sombra = fase.cena.add.ellipse(x + 30, MOVIMENTO.chaoY - 2, 70, 10, 0x000000, 0.35).setDepth(2).setVisible(false);
        // Altura onde para (encostado no chão)
        this.yFinal = MOVIMENTO.chaoY - 40;
    }

    atualizar(dt) {
        // Removido: nada
        if (!this.ativo) return;
        // Jogador e forma
        const p = this.fase.player, f = this.forma;
        // Distância da frente do jogador até o bloco
        const dx = (f.x - 30) - (p.x + 20);
        // Perto: mostra a sombra (aviso)
        if (this.estado === 'preso' && dx < 700) this.sombra.setVisible(true);
        // Bem perto: solta
        if (this.estado === 'preso' && dx < 360) {
            // Começa a cair
            this.estado = 'caindo'; f.body.setVelocityY(200); this.corrente.setVisible(false);
            // Estalo da corrente
            som.tom('square', 900, 400, 80, 0.05);
        }
        // Caindo: acelera (gravidade própria)
        if (this.estado === 'caindo') {
            // Gravidade forte
            f.body.velocity.y += 3200 * dt / 1000;
            // Caiu em cima do jogador?
            if (p.vivo && Phaser.Geom.Intersects.RectangleToRectangle(f.getBounds(), new Phaser.Geom.Rectangle(p.x - 18, p.y - 18, 36, 36))) {
                // Com fúria: estoura no ar; sem fúria: esmagado
                if (this.fase.emFuria()) { this.aoAcertar(this.hp); return; }
                this.fase.morrer(); return;
            }
            // Chegou no chão: para e vira parede
            if (f.y >= this.yFinal) {
                // Para e encaixa
                f.body.setVelocityY(0); f.body.reset(f.x, this.yFinal); this.estado = 'no chão';
                // Impacto: tremor, poeira, som
                this.fase.efeitos.tremor(120, 0.008); this.fase.efeitos.poeira(f.x, MOVIMENTO.chaoY - 6, 0x9a9f96, 8); som.ruido(200, 0.18, 500);
                // Sombra some
                this.sombra.setVisible(false);
            }
        }
        // Rótulo acompanha o bloco e só aparece depois que ele cai
        if (this.rotulo) { this.rotulo.setY(f.y - 66); if (this.estado !== 'no chão') this.rotulo.setVisible(false); }
        // Rachaduras acompanham o bloco
        this.rachaduras.y = f.y - (MOVIMENTO.tetoY + 30 + 40); this.detalhe.y = this.rachaduras.y;
        // Sombra cresce conforme o bloco desce
        if (this.sombra.visible) this.sombra.setScale(0.5 + 0.5 * Phaser.Math.Clamp((f.y - MOVIMENTO.tetoY) / (this.yFinal - MOVIMENTO.tetoY), 0, 1), 1);
    }

    // Some com corrente e sombra
    destruir() { this.corrente.destroy(); this.sombra.destroy(); super.destruir(); }
}

// HABILIDADE FÚRIA: fica ativa por um tempo; depois recarrega
class Furia extends Habilidade {
    constructor(fase) {
        // Nome, recarga total (duração + espera) e cor verde
        super(fase, { nome: 'FÚRIA', recarga: HULK.duracaoFuria + HULK.esperaFuria, cor: 0x6fdc4a });
    }

    // Está com a fúria ligada agora?
    ativa(agora) { return agora - this.ultimoUso < HULK.duracaoFuria; }

    // Barra do HUD: durante a fúria esvazia (tempo restante); depois enche (recarga)
    progresso(agora) {
        // Tempo desde a ativação
        const t = agora - this.ultimoUso;
        // Fúria ligada: quanto ainda resta (1 → 0)
        if (t < HULK.duracaoFuria) return 1 - t / HULK.duracaoFuria;
        // Recarregando: quanto já recarregou (0 → 1)
        return Phaser.Math.Clamp((t - HULK.duracaoFuria) / HULK.esperaFuria, 0, 1);
    }

    // Liga a fúria (os efeitos ficam na fase)
    usar(agora) {
        // Avisa a fase
        this.fase.ligarFuria();
        // Usou
        return true;
    }
}

// CLASSE FaseHulk
class FaseHulk extends Fase {
    constructor(cena, heroi, tentativa) {
        // Construtor da base
        super(cena, heroi, tentativa);
        // Controles mostrados no HUD
        this.textoControles = 'E / clique: FÚRIA  ·  Espaço ou botão direito: pular  ·  Listras amarelas não quebram';
        // Objetivo da intro
        this.objetivo = 'Ative a fúria na hora certa e esmague o caminho.';
        // Frases do encerramento (texto grande e subtítulo da tela final)
        this.fraseCurta = 'ESMAGOU!'; this.fraseFinal = 'a cidade sentiu cada golpe.';
        // Lista dos obstáculos golpeáveis (quebráveis + indestrutíveis)
        this.golpeaveis = [];
        // Quantos obstáculos destruídos (mostra no HUD)
        this.destruidos = 0;
    }

    // Encerramento: soco no chão (onda de choque, poeira e tremor forte)
    animacaoFinal() {
        // Ponto do impacto (no chão, embaixo do personagem)
        const x = this.player.x, y = MOVIMENTO.chaoY;
        // Personagem afunda no soco
        this.player.pouso = 300; this.player.avanco = 10;
        // Três ondas de choque crescendo pelo chão
        for (let i = 0; i < 3; i++) this.cena.time.delayedCall(i * 120, () => this.efeitos.anel(x, y, 0x6fdc4a, 30, 12, 600));
        // Poeira e lascas
        this.efeitos.poeira(x, y - 10, 0x9a9f96, 20); this.efeitos.estilhacos(x, y - 10, [0x8a8f86, 0x6fdc4a], 24, 420);
        // Tremor forte e som pesado
        this.efeitos.tremor(500, 0.015); som.ruido(500, 0.25, 400); som.tom('sawtooth', 90, 30, 500, 0.14);
    }

    // Cubo verde com borda clara
    coresCubo() { return VISUAIS_HEROIS['Hulk'].cores; }

    // Skin do Hulk: cabelo, testa franzida, punhos e calção (desenho em efeitosPoderes.js)
    desenharSkin(g) { VISUAIS_HEROIS['Hulk'].desenhar(g); }

    // Pulso: quadrado que cresce em volta do cubo a cada golpe que acerta
    pulsoSkin() {
        // Quadrado vazado verde
        const q = this.cena.add.rectangle(this.player.x, this.player.y, 40, 40).setStrokeStyle(3, 0x6fdc4a).setDepth(12);
        // Cresce e some
        this.cena.tweens.add({ targets: q, scale: 1.6, alpha: 0, duration: this.efeitos.dur(200), onComplete: () => q.destroy() });
        // Soco: faíscas verdes na frente
        fxFaiscas(this, this.player.x + 24, this.player.y, [0x9dff5a, 0xffffff], 8, 260, 300);
    }

    // Habilidade da fase
    criarHabilidade() { return new Furia(this); }

    // Fúria ligada neste instante?
    emFuria() { return !!this.habilidade && this.habilidade.ativa(this.cena.time.now); }

    // Clique/toque: terço esquerdo da tela pula (celular); o resto ativa a fúria
    aoClicarMundo(ponteiro) {
        // Terço esquerdo: deixa a base tratar como pulo
        if (ponteiro.x < 380) return false;
        // Ativa a fúria
        this.habilidade.ativar(this.cena.time.now);
        // Clique usado (não pula)
        return true;
    }

    // Botão direito: pula
    aoAcaoSecundaria() { this.aoPressionar('ponteiro'); }

    // Com fúria, os quebráveis não seguram o bloco (ele atravessa e esmaga)
    // (o bloco que cai só vira sólido depois de chegar no chão)
    podeColidir(obs) { if (obs instanceof BlocoQueda && obs.estado !== 'no chão') return false; return !(obs instanceof Quebravel && this.emFuria()); }

    // Começo da fúria: rugido, onda verde, tremor e o bloco cresce
    ligarFuria() {
        // Jogador
        const p = this.player;
        // Onda de choque verde saindo do bloco
        this.efeitos.anel(p.x, p.y, 0x6fdc4a, 24, 16, 420);
        // Segunda onda, mais clara
        this.cena.time.delayedCall(90, () => this.efeitos.anel(p.x, p.y, 0xc6ffb0, 20, 10, 360));
        // Onda de choque correndo pelo chão + pedaços de concreto + clarão verde + "eco" do corpo crescendo
        const yPe = p.y + (p.invertido ? -20 : 20);
        fxOndaChao(this, p.x, yPe, 0x9dff5a, 320, 420);
        fxRachaduras(this, p.x, yPe, 0x9dff5a, 6, 80);
        fxFaiscas(this, p.x, yPe - 6, [0x8a8f86, 0x6fdc4a, 0xc6ffb0], 18, 320, 520, { gravityY: 900, blendMode: 'NORMAL' });
        if (!reducedMotion.matches) this.efeitos.flash(60, 200, 40, 160);
        fxResidual(this, 0x6fdc4a, 0.5, 320, 1.3); this.cena.time.delayedCall(80, () => fxResidual(this, 0xc6ffb0, 0.4, 320, 1.6));
        fxCenario(this, 'furia');
        // Tremor curto
        this.efeitos.tremor(180, 0.008);
        // Rugido: grave rasgado + ruído
        som.tom('sawtooth', 110, 55, 420, 0.13); som.ruido(300, 0.12, 500);
        // Texto curto
        this.efeitos.textoFlutuante(p.x, p.y - 60, 'FÚRIA!', '#9dff7a');
        // Partículas de raiva começam a sair
        if (this.raiva) this.raiva.start();
    }

    // Fim da fúria: o bloco volta ao normal com uma baforada
    desligarFuria() {
        // Jogador
        const p = this.player;
        // Fumacinha verde-acinzentada e a energia se desfazendo
        this.efeitos.poeira(p.x, p.y, 0x7fa874, 6);
        fxFaiscas(this, p.x, p.y, [0x6fdc4a, 0x7fa874], 10, 90, 600, { gravityY: -120 });
        fxOnda(this, p.x, p.y, 0x6fdc4a, 40, 12, 300, 3, 0.6);
        // Som de "esvaziar"
        som.tom('sine', 300, 140, 200, 0.05);
        // Para as partículas
        if (this.raiva) this.raiva.stop();
    }

    // Cria a aura (desenhada a cada quadro), as partículas e a tinta verde da tela
    criarAura() {
        // Desenho da aura em volta do bloco (atrás da skin)
        this.aura = this.cena.add.graphics().setDepth(9);
        // Partículas verdes subindo como vapor de raiva (começam paradas)
        this.raiva = this.cena.add.particles(0, 0, 'faisca', {
            speedY: { min: -160, max: -60 }, speedX: { min: -60, max: 60 },   // sobem e espalham
            scale: { start: 0.9, end: 0 }, alpha: { start: 0.8, end: 0 },       // diminuem e somem
            lifespan: 500, frequency: 25, tint: [0x6fdc4a, 0x9dff7a, 0x2f7d1f],  // tons de verde
            emitting: false                                                     // só na fúria
        }).setDepth(8);
        // Faz as partículas seguirem o bloco
        this.raiva.startFollow(this.player);
        // Tinta verde de tela cheia (bem sutil; acende na fúria)
        this.tintaFuria = this.cena.add.rectangle(640, 410, 1280, 620, 0x2f7d1f, 0).setScrollFactor(0).setDepth(45);
        // Escala atual do desenho (anima suave até o alvo)
        this.escalaAtual = 1;
        // Guarda se estava em fúria no quadro anterior (pra detectar começo/fim)
        this.estavaEmFuria = false;
    }

    // Desenha a aura de raiva: anel irregular pulsando + raios curtos em volta
    desenharAura(agora, forca) {
        // Limpa o desenho anterior
        const g = this.aura; g.clear();
        // Sem fúria (força ~0): nada
        if (forca < 0.02 || !this.player.vivo) return;
        // Centro da aura = centro do desenho do bloco
        const s = this.player.skin, cx = s.x, cy = s.y;
        // Tamanho base (metade do bloco crescido)
        const r = 20 * this.escalaAtual;
        // Brilho de fundo: dois círculos verdes transparentes
        g.fillStyle(0x6fdc4a, 0.10 * forca); g.fillCircle(cx, cy, r * 2.2);
        g.fillStyle(0x9dff7a, 0.10 * forca); g.fillCircle(cx, cy, r * 1.6);
        // Anel irregular (polígono com raio que "treme")
        g.lineStyle(3, 0x9dff7a, 0.75 * forca);
        // Pontos do anel
        const pts = [];
        // 14 pontos em volta
        for (let i = 0; i < 14; i++) {
            // Ângulo do ponto
            const a = (i / 14) * Math.PI * 2;
            // Raio que pulsa com o tempo (cada ponto num ritmo)
            const rr = r * 1.5 + Math.sin(agora / 60 + i * 1.7) * 5;
            // Guarda o ponto
            pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
        }
        // Desenha o anel fechado
        g.strokePoints(pts, true);
        // Raios de raiva: traços curtos saindo do anel (mudam a cada 80 ms)
        const sem = Math.floor(agora / 80);
        // Cor mais escura pros raios
        g.lineStyle(2, 0x2f7d1f, 0.9 * forca);
        // 6 raios
        for (let i = 0; i < 6; i++) {
            // Ângulo "aleatório" estável dentro dos 80 ms
            const a = ((sem * 7 + i * 13) % 36) / 36 * Math.PI * 2;
            // Do anel pra fora
            g.lineBetween(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6, cx + Math.cos(a) * r * 2.3, cy + Math.sin(a) * r * 2.3);
        }
    }

    // Elementos exclusivos do Hulk
    criarElemento(ev) {
        // Topo do chão
        const chao = MOVIMENTO.chaoY;
        // Novo obstáculo (se for golpeável)
        let obs = null;
        // Escolhe pelo tipo
        switch (ev.tipo) {
            // Caixote frágil (pilha de 1 a 3)
            case 'caixa': obs = new Quebravel(this, ev.x, chao - 40 * (ev.pilha || 1), 40, 40 * (ev.pilha || 1), 1, 'caixa'); break;
            // Vidro frágil, alto demais pra pular
            case 'vidro': obs = new Quebravel(this, ev.x, chao - 160, 24, 160, 1, 'vidro'); break;
            // Concreto resistente (3 golpes, 200 de altura)
            case 'concreto': obs = new Quebravel(this, ev.x, chao - 200, 60, 200, 3, 'concreto'); break;
            // Concreto resistente menor (2 golpes)
            case 'concreto2': obs = new Quebravel(this, ev.x, chao - 120, 60, 120, 2, 'concreto'); break;
            // Viga baixa indestrutível: pular
            case 'vigaBaixa': obs = new Indestrutivel(this, ev.x, chao - 80, 40, 80); break;
            // Viga suspensa indestrutível: passar por baixo (não pular)
            case 'vigaSuspensa': obs = new Indestrutivel(this, ev.x, MOVIMENTO.tetoY, ev.largura || 60, 560 - MOVIMENTO.tetoY); break;
            // Plataforma que desmorona
            case 'fragil': obs = null; new PlataformaFragil(this, ev.x, ev.y || 580, ev.largura || 120); break;
            // Poça tóxica (não quebra; pular)
            case 'poca': new PocaToxica(this, ev.x, ev.largura || 120); break;
            // Concreto que cai do teto
            case 'queda': obs = new BlocoQueda(this, ev.x); break;
            // Espinho de entulho
            case 'espinho': new Espinho(this, ev.x, !!ev.teto); break;
            // Parede alta indestrutível (só passa com o pad de salto)
            case 'paredeAlta': obs = new Indestrutivel(this, ev.x, MOVIMENTO.chaoY - 170, 40, 170); break;
            // Tipos comuns (dica, bloco)
            default: super.criarElemento(ev);
        }
        // Guarda os golpeáveis
        if (obs) this.golpeaveis.push(obs);
    }

    // HUD: estado da fúria e quantos quebrou
    textoExtra() {
        // Estado da fúria
        const agora = this.cena.time.now, h = this.habilidade;
        // Texto conforme o estado
        const estado = h.ativa(agora) ? 'FÚRIA ATIVA' : (h.pronta(agora) ? 'FÚRIA PRONTA (E)' : 'RECARREGANDO');
        // Junta com o contador
        return `${estado}  ·  ESMAGADOS: ${this.golpeaveis.filter((o) => o instanceof Quebravel && !o.ativo).length}`;
    }

    // A cada quadro: liga/desliga a fúria, cresce o bloco, esmaga o que encostar e atualiza avisos
    atualizarMecanica(agora) {
        // Cria a aura na primeira vez
        if (!this.aura) this.criarAura();
        // Fúria agora?
        const furia = this.emFuria();
        // Acabou de terminar: efeito de fim
        if (this.estavaEmFuria && !furia) this.desligarFuria();
        // Guarda pro próximo quadro
        this.estavaEmFuria = furia;
        // Escala do desenho vai suave até o alvo (cresce na fúria, volta ao normal depois)
        const alvo = furia ? HULK.escalaFuria : 1;
        // Aproxima 20% por quadro
        this.escalaAtual += (alvo - this.escalaAtual) * 0.2;
        // Aplica no desenho do jogador
        this.player.escalaExtra = this.escalaAtual;
        // Força da aura (0 → 1 conforme cresce)
        const forca = (this.escalaAtual - 1) / (HULK.escalaFuria - 1);
        // Desenha a aura
        this.desenharAura(agora, forca);
        // Tela levemente esverdeada
        this.tintaFuria.setFillStyle(0x2f7d1f, 0.12 * forca);
        // Retângulo do jogador (um pouco maior: esmaga ao encostar)
        const rp = new Phaser.Geom.Rectangle(this.player.x - 24, this.player.y - 24, 52, 48);
        // Pisca a cada 150 ms (avisos)
        const pisca = Math.floor(agora / 150) % 2 === 0;
        // Passa pelos obstáculos golpeáveis
        this.golpeaveis.forEach((obs) => {
            // Só ativos e perto (economiza processamento)
            if (!obs.ativo || Math.abs(obs.forma.x - this.player.x) > 1400) return;
            // Bloco que cai: só conta depois de chegar no chão (antes ele mesmo cuida de tudo)
            if (obs instanceof BlocoQueda && obs.estado !== 'no chão') { if (obs.rotulo) obs.rotulo.setVisible(false); return; }
            // Distância da frente do bloco até o obstáculo
            const dx = (obs.forma.x - obs.forma.width / 2) - (this.player.x + 20);
            // Rótulo em cima (criado na primeira vez)
            if (!obs.rotulo) obs.rotulo = this.cena.add.text(obs.forma.x, obs.forma.y - obs.forma.height / 2 - 26, '', {
                fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5).setDepth(30);
            // Perto o bastante pra avisar?
            const perto = dx > -40 && dx < HULK.avisoDistancia;
            // Indestrutível: aviso amarelo (pular ou passar por baixo)
            if (obs instanceof Indestrutivel) {
                // Viga alta = passar por baixo; baixa = pular
                obs.rotulo.setText(obs.forma.y < 400 ? '✕ NÃO QUEBRA · PASSE POR BAIXO' : '✕ NÃO QUEBRA · PULE').setColor('#ffd34d').setVisible(perto);
                // Viga suspensa: rótulo embaixo dela
                if (obs.forma.y < 400) obs.rotulo.setY(obs.forma.y + obs.forma.height / 2 + 20);
                return;
            }
            // Com fúria: encostou = esmagou (de uma vez, qualquer tipo)
            if (furia && Phaser.Geom.Intersects.RectangleToRectangle(rp, obs.forma.getBounds())) {
                // Contagem de esmagados
                this.destruidos++;
                // Empurrãozinho visual e pulso
                this.player.avanco = 10; this.pulsoSkin();
                // Tremor leve
                this.efeitos.tremor(90, 0.005);
                // Quebra (dano = vida toda)
                obs.aoAcertar(obs.hp);
                return;
            }
            // Aviso: sem fúria = "PRECISA DE FÚRIA" piscando; com fúria = contorno verde (vai quebrar)
            obs.rotulo.setText(furia ? 'ESMAGA!' : '⚡ PRECISA DE FÚRIA').setColor(furia ? '#9dff7a' : (pisca ? '#ffffff' : '#9dff7a')).setVisible(perto);
            // Contorno: verde forte na fúria; normal fora
            obs.forma.setStrokeStyle(furia && perto ? 3 : 2, furia && perto ? 0x9dff7a : 0xc7ccc2);
        });
    }

    // Cenário: cidade em ruínas com 3 camadas de paralaxe
    // Cenário temático (cidade em ruínas com névoa gama, vigas expostas, fumaça, entulho e raios verdes) — desenhado em cenarios.js
    criarParalaxe() { Cenarios.hulk(this); }

    // O cenário reage aos poderes e momentos da fase (cenarios.js)
    cenarioReagir(evento, dados) { Cenarios.reagir(this, evento, dados); }

    // Desenha carros amassados e postes tortos (camada mais perto)
    desenharEntulho(c3, L, rnd) {
        // Passa pela largura
        for (let x = 100; x < L - 260; x += rnd.between(300, 600)) {
            // Carro amassado: corpo inclinado
            c3.fillStyle(0x4a524a, 1); c3.fillRect(x, 628, 90, 26);
            // Teto amassado (bloco baixo e torto)
            c3.fillStyle(0x3d443d, 1); c3.fillRect(x + 15, 610, 50, 18);
            // Rodas
            c3.fillStyle(0x111311, 1); c3.fillCircle(x + 18, 656, 9); c3.fillCircle(x + 72, 656, 9);
            // Poste torto
            c3.lineStyle(5, 0x5a625a, 1); c3.lineBetween(x + 180, 660, x + 205, 520); c3.lineBetween(x + 205, 520, x + 240, 512);
        }
    }

    // Poeira flutuando na frente (fixa na tela, partículas indo pra esquerda)
    criarPoeiraAmbiente() {
        const poeira = this.cena.add.particles(0, 0, 'faisca', {
            // Nasce em qualquer ponto da área de jogo
            x: { min: 0, max: 1280 }, y: { min: 120, max: 640 },
            // Vai pra esquerda devagar
            speedX: { min: -60, max: -20 }, speedY: { min: -10, max: 10 },
            // Vida longa
            lifespan: 4000,
            // Grande e bem transparente
            scale: { min: 0.6, max: 1.4 }, alpha: { start: 0.15, end: 0 },
            // Cor de poeira
            tint: 0xb8c0b0,
            // Uma a cada 300 ms (pouca, pra não atrapalhar a leitura)
            frequency: reducedMotion.matches ? -1 : 300
        }).setScrollFactor(0).setDepth(-60);
        // Guarda (não precisa mexer depois)
        this.poeiraAmbiente = poeira;
    }

    // Pouso pesado: a tela treme de leve
    aoPousar() { super.aoPousar(); this.efeitos.tremor(this.emFuria() ? 110 : 60, this.emFuria() ? 0.006 : 0.003); som.ruido(60, 0.06, 500); }

    // Entrada com "baque"
    aoCriar() { this.efeitos.tremor(150, 0.006); }

    // Checkpoints (3): um ao fim de cada ato, em trechos calmos (a fúria está pronta ao reaparecer)
    checkpoints() {
        return [
            { x: 5700 },    // Fim do ato 1 (depois da viga no alto)
            { x: 9120 },    // Logo depois da ponte que desmorona (era 9350: a serra em 9600 chegava em 0,3 s)
            { x: 11450 },   // Antes do portal de gravidade — começa o ato final
            { x: 16950 }    // Depois do último grupo — começa o trecho da bola
        ];
    }

    // Roteiro desenhado à mão (x = borda esquerda do obstáculo), em 3 atos:
    //   ATO 1 (aprender): fúria, listras amarelas, poça tóxica, viga no alto
    //   ATO 2 (combinar): blocos que caem, ponte que desmorona sobre a poça, fúria com viga no meio
    //   ATO 3 (dominar): tudo junto, com menos folga
    // Regra: cada GRUPO de quebráveis cabe numa fúria (~1300 px) e entre grupos há a recarga (~2700 px
    // do começo de uma fúria até a próxima), preenchida com perigos que se resolvem pulando
    roteiro() {
        return [
            // ATO 1 — APRENDIZADO
            { x: 450, tipo: 'dica', txt: 'E (ou clique): FÚRIA — você cresce e atravessa o que quebra' },
            { x: 1400, tipo: 'caixa', pilha: 2 }, { x: 1650, tipo: 'vidro' },
            { x: 2000, tipo: 'dica', txt: 'Listras amarelas NÃO quebram nem com fúria: pule' },
            // Vergalhão que brota do entulho (pisca no chão antes de subir)
            { x: 1950, tipo: 'emergente' },
            { x: 2400, tipo: 'vigaBaixa' },
            { x: 2700, tipo: 'dica', txt: 'Poça larga não quebra: pule e aperte de novo no ORBE amarelo' },
            { x: 3050, tipo: 'poca', largura: 300 }, { x: 3180, tipo: 'orbeSalto', y: 555 },
            { x: 3450, tipo: 'dica', txt: 'A fúria acaba e recarrega: ative logo antes do grupo' },
            { x: 4100, tipo: 'concreto' }, { x: 4400, tipo: 'vidro' }, { x: 4650, tipo: 'caixa', pilha: 3 }, { x: 4950, tipo: 'concreto2' },
            { x: 5150, tipo: 'dica', txt: 'Viga no alto: passe por baixo, não pule' },
            { x: 5300, tipo: 'vigaSuspensa', largura: 60 },
            // Cabo de força partido soltando faísca no chão (liga e desliga no ritmo)
            { x: 5470, tipo: 'laserPiso', largura: 100, padrao: '1110', cor: 0xffd34d },
            // ATO 2 — COMBINAÇÃO
            { x: 5750, tipo: 'dica', txt: 'Pad amarelo lança alto: passa a parede que não quebra' },
            { x: 5900, tipo: 'pad' }, { x: 6100, tipo: 'paredeAlta' },
            { x: 6300, tipo: 'dica', txt: 'Concreto pendurado cai quando você chega perto: pule-o (ou esmague com fúria)' },
            { x: 6650, tipo: 'queda' },
            { x: 7100, tipo: 'vidro' }, { x: 7350, tipo: 'queda' }, { x: 7600, tipo: 'caixa', pilha: 2 }, { x: 7850, tipo: 'concreto2' },
            { x: 8150, tipo: 'dica', txt: 'Chão instável: não pare, vá pulando de uma em uma' },
            { x: 8500, tipo: 'poca', largura: 520 },
            { x: 8440, tipo: 'fragil', largura: 160 }, { x: 8690, tipo: 'fragil', largura: 160 }, { x: 8940, tipo: 'fragil', largura: 160 },
            { x: 9600, tipo: 'serraDesce' },
            { x: 10000, tipo: 'concreto' }, { x: 10300, tipo: 'vidro' }, { x: 10550, tipo: 'vigaBaixa' }, { x: 10850, tipo: 'concreto2' },
            // ATO 3 — DOMÍNIO (sem fúria aqui: só pulos certos)
            { x: 11250, tipo: 'poca' },
            // Portal azul: corre no TETO (espinhos pendurados viram pulos pra baixo); laranja volta ao chão
            { x: 11600, tipo: 'gravidade', inverte: true }, { x: 12050, tipo: 'espinho', teto: true }, { x: 12300, tipo: 'espinho', teto: true },
            { x: 12550, tipo: 'gravidade', inverte: false },
            // Carro arremessado do fundo: a sombra marca onde ele vai cair (pule ou esmague)
            { x: 12930, tipo: 'carro' },
            // Grupo com bloco caindo no meio da fúria
            { x: 13350, tipo: 'concreto' }, { x: 13600, tipo: 'queda' }, { x: 13850, tipo: 'vidro' }, { x: 14050, tipo: 'caixa', pilha: 3 },
            { x: 14650, tipo: 'poca', largura: 500 },
            { x: 14600, tipo: 'fragil', largura: 160 }, { x: 14850, tipo: 'fragil', largura: 160 }, { x: 15100, tipo: 'fragil', largura: 160 },
            // No ritmo da música: espinho a cada 2 batidas antes do último grupo
            { x: 15580, tipo: 'ritmo', padrao: '^.^' },
            // Desafio final: o último grupo, com concreto despencando
            { x: 16100, tipo: 'concreto' }, { x: 16350, tipo: 'queda' }, { x: 16600, tipo: 'vidro' },
            // ATO 4 — MODO BOLA (portal ●): apertar encostado troca de lado; espinhos alternam chão e teto
            { x: 17050, tipo: 'dica', txt: 'Portal ● = BOLA: aperte encostado pra trocar de lado (chão ↔ teto)' },
            { x: 17400, tipo: 'modo', modo: 'bola' },
            { x: 17850, tipo: 'espinho' }, { x: 17890, tipo: 'espinho' }, { x: 17930, tipo: 'espinho' },
            { x: 18350, tipo: 'espinho', teto: true }, { x: 18390, tipo: 'espinho', teto: true }, { x: 18430, tipo: 'espinho', teto: true },
            { x: 18850, tipo: 'espinho' }, { x: 18890, tipo: 'espinho' }, { x: 18930, tipo: 'espinho' },
            // De volta ao cubo, ainda no teto: o PAD AZUL devolve ao chão sozinho
            { x: 19200, tipo: 'modo', modo: 'cubo' },
            { x: 19250, tipo: 'dica', txt: 'Pad azul troca o lado da gravidade sozinho' },
            { x: 19550, tipo: 'pad', azul: true, teto: true },
            { x: 19850, tipo: 'espinho', teto: true }, { x: 19890, tipo: 'espinho', teto: true },
            // ORBE AZUL: pule e aperte nele pra ir pro teto por cima do poço de espinhos; o portal laranja devolve ao chão
            { x: 19950, tipo: 'dica', txt: 'Orbe azul: pule e aperte nele pra subir pro teto' },
            { x: 20255, tipo: 'orbeSalto', azul: true, y: 545 },
            { x: 20300, tipo: 'espinho' }, { x: 20340, tipo: 'espinho' }, { x: 20380, tipo: 'espinho' }, { x: 20420, tipo: 'espinho' },
            { x: 20460, tipo: 'espinho' }, { x: 20500, tipo: 'espinho' }, { x: 20540, tipo: 'espinho' }, { x: 20580, tipo: 'espinho' },
            { x: 20800, tipo: 'gravidade', inverte: false }
        ];
    }
}
