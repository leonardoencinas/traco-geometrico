// ================================================================
// aranha.js — FASE DO HOMEM-ARANHA: "Balance-se de âncora em âncora sobre os vãos da cidade"
// Mecânica: física de pêndulo de verdade. No telhado o botão pula; NO AR, segurar lança a teia
// na âncora destacada e SOLTAR larga a teia — a trajetória depende do momento em que você solta.
// Bater de lado num prédio não mata; cair no vão, sim. (Sem habilidade no E: a teia é a mecânica toda.)
// ================================================================

// Constantes da fase
const ARANHA = {
    alcance: 470,          // distância máxima até uma âncora
    gravidade: 2400,       // gravidade usada no pêndulo (mais alta = balanço mais rápido e vivo)
    velMinPrender: 520,    // velocidade tangencial mínima ao prender a teia
    bonusSoltar: 1.2,      // multiplicador de velocidade ao soltar
    impulsoSoltar: 60,     // empurrão extra pra cima ao soltar
    anguloMax: 1.3,        // ~75°: solta sozinho se passar disso (evita dar a volta)
    velBase: 420,          // velocidade correndo no telhado
    embalo: 450,           // px/s² de impulso pra frente durante o balanço (deixa fluido)
    velMaxBalanco: 900,    // velocidade máxima na ponta da corda
    velMinSoltar: 480,     // soltar sempre sai pelo menos com essa velocidade pra frente
    desaceleracao: 1400,   // px/s² pra voltar à velocidade base depois de pousar rápido
    forcaPulo: 760         // pulo um pouco mais alto
};

// ÂNCORA: ponto no alto onde a teia pode prender (decorativa: o cálculo é feito pela fase)
class Ancora extends Obstaculo {
    constructor(fase, x, y) {
        // Círculo pequeno claro
        const forma = fase.cena.add.circle(x, y, 7, 0xcfd8ff).setDepth(4);
        // Decoração (sem física)
        super(fase, forma, 'decoracao');
        // Braço metálico até o "prédio alto" do fundo (só visual)
        const braco = fase.cena.add.graphics().setDepth(3);
        // Linha cinza-azulada subindo até o teto
        braco.lineStyle(3, 0x5b6bb5, 0.7); braco.lineBetween(x, y, x - 20, MOVIMENTO.tetoY);
        // Guarda
        this.braco = braco;
        // Anel de destaque (aparece quando é a âncora escolhida)
        this.anelDestaque = fase.cena.add.circle(x, y, 16).setStrokeStyle(3, 0xffffff).setVisible(false).setDepth(5);
    }

    // Liga/desliga o destaque (pulsando)
    destacar(ligado, agora) {
        // Mostra/esconde o anel
        this.anelDestaque.setVisible(ligado);
        // Pulso de escala
        if (ligado) this.anelDestaque.setScale(1 + Math.sin(agora / 120) * 0.15);
        // As não escolhidas ficam mais apagadas
        this.forma.setAlpha(ligado ? 1 : 0.5);
    }
}

// ÂNCORA DE GUINDASTE: o gancho anda pra lá e pra cá num trilho; a teia acompanha o gancho
// (o pêndulo usa a posição atual da âncora a cada quadro, então o balanço muda de forma)
class AncoraMovel extends Ancora {
    constructor(fase, x, y, amplitude = 100, periodo = 2600) {
        // Âncora comum na posição central
        super(fase, x, y);
        // Centro, amplitude e período do vai-e-vem
        this.x0 = x; this.amp = amplitude; this.periodo = periodo; this.relogio = 0;
        // O braço fixo da âncora comum vira o cabo do guindaste (redesenhado a cada quadro)
        this.braco.clear();
        // Trilho do guindaste no alto (fixo) com as pontas marcadas
        const t = fase.cena.add.graphics().setDepth(3);
        // Trilho amarelo-escuro (cor de guindaste)
        t.lineStyle(6, 0xc9a227, 0.9); t.lineBetween(x - amplitude - 30, MOVIMENTO.tetoY + 8, x + amplitude + 30, MOVIMENTO.tetoY + 8);
        // Listras pretas no trilho
        t.lineStyle(6, 0x1a1a1a, 0.9); for (let xx = x - amplitude - 20; xx < x + amplitude + 30; xx += 30) t.lineBetween(xx, MOVIMENTO.tetoY + 8, xx + 10, MOVIMENTO.tetoY + 8);
        // Guarda o trilho
        this.trilho = t;
        // A âncora fica amarela (diferencia das fixas)
        this.forma.setFillStyle(0xffd34d);
    }

