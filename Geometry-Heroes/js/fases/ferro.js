// ================================================================
// ferro.js — FASE DO HOMEM DE FERRO: "Voe pela cidade do futuro e abra caminho no disparo"
// Mecânica: a fase inteira é voo (segurar = empuxo pra cima, soltar = cai, ↓/S = mergulho).
// Chão e teto não matam. Repulsor (E / botão direito) destrói drones, mísseis e núcleos de portões.
// ================================================================

// Constantes da fase
const FERRO = {
    gravidadeVoo: 1400,   // gravidade sentida no voo (menor que a normal)
    empuxo: 3200,         // aceleração pra cima ao segurar
    mergulho: 1200,       // aceleração extra pra baixo com ↓/S
    vySubindo: -460,      // velocidade máxima subindo
    vyDescendo: 520,      // velocidade máxima descendo
    alcanceTiro: 900,     // alcance do repulsor (px)
    faixaTiro: 14,        // meia altura da faixa de acerto do repulsor
    recargaTiro: 150,     // ms entre disparos (era 400: agora dá pra atirar em sequência; segurar E repete nessa cadência)
    avisoMissil: 900,     // ms de aviso antes do míssil entrar na tela
    velMissil: 320        // velocidade do míssil (pra esquerda, no mundo)
};

// PAREDE TECNOLÓGICA: bloco que mata (do chão até "topo", ou do teto até "base"); bloqueia o tiro.
// Encostar mata em qualquer lado — inclusive no piso e no teto dos túneis: a fase é de VOAR, não de
// deslizar (por isso o Homem de Ferro é nível Insano). O chão e o teto da tela, esses sim, não machucam.
class ParedeTech extends Obstaculo {
    constructor(fase, x, yTopo, largura, altura) {
        // Retângulo azul-escuro com borda neon
        const forma = fase.cena.add.rectangle(x + largura / 2, yTopo + altura / 2, largura, altura, 0x123047).setStrokeStyle(2, 0x29e3ff);
        // Mortal (encostar mata)
        super(fase, forma, 'mortal');
        // Bloqueia o tiro do repulsor
        this.bloqueiaTiro = true;
    }
}

// DRONE: losango vermelho que mata ao encostar; 1 tiro destrói; pode flutuar
class Drone extends Obstaculo {
    constructor(fase, x, y, amp = 0) {
        // Losango (quadrado girado 45°)
        const forma = fase.cena.add.rectangle(x, y, 26, 26, 0xff4d4d).setStrokeStyle(3, 0xffe0e0).setAngle(45);
        // Mortal
        super(fase, forma, 'mortal');
        // Pode ser atingido pelo repulsor
        this.alvoTiro = true;
        // Y central e amplitude da flutuação
        this.y0 = y; this.amp = amp;
        // Relógio local (começa quando entra na tela)
        this.relogio = 0;
        // Luz central piscando
        this.luz = fase.cena.add.circle(x, y, 5, 0xffffff).setDepth(3);
    }

    // Flutua pra cima e pra baixo (período 1,6 s)
    atualizar(dt) {
        // Só conta o relógio quando está perto da tela
        if (this.forma.x - this.fase.player.x < 1100) this.relogio += dt;
        // Nova altura
        this.forma.y = this.y0 + Math.sin(this.relogio / 1600 * Math.PI * 2) * this.amp;
        // Luz acompanha e pisca
        this.luz.setPosition(this.forma.x, this.forma.y).setAlpha(Math.floor(this.relogio / 200) % 2 ? 0.3 : 1);
    }

    // Levou um tiro: explode
    aoAcertar() {
        // Faíscas vermelhas
        this.fase.efeitos.estilhacos(this.forma.x, this.forma.y, [0xff4d4d, 0xffe0e0], 10, 260);
        // Anel
        this.fase.efeitos.anel(this.forma.x, this.forma.y, 0xff4d4d, 16);
        // Som de explosão
        som.ruido(180, 0.14, 2500); som.tom('triangle', 600, 150, 160, 0.08);
        // Remove
        this.destruir();
        // Reagiu
        return true;
    }

    // Some com a luz
    destruir() { this.luz.destroy(); super.destruir(); }
}

