// ================================================================
// barraProgresso.js — barra de progresso percentual da fase (HUD)
// Formato: "NOME DA FASE [██████░░░░] 40%"
// Só MOSTRA o valor que recebe: não lê a posição do jogador nem o tempo.
// ================================================================

// Cores da barra por herói (cor1 → cor2 = degradê do preenchimento; marco = losango alcançado)
const CORES_BARRA = {
    'Homem-Aranha':   { cor1: 0xd4203a, cor2: 0x2b56c9, marco: 0xff5a6e }, // Vermelho + azul
    'Homem de Ferro': { cor1: 0xb3161e, cor2: 0xffc23d, marco: 0xffc23d }, // Vermelho + dourado
    'Hulk':           { cor1: 0x2f8f1a, cor2: 0x4fbf2a, marco: 0x8dff5a }, // Verde
    'Gaviao':         { cor1: 0x5a5f6b, cor2: 0x8a5cff, marco: 0xb59bff }, // Grafite tático + roxo
    'DrEstranho':     { cor1: 0x3dff8a, cor2: 0xff9b3d, marco: 0xffc27a }, // Verde místico + laranja
    'Wanda':          { cor1: 0xb3122e, cor2: 0xff2a4d, marco: 0xff6b84 }  // Vermelho escuro + vermelho vivo
};

// Classe BarraProgresso: uma instância por fase
class BarraProgresso {
    constructor(fase) {
        // Guarda a fase (pra cena, efeitos e tema)
        this.fase = fase;
        // Atalho pra cena do Phaser
        this.cena = fase.cena;
        // Cores do herói (se a chave não existir, usa a linha do tema nas duas pontas)
        this.cores = CORES_BARRA[fase.heroi] || { cor1: fase.tema.linha, cor2: fase.tema.linha, marco: 0xffffff };
        // Porcentagem atual mostrada (0–100)
        this.pct = 0;
        // Valor-alvo do preenchimento (0–1), útil pros testes
        this.alvo = 0;
        // Lista de losangos dos checkpoints
        this.tiques = [];
        // Marca se já foi destruída (destruir() pode ser chamada duas vezes)
        this.destruida = false;

        // ---- Medidas (faixa livre no rodapé da banda do HUD, abaixo dos controles) ----
        // Começo da faixa (alinhado com o título e os controles)
        const x0 = 210;
        // Fim da faixa (mesma largura do texto de controles: 780)
        const x1 = 990;
        // Centro vertical da faixa
        const y = 87;
        // Guarda o y pra posicionar os losangos depois
        this.y = y;

        // Estilo dos textos: pequeno, negrito, com contorno preto pra contraste
        const estilo = {
            fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold',
            color: '#ffffff', stroke: '#000000', strokeThickness: 3
        };

        // Fundo escuro semitransparente (pílula) atrás de tudo
        this.fundo = this.cena.add.graphics().setScrollFactor(0).setDepth(101);
        // Cor do fundo: preto com 55% de opacidade
        this.fundo.fillStyle(0x000000, 0.55);
        // Desenha a pílula de x0-8 a x1+8, 18 px de altura
        this.fundo.fillRoundedRect(x0 - 8, y - 9, (x1 - x0) + 16, 18, 9);

        // Nome da fase à esquerda
        this.textoNome = this.cena.add.text(x0, y, fase.cfg.nome, estilo).setOrigin(0, 0.5).setScrollFactor(0).setDepth(103);
        // Porcentagem à direita (largura reservada pra "100%")
        this.textoPct = this.cena.add.text(x1, y, '0%', estilo).setOrigin(1, 0.5).setScrollFactor(0).setDepth(103);

        // Onde a barra começa: logo depois do nome
        this.bx = x0 + this.textoNome.width + 12;
        // Largura total da barra: até antes da porcentagem (reserva 44 px)
        this.largura = (x1 - 44) - this.bx;
        // Altura da barra
        this.altura = 8;

        // Trilho (parte vazia): retângulo escuro com contorno na cor da linha do tema
        this.trilho = this.cena.add.rectangle(this.bx, y, this.largura, this.altura, 0xffffff, 0.12)
            .setOrigin(0, 0.5).setStrokeStyle(1, fase.tema.linha, 0.6).setScrollFactor(0).setDepth(101);

        // Preenchimento: desenhado UMA vez com a largura toda; o tamanho visível vem do scaleX
        this.preench = this.cena.add.graphics({ x: this.bx, y: y - this.altura / 2 }).setScrollFactor(0).setDepth(102);
        // Degradê horizontal: cor1 à esquerda, cor2 à direita (no Canvas vira cor única)
        this.preench.fillGradientStyle(this.cores.cor1, this.cores.cor2, this.cores.cor1, this.cores.cor2, 1);
        // Retângulo do preenchimento (origem no canto esquerdo, então o scaleX cresce pra direita)
        this.preench.fillRect(0, 0, this.largura, this.altura);
        // Começa vazio
        this.preench.scaleX = 0;

        // Brilho na ponta do preenchimento (pisca quando a porcentagem sobe)
        this.brilho = this.cena.add.rectangle(this.bx, y, 6, this.altura + 6, 0xffffff, 1)
            .setOrigin(0.5).setScrollFactor(0).setDepth(103).setAlpha(0);

        // Destaque de conclusão (contorno dourado ao redor da barra, aparece em 100%)
        this.destaque = this.cena.add.rectangle(this.bx - 2, y, this.largura + 4, this.altura + 4)
            .setOrigin(0, 0.5).setStrokeStyle(2, 0xffe27a, 1).setScrollFactor(0).setDepth(103).setAlpha(0);

        // Por segurança: some junto com a cena (reinício, volta ao menu)
        this.cena.events.once('shutdown', this.destruir, this);
    }

