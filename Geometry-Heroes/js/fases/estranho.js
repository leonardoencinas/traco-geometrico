// ================================================================
// estranho.js — FASE DO DOUTOR ESTRANHO: "Escolha a dimensão certa e dobre o tempo quando apertar"
// Mecânica 1: duas dimensões no mesmo mundo — NORMAL (chão) e ESPELHO (teto, gravidade invertida).
//   A dimensão inativa aparece como "fantasma" (dá pra ler a rota antes). Portais trocam de dimensão:
//   o "pad" no piso entra correndo por cima; o "anel" no ar só entra quem pula nele.
//   Selos bloqueiam uma das dimensões e obrigam a escolher o portal certo.
// Mecânica 2: Joia do Tempo (E) — o mundo desacelera para 0,4× por 3 s; apertar E de novo durante
//   o efeito REVERTE orbes e lâminas. Recarga de 7 s contada a partir do fim.
// ================================================================

// Constantes da fase
const ESTRANHO = {
    alphaFantasma: 0.18,  // transparência da dimensão inativa
    alphaFantasmaJoia: 0.45, // fantasma fica mais visível durante a Joia
    duracaoJoia: 3000,    // ms reais de tempo lento
    fatorJoia: 0.4,       // velocidade do mundo durante a Joia
    recargaJoia: 7000,    // ms de recarga (contados a partir do fim)
    velFaixa: 700,        // velocidade dentro da faixa rápida
    invencivelTroca: 300, // ms de invencibilidade depois de trocar de dimensão
    distPortalLivre: 450, // px entre a entrada e a saída do portal livre
    entradaPortalLivre: 80 // px à frente do cubo onde nasce a entrada
};

// Espelha um Y do chão pro teto (o roteiro é escrito "como se fosse no chão")
function espelharY(y) { return MOVIMENTO.chaoY + MOVIMENTO.tetoY - y; }

// PORTAL de troca: 'pad' (no piso) ou 'anel' (no ar)
class PortalDimensao extends Obstaculo {
    constructor(fase, x, tipo, dim) {
        // Espelho = no teto
        const e = dim === 'E';
        // Pad: oval achatado no piso; anel: elipse em pé a 120 px do piso
        const y = tipo === 'pad' ? (e ? MOVIMENTO.tetoY + 9 : MOVIMENTO.chaoY - 9) : (e ? MOVIMENTO.tetoY + 120 : MOVIMENTO.chaoY - 120);
        // Tamanho
        const w = tipo === 'pad' ? 100 : 60, h = tipo === 'pad' ? 18 : 100;
        // Área do gatilho (mesma elipse de antes; o desenho místico fica por cima)
        const forma = fase.cena.add.ellipse(x, y, w, h, 0x1a0800, 0.25);
        // Gatilho
        super(fase, forma, 'gatilho');
        // Tipo e dimensão
        this.tipo = tipo; this.dim = dim;
        // Portal místico (anéis dourados girando, glifos, faíscas pela borda) — só visual
        this.visual = criarPortalMistico(fase, x, y, w, h, { abrir: false, profundidade: 4, coluna: tipo === 'pad' ? (e ? 1 : -1) : 0 });
        // A fase controla a transparência (fantasma) pelos "extras" e pelas faíscas
        this.faiscas = this.visual.faiscas;
        this.extras = this.visual.partes.filter((o) => o !== this.faiscas);
    }

    // Encostou: troca de dimensão (o pad só funciona correndo por cima, não pulando)
    aoTocar() {
        // Pad: precisa estar no piso
        if (this.tipo === 'pad' && !this.fase.player.isOnGround()) return;
        // Troca
        this.fase.trocarDimensao(this);
    }

    // Some com o desenho místico junto
    destruir() { this.visual.destruir(); super.destruir(); }
}

// SELO: parede do teto ao chão com runas; só existe na dimensão dela
class Selo extends Obstaculo {
    constructor(fase, x) {
        // Retângulo escuro
        const forma = fase.cena.add.rectangle(x + 20, 380, 40, 560, 0x1d1640).setStrokeStyle(3, 0xffa53d);
        // Mortal
        super(fase, forma, 'mortal');
        // Runas geométricas (triângulo, quadrado, losango em coluna)
        const g = fase.cena.add.graphics().setDepth(3);
        g.lineStyle(2, 0xffa53d, 1);
        for (let y = 140; y < 640; y += 60) {
            // Alterna os 3 glifos
            const k = ((y - 140) / 60) % 3;
            if (k === 0) g.strokeTriangle(x + 10, y + 16, x + 30, y + 16, x + 20, y);
            if (k === 1) g.strokeRect(x + 11, y, 18, 18);
            if (k === 2) g.strokePoints([{ x: x + 20, y }, { x: x + 30, y: y + 10 }, { x: x + 20, y: y + 20 }, { x: x + 10, y: y + 10 }], true);
        }
        // Guarda (a camada controla a transparência)
        this.extras = [g];
    }
}

// ORBE: bola de energia que sobe e desce
class Orbe extends Obstaculo {
    constructor(fase, x, defasagem = 0) {
        // Círculo laranja com núcleo claro
        const forma = fase.cena.add.circle(x, 380, 16, 0xffa53d).setStrokeStyle(3, 0xfff1c1);
        // Mortal
        super(fase, forma, 'mortal');
        // Relógio local começa com a defasagem
        this.relogio = defasagem * 1600;
    }

    // Sobe e desce (amp 180, período 1,6 s); dt negativo = reverte (Joia)
    atualizar(dt) {
        // Só conta perto da tela
        if (this.forma.x - this.fase.player.x < 1100) this.relogio += dt;
        // Nova altura
        this.forma.y = 380 + Math.sin(this.relogio / 1600 * Math.PI * 2) * 180;
    }
}

