// ================================================================
// obstaculos.js — classe base Obstaculo + obstáculos comuns a várias fases
// (os obstáculos exclusivos de cada herói ficam no arquivo da fase dele)
// ================================================================

// CLASSE BASE: Obstaculo
// Todo obstáculo tem uma forma (shape do Phaser), uma categoria e pode reagir a golpe, tiro, toque ou ligação.
//   categoria 'solido'    → dá pra pisar em cima; bater de lado mata (na maioria das fases)
//   categoria 'mortal'    → encostar mata
//   categoria 'gatilho'   → encostar chama aoTocar() (portal, aljava, aviso...)
//   categoria 'decoracao' → só visual, sem física
class Obstaculo {
    constructor(fase, forma, categoria, id = null) {
        // Fase dona do obstáculo
        this.fase = fase;
        // Forma desenhada (retângulo, triângulo, círculo...)
        this.forma = forma;
        // A forma guarda referência de volta pro obstáculo (útil nas colisões)
        forma.obstaculo = this;
        // Categoria (define o grupo de física)
        this.categoria = categoria;
        // Identificador usado nas ligações (alvo 'a1' abre porta 'p1')
        this.id = id;
        // Ainda existe no jogo?
        this.ativo = true;
        // A fase coloca no grupo certo e na lista de obstáculos
        fase.registrar(this);
    }

    // Atualização por frame (dt já vem escalado pela Joia do Tempo); obstáculos que se movem sobrescrevem
    atualizar(dt, agora) {}

    // Reação a golpe/flecha/repulsor; retorna true se reagiu (as subclasses sobrescrevem)
    aoAcertar(dano, tipo) { return false; }

    // Chamado quando o jogador encosta (só gatilhos)
    aoTocar() {}

    // Chamado por uma ligação (ex.: alvo acertado aciona esta porta)
    acionar() {}

    // Liga/desliga a física do obstáculo
    ligarFisica(ligado) {
        // Só se tiver corpo
        if (this.forma.body) this.forma.body.enable = ligado;
    }

    // Remove o obstáculo do jogo
    destruir() {
        // Já destruído? ignora
        if (!this.ativo) return;
        // Marca como inativo
        this.ativo = false;
        // Desliga a física (apagar no meio da colisão dá erro; a fase apaga depois)
        this.ligarFisica(false);
        // Esconde a forma
        this.forma.setVisible(false);
        // Pede pra fase apagar no próximo frame
        this.fase.paraApagar.push(this);
    }
}

// BLOCO: retângulo sólido (x = borda esquerda, yTopo = topo)
class Bloco extends Obstaculo {
    constructor(fase, x, yTopo, largura, altura, cor, borda, id = null) {
        // Cria o retângulo com centro calculado a partir da borda esquerda e do topo
        const forma = fase.cena.add.rectangle(x + largura / 2, yTopo + altura / 2, largura, altura, cor)
            .setStrokeStyle(2, borda);
        // Chama a base como sólido
        super(fase, forma, 'solido', id);
    }
}

// PLATAFORMA: sólida só por cima (dá pra subir por baixo, atravessando)
class Plataforma extends Bloco {
    constructor(fase, x, yTopo, largura, cor, borda, id = null) {
        // Plataforma fina de 16 px
        super(fase, x, yTopo, largura, 16, cor, borda, id);
        // Só colide por cima (one-way)
        this.forma.body.checkCollision.down = false;
        // Não colide pelos lados
        this.forma.body.checkCollision.left = false;
        // Não colide pelos lados
        this.forma.body.checkCollision.right = false;
        // Avisa a fase pra não matar ao "bater de lado"
        this.semMorteLateral = true;
    }
}

// ESPINHO: triângulo que mata; noTeto = pendurado apontando pra baixo.
// Visual "neon" (rodada 6): preenchimento preto da fase, contorno claro e um halo na cor de destaque.
//   cor = cor do halo (null = destaque da fase) · borda = contorno (null = neon da fase)
class Espinho extends Obstaculo {
    constructor(fase, x, noTeto = false, cor = null, borda = null, yBase = null) {
        // Cores do tema (fases antigas sem objeto/neon caem no padrão)
        const tema = fase.tema || {};
        const corHalo = cor !== null ? cor : (tema.linha || 0xff5d7a);
        const corBorda = borda !== null ? borda : (tema.neon || 0xffffff);
        // Y do centro: encostado no chão ou no teto (ou numa base informada)
        const y = yBase !== null ? yBase - 20 : (noTeto ? MOVIMENTO.tetoY + 20 : MOVIMENTO.chaoY - 20);
        // Pontas do triângulo: pra cima (chão) ou pra baixo (teto)
        const pontos = noTeto ? [0, 0, 40, 0, 20, 40] : [0, 40, 20, 0, 40, 40];
        // Triângulo 40x40 com centro em (x+20, y): preto com contorno claro
        const forma = fase.cena.add.triangle(x + 20, y, ...pontos, tema.objeto !== undefined ? tema.objeto : 0x0a0a12).setStrokeStyle(2, corBorda);
        // Chama a base como mortal
        super(fase, forma, 'mortal');
        // Hitbox menor que o desenho (mais justo pro jogador)
        forma.body.setSize(14, 22, false).setOffset(13, noTeto ? 2 : 16);
        // Halo (contorno largo e transparente atrás do espinho)
        this.halo = fase.cena.add.triangle(x + 20, y, ...pontos).setStrokeStyle(7, corHalo, 0.35).setDepth(-1);
        this.halo.isFilled = false;
    }

