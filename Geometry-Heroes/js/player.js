// ================================================================
// player.js — CLASSE Player: o cubo controlado pelo jogador
// Física (Arcade do Phaser, passo fixo de 1/60 s): corre pra direita na velocidade da fase;
// o pulo é uma velocidade vertical instantânea contra a gravidade (MOVIMENTO em config.js).
// Pulo responsivo: o aperto pula NA HORA (no próprio evento da tecla/toque, sem esperar o quadro),
// com "coyote time" (ainda pula logo depois de sair da borda) e "jump buffer" (aperto um pouco
// antes de pousar vale no pouso). Cada pulo gasta o aperto: não há pulo duplo involuntário.
// ================================================================

// MODOS DE JOGO (como os portais de modo dos jogos de ritmo): o portal troca o jeito de se mover
//   cubo = pulo normal · bola = aperte no chão pra trocar de lado (chão ↔ teto) · ufo = cada toque é um pulinho no ar
// O corpo de física continua 40×40 em todos os modos; só o desenho muda.
const MODOS = {
    cubo: { gravidade: 1,   escala: 1 },
    bola: { gravidade: 0.9, escala: 0.72, empurrao: 250 },          // empurrão inicial na direção do novo lado
    ufo:  { gravidade: 0.6, escala: 0.62, pulo: 0.65, quedaMax: 650 } // pulinho = 65% do pulo; cai devagar
};

// CLASSE Player — movimentação básica do cubo (pulo, giro, gravidade invertida, morte).
// Agora o cubo ANDA de verdade pra direita e a câmera segue ele.
// Fases com movimento próprio (voo, balanço) assumem o controle pela fase.
class Player extends Phaser.GameObjects.Rectangle {

    // scene = cena; x, y = posição inicial; cor/borda = cores do corpo do cubo (skin da fase)
    constructor(scene, x, y, cor = 0xb7f65b, borda = 0xefffc6) {
        // Chama o construtor do Rectangle: cena, x, y, largura, altura, cor
        super(scene, x, y, 40, 40, cor);
        // Borda clara em volta do cubo
        this.setStrokeStyle(3, borda);
        // Guarda as cores (pra voltar ao normal depois de efeitos)
        this.corBase = cor;
        // Guarda a cor da borda
        this.bordaBase = borda;
        // Coloca o cubo na lista de coisas desenhadas da cena
        scene.add.existing(this);
        // Dá um corpo de física dinâmico pro cubo (ele sofre gravidade)
        scene.physics.add.existing(this);
        // Cubo fica na frente do cenário e dos obstáculos
        this.setDepth(10);

        // Velocidade de corrida pra direita (a fase define)
        this.velocidadeX = 450;
        // Força do pulo (a fase pode mudar)
        this.forcaPulo = MOVIMENTO.forcaPulo;
        // Guarda o último momento (em ms) em que o cubo estava no chão
        this.ultimoChao = -Infinity;
        // Guarda o último momento (em ms) em que o jogador apertou pra pular
        this.ultimoAperto = -Infinity;
        // Indica se o cubo está vivo (morto não se mexe mais)
        this.vivo = true;
        // Indica se a gravidade está invertida (cubo grudado no teto)
        this.invertido = false;
        // Momento até quando o cubo está invencível (depois de teleporte/troca de dimensão)
        this.invencivelAte = 0;
        // Desenho extra por cima do cubo (skin abstrata da fase); a fase cria
        this.skin = null;
        // Modo de jogo atual (portais de modo trocam): 'cubo', 'bola' ou 'ufo'
        this.modo = 'cubo';
        // Desenho do modo (anel da bola ou disco do UFO), por cima da skin
        this.adorno = null;
        // true quando a corrida/pulo padrão (atualizar) controlou o cubo no último quadro.
        // Fases com movimento próprio (voo do Ferro, balanço do Aranha) deixam false → o aperto não vira pulo de corrida.
        this.emCorrida = false;
        // Decide o pulo também a cada PASSO de física (60 por segundo, depois das colisões): o pulo guardado
        // no buffer sai no passo exato em que o cubo encosta, e o coyote conta igual em 30, 60 ou 144 fps.
        const mundo = scene.physics.world;
        mundo.on('worldstep', this.aoPassoFisica, this);
        this.once('destroy', () => mundo.off('worldstep', this.aoPassoFisica, this));
    }

    // Gravidade do corpo = mundo + extra. Total desejado: direção × fator do modo × gravidade
    aplicarGravidade() {
        // Direção (1 = pra baixo, -1 = pra cima) e fator do modo
        const dir = this.invertido ? -1 : 1, fator = (MODOS[this.modo] || MODOS.cubo).gravidade;
        // O mundo já puxa com +g; o extra completa o que falta
        this.body.setGravityY((dir * fator - 1) * MOVIMENTO.gravidade);
    }