    // Desenha losangos nos checkpoints (lista de porcentagens, ex. [33, 67])
    marcos(lista) {
        // Se já foi destruída, não faz nada
        if (this.destruida) return;
        // Apaga losangos antigos
        this.tiques.forEach(t => t.obj.destroy());
        // Zera a lista
        this.tiques = [];
        // Cria um losango por porcentagem
        (lista || []).forEach(p => {
            // Limita a 0–100
            const v = Phaser.Math.Clamp(p, 0, 100);
            // Posição x na barra
            const x = this.bx + this.largura * v / 100;
            // Quadrado girado 45° = losango, com contorno claro (aparece no trilho escuro)
            const obj = this.cena.add.rectangle(x, this.y, 7, 7, 0x222222, 1)
                .setStrokeStyle(1, 0xffffff, 0.55).setAngle(45).setScrollFactor(0).setDepth(103);
            // Guarda o objeto e a porcentagem dele
            this.tiques.push({ pct: v, obj });
        });
        // Pinta conforme o valor atual (sem pulso)
        this.pintarTiques(-1);
    }

    // Pinta os losangos: alcançados na cor do herói; pulsa os que acabaram de ser alcançados
    pintarTiques(anterior) {
        // Percorre cada losango
        this.tiques.forEach(t => {
            // Já foi alcançado?
            const alcancado = this.pct >= t.pct;
            // Cor: acesa (cor do herói) ou apagada (grafite)
            t.obj.setFillStyle(alcancado ? this.cores.marco : 0x3a3d48, 1);
            // Pulso só quando passou agora (antes estava abaixo)
            if (alcancado && anterior >= 0 && anterior < t.pct) {
                // Mata pulso antigo do mesmo losango
                this.cena.tweens.killTweensOf(t.obj);
                // Volta ao tamanho normal antes de pulsar
                t.obj.setScale(1);
                // Cresce e volta (yoyo)
                this.cena.tweens.add({ targets: t.obj, scale: 1.8, duration: this.fase.efeitos.dur(160), yoyo: true, ease: 'Quad.easeOut' });
            }
        });
    }