// MÍSSIL: aparece com aviso na borda direita, voa pra esquerda; o guiado corrige a altura
class Missil extends Obstaculo {
    constructor(fase, x, y, guiado) {
        // Corpo laranja (começa escondido até o aviso acabar)
        const forma = fase.cena.add.rectangle(x, y, 46, 12, guiado ? 0xff2e63 : 0xff8c42).setStrokeStyle(2, 0xffffff).setVisible(false);
        // Mortal
        super(fase, forma, 'mortal');
        // Física desligada até ser lançado
        this.ligarFisica(false);
        // Pode ser atingido pelo repulsor (depois de lançado)
        this.alvoTiro = false;
        // X do jogador que dispara o aviso
        this.gatilho = x;
        // Altura
        this.yAlvo = y;
        // É guiado?
        this.guiado = guiado;
        // Estado: 'esperando' → 'avisando' → 'voando'
        this.estado = 'esperando';
        // Tempo de aviso restante
        this.aviso = 0;
    }

    atualizar(dt) {
        // Fase e câmera
        const fase = this.fase;
        // Esperando o jogador chegar no gatilho
        if (this.estado === 'esperando' && fase.player.x >= this.gatilho) {
            // Começa o aviso
            this.estado = 'avisando'; this.aviso = FERRO.avisoMissil;
            // Triângulo de aviso fixo na borda direita da tela
            this.icone = fase.cena.add.text(1240, this.yAlvo, this.guiado ? '!!' : '!', {
                fontFamily: 'Arial, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#ff2e63', stroke: '#000000', strokeThickness: 5
            }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(60);
            // Dois tiques de aviso
            som.tom('square', 1400, 1400, 40, 0.06); som.tom('square', 1400, 1400, 40, 0.06, 90);
        }
        // Avisando: pisca o ícone e conta o tempo
        if (this.estado === 'avisando') {
            // Pisca a 8 Hz
            this.icone.setAlpha(Math.floor(this.aviso / 62) % 2 ? 0.3 : 1);
            // Conta
            this.aviso -= dt;
            // Acabou o aviso: lança o míssil logo depois da borda direita
            if (this.aviso <= 0) {
                // Remove o ícone
                this.icone.destroy();
                // Posição inicial (fora da tela, à direita)
                this.forma.setPosition(fase.player.x + 1100, this.yAlvo).setVisible(true);
                // Liga a física e vira alvo
                this.ligarFisica(true); this.alvoTiro = true;
                // Voando
                this.estado = 'voando';
            }
        }
        // Voando: anda pra esquerda e (se guiado) persegue a altura do jogador
        if (this.estado === 'voando') {
            // Anda pra esquerda
            this.forma.x -= FERRO.velMissil * dt / 1000;
            // Guiado: corrige no máximo 90 px/s em direção ao jogador
            if (this.guiado) this.forma.y += Phaser.Math.Clamp(fase.player.y - this.forma.y, -90 * dt / 1000, 90 * dt / 1000);
            // Rastro de fumaça
            if (Math.random() < 0.5) fase.efeitos.poeira(this.forma.x + 26, this.forma.y, 0xffd166, 1);
            // Saiu pela esquerda: remove
            if (this.forma.x < fase.player.x - 500) this.destruir();
        }
    }

    // Levou tiro: explode
    aoAcertar() { return Drone.prototype.aoAcertar.call(this); }

    // Some com o ícone se ainda existir
    destruir() { if (this.icone && this.icone.active) this.icone.destroy(); super.destruir(); }
}

// GRADE LASER: coluna de laser com um buraco de 170 px que sobe e desce
class GradeLaser extends Obstaculo {
    constructor(fase, x, periodo = 2400, defasagem = 0) {
        // Parte de cima do laser (retângulo alto que termina no buraco)
        const forma = fase.cena.add.rectangle(x, 0, 8, 600, 0xff2e63).setStrokeStyle(3, 0xff2e63, 0.35);
        // Mortal
        super(fase, forma, 'mortal');
        // Parte de baixo (outro obstáculo mortal)
        this.baixo = new ParedeLaserParte(fase, x);
        // Bicos ciano marcando o buraco
        this.bicoCima = fase.cena.add.triangle(x, 0, -12, 0, 12, 0, 0, 10, 0x29e3ff).setDepth(3);
        this.bicoBaixo = fase.cena.add.triangle(x, 0, -12, 10, 12, 10, 0, 0, 0x29e3ff).setDepth(3);
        // Período e defasagem da oscilação
        this.periodo = periodo; this.relogio = defasagem * periodo;
        // Bloqueia o tiro
        this.bloqueiaTiro = true; this.baixo.bloqueiaTiro = true;
        // Posiciona já no primeiro frame
        this.atualizar(0);
    }

