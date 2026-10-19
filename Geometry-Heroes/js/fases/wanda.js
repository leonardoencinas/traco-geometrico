// ================================================================
// wanda.js — FASE DA WANDA MAXIMOFF: "Troque a realidade para abrir caminho"
// Mecânica (simples e sempre igual): existem DUAS realidades — VERMELHA (◆) e AZUL (●).
//   Cada elemento mágico (parede, plataforma, ponte, espinho) só é sólido em UMA delas.
//   Na outra ele vira um contorno fantasma (dá pra ver onde vai aparecer).
//   E / Shift / clique / botão = trocar a realidade (recarga curta). Dá pra trocar no ar.
//   Segurança: se a troca fosse "nascer" um elemento dentro do cubo, ele espera o cubo sair.
// ================================================================

// Constantes da fase
const WANDA = {
    recarga: 450,         // ms entre uma troca e outra
    forcaPulo: 760,       // pulo um pouco mais alto
    alphaFantasma: 0.06,  // preenchimento do elemento da outra realidade (só o contorno aparece)
    yPlataforma: 590,     // altura padrão das plataformas mágicas
    duracaoTemp: 1300     // ms que uma plataforma ⌛ dura depois que aparece
};

// Aparência de cada realidade
const REALIDADES = {
    // Cores opostas (vermelho x azul-ciano) + símbolos diferentes (◆ x ●) pra nunca confundir
    A: { nome: 'VERMELHA', simbolo: '◆', cor: 0xd01840, borda: 0xff7a90, texto: '#ff7a90', tinta: 0x7a0018 },  // vermelho mágico
    B: { nome: 'AZUL',     simbolo: '●', cor: 0x1597b8, borda: 0x5ff2ff, texto: '#7ff5ff', tinta: 0x0a6a9a }   // azul-ciano
};

// ELEMENTO DA REALIDADE: retângulo (sólido) ou espinho (mortal) que existe só na realidade "real"
class ElementoCaos extends Obstaculo {
    // tipo = 'parede' | 'plataforma' | 'ponte' | 'bloco' | 'espinho'; real = 'A' | 'B'
    constructor(fase, tipo, x, real, largura = 120, andar = 0) {
        // Cores da realidade
        const c = REALIDADES[real], chao = MOVIMENTO.chaoY;
        // Forma e categoria por tipo
        let forma, categoria = 'solido';
        if (tipo === 'parede') forma = fase.cena.add.rectangle(x + 20, chao - 100, 40, 200, c.cor);
        if (tipo === 'bloco') forma = fase.cena.add.rectangle(x + 20, chao - 20 - andar * 40, 40, 40, c.cor);
        if (tipo === 'plataforma') forma = fase.cena.add.rectangle(x + largura / 2, WANDA.yPlataforma + 8, largura, 16, c.cor);
        if (tipo === 'ponte') forma = fase.cena.add.rectangle(x + largura / 2, chao + 10, largura, 20, c.cor);
        if (tipo === 'espinho') { forma = fase.cena.add.triangle(x + 20, chao - 20, 0, 40, 20, 0, 40, 40, c.cor); categoria = 'mortal'; }
        // Campo de caos: faixa de energia no chão que mata (só existe numa realidade)
        if (tipo === 'campo') { forma = fase.cena.add.rectangle(x + largura / 2, chao - 11, largura, 22, c.cor); categoria = 'mortal'; }
        // Portão: coluna grossa que DESCE e bloqueia na sua realidade e SOBE (deixa passar) na outra
        if (tipo === 'portao') forma = fase.cena.add.rectangle(x + 30, chao - 110, 60, 220, c.cor);
        // Borda brilhante na cor da realidade
        forma.setStrokeStyle(3, c.borda);
        // Base
        super(fase, forma, categoria);
        // Guarda tipo e realidade
        this.tipo = tipo; this.real = real;
        // Espinho: hitbox menor
        if (tipo === 'espinho') forma.body.setSize(14, 22, false).setOffset(13, 16);
        // Campo: hitbox um pouco menor que o desenho
        if (tipo === 'campo') forma.body.setSize(largura - 12, 14, false).setOffset(6, 8);
        // Plataforma: sólida só por cima (dá pra subir por baixo)
        if (tipo === 'plataforma') { forma.body.checkCollision.down = false; forma.body.checkCollision.left = false; forma.body.checkCollision.right = false; this.semMorteLateral = true; }
        // Ponte não mata de lado
        if (tipo === 'ponte') this.semMorteLateral = true;
        // Símbolo da realidade em cima (◆ vermelha / ● azul) — forma diferente, não depende só da cor
        this.simbolo = fase.cena.add.text(forma.x, forma.y - forma.height / 2 - 16, c.simbolo, {
            fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold', color: c.texto
        }).setOrigin(0.5).setDepth(6);
        // Esperando o cubo sair de dentro pra virar sólido?
        this.pendente = false;
    }

