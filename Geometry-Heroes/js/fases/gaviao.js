// ================================================================
// gaviao.js — FASE DO GAVIÃO ARQUEIRO: "Acerte o alvo certo antes que a porta chegue"
// Mecânica: mirar e atirar flechas em alvos que abrem portas, desligam lasers e estendem pontes.
//   Alvos de sequência (ordem 1-2-3), móveis, temporários, aglomerados (3 em 1,2 s).
//   Flecha explosiva (derruba barricadas) e elétrica (só ela ativa painéis blindados), com uso limitado.
// Controles: mouse/toque na METADE DIREITA = atirar no ponto; metade esquerda = pular.
//   Teclado: E/Shift = mira automática no próximo alvo; 1/2/3 ou Q = tipo de flecha.
// ================================================================

// Constantes da fase
const GAVIAO = {
    velFlecha: 1600,      // px/s
    vidaFlecha: 700,      // ms até a flecha sumir
    recarga: 300,         // ms entre disparos
    zonaTiro: 420,        // x na TELA a partir do qual o clique vira tiro
    assistencia: 70,      // px: se tocar perto de um alvo, a flecha vai no centro dele
    raioExplosao: 110,    // raio da flecha explosiva
    raioEletrica: 220,    // alcance do encadeamento da elétrica
    tempoAglomerado: 1200 // ms pra acertar os 3 alvos do aglomerado
};

// ALVO: círculo de 3 anéis; ao ser acertado, aciona o id ligado (porta, laser, ponte)
class Alvo extends Obstaculo {
    // opcoes: { abre, grupo, n, amp, temporario }
    constructor(fase, x, y, opcoes = {}) {
        // Container com os anéis
        const forma = fase.cena.add.container(x, y);
        // Anel externo branco, meio vermelho, centro amarelo
        const a1 = fase.cena.add.circle(0, 0, 18, 0xffffff), a2 = fase.cena.add.circle(0, 0, 12, 0xff4d6d), a3 = fase.cena.add.circle(0, 0, 6, 0xffd166);
        // Junta no container
        forma.add([a1, a2, a3]);
        // Decoração (a colisão da flecha é calculada na mão, sem física)
        super(fase, forma, 'decoracao');
        // Guarda os anéis (pra pintar de verde)
        this.aneis = [a1, a2, a3];
        // Opções
        this.abre = opcoes.abre; this.grupo = opcoes.grupo; this.n = opcoes.n;
        // Oscilação (alvo móvel)
        this.y0 = y; this.amp = opcoes.amp || 0; this.relogio = 0;
        // Temporário: aparece 1500 ms, some 800 ms
        this.temporario = !!opcoes.temporario;
        // Já foi acertado?
        this.acertado = false;
        // Número da sequência no centro
        if (this.n) { this.rotulo = fase.cena.add.text(0, 0, `${this.n}`, { fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#120f1f' }).setOrigin(0.5); forma.add(this.rotulo); }
        // Anel de tempo do temporário
        if (this.temporario) { this.anelTempo = fase.cena.add.graphics(); forma.add(this.anelTempo); }
        // Fica acima do cenário
        forma.setDepth(6);
    }

    // Visível agora (temporário pode estar escondido)?
    visivel() { return this.forma.visible; }

    // Pode ser atingido?
    atingivel() { return this.ativo && !this.acertado && this.visivel(); }

    atualizar(dt) {
        // Relógio local só anda quando está perto da tela
        if (this.forma.x - this.fase.player.x < 1100) this.relogio += dt;
        // Alvo móvel: sobe e desce (período 2 s)
        if (this.amp) this.forma.y = this.y0 + Math.sin(this.relogio / 2000 * Math.PI * 2) * this.amp;
        // Temporário: ciclo de 2300 ms (1500 visível + 800 escondido), até ser acertado
        if (this.temporario && !this.acertado) {
            // Posição no ciclo
            const t = this.relogio % 2300;
            // Visível nos primeiros 1500 ms
            this.forma.setVisible(t < 1500);
            // Desenha o anel de tempo esvaziando
            this.anelTempo.clear().lineStyle(3, 0xffd166).beginPath().arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t / 1500)).strokePath();
        }
    }

    // Pinta de verde (acertado) ou volta ao normal
    pintar(acertado) {
        // Cores
        this.aneis[0].setFillStyle(acertado ? 0xc8ffd9 : 0xffffff);
        this.aneis[1].setFillStyle(acertado ? 0x3bff7a : 0xff4d6d);
        this.aneis[2].setFillStyle(acertado ? 0x1f9e4a : 0xffd166);
    }

    // Levou flechada
    aoAcertar(dano, tipo) {
        // Já acertado ou escondido: ignora
        if (!this.atingivel()) return false;
        // A fase decide (sequência, aglomerado ou alvo simples)
        return this.fase.alvoAtingido(this);
    }

    // Marca como acertado (efeitos) e aciona a ligação
    confirmar(acionar = true) {
        // Acertado
        this.acertado = true;
        // Some o anel de tempo (temporário fica visível)
        this.forma.setVisible(true); if (this.anelTempo) this.anelTempo.clear();
        // Verde
        this.pintar(true);
        // Anel crescendo
        this.fase.efeitos.anel(this.forma.x, this.forma.y, 0x3bff7a, 18);
        // Som de acerto
        som.tom('sine', 1046, 1568, 90, 0.08);
        // Aciona o que estiver ligado
        if (acionar && this.abre) this.fase.acionarComSom(this.abre);
    }
}

// PAINEL BLINDADO: só a flecha elétrica ativa
class Painel extends Alvo {
    constructor(fase, x, y, opcoes) {
        // Base (alvo)
        super(fase, x, y, opcoes);
        // Esconde os anéis e desenha um hexágono com malha
        this.aneis.forEach((a) => a.setVisible(false));
        // Hexágono cinza com borda ciano
        this.hex = fase.cena.add.polygon(0, 0, [25, 0, 12, 22, -12, 22, -25, 0, -12, -22, 12, -22], 0x4a4f63).setStrokeStyle(3, 0x5ce1ff);
        // Raio desenhado no meio
        this.raio = fase.cena.add.text(0, 0, 'ϟ', { fontFamily: 'Arial', fontSize: '22px', color: '#5ce1ff' }).setOrigin(0.5);
        // Coloca no container
        this.forma.add([this.hex, this.raio]);
    }