    // Centro do buraco agora
    centroBuraco() { return 380 + Math.sin(this.relogio / this.periodo * Math.PI * 2) * 120; }

    atualizar(dt) {
        // Só conta o relógio quando está perto da tela
        if (this.forma.x - this.fase.player.x < 1100) this.relogio += dt;
        // Centro do buraco
        const c = this.centroBuraco();
        // Parte de cima termina em c - 85
        this.forma.y = c - 85 - 300;
        // Parte de baixo começa em c + 85
        this.baixo.forma.y = c + 85 + 300;
        // Bicos nas bordas do buraco
        this.bicoCima.y = c - 85; this.bicoBaixo.y = c + 85 - 10;
    }
}

// Parte de baixo da grade laser (obstáculo mortal simples, movido pela GradeLaser)
class ParedeLaserParte extends Obstaculo {
    constructor(fase, x) {
        // Retângulo alto
        const forma = fase.cena.add.rectangle(x, 0, 8, 600, 0xff2e63).setStrokeStyle(3, 0xff2e63, 0.35);
        // Mortal
        super(fase, forma, 'mortal');
    }
}

// LASER FIXO horizontal
class LaserFixo extends Obstaculo {
    constructor(fase, x, ate, y) {
        // Linha de laser (retângulo fino)
        const forma = fase.cena.add.rectangle((x + ate) / 2, y, ate - x, 6, 0xff2e63).setStrokeStyle(4, 0xff2e63, 0.3);
        // Mortal
        super(fase, forma, 'mortal');
    }
}

// PORTÃO COM NÚCLEOS: parede do teto ao chão que abre quando todos os núcleos são destruídos
class Portao extends Obstaculo {
    constructor(fase, x, nucleos) {
        // Parede de 40 px do teto ao chão
        const forma = fase.cena.add.rectangle(x + 20, 380, 40, 560, 0x1b4a66).setStrokeStyle(2, 0x29e3ff);
        // Mortal enquanto fechado
        super(fase, forma, 'mortal');
        // Bloqueia o tiro
        this.bloqueiaTiro = true;
        // Cria os núcleos (alvos) na frente da parede
        this.nucleos = nucleos.map((n) => new Nucleo(fase, x - 10, n.y, n.hp, this));
        // Já abriu?
        this.aberto = false;
    }

    // Um núcleo foi destruído: confere se todos caíram
    nucleoDestruido() {
        // Ainda tem núcleo ativo? então não abre
        if (this.nucleos.some((n) => n.ativo) || this.aberto) return;
        // Abre
        this.aberto = true;
        // Para de matar e de bloquear tiro
        this.ligarFisica(false); this.bloqueiaTiro = false;
        // Sobe a parede (animação)
        this.fase.cena.tweens.add({ targets: this.forma, y: -300, duration: this.fase.efeitos.dur(250) });
        // Som de portão abrindo
        som.tom('sawtooth', 200, 800, 300, 0.07);
    }
}

// NÚCLEO: hexágono-alvo do portão (precisa de vários tiros)
class Nucleo extends Obstaculo {
    constructor(fase, x, y, hp, portao) {
        // Círculo (núcleo de energia) ciano
        const forma = fase.cena.add.circle(x, y, 22, 0x29e3ff).setStrokeStyle(4, 0xffffff);
        // Mortal (bater nele também mata)
        super(fase, forma, 'mortal');
        // Alvo do repulsor
        this.alvoTiro = true;
        // Vida
        this.hp = hp; this.hpMax = hp;
        // Portão dono
        this.portao = portao;
    }