    // Anda no trilho (seno) e redesenha o cabo
    atualizar(dt) {
        // Avança o relógio
        this.relogio += dt;
        // Nova posição horizontal
        const x = this.x0 + this.amp * Math.sin(this.relogio / this.periodo * Math.PI * 2);
        // Move o gancho e o anel de destaque
        this.forma.x = x; this.anelDestaque.x = x;
        // Cabo do carrinho até o gancho
        this.braco.clear(); this.braco.lineStyle(3, 0xc9a227, 0.9); this.braco.lineBetween(x, MOVIMENTO.tetoY + 8, x, this.forma.y);
        // Carrinho no trilho
        this.braco.fillStyle(0xc9a227, 1); this.braco.fillRect(x - 12, MOVIMENTO.tetoY + 2, 24, 12);
    }

    // Some com o trilho também
    destruir() { this.trilho.destroy(); super.destruir(); }
}

// DRONE PATRULHA: sobe e desce entre y0 e y1; mata ao encostar
class DronePatrulha extends Obstaculo {
    constructor(fase, x, y0, y1, periodo = 2000) {
        // Corpo laranja 44x20
        const forma = fase.cena.add.rectangle(x, (y0 + y1) / 2, 44, 20, 0xff9f1c).setStrokeStyle(2, 0xfff1c1);
        // Mortal
        super(fase, forma, 'mortal');
        // Limites e período
        this.y0 = y0; this.y1 = y1; this.periodo = periodo; this.relogio = 0;
        // Hélices (duas linhas em cima)
        this.helices = fase.cena.add.graphics().setDepth(3);
    }

    atualizar(dt) {
        // Relógio local só anda perto da tela
        if (this.forma.x - this.fase.player.x < 1100) this.relogio += dt;
        // Posição entre y0 e y1 (vai e volta suave)
        this.forma.y = Phaser.Math.Linear(this.y0, this.y1, (Math.sin(this.relogio / this.periodo * Math.PI * 2) + 1) / 2);
        // Hélices piscando
        this.helices.clear().lineStyle(2, 0xfff1c1, Math.floor(this.relogio / 60) % 2 ? 1 : 0.3);
        this.helices.lineBetween(this.forma.x - 24, this.forma.y - 14, this.forma.x - 6, this.forma.y - 14);
        this.helices.lineBetween(this.forma.x + 6, this.forma.y - 14, this.forma.x + 24, this.forma.y - 14);
    }
}

// PLACA ELÉTRICA pendurada: mata (fica no caminho de quem solta a teia tarde demais)
class PlacaEletrica extends Obstaculo {
    constructor(fase, x, y) {
        // Placa 120x50
        const forma = fase.cena.add.rectangle(x, y, 120, 50, 0x1a2148).setStrokeStyle(3, 0x3ad1ff);
        // Mortal
        super(fase, forma, 'mortal');
        // Cabos até o teto e faíscas
        const g = fase.cena.add.graphics().setDepth(2);
        // Dois cabos
        g.lineStyle(2, 0x5b6bb5, 0.8); g.lineBetween(x - 40, y - 25, x - 40, MOVIMENTO.tetoY); g.lineBetween(x + 40, y - 25, x + 40, MOVIMENTO.tetoY);
        // Raio desenhado no meio
        g.lineStyle(3, 0x3ad1ff, 1); g.lineBetween(x - 10, y - 14, x + 4, y); g.lineBetween(x + 4, y, x - 4, y + 2); g.lineBetween(x - 4, y + 2, x + 10, y + 14);
        // Guarda
        this.cabos = g;
    }