    // Só reage à elétrica; as outras ricocheteiam
    aoAcertar(dano, tipo) {
        // Não é elétrica: "tink"
        if (tipo !== 'eletrica') {
            // Faísca
            this.fase.efeitos.estilhacos(this.forma.x - 20, this.forma.y, 0x5ce1ff, 4, 160);
            // Texto de dica
            this.fase.efeitos.textoFlutuante(this.forma.x, this.forma.y - 36, 'SÓ ELÉTRICA', '#5ce1ff');
            // Som de ricochete
            som.tom('triangle', 2400, 2200, 50, 0.05);
            // Reagiu (a flecha para)
            return true;
        }
        // Elétrica: ativa
        this.hex.setFillStyle(0x1f9e4a);
        // Confirma como alvo
        return super.aoAcertar(dano, tipo);
    }
}

// PORTA reforçada: do teto ao chão; abre deslizando pra cima. travas = quantos alvos precisa
class PortaGaviao extends Obstaculo {
    constructor(fase, x, id, travas = 1) {
        // Retângulo roxo-escuro
        const forma = fase.cena.add.rectangle(x + 20, 380, 40, 560, 0x2d2a45).setStrokeStyle(3, 0x8c7bd6);
        // Mortal (bater mata)
        super(fase, forma, 'mortal', id);
        // Bloqueia flechas
        this.bloqueiaFlecha = true;
        // Travas restantes
        this.travas = travas;
        // LED vermelho no meio
        this.led = fase.cena.add.circle(x + 20, 380, 7, 0xff3b3b).setDepth(4);
        // Faixas de reforço
        this.faixas = fase.cena.add.graphics().setDepth(3);
        this.faixas.lineStyle(2, 0x8c7bd6, 0.6);
        for (let y = 140; y < 660; y += 60) this.faixas.lineBetween(x + 4, y, x + 36, y);
    }

    // Um alvo ligado foi acertado
    acionar() {
        // Tira uma trava
        this.travas--;
        // Ainda tem trava: LED amarelo
        if (this.travas > 0) { this.led.setFillStyle(0xffd166); return; }
        // Abre: para de matar e de bloquear flechas
        this.ligarFisica(false); this.bloqueiaFlecha = false;
        // LED verde
        this.led.setFillStyle(0x3bff7a);
        // Desliza pra cima
        this.fase.cena.tweens.add({ targets: [this.forma, this.led, this.faixas], y: '-=560', duration: this.fase.efeitos.dur(250) });
    }
}

// LASER vertical: desliga quando o alvo ligado é acertado
class LaserGaviao extends Obstaculo {
    constructor(fase, x, id, travas = 1) {
        // Linha de laser
        const forma = fase.cena.add.rectangle(x, 380, 6, 560, 0xff2e63).setStrokeStyle(4, 0xff2e63, 0.3);
        // Mortal
        super(fase, forma, 'mortal', id);
        // Travas
        this.travas = travas;
        // Emissores nas pontas
        this.emissores = [fase.cena.add.rectangle(x, 108, 22, 14, 0x4a4f63).setDepth(4), fase.cena.add.rectangle(x, 652, 22, 14, 0x4a4f63).setDepth(4)];
    }

    // Desliga
    acionar() {
        // Tira uma trava
        this.travas--;
        // Ainda tem trava: pisca
        if (this.travas > 0) { this.forma.setAlpha(0.6); return; }
        // Desliga: some e para de matar
        this.ligarFisica(false);
        // Some com animação
        this.fase.cena.tweens.add({ targets: this.forma, alpha: 0, scaleX: 0.2, duration: this.fase.efeitos.dur(200) });
    }
}

// PONTE: se estende sobre o vão quando o alvo é acertado
class Ponte extends Obstaculo {
    constructor(fase, x, largura, id) {
        // Retângulo roxo no nível do chão (começa com largura quase zero)
        const forma = fase.cena.add.rectangle(x, MOVIMENTO.chaoY + 10, largura, 20, 0x8c5cff).setStrokeStyle(2, 0xe2d6ff).setOrigin(0, 0.5);
        // Sólido
        super(fase, forma, 'solido', id);
        // Não mata de lado
        this.semMorteLateral = true;
        // O corpo de física fica invisível e sem física até acionar (o desenho é separado)
        this.forma.setAlpha(0); this.ligarFisica(false);
        // Desenho do tabuleiro da ponte (é ele que estica na animação)
        this.tabuleiro = fase.cena.add.rectangle(x, MOVIMENTO.chaoY + 10, largura, 20, 0x8c5cff).setStrokeStyle(2, 0xe2d6ff).setOrigin(0, 0.5).setScale(0.02, 1).setDepth(2);
        // Guarda a largura
        this.largura = largura;
        // Marcas tracejadas mostrando onde a ponte vai ficar
        this.guia = fase.cena.add.graphics().setDepth(1);
        this.guia.lineStyle(2, 0x8c5cff, 0.5);
        for (let xx = x; xx < x + largura; xx += 24) this.guia.lineBetween(xx, MOVIMENTO.chaoY, xx + 12, MOVIMENTO.chaoY);
    }

    // Estende
    acionar() {
        // Liga a física na hora (com o tamanho cheio)
        this.ligarFisica(true);
        // Animação: o tabuleiro estica da esquerda pra direita
        this.fase.cena.tweens.add({ targets: this.tabuleiro, scaleX: 1, duration: this.fase.efeitos.dur(300) });
        // Apaga a guia
        this.guia.destroy();
    }
}

// BARRICADA de caixas: só a flecha explosiva derruba
class Barricada extends Bloco {
    constructor(fase, x) {
        // Bloco marrom de 80x200 em cima do chão
        super(fase, x, MOVIMENTO.chaoY - 200, 80, 200, 0x6b4a2f, 0xc99a6b);
        // Bloqueia flechas
        this.bloqueiaFlecha = true;
        // Ripas
        const g = fase.cena.add.graphics().setDepth(4);
        g.lineStyle(2, 0x3d2a1a, 0.8);
        for (let y = MOVIMENTO.chaoY - 200; y < MOVIMENTO.chaoY; y += 40) { g.strokeRect(x + 2, y + 2, 38, 38); g.strokeRect(x + 42, y + 2, 36, 38); }
        // Guarda
        this.ripas = g;
        // Placa de aviso
        this.placa = fase.cena.add.text(x + 40, MOVIMENTO.chaoY - 220, '✸', { fontFamily: 'Arial', fontSize: '24px', color: '#ff9f1c' }).setOrigin(0.5).setDepth(5);
    }

    // Flecha comum: bate e para; explosiva: destrói
    aoAcertar(dano, tipo) {
        // Não é explosiva: dica
        if (tipo !== 'explosiva') { this.fase.efeitos.textoFlutuante(this.forma.x, this.forma.y - 120, 'SÓ EXPLOSIVA', '#ff9f1c'); return true; }
        // Estilhaços de madeira
        this.fase.efeitos.estilhacos(this.forma.x, this.forma.y, [0x6b4a2f, 0xc99a6b], 16, 320);
        // Remove
        this.destruir();
        // Reagiu
        return true;
    }

