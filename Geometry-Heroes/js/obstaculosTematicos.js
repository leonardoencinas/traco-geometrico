// ================================================================
// obstaculosTematicos.js — OBSTÁCULOS TEMÁTICOS e variações de level design (rodada 7)
// Novos perigos por fase (estruturas móveis, armadilhas, lasers, barreiras...).
// Regras: triângulo = perigo; todo perigo novo avisa antes (piscar, marca no chão, trajetória);
// tudo é DETERMINÍSTICO (pela posição do jogador ou pela batida da música), nunca sorteado.
// Visual neon da rodada 6: preto (tema.objeto), contorno claro (tema.neon), brilho (tema.linha).
// Os pilotos automáticos pulam qualquer obstáculo com a marca `saltar = true`.
// ================================================================

// Cores do tema com reserva (fases antigas sem objeto/neon)
function coresNeon(fase) {
    const t = fase.tema || {};
    return { preto: t.objeto !== undefined ? t.objeto : 0x0a0a12, neon: t.neon || 0xffffff, brilho: t.linha || 0xffffff };
}

// ESPINHO EMERGENTE: fica escondido dentro do chão e SOBE quando o jogador chega perto.
// Antes de subir, uma faixa pisca no chão marcando onde ele vai aparecer (aviso).
class EspinhoEmergente extends Espinho {
    constructor(fase, x, yBase = null, noTeto = false) {
        super(fase, x, noTeto, null, null, noTeto ? null : yBase);
        // Posição final e quanto ele fica enterrado
        this.yFinal = this.forma.y; this.enterrado = noTeto ? -40 : 40;
        // Faixa de aviso no chão (ou no teto)
        const base = noTeto ? MOVIMENTO.tetoY + 3 : (yBase !== null ? yBase : MOVIMENTO.chaoY) - 3;
        this.aviso = fase.cena.add.rectangle(x + 20, base, 40, 6, coresNeon(fase).brilho, 0).setDepth(3);
        this.erguer(0, 0);
    }

    // Coloca o espinho na altura t (0 = enterrado, 1 = de pé)
    erguer(t) {
        this.forma.y = this.yFinal + this.enterrado * (1 - t);
        this.forma.body.reset(this.forma.x, this.forma.y);
        // Só machuca quando já está quase todo pra fora (e na dimensão ativa, no Dr. Estranho)
        const dimOk = !this.dim || !this.fase.dim || this.dim === this.fase.dim;
        this.forma.body.enable = this.ativo && t > 0.6 && dimOk;
    }

    atualizar(dt, agora) {
        // Distância da frente do cubo até o espinho
        const dx = this.forma.x - 20 - (this.fase.player.x + 20);
        // Sobe entre 430 e 310 px de distância (bem antes do pulo)
        const t = Phaser.Math.Clamp((430 - dx) / 120, 0, 1);
        this.erguer(t);
        // Aviso: pisca enquanto ainda não subiu, fica aceso fraco depois
        const pisca = reducedMotion.matches ? 0.7 : (Math.floor(agora / 90) % 2 ? 0.9 : 0.25);
        this.aviso.setAlpha(dx < 760 && t < 1 ? pisca * this.forma.alpha : (t >= 1 ? 0.35 * this.forma.alpha : 0));
        this.sincronizarHalo();
    }

    destruir() { this.aviso.destroy(); super.destruir(); }
}

// LASER DE PISO: feixe baixo entre dois emissores, liga e desliga no RITMO da música.
// padrao = um caractere por batida ('1' ligado, '0' desligado). Meia batida antes de ligar ele pisca.
// Dá pra pular sempre; quem pega o ritmo pode passar no instante desligado.
class LaserPiso extends Obstaculo {
    constructor(fase, x, largura = 120, padrao = '1110', yBase = MOVIMENTO.chaoY, cor = null) {
        const c = coresNeon(fase), corFeixe = cor !== null ? cor : c.brilho;
        // Feixe (retângulo fino logo acima do chão)
        const forma = fase.cena.add.rectangle(x + largura / 2, yBase - 12, largura - 16, 8, corFeixe).setDepth(4);
        super(fase, forma, 'mortal');
        forma.body.setSize(largura - 20, 8);
        // Brilho largo em volta do feixe
        this.brilho = fase.cena.add.rectangle(forma.x, forma.y, largura - 16, 20, corFeixe, 0.25).setDepth(3);
        // Emissores (pretos com contorno) nas pontas
        this.postes = fase.cena.add.graphics().setDepth(5);
        [x, x + largura - 10].forEach((px) => {
            this.postes.fillStyle(c.preto, 1).fillRect(px, yBase - 26, 10, 26);
            this.postes.lineStyle(2, c.neon, 1).strokeRect(px, yBase - 26, 10, 26);
            this.postes.fillStyle(corFeixe, 1).fillRect(px + 3, yBase - 16, 4, 6);
        });
        this.padrao = padrao; this.cor = corFeixe;
        // Marca pros pilotos automáticos (obstáculo baixo: pule)
        this.saltar = true;
    }