// LÂMINA giratória: barra de 200 px girando em volta do centro (colisão calculada na mão)
class Lamina extends Obstaculo {
    constructor(fase, x, defasagem = 0) {
        // Barra amarela
        const forma = fase.cena.add.rectangle(x, 380, 200, 12, 0xffd166).setStrokeStyle(2, 0xff7b00);
        // Decoração (colisão manual, porque corpo do Arcade não gira)
        super(fase, forma, 'decoracao');
        // Ângulo inicial
        this.forma.angle = defasagem;
        // Pivô no centro
        this.pivo = fase.cena.add.circle(x, 380, 8, 0xff7b00).setDepth(3);
        // Começa ativa (a camada liga/desliga)
        this.solida = true;
        // Guarda extras pra camada controlar a transparência
        this.extras = [this.pivo];
    }

    atualizar(dt) {
        // Só gira perto da tela
        if (this.forma.x - this.fase.player.x < 1100) this.forma.angle += 140 * dt / 1000;
        // Sem colisão se a dimensão dela está inativa
        if (!this.solida) return;
        // Pontas da barra (A e B)
        const r = this.forma.rotation, cx = this.forma.x, cy = this.forma.y;
        const ax = cx - Math.cos(r) * 100, ay = cy - Math.sin(r) * 100, bx = cx + Math.cos(r) * 100, by = cy + Math.sin(r) * 100;
        // Jogador
        const p = this.fase.player;
        // Projeção do centro do cubo no SEGMENTO AB (t limitado entre 0 e 1)
        const t = Phaser.Math.Clamp(((p.x - ax) * (bx - ax) + (p.y - ay) * (by - ay)) / (200 * 200), 0, 1);
        // Ponto mais perto na barra
        const ponto = { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
        // Encostou (raio ~26): morre
        if (Phaser.Math.Distance.Between(p.x, p.y, ponto.x, ponto.y) < 26) this.fase.morrer();
    }
}

// FAIXA RÁPIDA: setas no piso; dentro dela o mundo corre a 700
class FaixaRapida extends Obstaculo {
    constructor(fase, x, ate, dim) {
        // Espelho = no teto
        const y = dim === 'E' ? MOVIMENTO.tetoY + 4 : MOVIMENTO.chaoY - 4;
        // Graphics com setas >>>
        const g = fase.cena.add.graphics().setDepth(2);
        g.lineStyle(3, 0x3dff8a, 0.5);
        for (let xx = x; xx < ate; xx += 40) { g.lineBetween(xx, y - 6, xx + 10, y); g.lineBetween(xx + 10, y, xx, y + 6); }
        // Decoração (a fase confere pelo x do jogador)
        super(fase, g, 'decoracao');
        // Limites e dimensão
        this.x0 = x; this.x1 = ate; this.dim = dim;
    }
}

// RUNA DE PORTAL: ponto válido do cenário onde o jogador ABRE um portal (Q ou clique).
// Entrar no portal aberto leva à saída ligada a ele (mais à frente, na mesma dimensão).
class RunaPortal extends Obstaculo {
    constructor(fase, x, destino, dim) {
        // Espelho = no teto
        const e = dim === 'E', y = e ? MOVIMENTO.tetoY + 60 : MOVIMENTO.chaoY - 60;
        // Círculo de runas (decoração; a fase confere a distância)
        const forma = fase.cena.add.container(x, y);
        // Anel externo e interno + 6 traços (glifos)
        // Runa "adormecida": o mesmo anel rúnico do portal aberto (padrão único), ainda sem faíscas
        const g = fase.cena.add.graphics();
        desenharAnelRunico(g, 34, 0xffa53d, 1);
        forma.add(g);
        // Texto de ajuda
        const dica = fase.cena.add.text(0, e ? 52 : -52, 'Q / CLIQUE: ABRIR PORTAL', { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#ffa53d', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setVisible(false);
        forma.add(dica);
        // Decoração
        super(fase, forma, 'decoracao');
        // Dados
        this.destino = destino; this.dim = dim; this.y = y; this.dica = dica; this.aberto = false; this.usado = false;
        // Marca a saída no mundo (círculo fraco onde o portal vai te deixar)
        this.marcaSaida = fase.cena.add.graphics({ x: destino, y }).setDepth(3).setAlpha(0.4);
        desenharAnelRunico(this.marcaSaida, 30, 0xffa53d, 1);
        // Profundidade
        forma.setDepth(4);
    }

    // Jogador está na distância certa pra abrir (antes da runa, na mesma dimensão)?
    alcancavel() { const dx = this.forma.x - this.fase.player.x; return !this.aberto && !this.usado && this.dim === this.fase.dim && dx > 30 && dx < 460; }

    // Gira e mostra a dica quando dá pra abrir; quando aberto, teleporta ao encostar
    atualizar(dt) {
        // Gira devagar
        this.forma.angle += 40 * dt / 1000;
        // Dica visível no alcance (e o texto não gira)
        this.dica.setVisible(this.alcancavel()).setAngle(-this.forma.angle);
        // Aberto: confere se o cubo entrou
        if (this.aberto && !this.usado && Math.abs(this.fase.player.x - this.forma.x) < 26 && Math.abs(this.fase.player.y - this.y) < 70) this.fase.atravessarRuna(this);
    }

    // Abre: portal de faíscas na runa e na saída
    abrir() {
        // Marca
        this.aberto = true;
        // Portais visuais (o de entrada e o de saída)
        this.portalEntrada = this.fase.portalVisual(this.forma.x, this.y);
        this.portalSaida = this.fase.portalVisual(this.destino, this.y);
        fxCenario(this.fase, 'portalAbre', { x: this.forma.x, y: this.y, saida: this.destino });
        // Som de portal abrindo
        som.tom('sine', 300, 900, 250, 0.07); som.tom('triangle', 600, 1800, 250, 0.03);
    }
}

// ZONA DE PORTAL LIVRE: faixa de runas no piso. Dentro dela, Q / clique abre um portal SEU:
// a entrada nasce logo à frente e a saída a uma distância fixa. ONDE você abre decide onde sai —
// o marcador mostra a saída: verde = seguro, vermelho = bloqueado (dentro de algo ou longe demais)
class ZonaPortal extends Obstaculo {
    constructor(fase, x, ate, dim) {
        // Espelho = no teto
        const e = dim === 'E', y = e ? MOVIMENTO.tetoY + 4 : MOVIMENTO.chaoY - 4;
        // Faixa laranja no piso (decoração)
        const forma = fase.cena.add.rectangle((x + ate) / 2, y, ate - x, 8, 0xffa53d, 0.35).setStrokeStyle(2, 0xffe08a, 0.8).setDepth(3);
        // Decoração (a fase confere a posição)
        super(fase, forma, 'decoracao');
        // Dados
        this.x0 = x; this.x1 = ate; this.dim = dim;
        // Glifos ao longo da faixa
        const g = fase.cena.add.graphics().setDepth(3);
        g.lineStyle(2, 0xffe08a, 0.8);
        for (let xx = x + 20; xx < ate - 10; xx += 50) g.strokeCircle(xx, y, 6);
        this.glifos = g;
        // Marcador da saída (círculo + texto), atualizado a cada quadro
        this.marca = fase.cena.add.circle(0, 0, 26).setStrokeStyle(3, 0x3dff8a).setDepth(6).setVisible(false);
        this.rotulo = fase.cena.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#3dff8a', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(6).setVisible(false);
    }

    // O cubo está dentro da faixa, na mesma dimensão?
    dentro() { const p = this.fase.player; return this.dim === this.fase.dim && p.x >= this.x0 && p.x <= this.x1; }

    // Mostra onde a saída cairia agora (e se é segura)
    atualizar() {
        // Fora da zona ou já tem um portal aberto: esconde
        if (!this.dentro() || this.fase.portalLivre) { this.marca.setVisible(false); this.rotulo.setVisible(false); return; }
        // Pontos de entrada/saída se abrisse agora
        const pt = this.fase.pontosPortalLivre(), ok = this.fase.portalLivreValido(pt);
        // Cor: verde ok, vermelho bloqueado
        const cor = ok ? 0x3dff8a : 0xff4d6d;
        // Marcador na saída
        this.marca.setPosition(pt.saida, pt.y).setStrokeStyle(3, cor).setVisible(true);
        // Texto acima/abaixo
        this.rotulo.setPosition(pt.saida, pt.y + (this.dim === 'E' ? 44 : -44)).setText(ok ? '✓ SAÍDA LIVRE (Q)' : '✕ BLOQUEADA').setColor(ok ? '#3dff8a' : '#ff4d6d').setVisible(true);
    }

    // Some com os extras
    destruir() { this.glifos.destroy(); this.marca.destroy(); this.rotulo.destroy(); super.destruir(); }
}

// HABILIDADE JOIA DO TEMPO
class JoiaDoTempo extends Habilidade {
    constructor(fase) {
        // Nome, recarga e cor verde
        super(fase, { nome: 'JOIA DO TEMPO', recarga: ESTRANHO.recargaJoia, cor: 0x3dff8a });
    }

    usar(agora) {
        // Durante o efeito, apertar de novo REVERTE os obstáculos
        if (this.fase.joiaAtiva) { this.fase.alternarReversao(); return false; }
        // Liga o tempo lento
        this.fase.ligarJoia();
        // Usou (a recarga de verdade é marcada no fim, em desligarJoia)
        return true;
    }

    // Pronta só se não estiver em efeito (e a recarga, contada do fim, acabou) — ou se estiver ativa (pra reverter)
    pronta(agora) { return this.fase.joiaAtiva || super.pronta(agora); }
}

// CLASSE FaseEstranho
class FaseEstranho extends Fase {
    constructor(cena, heroi, tentativa) {
        // Base
        super(cena, heroi, tentativa);
        // Controles
        this.textoControles = 'Espaço: pular  ·  Pad/anel laranja: troca de dimensão  ·  Q: portal (runa ou faixa laranja)  ·  E: Joia do Tempo';
        // Objetivo
        this.objetivo = 'Leia a rota fantasma e escolha a dimensão certa.';
        // Frases do encerramento (texto grande e subtítulo da tela final)
        this.fraseCurta = 'A DIMENSÃO SE FECHA'; this.fraseFinal = 'tempo e espaço voltaram ao normal.';
        // Dimensão ativa
        this.dim = 'N';
        // Joia
        this.joiaAtiva = false; this.joiaRestante = 0; this.revertendo = false;
    }

    // Encerramento: portal se abre à frente, o personagem entra e o portal fecha
    animacaoFinal() {
        // Portal à frente
        const px = this.player.x + 160, py = this.player.y;
        const portal = this.portalVisual(px, py);
        // Anda até o portal e encolhe ao entrar
        this.cena.tweens.add({ targets: this.player, x: px, duration: 600, onComplete: () => {
            this.cena.tweens.add({ targets: this.player, scaleX: 0, scaleY: 0, duration: this.efeitos.dur(250), onComplete: () => portal.fechar() });
            som.tom('sine', 900, 200, 400, 0.07);
        } });
    }

    // Cubo índigo com borda laranja
    coresCubo() { return VISUAIS_HEROIS['DrEstranho'].cores; }

    // Skin do Doutor Estranho: manto e selo dourado (efeitosPoderes.js); o anel de runas gira à parte
    desenharSkin(g) { VISUAIS_HEROIS['DrEstranho'].desenhar(g); }

    // Habilidade
    criarHabilidade() { return new JoiaDoTempo(this); }

    // Tecla Q abre o portal da runa no alcance
    teclasExtras(tec) {
        // Handler
        const q = () => this.abrirPortal();
        // Liga
        tec.on('keydown-Q', q);
        // Desliga no fim
        this.desligadores.push(() => tec.off('keydown-Q', q));
    }

    // Abre o portal da runa que estiver no alcance (retorna true se abriu)
    abrirPortal() {
        // Runa alcançável
        const r = (this.runas_ || []).find((x) => x.alcancavel());
        // Nenhuma runa, mas está numa zona de portal livre: tenta abrir o seu
        if (!r && (this.zonas_ || []).some((z) => z.dentro())) return this.abrirPortalLivre();
        // Nenhuma: aviso
        if (!r) { this.efeitos.textoFlutuante(this.player.x, this.player.y - 50, 'NENHUMA RUNA PERTO', '#ffa53d'); return false; }
        // Abre
        r.abrir();
        return true;
    }

    // Onde ficariam a entrada e a saída do portal livre se abrisse agora
    pontosPortalLivre() {
        // Entrada logo à frente; saída a uma distância fixa; mesma altura do cubo
        const entrada = this.player.x + ESTRANHO.entradaPortalLivre;
        return { entrada, saida: entrada + ESTRANHO.distPortalLivre, y: this.player.y };
    }

    // A saída é segura? (nada da dimensão atual ali nem logo à frente; e a entrada não bate antes)
    portalLivreValido(pt) {
        // Área da saída (inclui ~60 px à frente pra não nascer colado num perigo)
        const rs = new Phaser.Geom.Rectangle(pt.saida - 22, pt.y - 22, 104, 44);
        // Caminho até a entrada (o cubo precisa chegar nela sem bater)
        const re = new Phaser.Geom.Rectangle(this.player.x, pt.y - 20, pt.entrada - this.player.x + 20, 40);
        // Confere os obstáculos ativos da dimensão atual (ou sem dimensão)
        return !this.obstaculos.some((o) => {
            // Só sólidos/mortais ligados
            if (!o.ativo || !o.forma.body || !o.forma.body.enable || (o.categoria !== 'mortal' && o.categoria !== 'solido') || o.ehChao) return false;
            // Outra dimensão não conta
            if (o.dim && o.dim !== this.dim) return false;
            // Bate na saída ou no caminho até a entrada?
            const b = o.forma.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(rs, b) || Phaser.Geom.Intersects.RectangleToRectangle(re, b);
        });
    }

    // Abre o portal livre (se a saída for segura)
    abrirPortalLivre() {
        // Já tem um aberto: ignora
        if (this.portalLivre) return false;
        // Pontos e validade
        const pt = this.pontosPortalLivre();
        // Bloqueada: avisa e não abre
        if (!this.portalLivreValido(pt)) { this.efeitos.textoFlutuante(this.player.x, this.player.y - 50, 'SAÍDA BLOQUEADA', '#ff4d6d'); som.tocar('erro'); return false; }
        // Guarda o portal e cria os visuais
        this.portalLivre = { ...pt, vEntrada: this.portalVisual(pt.entrada, pt.y), vSaida: this.portalVisual(pt.saida, pt.y) };
        fxCenario(this, 'portalAbre', { x: pt.entrada, y: pt.y, saida: pt.saida });
        // Som de portal abrindo
        som.tom('sine', 300, 900, 250, 0.07); som.tom('triangle', 600, 1800, 250, 0.03);
        return true;
    }

    // A cada quadro: o cubo chegou na entrada do portal livre? Atravessa
    verificarPortalLivre() {
        // Sem portal: nada
        const pl = this.portalLivre; if (!pl) return;
        // Ainda não chegou
        if (this.player.x < pl.entrada) return;
        // Teleporta pra saída (mesma altura)
        this.player.body.reset(pl.saida, this.player.y);
        // Invencível um instante (justo ao sair)
        this.player.invencivelAte = this.cena.time.now + ESTRANHO.invencivelTroca;
        // Efeitos
        this.efeitos.anel(pl.saida, pl.y, 0xffa53d, 30, 3, 300); som.tom('sine', 900, 300, 250, 0.07);
        // Fecha os dois portais logo depois
        this.cena.time.delayedCall(300, () => { pl.vEntrada.fechar(); pl.vSaida.fechar(); fxCenario(this, 'portalFecha'); });
        // Saída do portal: faíscas douradas e eco do corpo
        fxFaiscas(this, pl.saida, pl.y, [0xfff2b0, 0xffc94a, 0xff7b00], 14, 260, 400);
        // Libera pra abrir outro
        this.portalLivre = null;
    }

    // Clique numa runa no alcance = abre o portal dela; senão, pulo normal
    aoClicarMundo(ponteiro) {
        // Runa sob o clique (raio 60)
        const r = (this.runas_ || []).find((x) => x.alcancavel() && Phaser.Math.Distance.Between(x.forma.x, x.y, ponteiro.worldX, ponteiro.worldY) < 60);
        // Nenhuma runa, mas dentro de zona de portal livre (clique na metade direita): abre o seu
        if (!r && ponteiro.x > 640 && (this.zonas_ || []).some((z) => z.dentro())) { this.abrirPortalLivre(); return true; }
        // Nenhuma: pulo
        if (!r) return false;
        // Abre
        r.abrir();
        return true;
    }

    // Entrou no portal aberto: vai pra saída (mesma dimensão)
    atravessarRuna(r) {
        // Usado
        r.usado = true;
        // Teleporta
        this.player.body.reset(r.destino, this.player.y);
        // Invencível um instante
        this.player.invencivelAte = this.cena.time.now + ESTRANHO.invencivelTroca;
        // Efeitos
        this.efeitos.anel(r.destino, r.y, 0xffa53d, 30, 3, 300);
        som.tom('sine', 900, 300, 250, 0.07);
        // Fecha os portais depois de um instante
        this.cena.time.delayedCall(350, () => { [r.portalEntrada, r.portalSaida].forEach((pt) => pt && pt.fechar()); fxCenario(this, 'portalFecha'); });
        fxFaiscas(this, r.destino, r.y, [0xfff2b0, 0xffc94a, 0xff7b00], 14, 260, 400);
    }

    // Portal aberto pelo jogador (runa ou portal livre): portal místico que abre com expansão de energia,
    // fica girando estabilizado e contrai ao fechar — devolve um objeto com fechar()
    portalVisual(x, y) { return criarPortalMistico(this, x, y, 56, 110, { profundidade: 5 }); }

    // Valor da barra: durante a Joia mostra a duração restante
    progressoHabilidade(agora) { return this.joiaAtiva ? this.joiaRestante / ESTRANHO.duracaoJoia : this.habilidade.progresso(agora); }

    // HUD extra: dimensão atual
    textoExtra() { return `DIMENSÃO: ${this.dim === 'N' ? 'NORMAL' : 'ESPELHO'}${this.revertendo ? '  ·  REVERTENDO' : ''}`; }

    // Registra o obstáculo e guarda a dimensão dele (padrão N)
    registrar(obs) {
        // Registro normal
        super.registrar(obs);
        // Dimensão do elemento que está sendo criado agora
        obs.dim = obs.dim || this.dimCriando || null;
    }

    // Cria elemento já marcando a dimensão (e espelhando Y se for E)
    criarElemento(ev) {
        // Dimensão do evento (portais/faixa usam a deles)
        const dim = ev.dim || 'N', e = dim === 'E';
        // Marca pro registrar()
        this.dimCriando = dim;
        // Escolhe pelo tipo
        switch (ev.tipo) {
            // Espinho no piso da dimensão
            case 'espinho': new Espinho(this, ev.x, e, e ? 0xff7ad9 : null, 0xffffff); break;
            // Serra girando no piso da dimensão (clássico: pule)
            case 'serra': new Serra(this, ev.x, e); break;
            // Variações: mini espinho e serra que desce (só no piso normal)
            case 'mini': new MiniEspinho(this, ev.x, MOVIMENTO.chaoY, e); break;
            case 'serraDesce': new SerraDescendo(this, ev.x); break;
            // Bloco 40x40 (andar = blocos acima do piso)
            case 'bloco': {
                // Topo no chão ou espelhado no teto
                const topo = e ? MOVIMENTO.tetoY + (ev.andar || 0) * 40 : MOVIMENTO.chaoY - 40 - (ev.andar || 0) * 40;
                // Cores por dimensão
                new BlocoNeon(this, ev.x, topo, 40, 40, null, e ? 0xff7ad9 : 0xffdcae, e ? 0xff7ad9 : 0xffa53d);
                break;
            }
            // Portais
            case 'portalPad': new PortalDimensao(this, ev.x, 'pad', dim); break;
            case 'portalAnel': new PortalDimensao(this, ev.x, 'anel', dim); break;
            // Selo, orbe, lâmina, faixa rápida
            case 'selo': new Selo(this, ev.x); break;
            case 'orbe': new Orbe(this, ev.x, ev.defasagem || 0); break;
            case 'lamina': new Lamina(this, ev.x, ev.defasagem || 0); break;
            case 'faixaRapida': new FaixaRapida(this, ev.x, ev.ate, dim); break;
            // Runa de portal (ligada a uma saída mais à frente)
            // Zona de portal livre e muralha (selos nas duas dimensões, lado a lado)
            case 'zonaPortal': this.zonas_ = (this.zonas_ || []).concat(new ZonaPortal(this, ev.x, ev.ate, dim)); break;
            case 'muralha': for (let xx = ev.x; xx < ev.ate; xx += 60) { this.dimCriando = 'N'; new Selo(this, xx).barreira = true; this.dimCriando = 'E'; new Selo(this, xx).barreira = true; } break;
            case 'runa': this.runas_ = (this.runas_ || []).concat(new RunaPortal(this, ev.x, ev.destino, dim)); break;
            // Barreira dupla: selo nas DUAS dimensões (só passa pelo portal da runa)
            case 'barreira': this.dimCriando = 'N'; new Selo(this, ev.x).barreira = true; this.dimCriando = 'E'; new Selo(this, ev.x).barreira = true; break;
            // Obstáculos temáticos (rodada 7) ficam na dimensão do evento
            case 'emergente': case 'laserPiso': case 'blocoEntrada': criarTematico(this, ev); break;
            // Dica não tem dimensão
            default: this.dimCriando = null; super.criarElemento(ev);
        }
        // Limpa
        this.dimCriando = null;
    }

    // Ao criar: anel de runas da skin, overlay verde da Joia, aplica as camadas
    aoCriar() {
        // Anel de runas em volta do cubo (gira sozinho)
        this.runas = this.cena.add.graphics().setDepth(11);
        // Desenha os glifos
        this.desenharRunas(0xffa53d);
        // Anéis extras da Joia (verdes, escondidos até usar)
        this.aneisJoia = this.cena.add.graphics().setDepth(11).setVisible(false);
        // Overlay verde de tela cheia (fixo na tela)
        this.overlayJoia = this.cena.add.rectangle(640, 380, 1280, 560, 0x3dff8a, 0.1).setScrollFactor(0).setDepth(45).setVisible(false);
        // Aplica as camadas (N ativa, E fantasma)
        this.aplicarCamadas();
        // Entrada: portal se abre onde o cubo nasce
        this.efeitos.anel(this.player.x, this.player.y, 0xffa53d, 30, 2.5, 500);
    }

    // Desenha o anel de 8 glifos (triângulos, quadrados e traços alternados)
    desenharRunas(cor) {
        // Limpa
        this.runas.clear();
        // Cor
        this.runas.lineStyle(2, cor, 1); this.runas.fillStyle(cor, 1);
        // 8 posições em volta (raio 32)
        for (let i = 0; i < 8; i++) {
            // Ângulo e posição
            const a = i * Math.PI / 4, x = Math.cos(a) * 32, y = Math.sin(a) * 32;
            // Alterna o tipo de glifo
            if (i % 3 === 0) this.runas.fillCircle(x, y, 3.5);
            else if (i % 3 === 1) this.runas.strokeRect(x - 3, y - 3, 6, 6);
            else this.runas.lineBetween(x - 4, y, x + 4, y);
        }
        // Círculo fino ligando
        this.runas.lineStyle(1, cor, 0.5); this.runas.strokeCircle(0, 0, 32);
    }

    // Liga a dimensão ativa e deixa a outra como fantasma
    aplicarCamadas() {
        // Transparência do fantasma (mais visível durante a Joia)
        const fant = this.joiaAtiva ? ESTRANHO.alphaFantasmaJoia : ESTRANHO.alphaFantasma;
        // Passa por todos os obstáculos com dimensão
        this.obstaculos.forEach((o) => {
            // Sem dimensão (dica, chão): ignora
            if (!o.dim || !o.ativo) return;
            // Está na dimensão ativa?
            const ativa = o.dim === this.dim;
            // Transparência
            o.forma.setAlpha(ativa ? 1 : fant);
            (o.extras || []).forEach((x) => x.setAlpha(ativa ? 1 : fant));
            if (o.faiscas) o.faiscas.setAlpha(ativa ? 1 : fant);
            // Física só na ativa
            o.ligarFisica(ativa);
            // Lâmina: colisão manual liga/desliga
            if (o instanceof Lamina) o.solida = ativa;
        });
    }

    // Atravessou um portal
    trocarDimensao(portal) {
        // Invencível (acabou de trocar): ignora
        if (this.cena.time.now < this.player.invencivelAte) return;
        // Troca a dimensão
        this.dim = this.dim === 'N' ? 'E' : 'N';
        // Gravidade invertida no espelho
        this.player.inverterGravidade(this.dim === 'E');
        // Eco do corpo no lugar de onde saiu
        fxResidual(this, this.dim === 'E' ? 0xffc94a : 0xff7ad9, 0.5, 320);
        // Leva o cubo pro piso da outra dimensão
        this.player.body.reset(this.player.x, this.dim === 'E' ? MOVIMENTO.tetoY + 20 : MOVIMENTO.chaoY - 20);
        // Invencível por 300 ms
        this.player.invencivelAte = this.cena.time.now + ESTRANHO.invencivelTroca;
        // Remove obstáculos da nova dimensão colados no cubo (regra de justiça)
        this.obstaculos.forEach((o) => { if (o.dim === this.dim && o.categoria === 'mortal' && Math.abs(o.forma.x - this.player.x) < 80 && !(o instanceof Selo)) o.destruir(); });
        // Liga/desliga camadas
        this.aplicarCamadas();
        // Paleta do cenário troca
        this.trocarPaleta();
        // Onda varrendo a tela
        const onda = this.cena.add.rectangle(0, 380, 160, 560, this.dim === 'E' ? 0xff7ad9 : 0xffa53d, 0.25).setScrollFactor(0).setDepth(46);
        this.cena.tweens.add({ targets: onda, x: 1400, duration: this.efeitos.dur(250), onComplete: () => onda.destroy() });
        // Anel no portal + selo místico onde o cubo chega + faíscas
        this.efeitos.anel(portal.forma.x, portal.forma.y, 0xffa53d, 30, 2.5, 300);
        fxSelo(this, this.player.x, this.player.y, 46, this.dim === 'E' ? 0xff7ad9 : 0xffc94a, 620, 90);
        fxFaiscas(this, this.player.x, this.player.y, [0xfff2b0, 0xffc94a, this.dim === 'E' ? 0xff7ad9 : 0xff7b00], 16, 280, 420);
        fxCenario(this, 'dimensao', { dim: this.dim });
        // Som do portal
        som.tom('sine', 300, 900, 250, 0.07); som.tom('triangle', 600, 1800, 250, 0.03);
    }

    // Troca a cor de fundo e mostra a paralaxe da dimensão ativa
    trocarPaleta() {
        // Tema da dimensão
        const t = TEMAS[this.dim === 'E' ? 'espelho' : 'estranho'];
        // Fundo
        this.cena.cameras.main.setBackgroundColor(t.fundo);
        // Linha do teto
        this.linhaTeto.setFillStyle(t.linha, 0.8);
        // Camadas: as de índice par são da Normal, ímpar do Espelho
        // (com arte de fundo, as camadas procedurais de estrutura ficam escondidas nas duas dimensões)
        (this.camadas || []).forEach((c) => { if (c.dimensao) c.setVisible(c.dimensao === this.dim && !(this.fundoArte && c.estrutural)); });
        // Mandala troca de cor
        this.mandalaCor = t.linha; this.desenharMandala();
        // Cenário da dimensão ativa + luz mudando (não pisca no reaparecimento do checkpoint)
        Cenarios.mostrarDimensao(this, this.dim);
        if (this.estadoCenario && this.cena.time.now - (this.estadoCenario.criadoEm || 0) > 300) this.cenarioReagir('dimensao', { dim: this.dim });
    }

    // Liga a Joia do Tempo
    ligarJoia() {
        // Ativa
        this.joiaAtiva = true; this.joiaRestante = ESTRANHO.duracaoJoia; this.revertendo = false; this.avisouFim = false;
        // Mundo mais devagar (física e animações)
        this.cena.physics.world.timeScale = 1 / ESTRANHO.fatorJoia;
        this.cena.tweens.timeScale = ESTRANHO.fatorJoia;
        // Obstáculos com relógio próprio
        this.fatorTempo = ESTRANHO.fatorJoia;
        // Visual verde
        this.overlayJoia.setVisible(true); this.aneisJoia.setVisible(true); this.desenharRunas(0x3dff8a);
        // Ativação: energia esmeralda se concentra no personagem, pulsa e explode numa onda verde
        const p = this.player;
        fxConvergir(this, p.x, p.y, 0x3dff8a, 14, 140, 300);
        fxSelo(this, p.x, p.y, 64, 0x3dff8a, 900, -140);
        this.cena.time.delayedCall(120, () => {
            fxOnda(this, p.x, p.y, 0x3dff8a, 30, 700, 900, 6, 0.8);
            fxOnda(this, p.x, p.y, 0xb8ffd6, 20, 420, 700, 3, 0.7);
            fxFaiscas(this, p.x, p.y, [0x3dff8a, 0xb8ffd6, 0xffffff], 20, 260, 700);
        });
        if (!reducedMotion.matches) this.efeitos.flash(60, 255, 140, 180);
        this.fxJoia = { residual: 0, reverso: 0 };
        fxCenario(this, 'joiaInicio');
        // Fantasmas mais visíveis
        this.aplicarCamadas();
        // Som: tom caindo (tempo desacelerando)
        som.tom('sine', 880, 220, 500, 0.07);
    }

    // Durante a Joia, alterna entre desacelerar e reverter
    alternarReversao() {
        // Inverte o modo
        this.revertendo = !this.revertendo;
        // Fator negativo = relógio dos obstáculos anda pra trás
        this.fatorTempo = this.revertendo ? -ESTRANHO.fatorJoia : ESTRANHO.fatorJoia;
        // Texto e som
        this.efeitos.textoFlutuante(this.player.x, this.player.y - 50, this.revertendo ? 'REVERTER' : 'DESACELERAR', '#3dff8a');
        // Revertendo: energia volta pro personagem (anéis contraindo); desacelerando: pulso pra fora
        if (this.revertendo) { fxConvergir(this, this.player.x, this.player.y, 0xb8ffd6, 16, 160, 380); fxOnda(this, this.player.x, this.player.y, 0x3dff8a, 160, 24, 380, 4, 0.8); }
        else fxOnda(this, this.player.x, this.player.y, 0x3dff8a, 24, 200, 420, 4, 0.8);
        fxCenario(this, 'joiaReverso', { revertendo: this.revertendo });
        som.tom('sine', this.revertendo ? 600 : 300, this.revertendo ? 300 : 600, 200, 0.06);
    }

    // Desliga a Joia e começa a recarga
    desligarJoia() {
        // Desativa
        this.joiaAtiva = false; this.revertendo = false;
        // Tempo normal
        this.restaurarTempo();
        // Visual normal
        this.overlayJoia.setVisible(false); this.aneisJoia.setVisible(false); this.desenharRunas(0xffa53d);
        // Dissipação: o selo verde se abre e some, partículas sobem devagar e se apagam
        const p = this.player;
        fxSelo(this, p.x, p.y, 56, 0x3dff8a, 700, 60);
        fxFaiscas(this, p.x, p.y, [0x3dff8a, 0xb8ffd6], 18, 90, 900, { gravityY: -60 });
        fxOnda(this, p.x, p.y, 0xb8ffd6, 46, 90, 500, 2, 0.6);
        fxCenario(this, 'joiaFim');
        // Fantasmas voltam ao normal
        this.aplicarCamadas();
        // Recarga conta a partir de agora
        this.habilidade.ultimoUso = this.cena.time.now;
        // Som: tom subindo
        som.tom('sine', 220, 880, 300, 0.05);
    }

    // Por frame: Joia (duração real), faixa rápida, runas girando
    atualizarMecanica(agora, dtReal) {
        // Portal livre aberto: atravessa quando o cubo chega na entrada
        this.verificarPortalLivre();
        // Joia ativa: conta o tempo real
        if (this.joiaAtiva) {
            // Desconta
            this.joiaRestante -= dtReal;
            // Aviso 600 ms antes do fim (pisca + dois tiques)
            if (this.joiaRestante < 600 && !this.avisouFim) { this.avisouFim = true; som.tom('square', 1500, 1500, 30, 0.05); som.tom('square', 1500, 1500, 30, 0.05, 120); }
            // Relógio místico esmeralda em volta do personagem (marcas, glifos e ponteiros; andam pra trás ao reverter)
            this.aneisJoia.clear().setPosition(this.player.x, this.player.y);
            // Pisca nos últimos 600 ms
            const alpha = this.joiaRestante < 600 ? (Math.floor(agora / 100) % 2 ? 0.3 : 1) : 1;
            desenharRelogioJoia(this.aneisJoia, agora, alpha, this.revertendo);
            // Tela verde pulsando de leve
            this.overlayJoia.setAlpha(0.75 + Math.sin(agora / 180) * 0.25);
            // Rastros temporais: ecos do personagem a cada 90 ms (tempo real); ao reverter, anéis que se fecham
            const fj = this.fxJoia || (this.fxJoia = { residual: 0, reverso: 0 });
            fj.residual += dtReal; fj.reverso += dtReal;
            if (fj.residual >= 90) { fj.residual = 0; fxResidual(this, 0x3dff8a, 0.35, 360); }
            if (this.revertendo && fj.reverso >= 260) { fj.reverso = 0; fxOnda(this, this.player.x, this.player.y, 0xb8ffd6, 90, 18, 300, 2, 0.6); fxConvergir(this, this.player.x, this.player.y, 0x3dff8a, 5, 90, 260); }
            // Acabou: desliga
            if (this.joiaRestante <= 0) this.desligarJoia();
        }
        // Faixa rápida: dentro dela (na dimensão ativa) a velocidade sobe pra 700
        const naFaixa = this.obstaculos.some((o) => o instanceof FaixaRapida && o.dim === this.dim && this.player.x >= o.x0 && this.player.x <= o.x1);
        // Rampa suave até a velocidade alvo
        const alvoVel = naFaixa ? ESTRANHO.velFaixa : this.cfg.velocidade;
        this.player.velocidadeX += (alvoVel - this.player.velocidadeX) * Math.min(1, dtReal / 300);
        // Runas acompanham o cubo e giram (60°/s)
        this.runas.setPosition(this.player.x, this.player.y).setAlpha(this.player.alpha);
        this.runas.angle += 60 * dtReal / 1000;
        // Mandala do fundo gira devagar (mais devagar na Joia)
        if (this.mandala) this.mandala.angle += 3 * dtReal / 1000 * this.fatorTempo;
    }

    // Morreu/concluiu: tempo normal
    aoMorrer() { if (this.joiaAtiva) { this.joiaAtiva = false; this.restaurarTempo(); } }

    // Desenha a mandala geométrica (3 polígonos concêntricos)
    desenharMandala() {
        // Limpa
        this.mandala.clear();
        // Miolo do círculo mágico: dodecágono e círculos finos na cor da dimensão
        const cor = this.mandalaCor || 0xffa53d;
        this.mandala.lineStyle(2, cor, 0.16);
        this.mandala.strokePoints(Cenarios.poligono(12, 120), true);
        this.mandala.strokeCircle(0, 0, 60).strokeCircle(0, 0, 270);
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; this.mandala.fillStyle(cor, 0.22).fillCircle(Math.cos(a) * 270, Math.sin(a) * 270, 4); }
    }


    // Cenário: mandala girando + escadas impossíveis + fragmentos (versões Normal e Espelho)
    // Cenário especial: santuário místico entre dimensões (cenarios.js) + mandala da fase no centro
    criarParalaxe() {
        // Mandala fixa na tela, atrás de tudo (gira com o relógio da fase)
        this.mandala = this.cena.add.graphics().setScrollFactor(0).setDepth(-94.6).setPosition(820, 380);
        this.desenharMandala();
        // Céu, arquitetura flutuante, estantes, portais ao fundo, selos e faíscas (versões Normal e Espelho)
        Cenarios.estranho(this);
    }

    // O cenário reage aos poderes e momentos da fase (cenarios.js)
    cenarioReagir(evento, dados) { Cenarios.reagir(this, evento, dados); }

    // Roteiro desenhado à mão (dim:'E' = elemento da dimensão espelhada, escrito como se fosse no chão)
    // Checkpoints (3: fase longa, 20600 px, com duas dimensões). Dimensão declarada = a do trecho
    checkpoints() {
        return [
            { x: 4400, dim: 'N' },               // Depois do 1º anel (volta à Normal); selo do Espelho em 4700 é fantasma
            { x: 10280, dim: 'N' },              // Depois do 2º anel e do selo; faixa rápida em 10600 (era 10350)
            { x: 14490, dim: 'E', teto: true }   // Logo depois do anel 14400 (Espelho, no teto); era 14600 (mini-espinho em 15020 vinha em 0,7 s)
        ];
    }

    // Restaura a dimensão declarada: gravidade, posição no piso certo, camadas e cores
    // Prática: o diamante guarda a dimensão atual
    estadoPratica() { return { dim: this.dim }; }

    restaurarCheckpoint(cp) {
        // Dimensão do checkpoint
        this.dim = cp.dim || 'N';
        // Gravidade invertida no Espelho
        this.player.inverterGravidade(this.dim === 'E');
        // Garante o piso certo (teto no Espelho)
        this.player.body.reset(cp.x, this.yDoCheckpoint(cp));
        // Liga a física só da dimensão ativa
        this.aplicarCamadas();
        // Fundo e paralaxe da dimensão
        this.trocarPaleta();
    }

    roteiro() {
        return [
            // TUTORIAL
            // Abertura no ritmo: espinho · triplo · serra, cada um 2 batidas depois do outro
            { x: 800, tipo: 'ritmo', padrao: '^.3.S' },
            { x: 2050, tipo: 'dica', txt: 'Portais trocam de dimensão. Veja a rota fantasma no teto' },
            { x: 2300, tipo: 'portalPad' },
            { x: 3200, tipo: 'selo', dim: 'N' },
            { x: 2800, tipo: 'espinho', dim: 'E' }, { x: 3300, tipo: 'bloco', dim: 'E' },
            { x: 3800, tipo: 'portalAnel', dim: 'E' },
            { x: 4700, tipo: 'selo', dim: 'E' },
            { x: 4300, tipo: 'dica', txt: 'E: Joia do Tempo — desacelera tudo' },
            // MEIO
            { x: 4800, tipo: 'faixaRapida', ate: 5700 },
            { x: 5100, tipo: 'espinho' }, { x: 5600, tipo: 'espinho' }, { x: 5640, tipo: 'espinho' },
            { x: 5650, tipo: 'dica', txt: 'Faixa laranja: Q abre SEU portal. Espere o marcador ficar VERDE' },
            { x: 5900, tipo: 'zonaPortal', ate: 6160 }, { x: 6250, tipo: 'muralha', ate: 6540 },
            { x: 6800, tipo: 'espinho' }, { x: 6840, tipo: 'espinho' },
            { x: 7050, tipo: 'orbe' },
            { x: 7300, tipo: 'portalPad' },
            { x: 8200, tipo: 'selo', dim: 'N' }, { x: 7700, tipo: 'serraDesce' },
            { x: 7800, tipo: 'espinho', dim: 'E' }, { x: 8100, tipo: 'espinho', dim: 'E' },
            { x: 8800, tipo: 'lamina', dim: 'E' },
            { x: 9300, tipo: 'portalAnel', dim: 'E' },
            { x: 10200, tipo: 'selo', dim: 'E' }, { x: 9800, tipo: 'espinho', dim: 'E' },
            // Bloco rúnico que desliza do alto até o lugar
            { x: 9700, tipo: 'orbe' }, { x: 10000, tipo: 'blocoEntrada' },
            { x: 10600, tipo: 'faixaRapida', ate: 12000 },
            // Selo místico no chão que pulsa no ritmo (no lugar do antigo espinho da faixa rápida)
            { x: 10860, tipo: 'laserPiso', largura: 100, padrao: '1110', cor: 0x3dff8a },
            { x: 11400, tipo: 'bloco' }, { x: 11440, tipo: 'bloco', andar: 1 },
            { x: 11950, tipo: 'espinho' }, { x: 11990, tipo: 'espinho' },
            // FINAL
            { x: 12100, tipo: 'dica', txt: 'Nem todo portal é saída: leia o fantasma' },
            { x: 12500, tipo: 'dica', txt: 'O orbe passa na saída: espere o verde (a Joia ajuda)' },
            { x: 12300, tipo: 'portalPad' },
            { x: 13100, tipo: 'selo', dim: 'E' }, { x: 12800, tipo: 'espinho', dim: 'E' },
            { x: 12650, tipo: 'zonaPortal', ate: 12900 }, { x: 13000, tipo: 'muralha', ate: 13230 }, { x: 13340, tipo: 'orbe' },
            { x: 13650, tipo: 'lamina' }, { x: 14050, tipo: 'lamina', defasagem: 90 },
            { x: 14400, tipo: 'portalAnel' },
            { x: 15200, tipo: 'selo', dim: 'N' }, { x: 15000, tipo: 'mini' },
            { x: 14800, tipo: 'faixaRapida', ate: 16500, dim: 'E' },
            { x: 15100, tipo: 'espinho', dim: 'E' }, { x: 15600, tipo: 'orbe', dim: 'E' }, { x: 16250, tipo: 'bloco', dim: 'E' },
            { x: 15400, tipo: 'runa', dim: 'E', destino: 15950 }, { x: 15780, tipo: 'barreira' },
            { x: 16800, tipo: 'portalPad', dim: 'E' },
            { x: 17600, tipo: 'selo', dim: 'E' }, { x: 17300, tipo: 'espinho', dim: 'E' },
            { x: 17600, tipo: 'lamina' }, { x: 18100, tipo: 'orbe' }, { x: 18400, tipo: 'orbe', defasagem: 0.5 },
            { x: 18600, tipo: 'faixaRapida', ate: 19800 },
            { x: 18900, tipo: 'emergente' }, { x: 19400, tipo: 'blocoEntrada' }, { x: 19950, tipo: 'espinho' }, { x: 19990, tipo: 'espinho' }, { x: 20300, tipo: 'serra' }
        ];
    }
}
