class DemoGame extends Phaser.Scene {
    create() {
        // 1. Chão estático
        const ground = this.add.rectangle(640, 690, 1280, 60, 0x00ff00);
        this.physics.add.existing(ground, true);

        // 2. Jogador (usando this.player para podermos usar no update)
        this.player = this.add.rectangle(150, 200, 40, 40, 0xff0000);
        this.physics.add.existing(this.player);

        // 3. Colisão entre o cubo e o chão
        this.physics.add.collider(this.player, ground);

        // 4. Captura do Teclado (Seta para cima e Espaço) ou Clique do Mouse
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    update() {
        // Garante que o corpo rígido da física existe antes de checar as condições
        if (!this.player.body) return;

        // Checa se o cubo está tocando o chão
        const isGrounded = this.player.body.touching.down;

        // Pulo: Executa ao apertar ESPAÇO, SETA PARA CIMA ou CLICAR NA TELA
        const jumpPressed = this.cursors.up.isDown || this.spaceKey.isDown || this.input.activePointer.isDown;

        if (jumpPressed && isGrounded) {
            this.player.body.setVelocityY(-650); // Força do pulo
        }

        // Rotação do cubo estilo Geometry Dash
        if (!isGrounded) {
            // Rotaciona enquanto estiver no ar
            this.player.angle += 8;
        } else {
            // Alinha o cubo reto quando encosta no chão
            this.player.angle = Math.round(this.player.angle / 90) * 90;
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1800 }, // Gravidade ajustada para o pulo responder rápido
            debug: true
        }
    },
    scene: DemoGame
};

new Phaser.Game(config);