    // Ligado nesta batida? (relógio da música da fase; antes da 1ª batida: ligado)
    estadoBatida() {
        const f = this.fase, bpm = f.bpm || f.cfg.bpm || 128;
        const i = f.indiceBatida || 0, frac = (f.relogioBatida || 0) / (60000 / bpm);
        const p = this.padrao, agora = p[i % p.length] === '1', prox = p[(i + 1) % p.length] === '1';
        return { ligado: agora, avisando: !agora && prox && frac > 0.5 };
    }

    atualizar(dt, tempo) {
        const { ligado, avisando } = this.estadoBatida();
        const dimOk = !this.dim || !this.fase.dim || this.dim === this.fase.dim;
        this.forma.body.enable = ligado && dimOk;
        const fant = this.dim && this.fase.dim && this.dim !== this.fase.dim ? 0.2 : 1;
        // Ligado: forte · avisando: pisca · desligado: tracejado apagado
        const pisca = reducedMotion.matches ? 0.5 : (Math.floor(tempo / 70) % 2 ? 0.8 : 0.2);
        const a = ligado ? 1 : (avisando ? pisca : 0.12);
        this.forma.setAlpha(a * fant); this.brilho.setAlpha((ligado ? 0.3 : a * 0.2) * fant); this.postes.setAlpha(fant);
    }

    destruir() { this.brilho.destroy(); this.postes.destroy(); super.destruir(); }
}

// BLOCO DE ENTRADA: bloco neon que DESLIZA até o lugar quando o jogador se aproxima (como os
// gatilhos de movimento dos jogos de ritmo). Já está parado bem antes de o jogador chegar.
class BlocoEntrada extends BlocoNeon {
    constructor(fase, x, yTopo, largura, altura, deslocY = -300, id = null) {
        super(fase, x, yTopo, largura, altura, id);
        this.yFinal = this.forma.y; this.deslocY = deslocY;
        this.posicionar(0);
    }

    posicionar(t) {
        // Desacelera no fim (entrada suave)
        const e = 1 - Math.pow(1 - t, 3);
        this.forma.y = this.yFinal + this.deslocY * (1 - e);
        this.forma.body.reset(this.forma.x, this.forma.y);
    }

    atualizar(dt, agora) {
        // Entra entre 1000 e 620 px de distância (parado bem antes do jogador chegar)
        const dx = (this.forma.x - this.forma.width / 2) - (this.fase.player.x + 20);
        this.posicionar(Phaser.Math.Clamp((1000 - dx) / 380, 0, 1));
        super.atualizar(dt, agora);
    }
}

// TORRETA (Homem de Ferro): canhão parado que atira projéteis pra esquerda num ritmo fixo.
// A luz do cano enche antes de cada disparo (aviso). O repulsor destrói a torreta e os projéteis.
class Torreta extends Obstaculo {
    constructor(fase, x, y, intervalo = 1100) {
        const c = coresNeon(fase);
        const forma = fase.cena.add.rectangle(x, y, 44, 34, c.preto).setStrokeStyle(3, c.neon).setDepth(5);
        super(fase, forma, 'mortal');
        this.alvoTiro = true;
        // Cano e luz de carga
        this.cano = fase.cena.add.rectangle(x - 30, y, 22, 8, c.preto).setStrokeStyle(2, c.neon).setDepth(5);
        this.luz = fase.cena.add.circle(x - 4, y, 7, 0xff3b3b, 0.3).setDepth(6);
        this.intervalo = intervalo; this.relogio = 0; this.disparos = 0;
    }