    // Faísca de vez em quando
    atualizar() { if (Math.random() < 0.02) this.fase.efeitos.estilhacos(this.forma.x + Phaser.Math.Between(-60, 60), this.forma.y + 25, 0x3ad1ff, 2, 120); }
}

// ANTENA no telhado: o "espinho" desta fase
class Antena extends Obstaculo {
    constructor(fase, x, yTopo) {
        // Haste 8x60 em cima do telhado
        const forma = fase.cena.add.rectangle(x, yTopo - 30, 8, 60, 0x7b86c9).setStrokeStyle(1, 0xcfd8ff);
        // Mortal
        super(fase, forma, 'mortal');
        // Luz vermelha piscando em cima
        this.luz = fase.cena.add.circle(x, yTopo - 62, 5, 0xff4d5e).setDepth(4);
    }

    // Pisca a luz
    atualizar(dt, agora) { this.luz.setAlpha(Math.floor(agora / 400) % 2 ? 0.3 : 1); }
}

// CLASSE FaseAranha
class FaseAranha extends Fase {
    constructor(cena, heroi, tentativa) {
        // Base
        super(cena, heroi, tentativa);
        // Bater de lado em prédio não mata (o cubo cai)
        this.morteLateral = false;
        // Controles
        this.textoControles = 'SEGURE Espaço/clique: lança teia na âncora marcada  ·  SOLTE: voa  ·  Sem âncora: pula';
        // Objetivo
        this.objetivo = 'Balance-se nas teias e solte no momento certo.';
        // Frases do encerramento (texto grande e subtítulo da tela final)
        this.fraseCurta = 'PELA CIDADE!'; this.fraseFinal = 'nenhum vão foi grande demais.';
        // Estado do balanço (null = não está preso)
        this.balanco = null;
        // Velocidade horizontal atual (muda com o balanço)
        this.vx = ARANHA.velBase;
        // Âncoras da fase
        this.ancoras = [];
        // Âncora escolhida neste frame
        this.ancoraEscolhida = null;
    }

    // Telhados (com vãos entre eles) — [x inicial, x final, topo]
    segmentosChao() {
        return [[this.xMin(), 1500, 600], [1720, 2700, 600], [3200, 4200, 580], [4900, 5600, 620], [6500, 7100, 560],
                [7700, 8300, 600], [8800, 8940, 520], [9400, 9900, 500], [11500, 12000, 600], [12300, 12800, 560], [13180, 13300, 500], [14000, this.cfg.comprimento + 1600, 600]];
    }

    // Telhados com cor própria e janelas acesas nos prédios
    criarChao(segmentos) {
        // Cria os blocos normalmente
        super.criarChao(segmentos);
        // Gerador com semente (janelas iguais em toda tentativa)
        const rnd = new Phaser.Math.RandomDataGenerator(['janelas']);
        // Graphics das janelas dos prédios (frente)
        const g = this.cena.add.graphics().setDepth(1);
        // Cada telhado
        this.chao.forEach((b, i) => {
            // Cor do prédio e borda de topo
            b.forma.setFillStyle(0x1e2652).setStrokeStyle(0);
            // Limites do prédio
            const x0 = b.forma.x - b.forma.width / 2, x1 = b.forma.x + b.forma.width / 2, topo = b.forma.y - b.forma.height / 2;
            // Janelas acesas aleatórias (amarelas) na fachada
            for (let y = topo + 24; y < 720; y += 34) for (let x = Math.max(x0, this.xMin() + 100) + 14; x < Math.min(x1, this.cfg.comprimento + 1200) - 20; x += 30) {
                // 35% acesas
                if (rnd.frac() < 0.35) { g.fillStyle(0xffd27a, 0.5); g.fillRect(x, y, 12, 16); }
            }
        });
    }

    // Começa em cima do primeiro telhado
    criarJogador() {
        // Criação padrão
        super.criarJogador();
        // Sobe pro topo do primeiro telhado (600)
        this.player.y = 580; this.player.body.reset(this.xInicio, 580);
        // Pulo mais alto
        this.player.forcaPulo = ARANHA.forcaPulo;
    }