    // Liga (sólido/visível) ou desliga (fantasma)
    definirAtivo(ativo, animar) {
        // Fantasma: sem física, transparente
        // Fantasma = só o contorno fininho e quase sem preenchimento (fica claro que não é sólido)
        if (!ativo) { this.pendente = false; this.ligarFisica(false); this.estiloFantasma(true); this.forma.setAlpha(1); this.simbolo.setAlpha(0.35); return; }
        // Ativo: se o cubo está dentro, espera (não esmaga o jogador)
        if (this.fase.sobrepoeJogador(this)) { this.pendente = true; this.forma.setAlpha(0.45); return; }
        // Liga a física
        this.pendente = false; this.ligarFisica(true); this.estiloFantasma(false); this.simbolo.setAlpha(1);
        // Aparece (só a transparência anima; o corpo já existe inteiro)
        if (animar) { this.forma.setAlpha(0.3); this.fase.cena.tweens.add({ targets: this.forma, alpha: 1, duration: this.fase.efeitos.dur(180) }); }
        else this.forma.setAlpha(1);
    }

    // Troca o visual entre sólido (cheio + borda forte) e fantasma (contorno fraco)
    estiloFantasma(fantasma) {
        // Cores da realidade deste elemento
        const c = REALIDADES[this.real];
        // Fantasma: preenchimento quase invisível e borda fina transparente
        if (fantasma) { this.forma.setFillStyle(c.cor, WANDA.alphaFantasma); this.forma.setStrokeStyle(2, c.borda, 0.4); }
        // Sólido: cor cheia e borda brilhante
        else { this.forma.setFillStyle(c.cor, 1); this.forma.setStrokeStyle(3, c.borda, 1); }
    }

    // Pendente pisca até o cubo sair; aí liga
    atualizar(dt, agora) {
        // Não pendente: nada
        if (!this.pendente) return;
        // Pisca
        this.forma.setAlpha(Math.floor(agora / 80) % 2 ? 0.25 : 0.55);
        // Cubo saiu: liga
        if (!this.fase.sobrepoeJogador(this)) this.definirAtivo(true, true);
    }

    // Some com o símbolo também
    destruir() { this.simbolo.destroy(); super.destruir(); }
}

// PLATAFORMA TEMPORÁRIA (⌛): quando a realidade dela aparece, dura pouco e se apaga.
// Pra recuperar: troque de realidade e volte (o tempo recomeça). Não troque cedo demais!
class PlataformaTemporaria extends ElementoCaos {
    constructor(fase, x, real, largura = 160) {
        // Plataforma mágica comum
        super(fase, 'plataforma', x, real, largura);
        // Símbolo com ampulheta (diferencia das plataformas fixas)
        this.simbolo.setText(REALIDADES[real].simbolo + '⌛');
        // Barra de tempo em cima da plataforma
        this.barra = fase.cena.add.rectangle(this.forma.x - largura / 2, this.forma.y - 14, largura, 4, REALIDADES[real].borda).setOrigin(0, 0.5).setDepth(6).setVisible(false);
        // Tempo restante (ms); null = parada
        this.restante = null;
    }

    // Ao ligar, começa a contar; ao desligar, para e esconde a barra
    definirAtivo(ativo, animar) {
        // Comportamento normal (física, visual, pendente)
        super.definirAtivo(ativo, animar);
        // Ligada (realidade dela) e ainda não gasta; o tempo só começa quando o cubo está perto
        this.ligada = ativo; this.gasta = false; this.restante = null;
        // Esconde a barra até começar a contar
        this.barra.setVisible(false).setScale(1, 1);
        // Ligou já com o cubo perto: começa a contar na hora
        if (ativo && this.perto()) this.comecar();
    }