    // Some com ripas e placa
    destruir() { this.ripas.destroy(); this.placa.destroy(); super.destruir(); }
}

// ALJAVA: pegar ao encostar dá flechas especiais
class Aljava extends Obstaculo {
    constructor(fase, x, tipoFlecha) {
        // Área de toque invisível (o desenho da flecha fica por cima)
        const forma = fase.cena.add.rectangle(x, MOVIMENTO.chaoY - 40, 30, 40, 0xffffff, 0);
        // Gatilho
        super(fase, forma, 'gatilho');
        // Tipo de flecha que dá
        this.tipoFlecha = tipoFlecha;
        // Desenho da flecha inclinada (laranja = explosiva, ciano = elétrica)
        const cor = tipoFlecha === 'explosiva' ? 0xff9f1c : 0x5ce1ff;
        const g = fase.cena.add.graphics({ x, y: forma.y }).setDepth(5).setAngle(-45).setScale(1.3);
        // Brilho redondo atrás
        g.fillStyle(cor, 0.2).fillCircle(0, 0, 22);
        // Haste (contorno branco + cor)
        g.lineStyle(7, 0xffffff, 1).lineBetween(-17, 0, 10, 0);
        g.lineStyle(3, cor, 1).lineBetween(-17, 0, 10, 0);
        // Ponta
        g.fillStyle(cor, 1).fillTriangle(9, -8, 22, 0, 9, 8);
        g.lineStyle(2, 0xffffff, 1).strokeTriangle(9, -8, 22, 0, 9, 8);
        // Penas na traseira
        g.fillStyle(0xffffff, 1).fillTriangle(-20, 0, -12, 0, -24, -8).fillTriangle(-20, 0, -12, 0, -24, 8);
        // Símbolo do tipo no meio da haste (explosiva: bolinha; elétrica: raio curto)
        if (tipoFlecha === 'explosiva') g.fillStyle(0xffffff, 1).fillCircle(-3, 0, 3.5);
        else g.lineStyle(2, 0xffffff, 1).lineBetween(-6, -4, -2, 1).lineBetween(-2, 1, 1, -3);
        this.desenho = g;
        // Flutua um pouco (área de toque e desenho juntos)
        fase.cena.tweens.add({ targets: [forma, g], y: forma.y - 8, yoyo: true, repeat: -1, duration: 600 });
    }

    // Some com o desenho
    destruir() { this.desenho.destroy(); super.destruir(); }

    // Pegou
    aoTocar() {
        // Fase
        const fase = this.fase;
        // +1 (respeitando o máximo)
        fase.municao[this.tipoFlecha] = Math.min(fase.municao[this.tipoFlecha] + 1, this.tipoFlecha === 'explosiva' ? 3 : 2);
        // Texto
        fase.efeitos.textoFlutuante(this.forma.x, this.forma.y - 30, this.tipoFlecha === 'explosiva' ? '+1 EXPLOSIVA' : '+1 ELÉTRICA', '#ffffff');
        // Som
        som.tom('triangle', 660, 990, 120, 0.08);
        // Some
        this.destruir();
    }
}

// HABILIDADE TIRO: dispara uma flecha (na direção dada ou na mira automática)
class TiroArco extends Habilidade {
    constructor(fase) {
        // Nome, recarga e cor
        super(fase, { nome: 'FLECHA', recarga: GAVIAO.recarga, cor: 0x8c5cff });
    }

    // alvo = { x, y } no mundo (ou null = mira automática)
    usar(agora, alvo) {
        // Fase
        const fase = this.fase;
        // Mira automática
        if (!alvo) {
            // Próximo alvo
            const o = fase.proximoAlvo();
            // Nenhum: não gasta
            if (!o) { fase.efeitos.textoFlutuante(fase.player.x + 40, fase.player.y - 40, 'SEM ALVO', '#e2d6ff'); return false; }
            // Mira no centro dele
            alvo = { x: o.forma.x, y: o.forma.y, obs: o };
        }
        // Dispara
        fase.disparar(alvo);
        // Usou
        return true;
    }
}

// CLASSE FaseGaviao
class FaseGaviao extends Fase {
    constructor(cena, heroi, tentativa) {
        // Base
        super(cena, heroi, tentativa);
        // Controles
        this.textoControles = 'Clique/toque à direita: atirar · à esquerda: pular  ·  E: mira automática  ·  1/2/3: flecha';
        // Objetivo
        this.objetivo = 'Acerte os alvos para abrir o caminho.';
        // Frases do encerramento (texto grande e subtítulo da tela final)
        this.fraseCurta = 'NA MOSCA!'; this.fraseFinal = 'todas as portas foram abertas.';
        // Flechas voando
        this.flechas = [];
        // Munição especial
        this.municao = { explosiva: 0, eletrica: 0 };
        // Tipo escolhido manualmente (null = automático)
        this.tipoEscolhido = 'normal';
        // Estado das sequências: grupo → próximo número esperado
        this.sequencias = {};
        // Aglomerados: id → { alvos, inicio }
        this.aglomerados = {};
        // Vãos (pro chão)
        this.vaos = this.roteiro().filter((e) => e.tipo === 'vao');
    }

    // Encerramento: último disparo num alvo gigante na linha de chegada
    animacaoFinal() {
        // Alvo grande à frente
        const ax = this.player.x + 520, ay = 380;
        const anel = [this.cena.add.circle(ax, ay, 60, 0xffffff), this.cena.add.circle(ax, ay, 40, 0xff4d6d), this.cena.add.circle(ax, ay, 20, 0xffd166)];
        anel.forEach((a) => a.setDepth(20));
        // Flecha voando até o centro
        const fl = this.cena.add.rectangle(this.player.x + 20, this.player.y, 40, 4, 0xffffff).setDepth(21).setRotation(Math.atan2(ay - this.player.y, 500));
        som.tom('triangle', 900, 1400, 60, 0.08);
        this.cena.tweens.add({ targets: fl, x: ax - 10, y: ay, duration: this.efeitos.dur(260), onComplete: () => {
            // Acertou: alvo fica verde e anéis crescem
            anel[1].setFillStyle(0x3bff7a); this.efeitos.anel(ax, ay, 0x3bff7a, 40, 4, 500); this.efeitos.estilhacos(ax, ay, [0xffffff, 0x3bff7a], 20, 300);
            [660, 880, 1100, 1320].forEach((f, i) => som.tom('square', f, f, 70, 0.05, i * 70));
        } });
    }