    // Levou tiro
    aoAcertar() {
        // Perde vida
        this.hp--;
        // Cor muda de ciano pra vermelho conforme apanha (mistura proporcional ao dano)
        const mistura = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(0x29e3ff), Phaser.Display.Color.ValueToColor(0xff2e63), this.hpMax, this.hpMax - this.hp);
        // Aplica a nova cor
        this.forma.setFillStyle(Phaser.Display.Color.GetColor(mistura.r, mistura.g, mistura.b));
        // Som de acerto
        som.tom('sine', 300, 500, 80, 0.08);
        // Faíscas
        this.fase.efeitos.estilhacos(this.forma.x, this.forma.y, 0x29e3ff, 5, 160);
        // Acabou a vida: explode e avisa o portão
        if (this.hp <= 0) { Drone.prototype.aoAcertar.call(this); this.portao.nucleoDestruido(); }
        // Reagiu
        return true;
    }
}

// HABILIDADE REPULSOR: disparo instantâneo (feixe) na horizontal
class Repulsor extends Habilidade {
    constructor(fase) {
        // Nome, recarga e cor
        super(fase, { nome: 'REPULSOR', recarga: FERRO.recargaTiro, cor: 0xffd166 });
    }

    usar() {
        // Fase e jogador
        const fase = this.fase, p = fase.player;
        // Começo do feixe (frente do cubo)
        const x0 = p.x + 22;
        // Fim padrão (alcance máximo)
        let xFim = x0 + FERRO.alcanceTiro;
        // Obstáculo atingido (o mais perto que esteja na faixa)
        let atingido = null;
        // Procura entre todos os obstáculos
        fase.obstaculos.forEach((o) => {
            // Só ativos, com física, que sejam alvo ou bloqueiem tiro
            if (!o.ativo || !(o.alvoTiro || o.bloqueiaTiro) || !o.forma.body || !o.forma.body.enable) return;
            // Corpo do obstáculo
            const b = o.forma.body;
            // Precisa estar à frente
            if (b.right < x0 || b.left > xFim) return;
            // Precisa cruzar a faixa de altura do feixe
            if (b.bottom < p.y - FERRO.faixaTiro || b.top > p.y + FERRO.faixaTiro) return;
            // Guarda o mais perto
            if (b.left < xFim) { xFim = Math.max(x0, b.left); atingido = o; }
        });
        // Feixe do repulsor, criado NO MESMO instante do disparo: halo largo, faixa dourada e núcleo branco
        const meio = (x0 + xFim) / 2, larg = Math.max(2, xFim - x0);
        const halo = fase.cena.add.rectangle(meio, p.y, larg, 22, 0xffb347, 0.22).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        const brilho = fase.cena.add.rectangle(meio, p.y, larg, 10, 0xffd166, 0.75).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        const linha = fase.cena.add.rectangle(meio, p.y, larg, 3, 0xffffff).setDepth(13);
        // O feixe afina e some (rápido, combina com a cadência curta)
        fase.cena.tweens.add({ targets: [halo, brilho, linha], scaleY: 0.2, alpha: 0, duration: fase.efeitos.dur(110), onComplete: () => { halo.destroy(); brilho.destroy(); linha.destroy(); } });
        // Clarão na mão (boca do disparo) e recuo do corpo
        const clarao = fase.cena.add.circle(x0, p.y, 9, 0xfff3c4, 0.95).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
        fase.cena.tweens.add({ targets: clarao, scale: 2.2, alpha: 0, duration: fase.efeitos.dur(120), onComplete: () => clarao.destroy() });
        p.avanco = -4;
        // Impacto: anel + faíscas (explosão maior se acertou algo que quebra)
        fase.efeitos.anel(xFim, p.y, 0xfff3c4, 10, 2.5, 180);
        fxFaiscas(fase, xFim, p.y, [0xffd166, 0xff9f1c, 0xffffff], atingido ? 10 : 5, 260, 300);
        if (atingido && atingido.alvoTiro) { fxOnda(fase, xFim, p.y, 0xff9f1c, 12, 60, 280, 3); }
        fxCenario(fase, 'repulsor', { x: xFim, y: p.y });
        // Som do repulsor
        som.tom('square', 1600, 400, 120, 0.08);
        // Se acertou um alvo, aplica
        if (atingido && atingido.alvoTiro) atingido.aoAcertar(1, 'repulsor');
        // Usou
        return true;
    }
}