    atualizar(dt) {
        const dx = this.forma.x - this.fase.player.x;
        // Liga quando entra na tela (relógio próprio: o padrão é sempre o mesmo)
        if (dx > 820 || dx < -200) return;
        this.relogio += dt;
        // Carga: luz enche do vermelho fraco ao branco
        const carga = (this.relogio % this.intervalo) / this.intervalo;
        this.luz.setAlpha(0.3 + 0.7 * carga).setScale(0.8 + 0.6 * carga);
        // Disparo a cada intervalo
        const n = Math.floor(this.relogio / this.intervalo);
        if (n > this.disparos && dx > 120) {
            this.disparos = n;
            new ProjetilTorreta(this.fase, this.forma.x - 44, this.forma.y);
            this.fase.efeitos.anel(this.forma.x - 42, this.forma.y, 0xff8a3b, 10, 2, 160);
            som.tom('square', 500, 200, 80, 0.04);
        }
    }

    aoAcertar() {
        this.fase.efeitos.estilhacos(this.forma.x, this.forma.y, [0xff8a3b, 0xffffff], 14, 300);
        this.fase.efeitos.anel(this.forma.x, this.forma.y, 0xff8a3b, 22);
        som.ruido(220, 0.16, 2000);
        this.destruir();
        return true;
    }

    destruir() { this.cano.destroy(); this.luz.destroy(); super.destruir(); }
}

// Projétil da torreta: bola laranja que voa reto pra esquerda
class ProjetilTorreta extends Obstaculo {
    constructor(fase, x, y) {
        const forma = fase.cena.add.circle(x, y, 9, 0xff8a3b).setStrokeStyle(3, 0xffffff).setDepth(6);
        super(fase, forma, 'mortal');
        this.alvoTiro = true;
        this.rastro = fase.cena.add.rectangle(x + 16, y, 24, 6, 0xff8a3b, 0.35).setDepth(5);
    }

    atualizar(dt) {
        this.forma.x -= 330 * dt / 1000;
        this.forma.body.reset(this.forma.x, this.forma.y);
        this.rastro.setPosition(this.forma.x + 16, this.forma.y);
        // Saiu da tela pela esquerda: some
        if (this.forma.x < this.fase.player.x - 700) this.destruir();
    }

    aoAcertar() { this.fase.efeitos.anel(this.forma.x, this.forma.y, 0xff8a3b, 8); this.destruir(); return true; }

    destruir() { this.rastro.destroy(); super.destruir(); }
}

// MINA FLUTUANTE (Homem de Ferro): esfera com espetos curtos que sobe e desce devagar.
// Encostar mata; o repulsor explode. Usada em colunas com um vão.
class MinaFlutuante extends Obstaculo {
    constructor(fase, x, y, amp = 30, fase0 = 0) {
        const c = coresNeon(fase);
        const forma = fase.cena.add.circle(x, y, 15, c.preto).setStrokeStyle(3, 0xff4d4d).setDepth(5);
        super(fase, forma, 'mortal');
        forma.body.setCircle(13, 2, 2);
        this.alvoTiro = true;
        // Espetos (quadradinhos girados em volta, sem triângulo) e luz que pisca
        this.espetos = fase.cena.add.graphics({ x, y }).setDepth(5);
        this.espetos.fillStyle(0xff4d4d, 1);
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.espetos.fillRect(Math.cos(a) * 18 - 3, Math.sin(a) * 18 - 3, 6, 6); }
        this.luz = fase.cena.add.circle(x, y, 4, 0xffffff).setDepth(6);
        this.y0 = y; this.amp = amp; this.fase0 = fase0; this.relogio = 0;
    }

    atualizar(dt) {
        if (this.forma.x - this.fase.player.x < 1100) this.relogio += dt;
        const y = this.y0 + Math.sin(this.relogio / 1400 * Math.PI * 2 + this.fase0) * this.amp;
        this.forma.y = y; this.forma.body.reset(this.forma.x, y);
        this.espetos.setPosition(this.forma.x, y).setRotation(this.relogio / 900);
        this.luz.setPosition(this.forma.x, y).setAlpha(Math.floor(this.relogio / 250) % 2 ? 0.25 : 1);
    }

    aoAcertar() {
        this.fase.efeitos.estilhacos(this.forma.x, this.forma.y, [0xff4d4d, 0xffffff], 12, 280);
        this.fase.efeitos.anel(this.forma.x, this.forma.y, 0xff4d4d, 20);
        som.ruido(200, 0.15, 1800);
        this.destruir();
        return true;
    }

    destruir() { this.espetos.destroy(); this.luz.destroy(); super.destruir(); }
}

