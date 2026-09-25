// Check de acessibilidade: identifica se o usuário prefere movimentos reduzidos no sistema operacional
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// CONFIGURAÇÕES DE MOVIMENTO (ajuste aqui pra mudar a "sensação" do jogo)
const MOVIMENTO = {
    velocidadeMundo: 525, // px por segundo que o mundo anda pra esquerda (a "corrida")
    forcaPulo: 700,       // velocidade inicial do pulo pra cima
    giroNoAr: 330,        // graus por segundo que o cubo gira enquanto está no ar
    coyoteTime: 90,       // ms que ainda dá pra pular depois de sair da beirada
    jumpBuffer: 120,      // ms que um aperto feito um pouco antes de cair ainda vale
    xFixo: 260,           // posição X onde o jogador fica (quem anda é o mundo)
    chaoY: 660            // Y do topo do chão (o chão tem centro em 690 e 60 de altura)
};

// CENA BASE: GeometricScene
// Cenário compartilhado que provê o fundo e elementos visuais reutilizáveis.
class GeometricScene extends Phaser.Scene {

    // Constrói o fundo do jogo com cor sólida, grade vetorial, formas flutuantes animadas e o chão visual base.
    createBackdrop() {
        // Define a cor de fundo padrão da câmera
        this.cameras.main.setBackgroundColor('#101a46');

        // Desenha a grade de linhas de fundo
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x7096ef, 0.08);
        for (let x = 0; x <= 1280; x += 80) grid.lineBetween(x, 0, x, 720);
        for (let y = 0; y <= 720; y += 80) grid.lineBetween(0, y, 1280, y);

        // Renderiza retângulos flutuantes no cenário com animação tween suave
        const floatingShapes = [
          [100, 220, 76],
          [1150, 180, 110],
          [250, 460, 44],
          [1040, 440, 58]
        ];

        floatingShapes.forEach(([x, y, size], i) => {
            const shape = this.add
            .rectangle(x, y, size, size, 0x3657bc, 0.12)
            .setStrokeStyle(2, 0x668eff, 0.25)
            .setAngle(15 + i * 12);

            // Anima apenas se a preferência de movimento reduzido não estiver ativa
            if (!reducedMotion.matches) {
                this.tweens.add({
                    targets: shape,
                    y: y - 24,
                    angle: shape.angle + 20,
                    duration: 3200 + i * 600,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.InOut'
                });
            }
        });

        // Faixa e linha brilhante que formam a estética do chão no fundo
        this.add.rectangle(640, 690, 1280, 60, 0x0a1233);
        this.add.rectangle(640, 661, 1280, 2, 0x68e5ee, 0.8);
    }
}

// CLASSE Player — toda a movimentação do cubo fica aqui dentro
class Player extends Phaser.GameObjects.Rectangle {

    // scene = cena onde o jogador vai existir; x, y = posição inicial
    constructor(scene, x, y) {
        // Chama o construtor do Rectangle: cena, x, y, largura, altura, cor
        super(scene, x, y, 40, 40, 0xb7f65b);
        // Borda clara em volta do cubo
        this.setStrokeStyle(3, 0xefffc6);
        // Coloca o cubo na lista de coisas desenhadas da cena
        scene.add.existing(this);
        // Dá um corpo de física dinâmico pro cubo (ele sofre gravidade)
        scene.physics.add.existing(this);

        // Guarda o último momento (em ms) em que o cubo estava no chão
        this.ultimoChao = -Infinity;
        // Guarda o último momento (em ms) em que o jogador apertou pra pular
        this.ultimoAperto = -Infinity;
        // Indica se o cubo está vivo (morto não se mexe mais)
        this.vivo = true;
    }

    // Retorna true se o cubo está encostado em algo embaixo (chão ou bloco)
    isOnGround() {
        // blocked = bateu em corpo estático; touching = bateu em corpo dinâmico
        return this.body.blocked.down || this.body.touching.down;
    }

    // Registra um aperto de pulo (chamado pelos eventos de tecla/clique)
    apertarPulo(time) {
        // Só anota a hora; quem decide se pula é o atualizar()
        this.ultimoAperto = time;
    }

