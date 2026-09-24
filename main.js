// Check de acessibilidade: identifica se o usuário prefere movimentos reduzidos no sistema operacional
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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

    create() {
        // Desenha o fundo e faz transição de entrada suave
        this.createBackdrop();
        this.cameras.main.fadeIn(reducedMotion.matches ? 0 : 380, 16, 26, 70);

        // Configuração de Física e Entidades do Jogo

        // Criando chão estático invisível para física de colisão
        const ground = this.add.rectangle(640, 690, 1280, 60, 0x0a1233, 0);
        this.physics.add.existing(ground, true);

        // Criando objeto do jogador (quadrado verde) com física dinâmica
        const player = this.add.rectangle(150, 200, 40, 40, 0xb7f65b).setStrokeStyle(3, 0xefffc6);
        this.physics.add.existing(player);

        // Adiciona colisão entre o jogador e o chão
        this.physics.add.collider(player, ground);

        // Textos de Instrução
        this.add
            .text(640, 60, 'SEU PRIMEIRO SALTO', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: '#ecf4ff',
            fontStyle: 'bold'
        })
        .setOrigin(0.5);

        this.add
            .text(640, 96, 'Espaço, clique ou toque para pular', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#9aaed6'
        })
        .setOrigin(0.5);

        // Controles do Jogador e Ações

        // Executa o pulo apenas se o jogador estiver em contato com o chão
        const jump = () => {
            if (player.body.blocked.down || player.body.touching.down) {
                player.body.setVelocityY(-620);
            }
        };
    

        // Botão de retorno ao menu na interface DOM
        const back = document.getElementById('back-button');
        back.hidden = false;
        const goBack = () => this.scene.start('Menu');

        // Handler para pulo via barra de espaço (evita rolar a página)
        const onSpace = (event) => {
            if (document.activeElement?.tagName !== 'BUTTON') {
                event.preventDefault();
                jump();
            }
        };

        // Atribuição de ouvintes de inputs (Mouse, Teclado e Botão de Voltar)
        this.input.on('pointerdown', () => {
            this.game.canvas.focus({ preventScroll: true });
            jump();
        });
        this.input.keyboard.on('keydown-SPACE', onSpace);
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
            this.input.keyboard.off('keydown-SPACE', onSpace);
            this.input.keyboard.off('keydown-ESC', goBack);
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
            gravity: { y: 1500 },
            debug: false
        }
    },
    scene: [MenuScene, DemoGame]
};

// Instancia e inicia o motor do Phaser
new Phaser.Game(config);