// CLASSE FaseFerro
class FaseFerro extends Fase {
    constructor(cena, heroi, tentativa) {
        // Construtor da base
        super(cena, heroi, tentativa);
        // Controles no HUD
        this.textoControles = 'Segure Espaço/clique: subir  ·  ↓/S: mergulhar  ·  E ou botão direito: repulsor';
        // Objetivo
        this.objetivo = 'Voe por Nova York. Chão e teto não machucam.';
        // Frases do encerramento (texto grande e subtítulo da tela final)
        this.fraseCurta = 'MISSÃO CUMPRIDA'; this.fraseFinal = 'Nova York está livre.';
        // Drones derrubados (HUD)
        this.abatidos = 0;
    }

    // Encerramento: decola na vertical com o jato no máximo e some no céu
    animacaoFinal() {
        // Jato forte
        this.jato.start(); this.jato.frequency = 8;
        // Som do motor subindo
        som.tom('sawtooth', 120, 600, 900, 0.07);
        // Inclina pra cima
        this.player.angle = -20;
        // Sobe e sai da tela
        this.cena.tweens.add({ targets: this.player, y: -150, x: this.player.x + 300, duration: 1300, ease: 'Cubic.In' });
    }

    // Cubo grafite metálico
    coresCubo() { return VISUAIS_HEROIS['Homem de Ferro'].cores; }

    // Skin do Homem de Ferro: armadura vermelha e dourada com núcleo no peito (efeitosPoderes.js)
    desenharSkin(g) { VISUAIS_HEROIS['Homem de Ferro'].desenhar(g); }

    // Habilidade da fase
    criarHabilidade() { return new Repulsor(this); }

    // Voa a fase toda (é o "modo nave"): sem a abertura de pulos
    temAbertura() { return false; }

    // Botão direito = repulsor
    aoAcaoSecundaria() { this.aoAcao(); }

    // Contador
    textoExtra() { return `ABATIDOS: ${this.abatidos}`; }

    // Ao criar: jato, som contínuo, HUD tech, plataforma de lançamento
    aoCriar() {
        // Corpo do jogador
        const b = this.player.body;
        // No voo o desenho não estica (a armadura só inclina)
        this.player.semEsticar = true;
        // Gravidade do voo: o mundo tem 2500, então soma (1400 - 2500)
        b.setGravityY(FERRO.gravidadeVoo - MOVIMENTO.gravidade);
        // Jato: partículas saindo da traseira
        this.jato = this.cena.add.particles(0, 0, 'faisca', {
            // Saem pra trás (esquerda) e um pouco pra baixo
            speedX: { min: -320, max: -180 }, speedY: { min: 40, max: 140 },
            // Vida curta
            lifespan: { min: 120, max: 260 },
            // Encolhem
            scale: { start: 1.3, end: 0 },
            // Amarelo → laranja
            tint: [0xffd166, 0xff9f1c, 0xff6a00],
            // Brilho (cores somam)
            blendMode: 'ADD',
            // Frequência (muda quando segura o empuxo)
            frequency: 60
        }).setDepth(9);
        // Segue o jogador, saindo da traseira
        this.jato.startFollow(this.player, -26, 6);
        // Som contínuo do motor
        this.motor = som.continuo('sawtooth', 90, 400);
        // Desliga o motor quando a cena acabar
        this.desligadores.push(() => this.motor.parar());
        // HUD tech: cantoneiras nos 4 cantos e régua de altitude
        const hud = this.cena.add.graphics().setScrollFactor(0).setDepth(55);
        // Cor ciano transparente
        hud.lineStyle(2, 0x29e3ff, 0.6);
        // Cantoneiras (4 cantos da área de jogo)
        [[12, 112, 1, 1], [1268, 112, -1, 1], [12, 648, 1, -1], [1268, 648, -1, -1]].forEach(([x, y, sx, sy]) => {
            // Traço horizontal
            hud.lineBetween(x, y, x + 30 * sx, y);
            // Traço vertical
            hud.lineBetween(x, y, x, y + 30 * sy);
        });
        // Régua de altitude (linha vertical à esquerda)
        hud.lineBetween(22, 130, 22, 630);
        // Marquinhas a cada 50 px
        for (let y = 130; y <= 630; y += 50) hud.lineBetween(22, y, 30, y);
        // Marcador da altitude do cubo
        this.marcadorAltitude = this.cena.add.triangle(36, 380, 0, 0, 0, 12, -10, 6, 0xffd166).setScrollFactor(0).setDepth(56);
        // Plataforma de lançamento embaixo do início
        this.cena.add.rectangle(200, 652, 120, 16, 0x1b4a66).setStrokeStyle(2, 0x29e3ff);
    }