    // Cubo violeta
    coresCubo() { return VISUAIS_HEROIS['Gaviao'].cores; }

    // Skin do Gavião: máscara lilás, arco e flecha (efeitosPoderes.js)
    desenharSkin(g) { VISUAIS_HEROIS['Gaviao'].desenhar(g); }

    // Chão com vãos
    segmentosChao() {
        // Começa com um segmento e vai cortando nos vãos
        const segs = []; let x0 = this.xMin();
        // Para cada vão em ordem
        this.vaos.sort((a, b) => a.x - b.x).forEach((v) => { segs.push([x0, v.x]); x0 = v.x + v.largura; });
        // Último segmento até depois da chegada
        segs.push([x0, this.cfg.comprimento + 1600]);
        // Devolve
        return segs;
    }

    // Habilidade
    criarHabilidade() { return new TiroArco(this); }

    // Teclas 1/2/3/Q pra escolher a flecha
    teclasExtras(tec) {
        // Escolhe tipo (só se tiver munição)
        const escolher = (t) => { this.tipoEscolhido = t; this.efeitos.textoFlutuante(this.player.x, this.player.y - 50, t.toUpperCase(), '#ffffff'); };
        // Handlers
        const h1 = () => escolher('normal'), h2 = () => escolher('explosiva'), h3 = () => escolher('eletrica');
        const hq = () => escolher({ normal: 'explosiva', explosiva: 'eletrica', eletrica: 'normal' }[this.tipoEscolhido]);
        // Liga
        tec.on('keydown-ONE', h1); tec.on('keydown-TWO', h2); tec.on('keydown-THREE', h3); tec.on('keydown-Q', hq);
        // Desliga no fim
        this.desligadores.push(() => { tec.off('keydown-ONE', h1); tec.off('keydown-TWO', h2); tec.off('keydown-THREE', h3); tec.off('keydown-Q', hq); });
    }

    // HUD: munição
    textoExtra() {
        // Marca o tipo escolhido com colchetes
        const m = (t, txt) => (this.tipoEscolhido === t ? `[${txt}]` : txt);
        // Texto
        return `${m('normal', '➶ NORMAL')}  ${m('explosiva', `✸ ${this.municao.explosiva}`)}  ${m('eletrica', `ϟ ${this.municao.eletrica}`)}`;
    }

    // Clique: metade direita = atirar no ponto; esquerda = pular
    aoClicarMundo(ponteiro) {
        // Na zona de pulo: deixa virar pulo
        if (ponteiro.x < GAVIAO.zonaTiro) return false;
        // Ponto no mundo
        let alvo = { x: ponteiro.worldX, y: ponteiro.worldY };
        // Assistência de mira: alvo perto do toque
        const perto = this.todosAlvos().find((o) => o.atingivel() && Phaser.Math.Distance.Between(o.forma.x, o.forma.y, alvo.x, alvo.y) <= GAVIAO.assistencia);
        // Achou: mira no centro dele
        if (perto) alvo = { x: perto.forma.x, y: perto.forma.y, obs: perto };
        // Atira
        this.habilidade.ativar(this.cena.time.now, alvo);
        // Clique usado
        return true;
    }

    // Botão direito = pular
    aoAcaoSecundaria() { this.aoPressionar('ponteiro'); }

    // Prática: o diamante guarda as flechas especiais que o jogador tinha
    estadoPratica() { return { municao: Object.assign({}, this.municao) }; }
    restaurarCheckpoint(cp) { if (cp.municao) Object.assign(this.municao, cp.municao); }

    // Todos os alvos ativos (inclui painéis)
    todosAlvos() { return this.obstaculos.filter((o) => o instanceof Alvo && o.ativo); }

    // Próximo alvo pra mira automática (respeita a ordem das sequências)
    proximoAlvo() {
        // Candidatos: atingíveis, à frente (ou um pouco atrás), até 1000 px
        const cand = this.todosAlvos().filter((o) => o.atingivel() && o.forma.x > this.player.x - 20 && o.forma.x - this.player.x < 1000);
        // Remove alvos de sequência que não são o próximo número
        const validos = cand.filter((o) => !o.grupo || o.n === (this.sequencias[o.grupo] || 1));
        // Também considera barricadas à frente (se tiver explosiva)
        const barr = this.municao.explosiva > 0 ? this.obstaculos.filter((o) => o instanceof Barricada && o.ativo && o.forma.x > this.player.x && o.forma.x - this.player.x < 900) : [];
        // Junta e pega o mais perto
        const todos = validos.concat(barr).sort((a, b) => a.forma.x - b.forma.x);
        // Devolve o primeiro (ou null)
        return todos[0] || null;
    }

    // Escolhe o tipo de flecha pro alvo (automático quando faz sentido)
    tipoPara(obs) {
        // Painel: elétrica (se tiver)
        if (obs instanceof Painel && this.municao.eletrica > 0) return 'eletrica';
        // Barricada: explosiva (se tiver)
        if (obs instanceof Barricada && this.municao.explosiva > 0) return 'explosiva';
        // Aglomerado: explosiva se tiver (pega os 3 de uma vez)
        if (obs && obs.aglomerado && this.municao.explosiva > 0 && this.tipoEscolhido === 'explosiva') return 'explosiva';
        // Escolha manual (se tiver munição)
        if (this.tipoEscolhido !== 'normal' && this.municao[this.tipoEscolhido] > 0) return this.tipoEscolhido;
        // Normal
        return 'normal';
    }