    // Encerramento: última teia até o topo da tela e o personagem sobe girando
    animacaoFinal() {
        // Fio até o alto
        const ax = this.player.x + 160, ay = MOVIMENTO.tetoY + 10;
        this.cena.time.addEvent({ delay: 16, repeat: 80, callback: () => { this.fio.clear().lineStyle(2, 0xffffff, 0.95).lineBetween(this.player.x, this.player.y, ax, ay); } });
        som.tom('triangle', 1200, 600, 80, 0.07);
        // Sobe girando até a âncora
        this.cena.tweens.add({ targets: this.player, x: ax, y: ay + 30, angle: 360, duration: 1100, ease: 'Cubic.Out' });
    }

    // Cubo coral
    coresCubo() { return VISUAIS_HEROIS['Homem-Aranha'].cores; }

    // Skin do Homem-Aranha: máscara com teia e olhos grandes (efeitosPoderes.js)
    desenharSkin(g) { VISUAIS_HEROIS['Homem-Aranha'].desenhar(g); }

    // Habilidade

    // Ao criar: linha da teia (desenhada todo frame) + vento contínuo
    aoCriar() {
        // Graphics da teia
        this.fio = this.cena.add.graphics().setDepth(9);
        // Som contínuo de vento (volume conforme a velocidade)
        this.vento = som.continuo('triangle', 180, 900);
        // Desliga no fim da cena
        this.desligadores.push(() => this.vento.parar());
        // Entrada: o cubo cai do alto e pousa no telhado
        this.player.body.reset(this.xInicio, 160);
    }

    // Âncora válida (perto, acima e não muito atrás)?
    valida(a) {
        // Jogador
        const p = this.player;
        // Diferenças
        const dx = a.forma.x - p.x, dy = a.forma.y - p.y;
        // Regras do design
        // Precisa estar no alcance, um pouco acima do cubo e não muito pra trás (antes exigia 60 px acima e
        // só funcionava no ar — por isso a teia às vezes "não pegava")
        return a.ativo && Math.hypot(dx, dy) <= ARANHA.alcance && a.forma.y < p.y - 30 && dx >= -60;
    }

    // Escolhe a melhor âncora (a mais perto de 180 px à frente)
    escolherAncora() {
        // Melhor e nota
        let melhor = null, menor = Infinity;
        // Passa pelas âncoras
        this.ancoras.forEach((a) => {
            // Só válidas
            if (!this.valida(a)) return;
            // Nota: quão longe de "180 px à frente"
            const nota = Math.abs(a.forma.x - this.player.x - 180);
            // Guarda a melhor
            if (nota < menor) { menor = nota; melhor = a; }
        });
        // Devolve
        return melhor;
    }

    // Prende a teia numa âncora: calcula comprimento, ângulo e velocidade angular
    prender(a) {
        // Jogador e corpo
        const p = this.player, b = p.body;
        // Vetor da âncora até o cubo
        const dx = p.x - a.forma.x, dy = p.y - a.forma.y;
        // Comprimento da corda (limitado)
        const L = Phaser.Math.Clamp(Math.hypot(dx, dy), 140, ARANHA.alcance);
        // Ângulo (0 = cubo bem embaixo; positivo = cubo à direita)
        const th = Math.atan2(dx, dy);
        // Direção tangente (pra onde o ângulo cresce)
        const tx = Math.cos(th), ty = -Math.sin(th);
        // Velocidade angular a partir da velocidade atual projetada na tangente
        let w = (b.velocity.x * tx + b.velocity.y * ty) / L;
        // Garante uma velocidade mínima pra frente
        if (w * L < ARANHA.velMinPrender) w = ARANHA.velMinPrender / L;
        // Guarda o estado
        // Saindo do telhado: a corda já começa curta o bastante pro arco não raspar no telhado
        // (o encurtamento é gradual e dá um "puxão" gostoso, em vez de travar no chão)
        const Lalvo = p.isOnGround() ? Math.max(110, Math.min(L, p.y - a.forma.y - 6)) : L;
        this.balanco = { ancora: a, L, Lalvo, th, w };
        // O corpo não se move sozinho no balanço: a posição vem direto do pêndulo (sem tranco)
        b.moves = false;
        // Sem gravidade enquanto balança (o pêndulo calcula tudo)
        b.setAllowGravity(false);
        // Efeito "thwip": o fio sai do pulso até a âncora e respinga teia lá
        fxTeiaLancada(this, p.x, p.y, a.forma.x, a.forma.y);
        fxCenario(this, 'teia', { x: a.forma.x, y: a.forma.y });
        // Som da teia prendendo
        som.tom('triangle', 1200, 600, 80, 0.07); som.ruido(60, 0.05, 5000);
    }