    // Chamado todo frame pela cena. time = relógio do jogo; delta = ms desde o último frame
    atualizar(time, delta, segurando) {
        // Se morreu, não faz mais nada
        if (!this.vivo) return;

        // Trava o cubo no X fixo (quem anda é o mundo, não o jogador)
        this.x = MOVIMENTO.xFixo;
        // Zera qualquer velocidade horizontal que alguma colisão tenha dado
        this.body.setVelocityX(0);

        // Guarda se está no chão neste frame (usado duas vezes abaixo)
        const noChao = this.isOnGround();

        // Se está no chão, atualiza a hora do "último chão" (base do coyote time)
        if (noChao) this.ultimoChao = time;
        // Se o botão está segurado, conta como um aperto novo (pulo contínuo)
        if (segurando) this.ultimoAperto = time;

        // Pode pular se esteve no chão há pouco tempo (coyote time)
        const podePular = time - this.ultimoChao <= MOVIMENTO.coyoteTime;
        // Quer pular se apertou há pouco tempo (jump buffer)
        const querPular = time - this.ultimoAperto <= MOVIMENTO.jumpBuffer;

        // Pula só se as duas coisas forem verdade e o cubo não estiver subindo
        if (podePular && querPular && this.body.velocity.y >= 0) {
            // Joga o cubo pra cima (negativo = pra cima no Phaser)
            this.body.setVelocityY(-MOVIMENTO.forcaPulo);
            // "Gasta" o chão, pra não pular duas vezes no mesmo coyote time
            this.ultimoChao = -Infinity;
            // "Gasta" o aperto, pra não pular duas vezes com o mesmo buffer
            this.ultimoAperto = -Infinity;
        }

        // Rotação: no ar gira, no chão encaixa no ângulo reto mais próximo
        if (noChao && this.body.velocity.y >= 0) {
            // Calcula o múltiplo de 90° mais perto do ângulo atual
            const alvo = Math.round(this.angle / 90) * 90;
            // Aproxima 35% por frame até o alvo (encaixe suave)
            this.angle = Phaser.Math.Linear(this.angle, alvo, 0.35);
        } else {
            // Gira proporcional ao tempo do frame (mesma velocidade em 60 ou 144 fps)
            this.angle += MOVIMENTO.giroNoAr * (delta / 1000);
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

// CENA 1: MenuScene
// Gerencia a interface do menu principal e a transição para o jogo.
class MenuScene extends GeometricScene {
    constructor() {
        super('Menu');
    }

    create() {
        // Desenha o cenário de fundo estático/animado
        this.createBackdrop();
        this.starting = false;

        // Acessa e prepara os elementos de UI do DOM (HTML)
        const menu = document.getElementById('menu');
        const play = document.getElementById('play-button');

        menu.hidden = false;
        menu.classList.remove('is-leaving');
        menu.inert = false;
        play.disabled = false;
        document.getElementById('menu-status').innerHTML = 'ou pressione <kbd>Enter</kbd>';

        // Função responsável por iniciar a transição de saída do menu para a cena do jogo.
        const start = () => {
            if (this.starting) return;
            this.starting = true;

            // Desativa interações no DOM durante a transição
            play.disabled = true;
            menu.inert = true;
            menu.classList.add('is-leaving');

            const duration = reducedMotion.matches ? 0 : 480;

            // Executa efeito de Zoom e Fade Out na câmera (se animação permitida)
            if (duration) {
                this.tweens.add({
                targets: this.cameras.main,
                zoom: 1.08,
                duration,
                ease: 'Cubic.In'
                });

                this.cameras.main.fadeOut(duration, 16, 26, 70);
            }

            // Transita para a cena 'Game' após a duração da animação
            this.time.delayedCall(duration, () => {
                menu.hidden = true;
                this.scene.start('Game');
            });
        };

        // Listeners de evento de entrada (Clique ou tecla Enter)
        play.addEventListener('click', start);
        this.input.keyboard.on('keydown-ENTER', start);

        // Limpeza de eventos do DOM ao encerrar/mudar esta cena
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            play.removeEventListener('click', start);
            this.input.keyboard.off('keydown-ENTER', start);
        });

        // Coloca o foco acessível no botão "Play"
        play.focus({ preventScroll: true });
    }
}

// CENA 2: DemoGame
// Lógica principal de física, controles do jogador e renderização da fase.
class DemoGame extends GeometricScene {
    constructor() {
        super('Game');
    }

    // Recebe dados ao iniciar/reiniciar a cena (usado pra contar as tentativas)
    init(data) {
        // Se veio do menu não tem número, então começa na tentativa 1
        this.tentativa = data.tentativa || 1;
    }