    // Cria a flecha voando até o ponto
    disparar(alvo) {
        // Jogador
        const p = this.player;
        // Origem: frente do cubo
        const x0 = p.x + 20, y0 = p.y;
        // Direção normalizada
        const ang = Math.atan2(alvo.y - y0, alvo.x - x0);
        // Tipo de flecha (automático pelo alvo, se for o caso)
        const tipo = this.tipoPara(alvo.obs);
        // Gasta munição especial
        if (tipo !== 'normal') this.municao[tipo]--;
        // Depois de especial, volta pro normal
        if (tipo !== 'normal') this.tipoEscolhido = 'normal';
        // Cor por tipo
        const cor = { normal: 0xffffff, explosiva: 0xff9f1c, eletrica: 0x5ce1ff }[tipo];
        // Desenho da flecha (haste, ponta em losango, penas) girado na direção do tiro
        const g = this.cena.add.graphics({ x: x0, y: y0 }).setRotation(ang).setDepth(12);
        g.lineStyle(6, cor, 0.25).lineBetween(-18, 0, 12, 0);
        g.lineStyle(2.5, cor, 1).lineBetween(-18, 0, 12, 0);
        g.fillStyle(cor, 1).fillPoints([{ x: 8, y: 0 }, { x: 12, y: -4 }, { x: 19, y: 0 }, { x: 12, y: 4 }], true);
        g.lineStyle(2, tipo === 'normal' ? 0x8c5cff : 0xffffff, 1).lineBetween(-18, 0, -23, -5).lineBetween(-18, 0, -23, 5).lineBetween(-14, 0, -19, -5).lineBetween(-14, 0, -19, 5);
        // Rastro de energia (cor do tipo de flecha)
        const rastro = reducedMotion.matches ? null : this.cena.add.particles(x0, y0, 'faisca', {
            speed: { min: 5, max: 30 }, lifespan: tipo === 'normal' ? 180 : 300, scale: { start: tipo === 'normal' ? 0.6 : 1, end: 0 }, alpha: { start: 0.8, end: 0 },
            tint: { normal: [0xe2d6ff, 0x8c5cff], explosiva: [0xffd166, 0xff9f1c, 0xff4d00], eletrica: [0x5ce1ff, 0xffffff] }[tipo], blendMode: 'ADD', frequency: 12
        }).setDepth(11);
        // Guarda a flecha
        this.flechas.push({ x: x0, y: y0, vx: Math.cos(ang) * GAVIAO.velFlecha, vy: Math.sin(ang) * GAVIAO.velFlecha, vida: GAVIAO.vidaFlecha, tipo, g, rastro, ang });
        // Estalo da corda: anel lilás na saída e recuo do corpo
        fxOnda(this, x0, y0, cor === 0xffffff ? 0xe2d6ff : cor, 6, 26, 180, 2);
        this.player.avanco = -5;
        fxCenario(this, 'flecha', { tipo });
        // Som do disparo
        som.tom('triangle', 900, 1400, 60, 0.07); som.ruido(40, 0.05, 6000);
    }

    // Move as flechas e testa colisão (segmento da posição anterior até a atual)
    atualizarMecanica(agora, dtReal) {
        // Cada flecha (de trás pra frente, pra poder remover)
        for (let i = this.flechas.length - 1; i >= 0; i--) {
            // Flecha
            const f = this.flechas[i];
            // Posição anterior
            const xa = f.x, ya = f.y;
            // Anda
            f.x += f.vx * dtReal / 1000; f.y += f.vy * dtReal / 1000;
            // Envelhece
            f.vida -= dtReal;
            // Segmento percorrido neste frame
            const seg = new Phaser.Geom.Line(xa, ya, f.x, f.y);
            // Testa o que foi atingido primeiro (o mais perto do começo do segmento)
            const atingido = this.primeiroNoCaminho(seg);
            // Atualiza o desenho
            f.g.setPosition(f.x, f.y); if (f.rastro) f.rastro.setPosition(f.x - Math.cos(f.ang) * 16, f.y - Math.sin(f.ang) * 16);
            // Elétrica: faísca saltando da flecha de vez em quando
            if (f.tipo === 'eletrica' && Math.random() < 0.25) fxRaio(this, f.x, f.y, f.x - Math.cos(f.ang) * 24 + Phaser.Math.Between(-10, 10), f.y + Phaser.Math.Between(-14, 14), 0x5ce1ff, 90, 3, 5);
            // Bateu em algo ou acabou a vida: resolve e remove
            if (atingido || f.vida <= 0 || f.y < MOVIMENTO.tetoY || f.y > MOVIMENTO.chaoY) {
                // Resolve o impacto
                if (atingido) this.impacto(f, atingido);
                // Apaga o desenho
                f.g.destroy();
                if (f.rastro) { const r = f.rastro; r.stop(); this.cena.time.delayedCall(320, () => r.destroy()); }
                // Remove da lista
                this.flechas.splice(i, 1);
            }
        }
        // Aglomerados: se o tempo acabou sem acertar os 3, reseta
        Object.values(this.aglomerados).forEach((ag) => {
            // Começou e passou do tempo sem completar
            if (ag.inicio && !ag.completo && agora - ag.inicio > GAVIAO.tempoAglomerado) {
                // Reseta os alvos
                ag.alvos.forEach((o) => { o.acertado = false; o.pintar(false); });
                // Zera o início
                ag.inicio = 0;
                // Som de erro
                som.tom('square', 220, 180, 180, 0.07);
            }
        });
        // Retícula do mouse (só aparece na zona de tiro)
        this.atualizarMira();
    }

    // Primeiro obstáculo cruzado pelo segmento (alvos, barricadas, portas fechadas)
    primeiroNoCaminho(seg) {
        // Melhor e distância
        let melhor = null, menor = Infinity;
        // Passa pelos obstáculos
        this.obstaculos.forEach((o) => {
            // Só ativos
            if (!o.ativo) return;
            // Alvo: círculo de raio 22
            if (o instanceof Alvo) {
                // Só se pode ser atingido
                if (!o.atingivel()) return;
                // Cruza o círculo?
                if (Phaser.Geom.Intersects.LineToCircle(seg, new Phaser.Geom.Circle(o.forma.x, o.forma.y, 22))) {
                    // Distância do começo do segmento
                    const d = Phaser.Math.Distance.Between(seg.x1, seg.y1, o.forma.x, o.forma.y);
                    // Guarda o mais perto
                    if (d < menor) { menor = d; melhor = o; }
                }
            } else if (o.bloqueiaFlecha) {
                // Porta/barricada: retângulo
                const r = o.forma.getBounds();
                // Cruza?
                if (Phaser.Geom.Intersects.LineToRectangle(seg, r)) {
                    // Distância até a borda esquerda
                    const d = Math.abs(r.x - seg.x1);
                    // Guarda o mais perto
                    if (d < menor) { menor = d; melhor = o; }
                }
            }
        });
        // Devolve
        return melhor;
    }