    // Solta a teia: a velocidade tangencial vira velocidade do cubo
    soltar() {
        // Não está preso: nada
        if (!this.balanco) return;
        // Estado
        const { L, th, w } = this.balanco;
        // Velocidade tangencial (com bônus)
        let vx = w * L * Math.cos(th) * ARANHA.bonusSoltar;
        let vy = -w * L * Math.sin(th) * ARANHA.bonusSoltar - ARANHA.impulsoSoltar;
        // Limites
        vx = Phaser.Math.Clamp(vx, ARANHA.velMinSoltar, 780); vy = Phaser.Math.Clamp(vy, -900, 900);
        // Aplica
        this.player.body.setAllowGravity(true);
        // Volta a física normal
        this.player.body.moves = true;
        // Sincroniza o corpo com a posição atual (senão o Phaser soma o deslocamento do balanço inteiro de uma vez = teleporte)
        this.player.body.reset(this.player.x, this.player.y);
        this.player.body.setVelocity(vx, vy);
        // Guarda a velocidade horizontal (ela fica até pousar)
        this.vx = vx;
        // Não está mais preso
        this.balanco = null;
        // "Vupt" de vento se saiu rápido
        if (vx > 650) for (let i = 0; i < 3; i++) this.efeitos.anel(this.player.x - 30, this.player.y - 10 + i * 10, 0xffffff, 4, 3, 160);
        // Som
        som.tom('sine', 500, 900, 100, 0.06);
    }

    // Pressionou: se tem âncora destacada, lança a teia (no telhado ou no ar); senão, pula
    aoPressionar() {
        // Já balançando: nada (soltar é que larga a teia)
        if (this.balanco) return;
        // Orbe de salto encostado: pulo no ar
        if (this.usarOrbe()) return;
        // Tem âncora no alcance: prende (funciona até saindo do telhado)
        if (this.ancoraEscolhida) { this.prender(this.ancoraEscolhida); return; }
        // Sem âncora: pulo normal
        this.player.apertarPulo(this.cena.time.now);
    }

    // Soltou o botão: larga a teia
    aoSoltar() { this.soltar(); }

    // Prática: diamante só com os pés num telhado (no meio do balanço não dá pra refazer a teia)
    podeMarcarPratica() { return !this.balanco && this.player.isOnGround(); }

    // Clique perto de uma âncora válida (no ar): prende NELA
    aoClicarMundo(ponteiro) {
        // Já preso: ignora
        if (this.balanco) return false;
        // Âncora válida perto do clique (110 px)
        const a = this.ancoras.find((an) => this.valida(an) && Phaser.Math.Distance.Between(an.forma.x, an.forma.y, ponteiro.worldX, ponteiro.worldY) <= 110);
        // Nenhuma: comportamento normal
        if (!a) return false;
        // Prende nela
        this.prender(a);
        // Soltar o clique vai largar a teia
        this.ponteiroPulo = true;
        // Clique usado
        return true;
    }

    // O cubo (40x40) na posição x,y encostaria em algum prédio/telhado?
    bateEmSolido(x, y) {
        // Retângulo do cubo (um pouquinho menor, pra não travar em quinas)
        const r = new Phaser.Geom.Rectangle(x - 18, y - 18, 36, 36);
        // Confere contra os telhados
        const c = this.chao.find((c) => c.ativo && Phaser.Geom.Intersects.RectangleToRectangle(r, c.forma.getBounds()));
        // Devolve o topo do telhado em que bateu (ou null se está livre)
        return c ? c.forma.getBounds().top : null;
    }