    // Movimento de voo (substitui o pulo)
    atualizarMovimento(agora, dt) {
        // Jogador e corpo
        const p = this.player, b = p.body;
        // Segurar E = disparo contínuo na mesma cadência da recarga (relógio da cena: não depende do FPS).
        // O aperto em si já dispara pelo evento da tecla; aqui só repete enquanto segura (sem tiro duplo).
        if (!this.teclaTiro) this.teclaTiro = this.cena.input.keyboard.addKey('E', false);
        if (this.teclaTiro.isDown && this.habilidade.pronta(agora)) this.habilidade.ativar(agora);
        // Anda pra direita
        b.setVelocityX(p.velocidadeX);
        // Segurando = empuxo
        const empuxo = this.segurando();
        // Mergulho com ↓/S
        const mergulho = this.teclas.DOWN.isDown || this.teclas.S.isDown;
        // Aceleração vertical
        b.setAccelerationY((empuxo ? -FERRO.empuxo : 0) + (mergulho ? FERRO.mergulho : 0));
        // Subida "freia" suave quando solta o empuxo
        if (!empuxo && b.velocity.y < 0) b.velocity.y *= Math.pow(0.92, dt / 16);
        // Limita a velocidade vertical
        b.velocity.y = Phaser.Math.Clamp(b.velocity.y, FERRO.vySubindo, FERRO.vyDescendo);
        // Inclina o cubo conforme sobe/desce
        p.angle = Phaser.Math.Clamp(b.velocity.y * 0.04, -18, 21);
        // Jato mais forte segurando
        this.jato.frequency = empuxo ? 16 : 60;
        // Motor mais alto segurando
        this.motor.volume(empuxo ? 0.05 : 0.015);
        // Raspando no chão: faíscas
        if ((b.blocked.down || b.touching.down) && Math.random() < 0.3) this.efeitos.estilhacos(p.x - 10, p.y + 20, 0xffd166, 2, 120);
        // Marcador de altitude
        this.marcadorAltitude.y = p.y;
        // Cuidou do movimento
        return true;
    }

    // Ao morrer ou concluir: desliga o jato e o motor
    aoMorrer() { this.jato.stop(); this.motor.volume(0); }

    // Elementos do roteiro
    criarElemento(ev) {
        // Chão e teto
        const chao = MOVIMENTO.chaoY, teto = MOVIMENTO.tetoY;
        // Escolhe pelo tipo
        switch (ev.tipo) {
            // Parede subindo do chão até "topo"
            case 'paredeChao': new ParedeTech(this, ev.x, ev.topo, 80, chao - ev.topo); break;
            // Parede descendo do teto até "base"
            case 'paredeTeto': new ParedeTech(this, ev.x, teto, 80, ev.base - teto); break;
            // Túnel: fatias de 40 px seguindo uma linha de pontos
            case 'tunel': this.criarTunel(ev); break;
            // Drone (com flutuação opcional)
            case 'drone': new Drone(this, ev.x, ev.y, ev.amp || 0); break;
            // Fileira de drones (derrube um pra passar)
            case 'barreiraDrones': ev.ys.forEach((y) => new Drone(this, ev.x, y)); break;
            // Mísseis (x = posição do jogador quando o aviso aparece)
            case 'missil': new Missil(this, ev.x, ev.y, false); break;
            case 'missilGuiado': new Missil(this, ev.x, ev.y, true); break;
            // Grade laser com buraco oscilando
            case 'gradeLaser': new GradeLaser(this, ev.x, ev.periodo, ev.fase || 0); break;
            // Laser horizontal fixo
            case 'laserFixo': new LaserFixo(this, ev.x, ev.ate, ev.y); break;
            // Portão com núcleos
            case 'portao': new Portao(this, ev.x, ev.nucleos); break;
            // Tipos comuns
            default: super.criarElemento(ev);
        }
    }