    create() {
        // Garante que a física volta a rodar (ela é pausada quando o jogador morre)
        this.physics.resume();

        // Desenha o fundo e faz transição de entrada suave
        this.createBackdrop();
        this.cameras.main.fadeIn(reducedMotion.matches ? 0 : 380, 16, 26, 70);

        // ---------- Chão ----------

        // Criando chão estático invisível para física de colisão
        const ground = this.add.rectangle(640, 690, 1280, 60, 0x0a1233, 0);
        this.physics.add.existing(ground, true);

        // Marcas no chão que andam pra esquerda (dão a sensação de corrida)
        this.marcasChao = [];
        // Cria uma marca a cada 80px, com uma sobra pra fora da tela
        for (let x = 0; x <= 1360; x += 80) {
            // Retângulo fininho logo abaixo da linha brilhante do chão
            this.marcasChao.push(this.add.rectangle(x, 682, 34, 4, 0x243a8a));
        }

        // ---------- Jogador ----------

        // Cria o jogador usando a classe Player, já em cima do chão
        this.player = new Player(this, MOVIMENTO.xFixo, MOVIMENTO.chaoY - 20);

        // Adiciona colisão entre o jogador e o chão
        this.physics.add.collider(this.player, ground);

        // ---------- Obstáculos de TESTE ----------
        // (servem só pra ver a movimentação; quem faz a fase pode trocar)

        // Grupo dos blocos (dá pra subir em cima; bater de lado mata)
        this.blocos = this.physics.add.group();
        // Grupo dos espinhos (encostar mata)
        this.espinhos = this.physics.add.group();
        // Distância (em px) que falta o mundo andar até o próximo obstáculo
        this.distanciaProximo = 700;

        // Colisão com blocos: se bateu do lado direito, morre
        this.physics.add.collider(this.player, this.blocos, () => {
            // touching.right = encostou em algo à direita do cubo
            if (this.player.body.touching.right) this.morrer();
        });
        // Sobreposição com espinhos: morre na hora
        this.physics.add.overlap(this.player, this.espinhos, () => this.morrer());

        // ---------- Textos ----------

        this.add
            .text(640, 60, `TENTATIVA ${this.tentativa}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: '#ecf4ff',
            fontStyle: 'bold'
        })
        .setOrigin(0.5);

        this.add
            .text(640, 96, 'Espaço, clique ou toque para pular · segure para pular sem parar', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#9aaed6'
        })
        .setOrigin(0.5);

        // ---------- Controles ----------

        // Teclas que contam como "segurar pulo" (false = não bloqueia o Espaço nos botões)
        this.teclas = this.input.keyboard.addKeys('SPACE,UP,W', false);

        // Botão de retorno ao menu na interface DOM
        const back = document.getElementById('back-button');
        back.hidden = false;
        const goBack = () => this.scene.start('Menu');

        // Handler para pulo via teclado (evita rolar a página)
        const onJumpKey = (event) => {
            if (document.activeElement?.tagName !== 'BUTTON') {
                event.preventDefault();
                // Registra o aperto com a hora atual do jogo
                this.player.apertarPulo(this.time.now);
            }
        };

        // Clique/toque: foca o canvas e registra o aperto
        this.input.on('pointerdown', () => {
            this.game.canvas.focus({ preventScroll: true });
            this.player.apertarPulo(this.time.now);
        });
        this.input.keyboard.on('keydown-SPACE', onJumpKey);
        this.input.keyboard.on('keydown-UP', onJumpKey);
        this.input.keyboard.on('keydown-W', onJumpKey);
        this.input.keyboard.on('keydown-ESC', goBack);
        back.addEventListener('click', goBack);

        // Configuração de Acessibilidade do Canvas
        this.game.canvas.tabIndex = 0;
        this.game.canvas.setAttribute(
            'aria-label',
            'Partida. Espaço para pular. Escape para voltar ao menu.'
        );
        this.game.canvas.focus({ preventScroll: true });

        // Limpeza de event listeners ao sair da cena
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            back.hidden = true;
            back.removeEventListener('click', goBack);
            this.input.keyboard.off('keydown-SPACE', onJumpKey);
            this.input.keyboard.off('keydown-UP', onJumpKey);
            this.input.keyboard.off('keydown-W', onJumpKey);
            this.input.keyboard.off('keydown-ESC', goBack);
        });
    }

    // Roda todo frame (Phaser chama sozinho)
    update(time, delta) {
        // Se o jogador morreu, o mundo para
        if (!this.player.vivo) return;

        // Está segurando algum botão de pulo? (teclado fora de botão, ou mouse/toque)
        const tecladoLivre = document.activeElement?.tagName !== 'BUTTON';
        const segurando =
            (tecladoLivre && (this.teclas.SPACE.isDown || this.teclas.UP.isDown || this.teclas.W.isDown)) ||
            this.input.activePointer.isDown;

        // Atualiza a movimentação do cubo (pulo + rotação)
        this.player.atualizar(time, delta, segurando);

        // Quantos px o mundo anda neste frame
        const passo = MOVIMENTO.velocidadeMundo * (delta / 1000);

        // Move as marcas do chão; quando saem pela esquerda, voltam pela direita
        this.marcasChao.forEach((marca) => {
            marca.x -= passo;
            if (marca.x < -40) marca.x += 1360;
        });

        // Conta a distância até o próximo obstáculo e cria quando chegar
        this.distanciaProximo -= passo;
        if (this.distanciaProximo <= 0) this.criarPadrao();

        // Apaga obstáculos que já saíram da tela (economiza memória)
        [...this.blocos.getChildren(), ...this.espinhos.getChildren()].forEach((obj) => {
            if (obj.x < -120) obj.destroy();
        });
    }

    // Cria um bloco 40x40 no X dado, na altura "andar" (0 = no chão)
    criarBloco(x, andar = 0) {
        // Desenha o bloco
        const bloco = this.add.rectangle(x, MOVIMENTO.chaoY - 20 - andar * 40, 40, 40, 0x2c4bb0)
            .setStrokeStyle(2, 0x7fa2ff);
        // Coloca no grupo (isso cria o corpo de física)
        this.blocos.add(bloco);
        // Não cai com a gravidade
        bloco.body.setAllowGravity(false);
        // Não é empurrado pelo jogador
        bloco.body.setImmovable(true);
        // Não "arrasta" o jogador junto quando ele está em cima
        bloco.body.friction.x = 0;
        // Anda pra esquerda na velocidade do mundo
        bloco.body.setVelocityX(-MOVIMENTO.velocidadeMundo);
    }

    // Cria um espinho no X dado, na altura "andar" (0 = no chão)
    criarEspinho(x, andar = 0) {
        // Triângulo de 40x40 apontando pra cima
        const espinho = this.add.triangle(x, MOVIMENTO.chaoY - 20 - andar * 40, 0, 40, 20, 0, 40, 40, 0xff5d7a)
            .setStrokeStyle(2, 0xffc2cd);
        // Coloca no grupo (isso cria o corpo de física)
        this.espinhos.add(espinho);
        // Hitbox menor que o desenho (mais justo pro jogador)
        espinho.body.setSize(14, 22, false).setOffset(13, 16);
        // Não cai com a gravidade
        espinho.body.setAllowGravity(false);
        // Anda pra esquerda na velocidade do mundo
        espinho.body.setVelocityX(-MOVIMENTO.velocidadeMundo);
    }

    // Sorteia um padrão de obstáculos e cria fora da tela, à direita
    criarPadrao() {
        // X de nascimento (um pouco depois da borda direita)
        const x = 1340;
        // Sorteia um número de 0 a 3
        const tipo = Phaser.Math.Between(0, 3);

        if (tipo === 0) {
            // Um espinho
            this.criarEspinho(x);
        } else if (tipo === 1) {
            // Dois espinhos colados
            this.criarEspinho(x);
            this.criarEspinho(x + 40);
        } else if (tipo === 2) {
            // Um bloco pra pular em cima
            this.criarBloco(x);
        } else {
            // Três blocos em fila (dá pra correr por cima)
            this.criarBloco(x);
            this.criarBloco(x + 40);
            this.criarBloco(x + 80);
        }

        // Próximo obstáculo sai entre 380 e 640 px de distância
        this.distanciaProximo = Phaser.Math.Between(380, 640);
    }

    // Morte do jogador: para tudo, anima e reinicia
    morrer() {
        // Se já está morto, ignora
        if (!this.player.vivo) return;
        // Congela os obstáculos
        this.physics.pause();
        // Treme a câmera (se animação permitida)
        if (!reducedMotion.matches) this.cameras.main.shake(180, 0.008);
        // Anima a morte do cubo e reinicia a cena com a próxima tentativa
        this.player.morrer(() => {
            this.time.delayedCall(250, () => this.scene.restart({ tentativa: this.tentativa + 1 }));
        });
    }
}

// CONFIGURAÇÃO E INICIALIZAÇÃO DO PHASER
const config = {
    type: Phaser.AUTO,
    parent: 'game-canvas',
    width: 1280,
    height: 720,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 2500 },
            debug: false
        }
    },
    scene: [MenuScene, DemoGame]
};

// Instancia e inicia o motor do Phaser
new Phaser.Game(config);