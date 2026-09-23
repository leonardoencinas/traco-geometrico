class DemoGame extends Phaser.Scene {
    create() {
        
        // Cria o chão
        const ground = this.add.rectangle(640, 690, 1280, 60, 0x00ff00);
        this.physics.add.existing(ground, true);    // Faz o chão estático

        // Cria o jogador
        const player = this.add.rectangle(150, 200, 40, 40, 0xff0000);
        this.physics.add.existing(player);  // Adiciona física ao jogador

        // Colisão entre o cubo e o chão
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
            gravity: { y: 1500 }, // Define a gravidade
            debug: true
        }
    },
    scene: DemoGame
};

new Phaser.Game(config);