    // Halo acompanha o espinho (posição, transparência e visibilidade: fantasmas do Dr. Estranho, Wanda)
    atualizar() { this.sincronizarHalo(); }
    sincronizarHalo() {
        if (!this.halo) return;
        const f = this.forma;
        this.halo.setPosition(f.x, f.y).setVisible(f.visible && this.ativo).setAlpha(f.alpha);
    }

    // Some com o halo
    destruir() { if (this.halo) { this.halo.destroy(); this.halo = null; } super.destruir(); }
}

// BLOCO NEON: bloco preto em grade de ladrilhos com contorno claro e brilho (como os blocos dos jogos de ritmo)
// neon = cor do contorno (padrão: neon da fase) · brilho = cor do halo (padrão: destaque da fase)
class BlocoNeon extends Bloco {
    constructor(fase, x, yTopo, largura, altura, id = null, neon = null, brilho = null) {
        const tema = fase.tema || {};
        const corNeon = neon !== null ? neon : (tema.neon || 0xffffff);
        // Bloco preto com contorno claro
        super(fase, x, yTopo, largura, altura, tema.objeto !== undefined ? tema.objeto : 0x0a0a12, corNeon, id);
        // Grade de ladrilhos de 40 px + halo, num desenho só (centrado no bloco)
        const g = fase.cena.add.graphics({ x: x + largura / 2, y: yTopo + altura / 2 }).setDepth(1);
        const x0 = -largura / 2, y0 = -altura / 2;
        // Halo largo atrás
        g.lineStyle(8, brilho !== null ? brilho : (tema.linha || corNeon), 0.22).strokeRect(x0 - 2, y0 - 2, largura + 4, altura + 4);
        // Ladrilhos
        g.lineStyle(1, corNeon, 0.28);
        for (let xx = 40; xx < largura - 2; xx += 40) g.lineBetween(x0 + xx, y0 + 3, x0 + xx, y0 + altura - 3);
        for (let yy = 40; yy < altura - 2; yy += 40) g.lineBetween(x0 + 3, y0 + yy, x0 + largura - 3, y0 + yy);
        // Brilho na borda de cima (luz)
        g.lineStyle(2, corNeon, 0.9).lineBetween(x0 + 2, y0 + 2, x0 + largura - 2, y0 + 2);
        this.grade = g;
    }

    // A grade acompanha o bloco (posição, transparência e visibilidade)
    atualizar() {
        const f = this.forma;
        this.grade.setPosition(f.x, f.y).setVisible(f.visible && this.ativo).setAlpha(f.alpha * (f.fillAlpha === undefined ? 1 : Math.max(f.fillAlpha, 0.3)));
    }

    // Some com a grade
    destruir() { this.grade.destroy(); super.destruir(); }
}

// PLATAFORMA SUSPENSA: plataforma neon presa no teto por duas correntes (só visual; pisa por cima)
class PlataformaSuspensa extends Plataforma {
    constructor(fase, x, yTopo, largura) {
        const tema = fase.tema || {};
        super(fase, x, yTopo, largura, tema.objeto !== undefined ? tema.objeto : 0x0a0a12, tema.neon || 0xffffff);
        // Correntes: elos ovais do teto até a plataforma
        const g = fase.cena.add.graphics().setDepth(1);
        g.lineStyle(2, tema.linha || 0xffffff, 0.75);
        [x + 14, x + largura - 14].forEach((cx) => {
            for (let yy = MOVIMENTO.tetoY + 4; yy < yTopo - 6; yy += 14) g.strokeEllipse(cx, yy + 6, 7, 12);
        });
        this.correntes = g;
    }
    destruir() { this.correntes.destroy(); super.destruir(); }
}

// DICA: texto de tutorial no mundo, que aparece quando o jogador chega perto
class Dica extends Obstaculo {
    constructor(fase, x, texto) {
        // Texto flutuando no meio da área de jogo
        const forma = fase.cena.add.text(x, 180, texto, {
            fontFamily: 'Arial, sans-serif',          // Fonte
            fontSize: '24px',                         // Tamanho
            fontStyle: 'bold',                        // Negrito
            color: fase.tema.texto,                   // Cor do tema
            stroke: '#000000',                        // Contorno preto
            strokeThickness: 5,                       // Espessura do contorno
            align: 'center'                           // Centralizado
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(30);
        // Chama a base como decoração (sem física)
        super(fase, forma, 'decoracao');
    }

    // Aparece quando entra na tela e some depois que passou
    atualizar(dt) {
        // Distância do texto até o jogador
        const dx = this.forma.x - this.fase.player.x;
        // Visível enquanto está entre 900 px à frente e 300 px atrás
        const alvo = (dx < 900 && dx > -300) ? 1 : 0;
        // Aproxima o alpha suavemente
        this.forma.alpha += (alvo - this.forma.alpha) * 0.1;
    }
}

// LINHA DE CHEGADA: faixa quadriculada do chão ao teto
class LinhaChegada extends Obstaculo {
    constructor(fase, x) {
        // Graphics pra desenhar o quadriculado
        const g = fase.cena.add.graphics();
        // Quadrados de 12 px, 2 colunas
        for (let yy = MOVIMENTO.tetoY; yy < MOVIMENTO.chaoY; yy += 12) {
            // Duas colunas alternando branco e preto
            for (let c = 0; c < 2; c++) {
                // Alterna a cor
                g.fillStyle(((yy / 12) + c) % 2 === 0 ? 0xffffff : 0x111111, 0.9);
                // Desenha o quadradinho
                g.fillRect(x + c * 12, yy, 12, 12);
            }
        }
        // Chama a base como decoração (a fase confere a chegada pelo x do jogador)
        super(fase, g, 'decoracao');
    }
}