    // Túnel: para cada fatia de 40 px, uma parede de cima e uma de baixo deixando "vao" livre
    criarTunel(ev) {
        // Pontos [x, centroY]
        const pts = ev.pontos;
        // Guarda o túnel (o teste automático usa)
        (this.tuneis = this.tuneis || []).push(ev);
        // Fatias
        for (let x = ev.x; x < ev.ate; x += 40) {
            // Centro do vão naquele x (interpolação linear entre os pontos)
            const c = this.centroTunel(ev, x + 20);
            // Topo do vão e base do vão
            const topo = c - ev.vao / 2, base = c + ev.vao / 2;
            // Parede de cima (do teto até o topo do vão)
            new ParedeTech(this, x, MOVIMENTO.tetoY, 40, topo - MOVIMENTO.tetoY);
            // Parede de baixo (da base do vão até o chão)
            new ParedeTech(this, x, base, 40, MOVIMENTO.chaoY - base);
        }
        // Listras neon decorativas nas bordas do vão
        const g = this.cena.add.graphics().setDepth(2);
        // Ciano
        g.lineStyle(2, 0x29e3ff, 0.9);
        // Linha de cima e de baixo acompanhando o vão
        for (let x = ev.x; x < ev.ate - 40; x += 40) {
            // Centros nas duas pontas da fatia
            const c1 = this.centroTunel(ev, x + 20), c2 = this.centroTunel(ev, x + 60);
            // Linha de cima
            g.lineBetween(x + 20, c1 - ev.vao / 2 + 6, x + 60, c2 - ev.vao / 2 + 6);
            // Linha de baixo
            g.lineBetween(x + 20, c1 + ev.vao / 2 - 6, x + 60, c2 + ev.vao / 2 - 6);
        }
    }

    // Centro do vão do túnel num x (interpolação entre os pontos)
    centroTunel(ev, x) {
        // Pontos
        const pts = ev.pontos;
        // Procura o trecho que contém x
        for (let i = 0; i < pts.length - 1; i++) {
            // Trecho [a, b]
            const [xa, ya] = pts[i], [xb, yb] = pts[i + 1];
            // x dentro do trecho
            if (x >= xa && x <= xb) return Phaser.Math.Linear(ya, yb, (x - xa) / (xb - xa));
        }
        // Fora: usa a ponta mais perto
        return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
    }

    // Conta drones abatidos (chamado quando um drone é destruído pelo tiro)
    registrar(obs) {
        // Registro normal
        super.registrar(obs);
        // Se for drone, embrulha o aoAcertar pra contar
        if (obs instanceof Drone) {
            // aoAcertar original
            const original = obs.aoAcertar.bind(obs);
            // Novo: conta e chama o original
            obs.aoAcertar = (...a) => { this.abatidos++; return original(...a); };
        }
    }

    // Cenário: cidade futurista (torres, vias suspensas, painéis holográficos)
    // Cenário temático (metrópole futurista ao entardecer, torres com anéis, pontes aéreas, hologramas e trilhas de luz) — desenhado em cenarios.js
    criarParalaxe() { Cenarios.ferro(this); }

    // O cenário reage aos poderes e momentos da fase (cenarios.js)
    cenarioReagir(evento, dados) { Cenarios.reagir(this, evento, dados); }

    // Roteiro desenhado à mão
    // Checkpoints (3: fase mais longa, 21800 px). No chão (seguro sem segurar), longe das entradas de túnel
    checkpoints() {
        return [
            { x: 8050 },    // Logo depois da barreira de drones (era 8350: a grade laser em 8800 chegava em 0,6 s)
            { x: 13800 },   // Depois do corredor de lasers, ANTES dos mísseis guiados (13900/14200, com aviso de 0,9 s);
                            // era 14250 e a grade laser em 14700 chegava em 0,6 s
            { x: 17650 }    // Saída do 3º túnel, antes do último míssil guiado e da barreira
        ];
    }