    // Cubo a menos de 350 px da plataforma (ou em cima dela)?
    perto() { return (this.forma.x - this.forma.width / 2) - (this.fase.player.x + 20) < 350; }

    // Começa a contagem com o tempo cheio
    comecar() { this.restante = WANDA.duracaoTemp; this.barra.setVisible(true).setScale(1, 1); }

    atualizar(dt, agora) {
        // Parte do "pendente" (espera o cubo sair de dentro)
        super.atualizar(dt, agora);
        // Ligada, não gasta e o cubo chegou perto: começa a contar
        if (this.ligada && !this.gasta && this.restante === null && !this.pendente && this.perto()) this.comecar();
        // Não está contando (ou ainda pendente): nada
        if (this.restante === null || this.pendente) return;
        // Desconta
        this.restante -= dt;
        // Barra diminui
        this.barra.setScale(Math.max(0, this.restante / WANDA.duracaoTemp), 1);
        // Último terço: pisca (aviso)
        if (this.restante < WANDA.duracaoTemp / 3) this.forma.setAlpha(Math.floor(agora / 70) % 2 ? 0.5 : 1);
        // Acabou: vira fantasma (desliga a física) até a próxima troca
        if (this.restante <= 0) {
            // Desliga
            this.restante = null; this.gasta = true; this.ligarFisica(false); this.estiloFantasma(true); this.forma.setAlpha(1); this.barra.setVisible(false);
            // Fumacinha e som de "apagou"
            this.fase.efeitos.fumacaVermelha(this.forma.x, this.forma.y, 4); som.tom('sine', 500, 200, 120, 0.04);
        }
    }

    // Some com a barra também
    destruir() { this.barra.destroy(); super.destruir(); }
}