    // Resolve o impacto da flecha no obstáculo
    impacto(f, obs) {
        // Explosiva: explode numa área
        if (f.tipo === 'explosiva') {
            // Ponto da explosão
            const ex = f.x, ey = f.y;
            // Anel laranja grande
            this.efeitos.anel(ex, ey, 0xff9f1c, 20, GAVIAO.raioExplosao / 20, 320);
            // Partículas
            this.efeitos.estilhacos(ex, ey, [0xff9f1c, 0xffd166], 16, 300);
            // Bola de fogo: clarão, segunda onda, brasas caindo e fumaça
            fxOnda(this, ex, ey, 0xffd166, 14, GAVIAO.raioExplosao * 1.3, 420, 5);
            fxFaiscas(this, ex, ey, [0xffffff, 0xffd166, 0xff6a00], 22, 380, 560, { gravityY: 600 });
            this.efeitos.poeira(ex, ey, 0x5a4a3a, 8);
            if (!reducedMotion.matches) this.efeitos.flash(255, 150, 40, 120);
            // Som
            som.ruido(300, 0.18, 800);
            // Tremor
            this.efeitos.tremor(120, 0.005);
            // Acerta tudo no raio (alvos e barricadas)
            this.obstaculos.slice().forEach((o) => {
                // Só alvos/barricadas ativos dentro do raio
                if (!o.ativo || !(o instanceof Alvo || o instanceof Barricada)) return;
                // Distância
                if (Phaser.Math.Distance.Between(ex, ey, o.forma.x, o.forma.y) <= GAVIAO.raioExplosao + (o instanceof Barricada ? 60 : 0)) o.aoAcertar(1, 'explosiva');
            });
            // Pronto
            return;
        }
        // Elétrica: acerta e encadeia em até 2 alvos perto
        if (f.tipo === 'eletrica') {
            // Acerta o primeiro
            obs.aoAcertar(1, 'eletrica');
            // Descarga: raios curtos em volta do alvo e faíscas ciano
            for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2; fxRaio(this, obs.forma.x, obs.forma.y, obs.forma.x + Math.cos(a) * 46, obs.forma.y + Math.sin(a) * 46, 0x5ce1ff, 200, 4, 8); }
            fxFaiscas(this, obs.forma.x, obs.forma.y, [0x5ce1ff, 0xffffff], 12, 240, 360);
            // Lista de já atingidos
            const feitos = [obs];
            // Até 2 saltos
            for (let s = 0; s < 2; s++) {
                // Último atingido
                const ult = feitos[feitos.length - 1];
                // Próximo alvo perto
                const prox = this.todosAlvos().find((o) => !feitos.includes(o) && o.atingivel() && Phaser.Math.Distance.Between(o.forma.x, o.forma.y, ult.forma.x, ult.forma.y) <= GAVIAO.raioEletrica);
                // Nenhum: para
                if (!prox) break;
                // Raio em zigue-zague entre os dois
                this.desenharRaio(ult.forma.x, ult.forma.y, prox.forma.x, prox.forma.y);
                // Acerta
                prox.aoAcertar(1, 'eletrica');
                // Guarda
                feitos.push(prox);
            }
            // Som elétrico
            som.tom('sawtooth', 2000, 600, 200, 0.06);
            // Pronto
            return;
        }
        // Normal: acerta com lascas e um anel curto no ponto do impacto
        fxFaiscas(this, f.x, f.y, [0xffffff, 0xe2d6ff, 0x8c5cff], 8, 220, 300);
        fxOnda(this, f.x, f.y, 0xe2d6ff, 6, 30, 200, 2);
        obs.aoAcertar(1, 'normal');
    }

    // Raio elétrico em zigue-zague
    desenharRaio(x1, y1, x2, y2) {
        // Graphics
        const g = this.cena.add.graphics().setDepth(14);
        // Ciano
        g.lineStyle(3, 0x5ce1ff, 1);
        // Começa no primeiro ponto
        g.beginPath(); g.moveTo(x1, y1);
        // 6 pontos intermediários com desvio aleatório
        for (let i = 1; i < 6; i++) g.lineTo(Phaser.Math.Linear(x1, x2, i / 6) + Phaser.Math.Between(-10, 10), Phaser.Math.Linear(y1, y2, i / 6) + Phaser.Math.Between(-10, 10));
        // Termina no segundo
        g.lineTo(x2, y2); g.strokePath();
        // Some
        this.cena.tweens.add({ targets: g, alpha: 0, duration: this.efeitos.dur(250), onComplete: () => g.destroy() });
    }

    // Um alvo foi atingido: sequência, aglomerado ou simples
    alvoAtingido(alvo) {
        // Alvo de sequência
        if (alvo.grupo) {
            // Número esperado
            const esperado = this.sequencias[alvo.grupo] || 1;
            // Errou a ordem: zera a sequência
            if (alvo.n !== esperado) {
                // Volta todos do grupo pro normal
                this.todosAlvos().filter((o) => o.grupo === alvo.grupo).forEach((o) => { o.acertado = false; o.pintar(false); });
                // Zera
                this.sequencias[alvo.grupo] = 1;
                // X vermelho e som
                this.efeitos.textoFlutuante(alvo.forma.x, alvo.forma.y - 30, '✕ ORDEM', '#ff3b3b');
                som.tom('square', 220, 180, 180, 0.07);
                // Reagiu
                return true;
            }
            // Certo: avança a sequência
            this.sequencias[alvo.grupo] = esperado + 1;
            // Último da sequência (o que tem "abre") aciona; os outros só ficam verdes
            alvo.confirmar(!!alvo.abre);
            // Reagiu
            return true;
        }
        // Alvo de aglomerado
        if (alvo.aglomerado) {
            // Estado do aglomerado
            const ag = this.aglomerados[alvo.aglomerado];
            // Primeiro acerto: começa o tempo
            if (!ag.inicio) ag.inicio = this.cena.time.now;
            // Marca este (sem acionar)
            alvo.confirmar(false);
            // Todos acertados a tempo: aciona
            if (ag.alvos.every((o) => o.acertado)) { ag.completo = true; this.acionarComSom(ag.abre); }
            // Reagiu
            return true;
        }
        // Alvo simples
        alvo.confirmar(true);
        // Reagiu
        return true;
    }

    // Aciona uma ligação com som de "porta abrindo"
    acionarComSom(id) {
        // Aciona
        this.acionar(id);
        // Arpejo
        [660, 880, 1100].forEach((f, i) => som.tom('square', f, f, 60, 0.05, i * 60));
    }