    // Câmera um pouco "atrasada" (lerp 0,15): no balanço a velocidade muda e assim a tela não dá trancos
    configurarCamera() {
        // Configuração padrão
        super.configurarCamera();
        // Segue com suavidade no eixo X
        this.cena.cameras.main.startFollow(this.foco || this.player, true, 0.15, 0, -(640 - MOVIMENTO.telaX), 0);
    }

    // Movimento próprio (corrida com velocidade variável + pêndulo)
    atualizarMovimento(agora, dt) {
        // Jogador e corpo
        const p = this.player, b = p.body;
        // Escolhe e destaca a âncora (sempre que não está preso — no telhado também)
        this.ancoraEscolhida = !this.balanco ? this.escolherAncora() : null;
        // Atualiza o destaque de todas
        this.ancoras.forEach((a) => a.destacar(a === this.ancoraEscolhida, agora));
        // Limpa o fio da teia
        this.fio.clear();
        // Prévia: linha tracejada fraca até a âncora destacada (mostra onde a teia vai prender)
        if (this.ancoraEscolhida && p.vivo) {
            // Âncora
            const a = this.ancoraEscolhida, d = Phaser.Math.Distance.Between(p.x, p.y, a.forma.x, a.forma.y);
            // Tracinhos de 10 px a cada 20 px
            this.fio.lineStyle(1, 0xffffff, 0.35);
            for (let t = 0; t < d; t += 20) this.fio.lineBetween(p.x + (a.forma.x - p.x) * t / d, p.y + (a.forma.y - p.y) * t / d, p.x + (a.forma.x - p.x) * Math.min(d, t + 10) / d, p.y + (a.forma.y - p.y) * Math.min(d, t + 10) / d);
        }

        // PRESO NA TEIA: integra o pêndulo e coloca o cubo direto na ponta da corda (movimento liso)
        if (this.balanco) {
            // Estado
            const s = this.balanco, a = s.ancora;
            // Sub-passos de 4 ms (mais estável)
            const passos = Math.max(1, Math.round(dt / 4)), h = dt / 1000 / passos;
            // Integra
            for (let i = 0; i < passos; i++) {
                // Puxão/encurtamento: diminui a corda aos poucos conservando ω·L² (ganha velocidade)
                if (s.L > s.Lalvo + 0.5) { const novo = Math.max(s.Lalvo, s.L - 1600 * h); s.w *= (s.L / novo) * (s.L / novo); s.L = novo; }
                // Aceleração angular do pêndulo
                // + impulso pra frente enquanto vai pra frente (o balanço ganha embalo, não morre)
                const alfa = -(ARANHA.gravidade / s.L) * Math.sin(s.th) + (s.w > 0 ? ARANHA.embalo / s.L : 0);
                // Atualiza velocidade e ângulo
                s.w += alfa * h; s.w = Math.min(s.w, ARANHA.velMaxBalanco / s.L); s.th += s.w * h;
            }
            // Ponta da corda nesse ângulo
            let alvoX = a.forma.x + s.L * Math.sin(s.th), alvoY = a.forma.y + s.L * Math.cos(s.th);
            // Se a ponta entraria num prédio/telhado, recolhe a corda até caber (sobe por cima)
            const topo = this.bateEmSolido(alvoX, alvoY);
            if (topo !== null) {
                // Encurta a corda só o necessário pro cubo deslizar por cima do telhado (sem tranco)
                const Lnovo = (topo - 19 - a.forma.y) / Math.max(0.2, Math.cos(s.th));
                if (Lnovo >= 80) { s.L = s.Lalvo = Math.min(s.L, Lnovo); alvoX = a.forma.x + s.L * Math.sin(s.th); alvoY = a.forma.y + s.L * Math.cos(s.th); }
                // Bateu de frente numa parede alta: solta com um pulinho pra frente
                if (Lnovo < 80 || this.bateEmSolido(alvoX, alvoY) !== null) { this.soltar(); p.body.setVelocity(ARANHA.velBase, -520); this.vx = ARANHA.velBase; return true; }
            }
            // Velocidade real (pra efeitos e pra soltar com o impulso certo)
            const vt = s.w * s.L;
            b.velocity.set(vt * Math.cos(s.th), -vt * Math.sin(s.th));
            // Coloca o cubo na ponta da corda
            p.setPosition(alvoX, alvoY);
            // O cubo inclina suave na direção do movimento (não gira duro junto com a corda)
            p.rotation = Phaser.Math.Angle.RotateTo(p.rotation, -s.th * 0.6, 0.25);
            // Corda levemente curva (fica mais orgânica) + "asterisco" de teia na âncora
            const mx = (p.x + a.forma.x) / 2, my = (p.y + a.forma.y) / 2 + Math.min(18, Math.abs(vt) / 60);
            const curva = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(p.x, p.y), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(a.forma.x, a.forma.y));
            desenharTeiaFio(this.fio, curva, a.forma.x, a.forma.y);
            // Rastro de velocidade quando está rápido
            if (Math.abs(vt) > 600 && Math.random() < 0.5) this.efeitos.poeira(p.x - 12, p.y, 0xff5a6e, 1);
            // Solta sozinho só se passar de ~75° (evita dar a volta completa)
            if (s.th > ARANHA.anguloMax) this.soltar();
            // Vento
            this.vento.volume(Math.min(0.04, Math.abs(vt) / 20000));
            // Cuidou do movimento
            return true;
        }