// ----------------------------------------------------------------
// Classes que herdam de obstáculos de UMA fase (definidas na primeira vez que forem usadas,
// porque os arquivos das fases carregam depois deste)
// ----------------------------------------------------------------
const TEMATICOS = {};
function definirTematicos() {
    // CARRO ARREMESSADO (Hulk): voa em arco do fundo e cai no ponto marcado no chão (sombra pulsando).
    // No chão vira um obstáculo baixo: pule, ou esmague com a fúria.
    if (!TEMATICOS.Carro && typeof BlocoQueda !== 'undefined') {
        TEMATICOS.Carro = class CarroArremessado extends BlocoQueda {
            constructor(fase, xAlvo) {
                super(fase, xAlvo);
                // Formato de carro (70×34) e 1 golpe só
                this.forma.setSize(70, 34); this.forma.body.setSize(70, 34);
                this.forma.setFillStyle(0x9b2335).setStrokeStyle(2, 0xffd0d6);
                this.hp = this.hpMax = 1; this.yFinal = MOVIMENTO.chaoY - 17;
                this.corrente.setVisible(false); this.detalhe.setVisible(false); this.rachaduras.setVisible(false);
                // Desenho do carro (janelas e rodas) acompanha o corpo
                const g = fase.cena.add.graphics().setDepth(5);
                g.fillStyle(0x2a0a10, 1).fillRect(-22, -22, 40, 10);
                g.fillStyle(0xbfe9ff, 0.8).fillRect(-18, -20, 14, 7).fillRect(0, -20, 14, 7);
                g.fillStyle(0x111111, 1).fillCircle(-22, 15, 7).fillCircle(22, 15, 7);
                g.fillStyle(0x777777, 1).fillCircle(-22, 15, 3).fillCircle(22, 15, 3);
                this.carro = g;
                // Trajetória: sai de trás da tela (alto, à direita) e cai no alvo
                this.xAlvo = xAlvo + 35; this.x0 = this.xAlvo + 560; this.y0 = MOVIMENTO.tetoY + 40;
                this.estado = 'preso'; this.t = 0;
                // Pontinhos marcando o arco (aparecem com o aviso)
                this.arco = fase.cena.add.graphics().setDepth(2).setVisible(false);
                this.arco.fillStyle(0xffffff, 0.35);
                for (let k = 1; k < 10; k++) { const t = k / 10, p = this.ponto(t); this.arco.fillCircle(p.x, p.y, 3); }
                this.colocar(this.x0, this.y0);
                this.forma.body.enable = false;
            }

            // Ponto do arco no instante t (0 → 1)
            ponto(t) { return { x: Phaser.Math.Linear(this.x0, this.xAlvo, t), y: Phaser.Math.Linear(this.y0, this.yFinal, t) - 160 * 4 * t * (1 - t) }; }

            colocar(x, y, giro = 0) {
                this.forma.setPosition(x, y).setAngle(giro);
                this.carro.setPosition(x, y).setAngle(giro);
                this.sombra.setPosition(this.xAlvo, MOVIMENTO.chaoY - 2);
            }

            atualizar(dt, agora) {
                if (!this.ativo) return;
                const p = this.fase.player, dx = (this.xAlvo - 35) - (p.x + 20);
                // Aviso: sombra pulsando e arco pontilhado
                if (this.estado === 'preso' && dx < 1150) { this.sombra.setVisible(true); this.arco.setVisible(true); }
                if (this.sombra.visible && this.estado !== 'no chão') this.sombra.setScale(0.9 + 0.2 * Math.sin(agora / 90), 1);
                // Arremesso
                if (this.estado === 'preso' && dx < 950) { this.estado = 'caindo'; som.tom('sawtooth', 200, 500, 300, 0.04); }
                if (this.estado === 'caindo') {
                    this.t = Math.min(1, this.t + dt / 750);
                    const q = this.ponto(this.t);
                    this.colocar(q.x, q.y, -540 * this.t);
                    if (this.t >= 1) {
                        this.estado = 'no chão'; this.colocar(this.xAlvo, this.yFinal, 0);
                        this.forma.body.enable = true; this.forma.body.reset(this.xAlvo, this.yFinal);
                        this.sombra.setVisible(false); this.arco.setVisible(false);
                        this.saltar = true;
                        this.fase.efeitos.tremor(140, 0.008); this.fase.efeitos.poeira(this.xAlvo, MOVIMENTO.chaoY - 6, 0x9a9f96, 8);
                        som.ruido(220, 0.18, 600);
                    }
                }
                if (this.rotulo) this.rotulo.setY(this.forma.y - 50).setX(this.forma.x);
            }

            destruir() { this.carro.destroy(); this.arco.destroy(); super.destruir(); }
        };
        window.CarroArremessado = TEMATICOS.Carro;
    }
    // HOLOFOTE (Gavião): lâmpada de segurança que varre o chão com um cone de luz. Acertar a lâmpada
    // (é um alvo) desliga o laser ligado a ela; o cone some quando a lâmpada é atingida.
    if (!TEMATICOS.Holofote && typeof Alvo !== 'undefined') {
        TEMATICOS.Holofote = class HolofoteAlvo extends Alvo {
            constructor(fase, x, y, opcoes) {
                super(fase, x, y, opcoes);
                // Suporte preso no teto
                this.suporte = fase.cena.add.rectangle(x, (MOVIMENTO.tetoY + y) / 2, 6, y - MOVIMENTO.tetoY, 0x2a2440).setDepth(5);
                // Cone de luz (desenhado a cada quadro)
                this.cone = fase.cena.add.graphics().setDepth(2);
            }

            atualizar(dt) {
                super.atualizar(dt);
                this.cone.clear();
                if (this.acertado) return;
                // Varre de um lado pro outro (ângulo pelo relógio local)
                const a = Math.PI / 2 + Math.sin(this.relogio / 900) * 0.45, alc = MOVIMENTO.chaoY - this.forma.y;
                const x = this.forma.x, y = this.forma.y, abre = 0.22;
                const pts = [{ x, y }, { x: x + Math.cos(a - abre) * alc * 1.1, y: y + Math.sin(a - abre) * alc * 1.1 }, { x: x + Math.cos(a + abre) * alc * 1.1, y: y + Math.sin(a + abre) * alc * 1.1 }];
                this.cone.fillStyle(0xfff3b0, 0.14).fillPoints(pts, true);
            }

            confirmar(acionar = true) { super.confirmar(acionar); this.cone.clear(); }

            destruir() { this.suporte.destroy(); this.cone.destroy(); super.destruir(); }
        };
        window.HolofoteAlvo = TEMATICOS.Holofote;
    }
}