    // Define a porcentagem (0–100); animar=false pula a animação
    definir(pct, animar = true) {
        // Se já foi destruída, não faz nada
        if (this.destruida) return;
        // Limita a 0–100 e arredonda
        const novo = Math.round(Phaser.Math.Clamp(pct, 0, 100));
        // Guarda o valor anterior (pra saber se subiu)
        const anterior = this.pct;
        // Atualiza o valor atual
        this.pct = novo;
        // Novo alvo do preenchimento (0–1)
        this.alvo = novo / 100;
        // O NÚMERO muda na hora
        this.textoPct.setText(novo + '%');
        // Para a animação anterior do preenchimento
        this.cena.tweens.killTweensOf(this.preench);
        // Duração curta (1 ms com movimento reduzido)
        const dur = this.fase.efeitos.dur(300);
        // Animado: tween no scaleX (objeto só visual)
        if (animar) this.cena.tweens.add({ targets: this.preench, scaleX: this.alvo, duration: dur, ease: 'Cubic.easeOut' });
        // Sem animação: aplica direto
        else {
            // Aplica o preenchimento direto
            this.preench.scaleX = this.alvo;
            // Apaga um brilho que ainda estivesse sumindo (ex.: volta ao checkpoint)
            this.cena.tweens.killTweensOf(this.brilho);
            // Brilho invisível
            this.brilho.setAlpha(0);
        }
        // Subiu? Faz o brilho na ponta (só se animar)
        if (animar && novo > anterior) this.pulsar();
        // Atualiza os losangos (pulsa os recém-alcançados só se animar)
        this.pintarTiques(animar ? anterior : -1);
        // Destaque de conclusão em 100%
        this.concluir(novo >= 100, animar && anterior < 100);
    }

    // Pequeno brilho branco na ponta do preenchimento
    pulsar() {
        // Mata o brilho anterior
        this.cena.tweens.killTweensOf(this.brilho);
        // Coloca o brilho no ponto do novo valor
        this.brilho.setPosition(this.bx + this.largura * this.alvo, this.y).setAlpha(0.9).setScale(1);
        // Some e cresce um pouco
        this.cena.tweens.add({ targets: this.brilho, alpha: 0, scaleX: 2.2, duration: this.fase.efeitos.dur(350), ease: 'Quad.easeOut' });
        // Pulso rápido no número
        this.cena.tweens.killTweensOf(this.textoPct);
        // Volta ao tamanho normal antes
        this.textoPct.setScale(1);
        // Cresce e volta
        this.cena.tweens.add({ targets: this.textoPct, scale: 1.15, duration: this.fase.efeitos.dur(120), yoyo: true });
    }

    // Liga/desliga o destaque de 100%
    concluir(ligado, animar) {
        // Para animação antiga do destaque
        this.cena.tweens.killTweensOf(this.destaque);
        // Número dourado em 100%, branco no resto
        this.textoPct.setColor(ligado ? '#ffe27a' : '#ffffff');
        // Desligado: esconde o contorno
        if (!ligado) { this.destaque.setAlpha(0); return; }
        // Ligado sem animação: aparece direto
        if (!animar) { this.destaque.setAlpha(1); return; }
        // Ligado com animação: pisca 2 vezes e fica aceso
        this.destaque.setAlpha(0);
        // Tween de alpha com repetição
        this.cena.tweens.add({ targets: this.destaque, alpha: 1, duration: this.fase.efeitos.dur(140), yoyo: true, repeat: 1,
            // No fim, deixa aceso
            onComplete: () => { if (!this.destruida) this.destaque.setAlpha(1); } });
    }

    // Destrói todos os objetos da barra
    destruir() {
        // Evita destruir duas vezes
        if (this.destruida) return;
        // Marca como destruída
        this.destruida = true;
        // Tira o aviso de 'shutdown' (caso destruir() tenha sido chamada antes)
        this.cena.events.off('shutdown', this.destruir, this);
        // Lista de todos os objetos visuais
        const objs = [this.fundo, this.textoNome, this.textoPct, this.trilho, this.preench, this.brilho, this.destaque, ...this.tiques.map(t => t.obj)];
        // Para os tweens desses objetos
        objs.forEach(o => this.cena.tweens.killTweensOf(o));
        // Destrói cada um
        objs.forEach(o => o.destroy());
        // Limpa a lista de losangos
        this.tiques = [];
    }
}