    // Reaparecendo: mísseis cujo gatilho ficou pra trás não podem disparar todos de uma vez
    restaurarCheckpoint(cp) {
        // Apaga os mísseis com gatilho antes do checkpoint
        this.obstaculos.forEach((o) => { if (o instanceof Missil && o.gatilho < cp.x) o.destruir(); });
    }

    roteiro() {
        return [
            // TUTORIAL
            { x: 500, tipo: 'dica', txt: 'Segure para subir. Solte para descer' },
            { x: 1000, tipo: 'paredeChao', topo: 440 },
            { x: 1800, tipo: 'paredeTeto', base: 340 },
            { x: 2200, tipo: 'dica', txt: 'E ou botão direito: repulsor' },
            // Torreta alta atirando no ritmo (desvie por baixo ou destrua com o repulsor)
            { x: 2450, tipo: 'torreta', y: 250, intervalo: 900 },
            { x: 2700, tipo: 'drone', y: 380 },
            { x: 3200, tipo: 'drone', y: 260, amp: 60 },
            // Corredor clássico: serras no chão e no teto (fique no meio)
            { x: 3000, tipo: 'serra' }, { x: 3060, tipo: 'serra' }, { x: 3450, tipo: 'serra', teto: true }, { x: 3510, tipo: 'serra', teto: true },
            // MEIO
            { x: 3800, tipo: 'tunel', ate: 6000, vao: 200, pontos: [[3800, 380], [4400, 300], [5000, 470], [5600, 360], [6000, 380]] },
            { x: 6300, tipo: 'dica', txt: '! na borda = míssil chegando' },
            // Corredor curto de espinhos no chão e no teto enquanto os mísseis passam (fique no meio)
            { x: 6600, ate: 6840, tipo: 'fileira', teto: true },
            { x: 6400, tipo: 'missil', y: 300 }, { x: 6800, tipo: 'missil', y: 520 }, { x: 7150, tipo: 'missil', y: 380 },
            { x: 7900, tipo: 'barreiraDrones', ys: [160, 270, 380, 490, 600] },
            { x: 8800, tipo: 'gradeLaser', periodo: 2400 },
            { x: 9350, tipo: 'serra' }, { x: 9350, tipo: 'serra', teto: true }, { x: 9600, tipo: 'serra' }, { x: 9600, tipo: 'serra', teto: true },
            { x: 9900, tipo: 'portao', nucleos: [{ y: 380, hp: 3 }] },
            { x: 10300, tipo: 'tunel', ate: 12300, vao: 190, pontos: [[10300, 380], [10900, 260], [11500, 480], [12300, 380]] },
            { x: 11150, tipo: 'drone', y: 330 },
            { x: 12700, tipo: 'laserFixo', ate: 13700, y: 260 }, { x: 12700, tipo: 'laserFixo', ate: 13700, y: 500 },
            { x: 13300, tipo: 'drone', y: 380 },
            // Torreta no meio do corredor de lasers: só o repulsor abre caminho
            { x: 13650, tipo: 'torreta', y: 380, intervalo: 1000 },
            // FINAL
            { x: 13900, tipo: 'missilGuiado', y: 250 }, { x: 14200, tipo: 'missilGuiado', y: 520 },
            { x: 14700, tipo: 'gradeLaser', periodo: 2000 },
            { x: 15400, tipo: 'tunel', ate: 17600, vao: 175, pontos: [[15400, 380], [16000, 260], [16600, 470], [17200, 310], [17600, 390]] },
            { x: 17700, tipo: 'missilGuiado', y: 380 }, { x: 18300, tipo: 'barreiraDrones', ys: [160, 270, 380, 490, 600] },
            // Coluna de minas flutuantes: exploda a do meio
            { x: 18900, tipo: 'minas', ys: [190, 380, 570] },
            { x: 19400, tipo: 'portao', nucleos: [{ y: 250, hp: 1 }, { y: 510, hp: 1 }] },
            { x: 20000, tipo: 'paredeChao', topo: 280 }, { x: 20750, tipo: 'paredeTeto', base: 480 },
            { x: 21350, tipo: 'barreiraDrones', ys: [160, 270, 380, 490, 600] }
        ];
    }
}
