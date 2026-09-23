
class DemoGame extends Phaser.Scene {
    create() {
        // 1. Chão estático adaptado para 1280px de largura
        // Centro em X = 640, Centro em Y = 690 (altura total 720 - metade do chão 30)
        const ground = this.add.rectangle(640, 690, 1280, 60, 0x00ff00);
        this.physics.add.existing(ground, true);

        // 2. Jogador (cubo 40x40) caindo mais do alto
        const player = this.add.rectangle(150, 200, 40, 40, 0xff0000);
        this.physics.add.existing(player);

        // 3. Colisão entre o cubo e o chão
        this.physics.add.collider(player, ground);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1500 }, // Gravidade ajustada para a nova resolução
            debug: true
        }
    },
    scene: DemoGame
};

new Phaser.Game(config);