    // Retícula que segue o mouse (só na zona de tiro, e só com mouse)
    atualizarMira() {
        // Ponteiro atual
        const pt = this.cena.input.activePointer;
        // Cria a retícula na primeira vez
        if (!this.mira) {
            // Graphics fixo na tela
            this.mira = this.cena.add.graphics().setScrollFactor(0).setDepth(90);
        }
        // Limpa
        this.mira.clear();
        // Só mostra com mouse dentro da zona de tiro e jogador vivo
        if (!pt.wasTouch && pt.x >= GAVIAO.zonaTiro && this.player.vivo && !this.concluida) {
            // Linha pontilhada do cubo até o ponteiro
            const cam = this.cena.cameras.main;
            // Posição do cubo na tela
            const px = this.player.x - cam.scrollX + 20, py = this.player.y - cam.scrollY;
            // Pontinhos ao longo da linha
            this.mira.fillStyle(0xffffff, 0.35);
            // Distância total
            const dist = Phaser.Math.Distance.Between(px, py, pt.x, pt.y);
            // Um ponto a cada 18 px
            for (let d = 0; d < dist; d += 18) this.mira.fillCircle(px + (pt.x - px) * d / dist, py + (pt.y - py) * d / dist, 2);
            // Retícula
            this.mira.lineStyle(2, 0xffffff, 0.9).strokeCircle(pt.x, pt.y, 12);
            this.mira.lineBetween(pt.x - 18, pt.y, pt.x - 6, pt.y); this.mira.lineBetween(pt.x + 6, pt.y, pt.x + 18, pt.y);
            this.mira.lineBetween(pt.x, pt.y - 18, pt.x, pt.y - 6); this.mira.lineBetween(pt.x, pt.y + 6, pt.x, pt.y + 18);
        }
    }

    // Ao criar: linha divisória das zonas por 3 s (ajuda no toque) + cursor escondido na zona de tiro
    aoCriar() {
        // Linha tracejada vertical em x=420 da tela
        const linha = this.cena.add.graphics().setScrollFactor(0).setDepth(60);
        // Branca transparente
        linha.lineStyle(2, 0xffffff, 0.25);
        // Tracejado
        for (let y = 110; y < 650; y += 20) linha.lineBetween(GAVIAO.zonaTiro, y, GAVIAO.zonaTiro, y + 10);
        // Textos das zonas
        const t1 = this.cena.add.text(GAVIAO.zonaTiro - 20, 630, 'PULAR', { fontFamily: 'Arial', fontSize: '14px', color: '#ffffff' }).setOrigin(1, 1).setScrollFactor(0).setAlpha(0.4).setDepth(60);
        const t2 = this.cena.add.text(GAVIAO.zonaTiro + 20, 630, 'ATIRAR', { fontFamily: 'Arial', fontSize: '14px', color: '#ffffff' }).setOrigin(0, 1).setScrollFactor(0).setAlpha(0.4).setDepth(60);
        // Some depois de 3 s
        this.cena.tweens.add({ targets: [linha, t1, t2], alpha: 0, delay: 3000, duration: 600 });
        // Cursor do sistema escondido (a retícula substitui)
        this.cena.game.canvas.style.cursor = 'crosshair';
        // Volta o cursor ao sair
        this.desligadores.push(() => { this.cena.game.canvas.style.cursor = ''; });
        // Luzes de alarme acendendo da esquerda pra direita (entrada)
        for (let i = 0; i < 8; i++) {
            // Luz vermelha no teto
            const luz = this.cena.add.circle(160 + i * 140, 112, 6, 0xff2e63).setScrollFactor(0).setDepth(55).setAlpha(0);
            // Acende em sequência e apaga
            this.cena.tweens.add({ targets: luz, alpha: 1, delay: i * 90, duration: 120, yoyo: true, hold: 300, onComplete: () => luz.destroy() });
        }
    }

    // Elementos do roteiro
    criarElemento(ev) {
        // Escolhe pelo tipo
        switch (ev.tipo) {
            // Alvos
            case 'alvo': new Alvo(this, ev.x, ev.y, { abre: ev.abre }); break;
            case 'alvoMovel': new Alvo(this, ev.x, ev.y, { abre: ev.abre, amp: ev.amp }); break;
            case 'alvoTemp': new Alvo(this, ev.x, ev.y, { abre: ev.abre, temporario: true }); break;
            case 'seq': new Alvo(this, ev.x, ev.y, { abre: ev.abre, grupo: ev.grupo, n: ev.n }); break;
            case 'seqMovel': new Alvo(this, ev.x, ev.y, { abre: ev.abre, grupo: ev.grupo, n: ev.n, amp: ev.amp }); break;
            case 'seqTemp': new Alvo(this, ev.x, ev.y, { abre: ev.abre, grupo: ev.grupo, n: ev.n, temporario: true }); break;
            // Alvo meio escondido atrás de uma placa (a parte de cima fica coberta)
            case 'alvoEscondido': {
                // Alvo
                new Alvo(this, ev.x, ev.y, { abre: ev.abre });
                // Placa cobrindo a metade de cima (bloqueia flechas)
                const capa = new Bloco(this, ev.x - 40, ev.y - 34, 70, 30, 0x1f1a33, 0x8c7bd6);
                // Bloqueia flecha, não tem física com o jogador
                capa.bloqueiaFlecha = true; capa.ligarFisica(false); capa.forma.setDepth(7);
                break;
            }
            // Aglomerado: 3 alvos juntos (acertar os 3 em 1,2 s)
            case 'aglomerado': {
                // Id do aglomerado
                const id = `ag${ev.x}`;
                // Cria os 3 alvos em triângulo
                const alvos = [[0, -30], [-28, 20], [28, 20]].map(([dx, dy]) => { const a = new Alvo(this, ev.x + dx, ev.y + dy); a.aglomerado = id; return a; });
                // Guarda o estado
                this.aglomerados[id] = { alvos, abre: ev.abre, inicio: 0, completo: false };
                break;
            }
            // Painel blindado (só elétrica)
            case 'painel': new Painel(this, ev.x, ev.y, { abre: ev.abre }); break;
            // Porta e laser
            case 'porta': new PortaGaviao(this, ev.x, ev.id, ev.travas || 1); break;
            case 'laser': new LaserGaviao(this, ev.x, ev.id, ev.travas || 1); break;
            // Vão com ponte
            case 'vao': new Ponte(this, ev.x, ev.largura, ev.ponte); break;
            // Barricada e aljava
            case 'barricada': new Barricada(this, ev.x); break;
            case 'aljava': new Aljava(this, ev.x, ev.flecha); break;
            // Comuns (dica, espinho, bloco)
            default: super.criarElemento(ev);
        }
    }

    // Cenário: base de segurança (painéis, tubulações, grades)
    // Cenário temático (base tática à noite: hangares, torre, contêineres, radares, holofotes e luzes de pista) — desenhado em cenarios.js
    criarParalaxe() { Cenarios.gaviao(this); }

    // O cenário reage aos poderes e momentos da fase (cenarios.js)
    cenarioReagir(evento, dados) { Cenarios.reagir(this, evento, dados); }

