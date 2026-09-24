const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Cenário compartilhado para manter a continuidade visual entre as cenas.
class GeometricScene extends Phaser.Scene {
    createBackdrop() {
        this.cameras.main.setBackgroundColor('#101a46');
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x7096ef, 0.08);
        for (let x = 0; x <= 1280; x += 80) grid.lineBetween(x, 0, x, 720);
        for (let y = 0; y <= 720; y += 80) grid.lineBetween(0, y, 1280, y);
        [[100, 220, 76], [1150, 180, 110], [250, 460, 44], [1040, 440, 58]].forEach(([x, y, size], i) => {
            const shape = this.add.rectangle(x, y, size, size, 0x3657bc, 0.12)
                .setStrokeStyle(2, 0x668eff, 0.25).setAngle(15 + i * 12);
            if (!reducedMotion.matches) this.tweens.add({ targets: shape, y: y - 24,
                angle: shape.angle + 20, duration: 3200 + i * 600,
                yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        });
        this.add.rectangle(640, 690, 1280, 60, 0x0a1233);
        this.add.rectangle(640, 661, 1280, 2, 0x68e5ee, 0.8);
    }
}

class MenuScene extends GeometricScene {
    constructor() { super('Menu'); }

    create() {
        this.createBackdrop();
        this.starting = false;
        const menu = document.getElementById('menu');
        const play = document.getElementById('play-button');
        menu.hidden = false;
        menu.classList.remove('is-leaving');
        menu.inert = false;
        play.disabled = false;
        document.getElementById('menu-status').innerHTML = 'ou pressione <kbd>Enter</kbd>';
        const start = () => {
            if (this.starting) return;
            this.starting = true;
            play.disabled = true;
            menu.inert = true;
            menu.classList.add('is-leaving');
            const duration = reducedMotion.matches ? 0 : 480;
            if (duration) {
                this.tweens.add({ targets: this.cameras.main, zoom: 1.08, duration, ease: 'Cubic.In' });
                this.cameras.main.fadeOut(duration, 16, 26, 70);
            }
            this.time.delayedCall(duration, () => {
                menu.hidden = true;
                this.scene.start('Game');
            });
        };
        play.addEventListener('click', start);
        this.input.keyboard.on('keydown-ENTER', start);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            play.removeEventListener('click', start);
            this.input.keyboard.off('keydown-ENTER', start);
        });
        play.focus({ preventScroll: true });
    }
}

class DemoGame extends GeometricScene {
    constructor() { super('Game'); }

    create() {
        this.createBackdrop();
        this.cameras.main.fadeIn(reducedMotion.matches ? 0 : 380, 16, 26, 70);
        // Preserva a base: gravidade, jogador dinâmico e colisão com chão estático.
        const ground = this.add.rectangle(640, 690, 1280, 60, 0x0a1233, 0);
        this.physics.add.existing(ground, true);
        const player = this.add.rectangle(150, 200, 40, 40, 0xb7f65b).setStrokeStyle(3, 0xefffc6);
        this.physics.add.existing(player);
        this.physics.add.collider(player, ground);
        this.add.text(640, 60, 'SEU PRIMEIRO SALTO', {
            fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ecf4ff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(640, 96, 'Espaço, clique ou toque para pular', {
            fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#9aaed6'
        }).setOrigin(0.5);
        const jump = () => {
            if (player.body.blocked.down || player.body.touching.down) player.body.setVelocityY(-620);
        };
        const back = document.getElementById('back-button');
        back.hidden = false;
        const goBack = () => this.scene.start('Menu');
        const onSpace = (event) => {
            if (document.activeElement?.tagName !== 'BUTTON') { event.preventDefault(); jump(); }
        };
        this.input.on('pointerdown', () => { this.game.canvas.focus({ preventScroll: true }); jump(); });
        this.input.keyboard.on('keydown-SPACE', onSpace);
        this.input.keyboard.on('keydown-ESC', goBack);
        back.addEventListener('click', goBack);
        this.game.canvas.tabIndex = 0;
        this.game.canvas.setAttribute('aria-label', 'Partida. Espaço para pular. Escape para voltar ao menu.');
        this.game.canvas.focus({ preventScroll: true });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            back.hidden = true;
            back.removeEventListener('click', goBack);
            this.input.keyboard.off('keydown-SPACE', onSpace);
            this.input.keyboard.off('keydown-ESC', goBack);
        });
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-canvas',
    width: 1280,
    height: 720,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 1500 }, debug: false }
    },
    scene: [MenuScene, DemoGame]
};

new Phaser.Game(config);