// PORTÃO DO CAOS: na sua realidade fica embaixo (bloqueia); na outra sobe pro alto (passa por baixo)
class PortaoCaos extends ElementoCaos {
    constructor(fase, x, real) {
        // Coluna 60x220
        super(fase, 'portao', x, real);
        // Y do centro em cada posição: embaixo (no chão) e em cima (encostado no teto)
        this.yBaixo = MOVIMENTO.chaoY - 110; this.yAlto = MOVIMENTO.tetoY + 110 - 20;
        // Setas indicando o movimento (decoração)
        this.seta = fase.cena.add.text(x + 30, this.yBaixo, '⇵', { fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#ffffff' }).setOrigin(0.5).setDepth(6).setAlpha(0.7);
    }

    // Move o portão (corpo e desenho juntos, na hora) com um rastro mágico
    mover(y) {
        // Já está lá: nada
        if (this.forma.y === y) return;
        // Rastro: anel na posição antiga
        this.fase.efeitos.anel(this.forma.x, this.forma.y, REALIDADES[this.real].borda, 20, 8, 220);
        // Move o desenho
        this.forma.y = y;
        // Move o corpo junto
        if (this.forma.body) this.forma.body.reset(this.forma.x, y);
        // Símbolo e seta acompanham
        this.simbolo.setY(y - 126); this.seta.setY(y);
    }

    // Ativo = desce (bloqueia); inativo = sobe. Nunca desce em cima do cubo (espera ele passar)
    definirAtivo(ativo, animar) {
        // Sempre sólido e visível (só muda de lugar)
        this.ligarFisica(true); this.estiloFantasma(false); this.forma.setAlpha(1);
        // Subir: imediato
        if (!ativo) { this.pendente = false; this.mover(this.yAlto); this.simbolo.setAlpha(0.6); return; }
        // Descer: confere se o cubo está embaixo
        const rp = new Phaser.Geom.Rectangle(this.fase.player.x - 22, this.fase.player.y - 22, 44, 44);
        const alvo = new Phaser.Geom.Rectangle(this.forma.x - 30, this.yBaixo - 110, 60, 220);
        // Cubo embaixo: espera
        if (Phaser.Geom.Intersects.RectangleToRectangle(rp, alvo)) { this.pendente = true; return; }
        // Desce
        this.pendente = false; this.mover(this.yBaixo); this.simbolo.setAlpha(1);
    }

    // Pendente: desce assim que o cubo sair de baixo
    atualizar() { if (this.pendente) this.definirAtivo(true, false); }

    // Some com a seta
    destruir() { this.seta.destroy(); super.destruir(); }
}

// HABILIDADE TROCAR REALIDADE
class TrocaRealidade extends Habilidade {
    constructor(fase) {
        // Nome, recarga e cor
        super(fase, { nome: 'TROCAR REALIDADE', recarga: WANDA.recarga, cor: 0xff2a4d });
    }

    // Troca (sempre funciona quando pronta)
    usar() { this.fase.trocarRealidade(); return true; }
}

// CLASSE FaseWanda
class FaseWanda extends Fase {
    constructor(cena, heroi, tentativa) {
        // Base
        super(cena, heroi, tentativa);
        // Controles
        this.textoControles = 'E / clique / botão: TROCAR REALIDADE (◆ vermelha ↔ ● azul)  ·  Espaço ou botão direito: pular';
        // Objetivo
        this.objetivo = 'Só o que é da realidade atual existe. Troque para abrir caminho.';
        // Frases do encerramento (texto grande e subtítulo da tela final)
        this.fraseCurta = 'REALIDADE REESCRITA'; this.fraseFinal = 'o caos agora obedece a você.';
        // Realidade atual
        this.realidade = 'A';
        // Elementos mágicos
        this.elementos = [];
        // Vãos (pro chão)
        this.vaos = this.roteiro().filter((e) => e.tipo === 'vao');
    }

    // Chão com vãos
    segmentosChao() {
        // Corta o chão nos vãos
        const segs = []; let x0 = this.xMin();
        this.vaos.slice().sort((a, b) => a.x - b.x).forEach((v) => { segs.push([x0, v.x]); x0 = v.ate; });
        segs.push([x0, this.cfg.comprimento + 1600]);
        return segs;
    }

    // Encerramento: onda carmesim que dissolve todos os elementos mágicos na tela
    animacaoFinal() {
        // Ondas enormes saindo do personagem
        for (let i = 0; i < 4; i++) this.cena.time.delayedCall(i * 150, () => this.efeitos.anel(this.player.x, this.player.y, i % 2 ? 0xb06bff : 0xff2a4d, 30, 25, 700));
        // Elementos visíveis viram fumaça
        this.elementos.forEach((el) => { if (el.ativo && Math.abs(el.forma.x - this.player.x) < 1300) { this.efeitos.fumacaVermelha(el.forma.x, el.forma.y, 10); el.destruir(); } });
        // Tela tinge de vermelho e o personagem flutua
        this.efeitos.flash(120, 0, 20, 400);
        this.cena.tweens.add({ targets: this.player, y: this.player.y - 120, duration: 1200, ease: 'Sine.Out' });
        // Som grave
        som.tom('sawtooth', 160, 40, 900, 0.1);
    }

    // Cubo carmim
    coresCubo() { return VISUAIS_HEROIS['Wanda'].cores; }

    // Skin da Wanda: tiara, olhos brilhando e espiral do caos (efeitosPoderes.js); o hexágono gira à parte
    desenharSkin(g) { VISUAIS_HEROIS['Wanda'].desenhar(g); }

    // Pulo mais alto
    criarJogador() { super.criarJogador(); this.player.forcaPulo = WANDA.forcaPulo; }

    // Habilidade
    criarHabilidade() { return new TrocaRealidade(this); }

    // HUD extra: realidade atual
    textoExtra() { return `REALIDADE: ${REALIDADES[this.realidade].simbolo} ${REALIDADES[this.realidade].nome}`; }

    // O elemento está encostando no cubo agora?
    sobrepoeJogador(el) {
        // Retângulo do cubo (um pouquinho maior)
        const p = this.player, rp = new Phaser.Geom.Rectangle(p.x - 22, p.y - 22, 44, 44);
        // Retângulo do elemento
        return Phaser.Geom.Intersects.RectangleToRectangle(rp, el.forma.getBounds());
    }

    // Aplica a realidade atual em todos os elementos
    aplicarRealidade(animar) {
        // Cada elemento: ativo se for da realidade atual
        this.elementos.forEach((el) => { if (el.ativo) el.definirAtivo(el.real === this.realidade, animar); });
        // Orbes de salto com realidade: só funcionam na realidade deles
        (this.orbesClassicos || []).forEach((o) => { if (o.real) o.ligado = o.real === this.realidade; });
        // Linha do teto na cor da realidade
        this.linhaTeto.setFillStyle(REALIDADES[this.realidade].borda, 0.8);
        // Interface inteira na cor da realidade atual (texto do HUD, barra e botão da habilidade)
        const c = REALIDADES[this.realidade];
        if (this.hudExtra) this.hudExtra.setColor(c.texto);
        if (this.barraRecarga) this.barraRecarga.setFillStyle(c.borda);
        if (this.botaoHabilidade) this.botaoHabilidade.style.setProperty('--cor-hab', '#' + c.borda.toString(16).padStart(6, '0'));
        // Tela tingida: quase nada na vermelha, azul forte na azul (dá pra saber só de olhar)
        if (this.tinta) this.tinta.setFillStyle(c.tinta, this.realidade === 'A' ? 0.12 : 0.32);
    }

    // Troca de realidade (com efeito bem visível)
    trocarRealidade() {
        // Inverte
        this.realidade = this.realidade === 'A' ? 'B' : 'A';
        // Cores da nova realidade
        const c = REALIDADES[this.realidade];
        // Aplica nos elementos
        this.aplicarRealidade(true);
        // Onda de magia saindo do cubo + espiral do caos + faíscas escarlates + ecos do corpo
        this.efeitos.anel(this.player.x, this.player.y, c.borda, 30, 14, 420);
        fxEspiral(this, this.player.x, this.player.y, this.realidade === 'A' ? 0xff1f4b : c.borda, 90, 560);
        fxFaiscas(this, this.player.x, this.player.y, [0xff1f4b, 0xff8fa3, c.borda], 18, 300, 480);
        fxResidual(this, 0xff1f4b, 0.5, 280, 1.2); this.cena.time.delayedCall(70, () => fxResidual(this, c.borda, 0.4, 280, 1.5));
        fxCenario(this, 'realidade', { realidade: this.realidade });
        // Fumaça vermelha nos elementos que mudaram e estão na tela
        this.elementos.forEach((el) => { if (el.ativo && Math.abs(el.forma.x - this.player.x) < 1000) this.efeitos.fumacaVermelha(el.forma.x, el.forma.y, 6); });
        // Hexágono da skin pisca na cor nova
        this.hexSkin.setStrokeStyle(3, c.borda, 1);
        this.cena.tweens.add({ targets: this.hexSkin, scale: 1.6, duration: this.efeitos.dur(120), yoyo: true });
        // Grade treme um instante (distorção)
        if (!reducedMotion.matches) this.cena.tweens.add({ targets: this.grade, x: 4, duration: 40, yoyo: true, repeat: 2 });
        // Som: grave + brilho
        som.tom('sawtooth', this.realidade === 'A' ? 180 : 120, 60, 260, 0.07); som.tom('sine', 600, this.realidade === 'A' ? 1200 : 900, 220, 0.04);
    }

    // Clique: terço esquerdo da tela = pulo; resto = trocar realidade
    aoClicarMundo(ponteiro) {
        // Zona de pulo (útil no celular)
        if (ponteiro.x < 380) return false;
        // Troca
        this.habilidade.ativar(this.cena.time.now);
        // Clique usado
        return true;
    }

    // Botão direito = pular
    aoAcaoSecundaria() { this.aoPressionar('ponteiro'); }

    // Elementos do roteiro
    criarElemento(ev) {
        // Elemento mágico com realidade
        // Orbe de salto que só existe numa realidade
        if (ev.tipo === 'orbeSalto') { const o = new OrbeSalto(this, ev.x, ev.y || 545); o.real = ev.real || null; return; }
        // Plataforma temporária e portão têm classe própria
        if (ev.tipo === 'temporaria') { this.elementos.push(new PlataformaTemporaria(this, ev.x, ev.real, ev.largura || 160)); return; }
        if (ev.tipo === 'portao') { this.elementos.push(new PortaoCaos(this, ev.x, ev.real)); return; }
        if (ev.real) { const el = new ElementoCaos(this, ev.tipo, ev.x, ev.real, ev.largura || (ev.tipo === 'ponte' ? (ev.ate - ev.x) : 160), ev.andar || 0); this.elementos.push(el); return; }
        // Vão: o chão já tem o buraco
        if (ev.tipo === 'vao') return;
        // Comuns (dica, espinho, bloco)
        super.criarElemento(ev);
    }

    // Ao criar: hexágono, aura, névoa, tinta e realidade inicial
    aoCriar() {
        // Hexágono girando em volta do cubo
        this.hexSkin = this.cena.add.polygon(this.player.x, this.player.y, [28, 0, 14, 24, -14, 24, -28, 0, -14, -24, 14, -24], 0x000000, 0).setStrokeStyle(2, 0xff4d6d, 0.6).setDepth(11);
        // Aura de magia do caos (partículas vermelhas)
        this.aura = this.cena.add.particles(0, 0, 'faisca', {
            speed: { min: 10, max: 50 }, gravityY: -60,                    // Sobe como fumaça
            lifespan: { min: 300, max: 700 },                              // Vida
            scale: { start: 0.9, end: 1.6 }, alpha: { start: 0.6, end: 0 },// Cresce e some
            tint: [0xff2a4d, 0xb3001b, 0xff6b81], blendMode: 'ADD',        // Vermelho brilhante
            frequency: reducedMotion.matches ? 120 : 35                    // Quantidade
        }).setDepth(9);
        // Segue o cubo
        this.aura.startFollow(this.player);
        // Tinta sutil de tela cheia (muda com a realidade)
        this.tinta = this.cena.add.rectangle(640, 380, 1280, 560, REALIDADES.A.tinta, 0.2).setScrollFactor(0).setDepth(-1);
        // Vinheta escura nas bordas (atmosfera opressiva)
        // (rodada 8: degradê radial liso — os retângulos concêntricos de antes pareciam molduras/grade)
        if (this.cena.textures.exists('vinheta')) this.cena.add.image(640, 380, 'vinheta').setDisplaySize(1280, 560).setScrollFactor(0).setDepth(45).setAlpha(0.6);
        // Névoa vermelha rasteira (partículas grandes e lentas, fixas na tela)
        this.cena.add.particles(0, 0, 'faisca', {
            x: { min: 0, max: 1280 }, y: { min: 560, max: 660 },           // Perto do chão
            speedX: { min: -40, max: -10 }, lifespan: 5000,                // Desliza pra esquerda
            scale: { min: 4, max: 8 }, alpha: { start: 0.06, end: 0 },     // Grande e quase transparente
            tint: 0xff2a4d, frequency: reducedMotion.matches ? -1 : 220    // Pouca
        }).setScrollFactor(0).setDepth(-60);
        // Aplica a realidade inicial (sem animação)
        this.aplicarRealidade(false);
    }

    // Por frame: hexágono acompanha o cubo
    atualizarMecanica(agora, dtReal) {
        // Posição e giro
        if (!this.cena.tweens.isTweening(this.hexSkin)) this.hexSkin.setPosition(this.player.x, this.player.y);
        this.hexSkin.angle += 20 * dtReal / 1000;
    }

    // Cenário sombrio: céu quase preto com brilho vermelho no horizonte, casas tortas, névoa
    // Cenário temático (realidade do caos: redemoinho hex, subúrbio distorcido, névoa escarlate e fragmentos) — desenhado em cenarios.js
    criarParalaxe() { Cenarios.wanda(this); }

    // O cenário reage aos poderes e momentos da fase (cenarios.js)
    cenarioReagir(evento, dados) { Cenarios.reagir(this, evento, dados); }

    // Roteiro desenhado à mão (real: 'A' = só existe na VERMELHA; 'B' = só na AZUL)
    // Checkpoints (3: fase longa e cheia de troca de realidade). Realidade declarada = a que deixa o próximo trecho seguro
    checkpoints() {
        return [
            { x: 4600, realidade: 'B' },   // Depois das plataformas do meio; o portão ◆ em 5300 já está erguido
            { x: 7100, realidade: 'B' },   // Chão 7000–8050, antes do campo ◆ (inofensivo no ●) e do vão do orbe ●;
                                           // era 8480: só 120 px de chão antes do vão grande (caía em 0,4 s)
            { x: 11950, realidade: 'B' }   // Antes do último vão com plataformas; a primeira (12480) é ●
        ];
    }

    // Restaura a realidade declarada no checkpoint (sem animação)
    // Prática: o diamante guarda a realidade atual
    estadoPratica() { return { realidade: this.realidade }; }

    restaurarCheckpoint(cp) {
        // Realidade do checkpoint (padrão: a inicial)
        this.realidade = cp.realidade || 'A';
        // Liga/desliga os elementos e o visual na hora
        this.aplicarRealidade(false);
    }

    roteiro() {
        return [
            // TUTORIAL
            { x: 450, tipo: 'dica', txt: 'Aperte E: troca a realidade (◆ vermelha ↔ ● azul)' },
            { x: 1000, tipo: 'parede', real: 'A' },
            // Espinho de caos que brota do chão (pisca antes de subir)
            { x: 1550, tipo: 'emergente' },
            { x: 1350, tipo: 'dica', txt: 'Contorno fraco = existe na OUTRA realidade' },
            { x: 1900, tipo: 'vao', ate: 2250 }, { x: 1900, tipo: 'ponte', real: 'A', ate: 2250 },
            { x: 2450, tipo: 'serraDesce' },
            { x: 2700, tipo: 'parede', real: 'B' },
            { x: 3200, tipo: 'espinho', real: 'A' }, { x: 3240, tipo: 'espinho', real: 'A' }, { x: 3280, tipo: 'espinho', real: 'A' },
            { x: 3500, tipo: 'dica', txt: 'Troque NO AR pra pousar na próxima plataforma' },
            // MEIO
            { x: 3800, tipo: 'vao', ate: 4400 }, { x: 3980, tipo: 'plataforma', real: 'B' }, { x: 4280, tipo: 'plataforma', real: 'A' },
            // MEIO — portões que mudam a geometria, campo de caos e plataformas que se apagam
            { x: 4850, tipo: 'dica', txt: 'Portão ⇵ desce na realidade dele: troque pra ele subir e passe por baixo' },
            { x: 5300, tipo: 'portao', real: 'A' }, { x: 5750, tipo: 'portao', real: 'B' }, { x: 6200, tipo: 'portao', real: 'A' },
            { x: 6600, tipo: 'vao', ate: 7000 }, { x: 6600, tipo: 'ponte', real: 'B', ate: 7000 },
            { x: 7300, tipo: 'dica', txt: 'Campo de caos: só machuca na realidade dele' },
            { x: 7650, tipo: 'campo', real: 'A', largura: 300 },
            { x: 7980, tipo: 'dica', txt: 'Vão largo: pule e use o ORBE ● (só existe na realidade azul)' },
            { x: 8050, tipo: 'vao', ate: 8400 }, { x: 8200, tipo: 'orbeSalto', real: 'B' },
            { x: 8450, tipo: 'dica', txt: 'Plataforma ⌛ dura pouco: não troque cedo demais' },
            { x: 8600, tipo: 'vao', ate: 9600 },
            { x: 8780, tipo: 'temporaria', real: 'A' }, { x: 9120, tipo: 'temporaria', real: 'B' }, { x: 9460, tipo: 'temporaria', real: 'A' },
            { x: 10200, tipo: 'parede', real: 'A' }, { x: 10550, tipo: 'espinho', real: 'B' }, { x: 10590, tipo: 'espinho', real: 'B' },
            { x: 11000, tipo: 'vao', ate: 11400 }, { x: 11000, tipo: 'ponte', real: 'A', ate: 11400 },
            { x: 11800, tipo: 'parede', real: 'A' },
            // FINAL — tudo junto, trocando rápido
            { x: 12300, tipo: 'vao', ate: 13100 },
            { x: 12480, tipo: 'temporaria', real: 'B' }, { x: 12820, tipo: 'temporaria', real: 'A' },
            // Runa carmesim no chão que pulsa no ritmo (pule, ou passe no instante apagado)
            { x: 13280, tipo: 'laserPiso', largura: 120, padrao: '1110' },
            { x: 13500, tipo: 'campo', real: 'B', largura: 260 }, { x: 14050, tipo: 'portao', real: 'A' }, { x: 14450, tipo: 'parede', real: 'B' },
            { x: 14800, tipo: 'vao', ate: 15200 }, { x: 14800, tipo: 'ponte', real: 'A', ate: 15200 },
            { x: 15500, tipo: 'espinho', real: 'A' }, { x: 15540, tipo: 'espinho', real: 'A' }, { x: 15580, tipo: 'espinho', real: 'A' },
            { x: 15850, tipo: 'portao', real: 'B' }
        ];
    }
}