    // Roteiro desenhado à mão
    // Checkpoints (3: fase longa, 17600 px, com muitos alvos). Fora de pares alvo→porta ainda fechados
    checkpoints() {
        return [
            { x: 4800 },    // Depois da ponte b1; os alvos em sequência (5300) vêm depois
            { x: 9500 },    // Depois da barricada; a aljava elétrica (9800) vem depois
            { x: 13200 },   // Depois da ponte b2; sequência s2 à frente, porta em 13950
            { x: 17350 }    // Depois da porta p6 — começa o trecho do UFO
        ];
    }

    roteiro() {
        return [
            // TUTORIAL
            { x: 520, tipo: 'dica', txt: 'Clique no alvo (ou aperte E)' },
            { x: 1300, tipo: 'alvo', y: 300, abre: 'p1' }, { x: 1700, tipo: 'porta', id: 'p1' },
            { x: 2300, tipo: 'dica', txt: 'Alvos também desligam lasers' },
            // Holofote de segurança varrendo o corredor: a lâmpada é o alvo que desliga o laser
            { x: 2700, tipo: 'holofote', y: 260, abre: 'l1' }, { x: 3000, tipo: 'laser', id: 'l1' },
            // No ritmo da música: espinho, espinho, serra (2 batidas entre cada)
            { x: 3250, tipo: 'ritmo', padrao: '^.^.S' },
            // MEIO
            { x: 3800, tipo: 'dica', txt: 'O alvo estende a ponte' },
            { x: 4000, tipo: 'alvo', y: 240, abre: 'b1' }, { x: 4300, tipo: 'vao', largura: 360, ponte: 'b1' },
            { x: 5100, tipo: 'dica', txt: 'Siga a ordem dos números' },
            { x: 5300, tipo: 'seq', grupo: 's1', n: 1, y: 220 }, { x: 5380, tipo: 'seq', grupo: 's1', n: 2, y: 400 },
            { x: 5460, tipo: 'seq', grupo: 's1', n: 3, y: 560, abre: 'p2' }, { x: 5900, tipo: 'porta', id: 'p2' },
            { x: 6500, tipo: 'alvoMovel', y: 380, amp: 110, abre: 'p3' }, { x: 6900, tipo: 'porta', id: 'p3' },
            { x: 7400, tipo: 'mini' }, { x: 7440, tipo: 'mini' },
            { x: 7800, tipo: 'alvoTemp', y: 260, abre: 'l2' }, { x: 8200, tipo: 'laser', id: 'l2' },
            { x: 8600, tipo: 'aljava', flecha: 'explosiva' }, { x: 8700, tipo: 'dica', txt: 'Barricada: flecha explosiva (automática no E)' },
            { x: 9200, tipo: 'barricada' },
            { x: 9800, tipo: 'aljava', flecha: 'eletrica' }, { x: 9900, tipo: 'dica', txt: 'Painel blindado: só a elétrica' },
            { x: 10400, tipo: 'painel', y: 300, abre: 'l3' }, { x: 10800, tipo: 'laser', id: 'l3' },
            // FINAL (portal verde »»: tudo mais rápido até o portal azul »)
            { x: 11050, tipo: 'velocidade', mult: 1.25 },
            { x: 11400, tipo: 'aglomerado', y: 300, abre: 'p4' }, { x: 11800, tipo: 'porta', id: 'p4' },
            { x: 12300, tipo: 'alvoEscondido', y: 230, abre: 'b2' }, { x: 12450, tipo: 'serraDesce' },
            { x: 12700, tipo: 'vao', largura: 360, ponte: 'b2' },
            { x: 13400, tipo: 'seq', grupo: 's2', n: 1, y: 240 }, { x: 13460, tipo: 'seqMovel', grupo: 's2', n: 2, y: 400, amp: 90 },
            { x: 13520, tipo: 'seq', grupo: 's2', n: 3, y: 560, abre: 'p5' }, { x: 13950, tipo: 'porta', id: 'p5' },
            { x: 14250, tipo: 'velocidade', mult: 1 },
            { x: 14500, tipo: 'alvoTemp', y: 240, abre: 'l4' }, { x: 14560, tipo: 'alvoMovel', y: 480, amp: 80, abre: 'l4' },
            { x: 15000, tipo: 'laser', id: 'l4', travas: 2 },
            { x: 15500, tipo: 'aljava', flecha: 'explosiva' }, { x: 15900, tipo: 'barricada' },
            { x: 16400, tipo: 'seq', grupo: 's3', n: 1, y: 220 }, { x: 16460, tipo: 'seqMovel', grupo: 's3', n: 2, y: 380, amp: 70 },
            { x: 16520, tipo: 'seqTemp', grupo: 's3', n: 3, y: 520 }, { x: 16600, tipo: 'seq', grupo: 's3', n: 4, y: 300, abre: 'p6' },
            // Laser de piso no ritmo e espinhos que brotam antes da última porta
            { x: 16180, tipo: 'laserPiso', largura: 120, padrao: '1100' },
            { x: 16700, tipo: 'emergente' }, { x: 16740, tipo: 'emergente' },
            { x: 17100, tipo: 'porta', id: 'p6' },
            // FINAL EXTRA — MODO UFO (portal ◓): cada toque é um pulinho; passe pelos vãos dos pilares
            { x: 17500, tipo: 'dica', txt: 'Portal ◓ = UFO: cada toque é um pulinho no ar' },
            { x: 17800, tipo: 'modo', modo: 'ufo' },
            // Os pilares deslizam do teto e do chão até o lugar quando você se aproxima
            { x: 18250, tipo: 'pilar', centro: 470, vao: 200, entra: true }, { x: 18700, tipo: 'pilar', centro: 320, vao: 200, entra: true },
            { x: 19150, tipo: 'pilar', centro: 500, vao: 190, entra: true },
            // Voando, a flecha ainda manda: acerte o alvo pra abrir a porta
            { x: 19300, tipo: 'dica', txt: 'Voando também dá pra atirar: abra a porta' },
            { x: 19750, tipo: 'holofote', y: 240, abre: 'p7' }, { x: 20000, tipo: 'porta', id: 'p7' },
            { x: 20350, tipo: 'pilar', centro: 380, vao: 190, entra: true },
            { x: 20700, tipo: 'modo', modo: 'cubo' },
            // Poucos grupos curtos de espinhos no chão entre os pilares (castigam quem voa baixo demais)
            // e a pirâmide invertida pendurada no teto (só obstáculos: triângulo sempre é perigo)
            { x: 18420, ate: 18540, tipo: 'fileira' }, { x: 18870, ate: 18990, tipo: 'fileira' },
            { x: 20120, ate: 20240, tipo: 'fileira' },
            { x: 19300, tipo: 'piramide', linhas: [6, 4, 2] }
        ];
    }
}