        // SOLTO: segurando o botão, prende assim que uma âncora entrar no alcance
        if (this.segurando() && this.ancoraEscolhida) { this.prender(this.ancoraEscolhida); return true; }
        // No telhado: velocidade volta aos poucos pra base (mínimo = base)
        if (p.isOnGround()) this.vx = Math.max(ARANHA.velBase, this.vx - ARANHA.desaceleracao * dt / 1000);
        // Corrida/pulo padrão com a velocidade atual (só pula segurando quando está no telhado)
        p.velocidadeX = this.vx;
        p.atualizar(agora, dt, this.segurando() && p.isOnGround());
        // Vento conforme a velocidade
        this.vento.volume(Math.min(0.03, Math.max(0, this.vx - 420) / 20000));
        // Cuidou do movimento
        return true;
    }

    // Ao morrer/concluir: solta a teia e silencia o vento
    aoMorrer() { this.balanco = null; this.fio.clear(); this.vento.volume(0); }

    // Elementos do roteiro
    criarElemento(ev) {
        // Escolhe pelo tipo
        switch (ev.tipo) {
            // Âncora
            case 'ancora': this.ancoras.push(new Ancora(this, ev.x, ev.y)); break;
            // Âncora de guindaste (anda no trilho)
            case 'guindaste': this.ancoras.push(new AncoraMovel(this, ev.x, ev.y, ev.amp || 100, ev.periodo || 2600)); break;
            // Drone patrulha
            case 'drone': new DronePatrulha(this, ev.x, ev.y0, ev.y1, ev.periodo || 2000); break;
            // Placa elétrica
            case 'placa': new PlacaEletrica(this, ev.x, ev.y); break;
            // Antena (no topo do telhado daquele x)
            case 'antena': { const seg = this.segmentosChao().find(([a, b]) => ev.x >= a && ev.x <= b); new Antena(this, ev.x, seg ? seg[2] : 600); break; }
            // Comuns
            default: super.criarElemento(ev);
        }
    }

    // Cenário: cidade à noite (lua e estrelas, prédios com janelas, caixas d'água)
    // Cenário temático (cidade à noite com lua, skyline em camadas, caixas d'água, antenas, holofotes e janelas acendendo) — desenhado em cenarios.js
    criarParalaxe() { Cenarios.aranha(this); }

    // O cenário reage aos poderes e momentos da fase (cenarios.js)
    cenarioReagir(evento, dados) { Cenarios.reagir(this, evento, dados); }

    // Roteiro desenhado à mão (os telhados estão em segmentosChao)
    // Checkpoints (2: fase curta, 15000 px). Sempre em cima de um telhado, longe da borda
    checkpoints() {
        return [
            { x: 4910 },    // Começo do telhado 4900–5600 (era 5000: o laser do piso em 5240 chegava em 0,3 s)
            { x: 9500 },    // Telhado alto 9400–9900: antes do vão grande com guindastes
            { x: 11510 }    // Começo do telhado 11500–12000 (sem serra neste telhado: o caminho até o vão fica livre)
        ];
    }

    roteiro() {
        return [
            // TUTORIAL
            { x: 700, tipo: 'dica', txt: 'Pule o vão' },
            { x: 2000, tipo: 'dica', txt: 'SEGURE pra lançar teia na âncora marcada. SOLTE pra voar' },
            { x: 2300, tipo: 'serra', yBase: 600 },
            { x: 2950, tipo: 'ancora', y: 190 },
            { x: 3900, tipo: 'dica', txt: 'Pad amarelo: te lança alto — segure pra prender a teia lá em cima' },
            { x: 4080, tipo: 'pad' },
            { x: 4380, tipo: 'ancora', y: 180 }, { x: 4720, tipo: 'ancora', y: 200 },
            // MEIO
            { x: 5250, tipo: 'dica', txt: 'Gancho amarelo de guindaste anda: prenda quando ele vier na sua direção' },
            { x: 5800, tipo: 'ancora', y: 170 }, { x: 6150, tipo: 'guindaste', y: 210, amp: 90 }, { x: 6400, tipo: 'ancora', y: 170 },
            { x: 6000, tipo: 'drone', y0: 680, y1: 740 },
            // Laser de segurança no telhado (liga no ritmo da música)
            { x: 5240, tipo: 'laserPiso', largura: 100, padrao: '1110' },
            // Antena de para-raios que sobe do telhado
            { x: 7950, tipo: 'emergente' },
            { x: 7380, tipo: 'ancora', y: 180 }, { x: 7600, tipo: 'placa', y: 300 },
            { x: 8500, tipo: 'ancora', y: 170 }, { x: 8850, tipo: 'ancora', y: 220 }, { x: 9200, tipo: 'ancora', y: 170 },
            { x: 8700, tipo: 'drone', y0: 680, y1: 740, periodo: 2400 }, { x: 9050, tipo: 'drone', y0: 480, y1: 640, periodo: 2400 },
            { x: 8000, tipo: 'dica', txt: 'Errou o tempo? O letreiro no meio do vão salva: pouse e pule' },
            // FINAL (vão grande)
            { x: 10100, tipo: 'ancora', y: 170 }, { x: 10450, tipo: 'guindaste', y: 200, amp: 100 }, { x: 10800, tipo: 'ancora', y: 160 },
            { x: 11150, tipo: 'guindaste', y: 200, amp: 80, periodo: 2200 }, { x: 11400, tipo: 'ancora', y: 180 },
            { x: 10300, tipo: 'drone', y0: 680, y1: 740, periodo: 2200 }, { x: 10950, tipo: 'drone', y0: 500, y1: 640, periodo: 2200 },
            // (a serra que ficava em 11850, no mesmo telhado do último checkpoint, foi tirada: aparecia logo na frente do save)
            { x: 12150, tipo: 'ancora', y: 200 },
            { x: 12600, tipo: 'antena' },
            { x: 12980, tipo: 'ancora', y: 180 }, { x: 13350, tipo: 'guindaste', y: 170, amp: 90 }, { x: 13700, tipo: 'ancora', y: 200 },
            { x: 13500, tipo: 'drone', y0: 680, y1: 740, periodo: 2200 },
            // Corrida final no telhado: antena, laser no ritmo e antena (sem teia: só pulos certos)
            { x: 14300, tipo: 'emergente' }, { x: 14560, tipo: 'laserPiso', largura: 110, padrao: '1101' }, { x: 14820, tipo: 'emergente' }
        ];
    }
}