    // Troca o modo de jogo (portal de modo)
    definirModo(modo) {
        // Modo desconhecido ou igual: nada
        if (!MODOS[modo] || modo === this.modo) return;
        // Guarda
        this.modo = modo;
        // Gravidade do novo modo
        this.aplicarGravidade();
        // Tamanho do desenho do personagem dentro do modo
        this.escalaModo = MODOS[modo].escala;
        // Gasta apertos antigos (não pula sozinho ao atravessar)
        this.ultimoAperto = -Infinity;
        // Desenha o adorno do modo
        if (this.adorno) { this.adorno.destroy(); this.adorno = null; }
        if (modo === 'cubo') { this.angle = Math.round(this.angle / 90) * 90; return; }
        const g = this.scene.add.graphics().setDepth(12);
        if (modo === 'bola') {
            // Anel com 4 raios (mostra que rola)
            g.lineStyle(4, this.bordaBase, 1).strokeCircle(0, 0, 22);
            g.lineStyle(2, this.bordaBase, 0.8);
            for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.lineBetween(Math.cos(a) * 15, Math.sin(a) * 15, Math.cos(a) * 22, Math.sin(a) * 22); }
        } else {
            // Disco voador embaixo do personagem, com luzinhas
            g.fillStyle(0x9aa3b5, 1).fillEllipse(0, 12, 56, 16);
            g.lineStyle(2, this.bordaBase, 1).strokeEllipse(0, 12, 56, 16);
            g.fillStyle(this.bordaBase, 1); [-18, 0, 18].forEach((x) => g.fillCircle(x, 13, 2.5));
        }
        this.adorno = g;
    }

    // Volta o cubo pras cores da skin
    corNormal() {
        // Só muda se ainda estiver vivo
        if (this.vivo) this.setFillStyle(this.corBase).setStrokeStyle(3, this.bordaBase);
    }

    // Inverte a gravidade do cubo (usado na dimensão espelhada do Doutor Estranho)
    inverterGravidade(invertido = !this.invertido) {
        // Guarda o novo estado
        this.invertido = invertido;
        // Gravidade do corpo (pra cima se invertido; o fator depende do modo)
        this.aplicarGravidade();
        // Libera o chão (pra não pular no mesmo frame da troca)
        this.ultimoChao = -Infinity;
    }

    // Retorna true se o cubo está encostado em algo embaixo (ou em cima, se invertido)
    isOnGround() {
        // Invertido: o "chão" é o teto (lado de cima do cubo)
        if (this.invertido) return this.body.blocked.up || this.body.touching.up;
        // blocked = bateu em corpo estático; touching = bateu em corpo dinâmico
        return this.body.blocked.down || this.body.touching.down;
    }

    // Registra um aperto de pulo (chamado pelos eventos de tecla/clique)
    apertarPulo(time) {
        // Guarda a hora do aperto (jump buffer)
        this.ultimoAperto = time;
        // Resposta imediata: decide o pulo JÁ no evento. A tecla é lida antes do passo de física do quadro,
        // então o cubo sai do chão neste mesmo quadro (antes só saía no quadro seguinte: +1 quadro de atraso).
        if (this.emCorrida && this.vivo && this.body.enable) this.decidirPulo(time, false);
    }

    // Chamado pelo mundo de física depois de cada passo (colisões já resolvidas)
    aoPassoFisica() {
        // Só quando a corrida padrão está no controle
        if (!this.emCorrida || !this.vivo || !this.body.enable) return;
        // Atualiza o chão / usa o aperto guardado (segurar é tratado no atualizar, que sabe se está segurando)
        this.decidirPulo(this.scene.time.now, false);
    }

    // Decide o pulo (ou a troca de lado da bola / pulinho do UFO). Devolve true se estava no chão.
    // Pode ser chamado várias vezes por quadro sem pular duas vezes: cada pulo gasta o chão e o aperto.
    decidirPulo(time, segurando) {
        // Direção da gravidade: 1 = normal (pra baixo), -1 = invertida (pra cima)
        const dir = this.invertido ? -1 : 1;
        // Encostado no chão agora (flags do último passo de física)?
        const noChao = this.isOnGround();
        // Se está no chão, atualiza a hora do "último chão" (base do coyote time)
        if (noChao) this.ultimoChao = time;
        // Se o botão está segurado, conta como um aperto novo (pulo contínuo; no UFO segurar não repete)
        if (segurando && this.modo !== 'ufo') this.ultimoAperto = time;
        // Esteve no chão há pouco (coyote time) e apertou há pouco (jump buffer)?
        const podePular = time - this.ultimoChao <= MOVIMENTO.coyoteTime;
        const querPular = time - this.ultimoAperto <= MOVIMENTO.jumpBuffer;
        if (this.modo === 'bola') {
            // BOLA: troca o lado da gravidade
            if (podePular && querPular) {
                this.inverterGravidade(!this.invertido);
                // Empurrão na direção do novo lado (sai do chão na hora)
                this.body.setVelocityY(MODOS.bola.empurrao * (this.invertido ? -1 : 1));
                this.ultimoChao = -Infinity; this.ultimoAperto = -Infinity;
                som.tom('triangle', this.invertido ? 300 : 700, this.invertido ? 700 : 300, 90, 0.05);
            }
        } else if (this.modo === 'ufo') {
            // UFO: cada aperto novo dá um pulinho (no ar também)
            if (querPular) {
                this.body.setVelocityY(-this.forcaPulo * MODOS.ufo.pulo * dir);
                this.ultimoAperto = -Infinity;
                som.tom('square', 520, 880, 70, 0.04);
            }
        } else if (podePular && querPular && (noChao || this.body.velocity.y * dir >= 0)) {
            // CUBO: joga o cubo pra longe do chão (pra cima normal, pra baixo se invertido)
            this.body.setVelocityY(-this.forcaPulo * dir);
            // "Gasta" o chão e o aperto (não pula duas vezes com o mesmo coyote/buffer)
            this.ultimoChao = -Infinity;
            this.ultimoAperto = -Infinity;
            // Corta o achatamento do pouso: o desenho já sai esticado no pulo, sem parecer "preso" no chão
            this.pouso = 0;
            // Som do pulo
            som.tocar('pulo');
        }
        return noChao;
    }

    // Movimento padrão de corrida + pulo. time = relógio; delta = ms do frame; segurando = botão de pulo segurado
    atualizar(time, delta, segurando) {
        // Se morreu, não faz mais nada
        if (!this.vivo) return;
        // A corrida padrão está no controle neste quadro (libera o pulo imediato no evento e no passo de física)
        this.emCorrida = true;

        // Corre pra direita na velocidade da fase
        this.body.setVelocityX(this.velocidadeX);

        // Direção da gravidade: 1 = normal (pra baixo), -1 = invertida (pra cima)
        const dir = this.invertido ? -1 : 1;

        // Pulo / troca de lado / pulinho (com coyote time, jump buffer e segurar)
        const noChao = this.decidirPulo(time, segurando);

        // Modos especiais (bola, UFO) têm o próprio jeito de girar/cair
        if (this.modo === 'bola') { this.atualizarBola(time, delta); return; }
        if (this.modo === 'ufo') { this.atualizarUfo(time, delta, dir); return; }

        // Rotação: no ar gira, no chão encaixa no ângulo reto mais próximo
        this.girar(noChao && this.body.velocity.y * dir >= 0, delta, dir);
    }

    // BOLA: apertar encostado no chão (ou no teto) troca o lado da gravidade (decidirPulo). Segurar repete ao encostar.
    // Aqui só a parte visual: rola conforme anda.
    atualizarBola(time, delta) {
        // Rola: gira conforme anda (raio 20 px)
        this.angle += (this.velocidadeX * delta / 1000) / 20 * (180 / Math.PI) * (this.invertido ? -1 : 1);
    }

    // UFO: cada APERTO novo dá um pulinho no ar (decidirPulo); segurar não repete. Cai devagar.
    atualizarUfo(time, delta, dir) {
        // Velocidade máxima de queda
        if (this.body.velocity.y * dir > MODOS.ufo.quedaMax) this.body.setVelocityY(MODOS.ufo.quedaMax * dir);
        // Inclina um pouco conforme sobe/desce
        const alvo = Phaser.Math.Clamp(this.body.velocity.y / 35, -18, 18) * dir;
        this.angle = Phaser.Math.Linear(this.angle, alvo, 0.2);
    }

    // Gira no ar ou encaixa em 90° no chão (separado pra outras fases reaproveitarem)
    girar(noChao, delta, dir = 1) {
        // No chão: encaixa
        if (noChao) {
            // Calcula o múltiplo de 90° mais perto do ângulo atual
            const alvo = Math.round(this.angle / 90) * 90;
            // Aproxima 35% por frame até o alvo (encaixe suave)
            this.angle = Phaser.Math.Linear(this.angle, alvo, 0.35);
        } else {
            // Gira proporcional ao tempo do frame (invertido gira pro outro lado)
            this.angle += MOVIMENTO.giroNoAr * (delta / 1000) * dir;
        }
    }

    // Faz a skin (o desenho do personagem) acompanhar o corpo de física; chamado todo frame pela fase.
    // O corpo é invisível; o desenho estica/achata (animação), sem mexer na colisão.
    sincronizarSkin(dt = 16) {
        // Sem skin, nada a fazer
        if (!this.skin) return;
        // No chão agora?
        const noChao = this.vivo && this.isOnGround();
        // Acabou de pousar: começa o "achatamento" de impacto (140 ms)
        if (noChao && !this.estavaNoChao && this.vivo) { this.pouso = 140; this.acabouDePousar = true; }
        // Guarda pro próximo frame
        this.estavaNoChao = noChao;
        // Conta o tempo do achatamento
        this.pouso = Math.max(0, (this.pouso || 0) - dt);
        // Escalas da animação
        let sx = 1, sy = 1, dy = 0;
        if (this.pouso > 0) {
            // Pouso: achata e alarga (sensação de peso)
            const k = this.pouso / 140; sy = 1 - 0.25 * k; sx = 1 + 0.25 * k;
        } else if (!noChao && this.vivo && !this.semEsticar) {
            // No ar: estica na direção do movimento vertical
            const e = Math.min(0.15, Math.abs(this.body.velocity.y) / 4000); sy = 1 + e; sx = 1 - e;
        } else if (this.vivo) {
            // Correndo: quica de leve (passos), em vez de deslizar
            this.passo = (this.passo || 0) + dt * Math.max(0.5, this.body.velocity.x / 450);
            dy = -Math.abs(Math.sin(this.passo / 70)) * 3;
        }
        // Escala extra do desenho (ex.: fúria do Hulk deixa o bloco maior); 1 = normal
        const ex = (this.escalaExtra || 1) * (this.escalaModo || 1);
        // Mantém a base do desenho no chão quando achata ou cresce (ou no teto, se invertido).
        // Na bola o desenho fica no centro; no UFO, sentado em cima do disco.
        const lado = this.invertido ? -1 : 1;
        const base = this.modo === 'bola' ? 0 : this.modo === 'ufo' ? -6 * lado : (20 - 20 * sy * ex) * lado;
        // Avanço visual (soco do Hulk, recuo do arco...): some sozinho
        this.avanco = (this.avanco || 0) * Math.pow(0.82, dt / 16);
        // Mesma posição do corpo (+ ajustes da animação)
        // (visX/visY = posição suavizada entre os dois últimos passos da física; ver Fase.criarJogador)
        const vx = this.visX !== undefined ? this.visX : this.x, vy = this.visY !== undefined ? this.visY : this.y;
        this.skin.setPosition(vx + this.avanco, vy + base + dy * (this.invertido ? -1 : 1));
        // Mesma rotação do corpo
        this.skin.rotation = this.rotation;
        // Mesma transparência (pisca junto na invencibilidade)
        this.skin.alpha = this.alpha;
        // Escala: animação × escala do corpo (efeitos de morte/portal)
        this.skin.setScale(this.scaleX * sx * ex, this.scaleY * sy * ex);
        // Adorno do modo (anel da bola / disco do UFO) acompanha o corpo
        if (this.adorno) {
            this.adorno.setPosition(vx + this.avanco, vy);
            this.adorno.rotation = this.rotation;
            this.adorno.alpha = this.alpha;
            // No UFO de cabeça pra baixo o disco fica do outro lado
            this.adorno.setScale(this.scaleX, this.scaleY * (this.modo === 'ufo' ? lado : 1));
        }
    }

    // Mata o cubo: para a física e esconde com uma animação
    morrer(aoTerminar) {
        // Evita morrer duas vezes
        if (!this.vivo) return;
        // Marca como morto
        this.vivo = false;
        // Desliga o corpo de física (não cai nem colide mais)
        this.body.enable = false;
        // Some com a skin também
        if (this.skin) this.scene.tweens.add({ targets: this.adorno ? [this.skin, this.adorno] : this.skin, alpha: 0, duration: 200 });
        // Anima o cubo crescendo e sumindo; no fim chama aoTerminar
        this.scene.tweens.add({
            targets: this,
            scale: 1.8,
            alpha: 0,
            angle: this.angle + 90,
            duration: reducedMotion.matches ? 1 : 260,
            ease: 'Cubic.Out',
            onComplete: aoTerminar
        });
    }
}