// Cria um obstáculo temático pelo evento do roteiro; devolve true se criou
function criarTematico(fase, ev) {
    definirTematicos();
    switch (ev.tipo) {
        case 'emergente': new EspinhoEmergente(fase, ev.x, ev.yBase !== undefined ? ev.yBase : fase.topoChaoEm(ev.x + 20), !!ev.teto); return true;
        case 'laserPiso': new LaserPiso(fase, ev.x, ev.largura || 120, ev.padrao || '1110', ev.yBase !== undefined ? ev.yBase : fase.topoChaoEm(ev.x + 20), ev.cor !== undefined ? ev.cor : null); return true;
        case 'blocoEntrada': new BlocoEntrada(fase, ev.x, MOVIMENTO.chaoY - 40 - (ev.andar || 0) * 40, 40, 40, ev.de || -300); return true;
        case 'torreta': new Torreta(fase, ev.x, ev.y || 380, ev.intervalo || 1100); return true;
        // Coluna de minas com um vão: ys = alturas das minas
        case 'minas': (ev.ys || [180, 380, 580]).forEach((y, i) => new MinaFlutuante(fase, ev.x, y, ev.amp !== undefined ? ev.amp : 26, i * 1.3)); return true;
        case 'carro': {
            if (!TEMATICOS.Carro) return false;
            const c = new TEMATICOS.Carro(fase, ev.x);
            // Entra na lista de golpeáveis do Hulk (a fúria esmaga)
            if (fase.golpeaveis) fase.golpeaveis.push(c);
            return true;
        }
        case 'holofote': {
            if (!TEMATICOS.Holofote) return false;
            new TEMATICOS.Holofote(fase, ev.x, ev.y || 240, { abre: ev.abre });
            return true;
        }
        default: return false;
    }
}
