// ================================================================
// classicos.js — elementos clássicos de jogos de ritmo/plataforma
// (pad de salto, orbe de salto, portal de gravidade, portal de velocidade, portal de modo e serra)
// Todos são FUNCIONAIS (mexem na física do cubo) e reaproveitam a classe Obstaculo.
// Cada fase escolhe quais usar no roteiro (tipo: 'pad', 'orbe', 'gravidade', 'velocidade', 'serra').
// ================================================================

// Ajustes dos elementos clássicos
const CLASSICOS = {
    forcaPad: 1.45,       // pad: pulo 45% mais forte que o normal
    forcaOrbe: 1.0,       // orbe: pulo normal, mas no ar
    janelaOrbe: 120,      // ms: apertar um pouco antes de encostar no orbe também vale
    raioOrbe: 30,         // tamanho do orbe (área de toque)
    corAmarelo: 0xffd400, // cor clássica de pad/orbe
    corRosa: 0xff5ad1,    // variação fraca (pad/orbe rosa)
    forcaRosa: 1.15,      // pad rosa: pouco mais que o pulo normal
    forcaOrbeRosa: 0.72,  // orbe rosa: pulinho no ar
    corAzul: 0x3ad1ff,    // portal que inverte a gravidade
    corLaranja: 0xffa53d, // portal que volta a gravidade ao normal
    empurraoAzul: 320,    // pad/orbe azul: velocidade inicial rumo ao novo lado (chão ↔ teto)
    // Portais de modo: cor e símbolo de cada modo (desenho nosso)
    modos: {
        cubo: { cor: 0x3dff8a, simbolo: '■' },
        bola: { cor: 0xff4d6d, simbolo: '●' },
        ufo:  { cor: 0xc06bff, simbolo: '◓' }
    }
};

// Variante de pad/orbe: aceita true (= rosa, compatível com o código antigo) ou 'rosa' / 'azul' / 'amarelo'
function varianteClassico(v) { return v === true ? 'rosa' : (v === 'rosa' || v === 'azul') ? v : 'amarelo'; }

// Pad/orbe AZUL: inverte a gravidade e já empurra o cubo pro novo lado
function inverterClassico(fase) {
    const p = fase.player;
    p.inverterGravidade(!p.invertido);
    p.body.setVelocityY(CLASSICOS.empurraoAzul * (p.invertido ? -1 : 1));
    p.ultimoChao = -Infinity; p.ultimoAperto = -Infinity;
}

// Dá um impulso vertical no cubo (respeita a gravidade invertida)
function impulsoClassico(fase, multiplicador) {
    // Jogador
    const p = fase.player;
    // Direção da gravidade (1 normal, -1 invertida)
    const dir = p.invertido ? -1 : 1;
    // Novo impulso pra longe do chão
    p.body.setVelocityY(-p.forcaPulo * multiplicador * dir);
    // Gasta chão e aperto (não soma com um pulo normal no mesmo quadro)
    p.ultimoChao = -Infinity; p.ultimoAperto = -Infinity;
}

// PAD DE SALTO: placa amarela no chão; encostou = lançado pra cima (sem apertar nada)
class PadSalto extends Obstaculo {
    // variante: 'amarelo' (forte), 'rosa' (fraco, true também vale) ou 'azul' (inverte a gravidade)
    constructor(fase, x, noTeto = false, rosa = false) {
        // Variante e cor
        const variante = varianteClassico(rosa);
        const cor = { amarelo: CLASSICOS.corAmarelo, rosa: CLASSICOS.corRosa, azul: CLASSICOS.corAzul }[variante];
        // Topo do chão naquele x (ou teto, se o pad estiver lá em cima)
        const y = noTeto ? MOVIMENTO.tetoY + 4 : fase.topoChaoEm(x + 20) - 4;
        // Meia-lua achatada amarela
        const forma = fase.cena.add.rectangle(x + 20, y, 40, 8, cor).setStrokeStyle(2, 0xffffff);
        // Gatilho (não bloqueia)
        super(fase, forma, 'gatilho');
        // Brilho subindo (decoração)
        this.brilho = fase.cena.add.triangle(x + 20, y + (noTeto ? 14 : -14), 0, 12, 10, 0, 20, 12, cor, 0.35).setDepth(2);
        // Guarda força e cor
        this.forca = variante === 'rosa' ? CLASSICOS.forcaRosa : CLASSICOS.forcaPad; this.cor = cor; this.variante = variante;
        if (noTeto) this.brilho.setAngle(180);
        // Última vez que lançou (evita lançar duas vezes seguidas)
        this.ultimo = -Infinity;
    }

    // Encostou: lança
    aoTocar() {
        // Relógio
        const agora = this.fase.cena.time.now;
        // Acabou de lançar: ignora
        if (agora - this.ultimo < 300) return;
        // Marca
        this.ultimo = agora;
        // Azul: troca o lado da gravidade · amarelo/rosa: impulso pra cima
        if (this.variante === 'azul') inverterClassico(this.fase); else impulsoClassico(this.fase, this.forca);
        // Efeitos: anel na cor do pad e som
        this.fase.efeitos.anel(this.forma.x, this.forma.y, this.cor, 14, 3, 220);
        som.tom('square', 500, this.variante === 'azul' ? 300 : 1100, 120, 0.05);
    }

    // Some com o brilho
    destruir() { this.brilho.destroy(); super.destruir(); }
}

// ORBE DE SALTO: anel amarelo no ar; encostado nele, APERTAR o pulo dá um pulo novo no ar
class OrbeSalto extends Obstaculo {
    // variante: 'amarelo', 'rosa' (pulinho; true também vale) ou 'azul' (inverte a gravidade no ar)
    constructor(fase, x, y, rosa = false) {
        // Variante e cor
        const variante = varianteClassico(rosa);
        const cor = { amarelo: CLASSICOS.corAmarelo, rosa: CLASSICOS.corRosa, azul: CLASSICOS.corAzul }[variante];
        // Núcleo cheio na cor do orbe, com anel branco (visual da rodada 6: núcleo + anel + halo)
        const forma = fase.cena.add.circle(x, y, CLASSICOS.raioOrbe - 12, cor, 0.95).setStrokeStyle(4, 0xffffff).setDepth(4);
        // Decoração (a fase confere a distância; não precisa de corpo)
        super(fase, forma, 'decoracao');
        // Halo grande e suave atrás
        this.halo = fase.cena.add.circle(x, y, CLASSICOS.raioOrbe + 8, cor, 0.16).setDepth(3);
        // Anel externo pulsando (mostra que é interativo)
        this.anel = fase.cena.add.circle(x, y, CLASSICOS.raioOrbe).setStrokeStyle(2, 0xffffff, 0.6).setDepth(4);
        // Última vez usado
        this.ultimo = -Infinity;
        // Força e cor da variação
        this.forca = variante === 'rosa' ? CLASSICOS.forcaOrbeRosa : CLASSICOS.forcaOrbe; this.cor = cor; this.variante = variante;
        // Ligado? (a Wanda pode desligar orbes da outra realidade)
        this.ligado = true;
        // Registra na lista de orbes da fase
        (fase.orbesClassicos = fase.orbesClassicos || []).push(this);
    }

    // O cubo está encostando no orbe?
    alcance() {
        // Jogador
        const p = this.fase.player;
        // Distância do centro do cubo ao centro do orbe
        return this.ligado && this.ativo && Phaser.Math.Distance.Between(p.x, p.y, this.forma.x, this.forma.y) < CLASSICOS.raioOrbe + 20;
    }

    // Usa o orbe (pulo no ar)
    usar() {
        // Relógio
        const agora = this.fase.cena.time.now;
        // Usado agora há pouco: ignora
        if (agora - this.ultimo < 250) return false;
        // Marca
        this.ultimo = agora;
        // Pulo novo (azul: troca o lado da gravidade)
        if (this.variante === 'azul') inverterClassico(this.fase); else impulsoClassico(this.fase, this.forca);
        // Efeitos: anel e som
        this.fase.efeitos.anel(this.forma.x, this.forma.y, this.cor, 20, 3, 260);
        som.tom('triangle', 700, 1400, 120, 0.06);
        return true;
    }

    // Pulsa; e se o jogador já estava apertando (buffer) ao encostar, usa sozinho
    atualizar(dt, agora) {
        // Pulso visual
        this.anel.setScale(1 + Math.sin(agora / 140) * 0.08);
        // Apagado (Wanda): transparente
        this.forma.setAlpha(this.ligado ? 1 : 0.2); this.anel.setAlpha(this.ligado ? 1 : 0.2);
        this.halo.setAlpha(this.ligado ? 1 : 0.2).setScale(1 + Math.sin(agora / 220) * 0.1);
        // Encostando e apertou há pouco (ou segurando): usa
        const p = this.fase.player;
        if (this.alcance() && (this.fase.segurandoTecla || agora - p.ultimoAperto < CLASSICOS.janelaOrbe)) this.usar();
    }

    // Some com o anel
    destruir() { this.anel.destroy(); this.halo.destroy(); super.destruir(); }
}

// PORTAL DE GRAVIDADE: azul inverte (o cubo corre no teto); laranja volta ao normal
class PortalGravidade extends Obstaculo {
    constructor(fase, x, inverte) {
        // Cor pelo efeito
        const cor = inverte ? CLASSICOS.corAzul : CLASSICOS.corLaranja;
        // Elipse alta vazada (atravessa a pista toda)
        const forma = fase.cena.add.ellipse(x, 380, 46, 520, cor, 0.12).setStrokeStyle(5, cor);
        // Gatilho
        super(fase, forma, 'gatilho');
        // Seta indicando o lado da gravidade
        this.seta = fase.cena.add.text(x, 380, inverte ? '▲' : '▼', { fontFamily: 'Arial', fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setDepth(5);
        // Efeito do portal
        this.inverte = inverte;
    }

    // Atravessou: aplica a gravidade
    aoTocar() {
        // Já está do jeito certo: nada
        if (this.fase.player.invertido === this.inverte) return;
        // Inverte (ou desinverte)
        this.fase.player.inverterGravidade(this.inverte);
        // Efeitos
        this.fase.efeitos.anel(this.fase.player.x, this.fase.player.y, this.inverte ? CLASSICOS.corAzul : CLASSICOS.corLaranja, 24, 4, 300);
        som.tom('sine', this.inverte ? 300 : 900, this.inverte ? 900 : 300, 220, 0.06);
    }

    // Some com a seta
    destruir() { this.seta.destroy(); super.destruir(); }
}

// PORTAL DE VELOCIDADE: muda a velocidade de corrida (multiplicador da velocidade da fase)
class PortalVelocidade extends Obstaculo {
    constructor(fase, x, mult) {
        // Cor: verde = mais rápido, laranja = mais lento, azul = normal
        const cor = mult > 1 ? 0x3dff8a : (mult < 1 ? 0xffa53d : 0x3ad1ff);
        // Retângulo alto vazado
        const forma = fase.cena.add.rectangle(x, 560, 36, 200, cor, 0.12).setStrokeStyle(4, cor);
        // Gatilho
        super(fase, forma, 'gatilho');
        // Setas: >>> rápido, > lento, >> normal
        this.seta = fase.cena.add.text(x, 560, mult > 1 ? '»»' : (mult < 1 ? '›' : '»'), { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(5);
        // Multiplicador
        this.mult = mult;
    }

    // Atravessou: muda a velocidade (uma vez)
    aoTocar() {
        // Nova velocidade
        const v = this.fase.cfg.velocidade * this.mult;
        // Já está nela: nada
        if (this.fase.player.velocidadeX === v) return;
        // Aplica
        this.fase.player.velocidadeX = v;
        // Efeito e som
        this.fase.efeitos.anel(this.forma.x, this.fase.player.y, this.forma.strokeColor, 18, 3, 220);
        som.tom('sawtooth', 200, this.mult > 1 ? 600 : 120, 160, 0.04);
    }

    // Some com a seta
    destruir() { this.seta.destroy(); super.destruir(); }
}

// PORTAL DE MODO: transforma o cubo em BOLA (troca de lado ao apertar no chão), UFO (pulinhos no ar)
// ou de volta em CUBO. Mantém a gravidade como estava (dá pra entrar na bola andando no teto).
class PortalModo extends Obstaculo {
    constructor(fase, x, modo) {
        // Cor e símbolo do modo
        const info = CLASSICOS.modos[modo] || CLASSICOS.modos.cubo;
        // Moldura alta atravessando a pista toda
        const forma = fase.cena.add.rectangle(x, 380, 40, 520, info.cor, 0.12).setStrokeStyle(5, info.cor);
        // Gatilho
        super(fase, forma, 'gatilho');
        // Brilho interno e símbolo do modo no meio
        this.brilho = fase.cena.add.rectangle(x, 380, 14, 500, 0xffffff, 0.12).setDepth(4);
        this.icone = fase.cena.add.text(x, 380, info.simbolo, { fontFamily: 'Arial', fontSize: '30px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(5);
        // Modo e cor
        this.modo = modo; this.cor = info.cor;
    }

    // Brilho pulsando (mostra que é um portal)
    atualizar(dt, agora) { this.brilho.setAlpha(0.08 + 0.08 * (1 + Math.sin(agora / 160))); }

    // Atravessou: troca o modo
    aoTocar() {
        const p = this.fase.player;
        if (p.modo === this.modo) return;
        p.definirModo(this.modo);
        this.fase.efeitos.anel(p.x, p.y, this.cor, 26, 4, 320);
        this.fase.efeitos.textoFlutuante(p.x, p.y - 60, this.modo.toUpperCase(), '#ffffff');
        som.tom('sine', 400, 1000, 200, 0.06);
    }

    // Some com os extras
    destruir() { this.brilho.destroy(); this.icone.destroy(); super.destruir(); }
}

// SERRA: disco girando no chão (ou no teto). Mata como espinho (os pilotos de teste tratam igual)
class Serra extends Espinho {
    constructor(fase, x, noTeto = false, yBase = null) {
        // Usa o espinho como "caixa de colisão" (justa: menor que o desenho)
        super(fase, x, noTeto, 0xffffff, 0xffffff, yBase);
        // O triângulo não aparece (só o corpo dele), nem o halo
        this.forma.setAlpha(0); this.halo.destroy(); this.halo = null;
        // Centro do disco (meio enterrado no chão ou no teto)
        const cy = yBase !== null ? yBase - 12 : (noTeto ? MOVIMENTO.tetoY + 12 : MOVIMENTO.chaoY - 12);
        // Desenho do disco com dentes: preto com contorno claro e halo na cor da fase (visual neon)
        const tema = fase.tema || {}, preto = tema.objeto !== undefined ? tema.objeto : 0x0a0a12, neon = tema.neon || 0xffffff;
        const g = fase.cena.add.graphics({ x: x + 20, y: cy }).setDepth(3);
        // Contorno em estrela (10 dentes): pontas em r=30, vales em r=20
        const estrela = [];
        for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10, r = i % 2 ? 20 : 30; estrela.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
        // Halo
        g.lineStyle(7, tema.linha || neon, 0.3).strokePoints(estrela, true);
        // Corpo preto + contorno
        g.fillStyle(preto, 1).fillPoints(estrela, true);
        g.lineStyle(2, neon, 1).strokePoints(estrela, true);
        // Miolo: anel e furo
        g.lineStyle(2, neon, 0.8).strokeCircle(0, 0, 9); g.fillStyle(neon, 1).fillCircle(0, 0, 3);
        // Guarda
        this.disco = g;
    }

    // Gira
    atualizar(dt) { this.disco.rotation += 9 * dt / 1000; }

    // Some com o disco
    destruir() { this.disco.destroy(); super.destruir(); }
}

// MINI ESPINHO: metade da altura (pulo curto já passa, mas quebra o ritmo esperado)
// Herda de Espinho (o jogo e os pilotos de teste tratam igual a um espinho)
class MiniEspinho extends Espinho {
    constructor(fase, x, yBase = MOVIMENTO.chaoY, noTeto = false) {
        // Espinho normal na mesma base
        super(fase, x, noTeto, null, null, noTeto ? null : yBase);
        // Desenho baixinho (triângulo de 20 px de altura, colado na base)
        if (noTeto) { this.forma.setTo(0, 0, 40, 0, 20, 20); this.halo.setTo(0, 0, 40, 0, 20, 20); }
        else { this.forma.setTo(0, 40, 20, 20, 40, 40); this.halo.setTo(0, 40, 20, 20, 40, 40); }
        // Hitbox só na ponta baixa
        this.forma.body.setSize(14, 10, false).setOffset(13, noTeto ? 2 : 28);
    }
}

// SERRA QUE DESCE: começa pendurada no alto e desce até o chão conforme o cubo se aproxima
// (acionada pela POSIÇÃO do jogador, então é sempre igual: dá pra aprender o tempo)
class SerraDescendo extends Serra {
    constructor(fase, x, yBase = MOVIMENTO.chaoY) {
        // Serra normal no chão (corpo/hitbox de espinho)
        super(fase, x, false, yBase);
        // Posições: alto (y do disco) e chão
        this.yChaoDisco = this.disco.y; this.yAlto = this.disco.y - 230;
        // Corrente que segura a serra (decoração)
        this.corrente = fase.cena.add.line(0, 0, x + 20, MOVIMENTO.tetoY, x + 20, this.yAlto, 0x9a9f96, 0.7).setOrigin(0, 0).setLineWidth(2).setDepth(2);
        // Diferença entre o corpo e o disco (o corpo fica um pouco abaixo do centro do disco)
        this.difCorpo = this.forma.y - this.disco.y;
        // Começa no alto
        this.posicionar(this.yAlto);
    }

    // Move disco e corpo juntos
    posicionar(yDisco) {
        // Desenho
        this.disco.y = yDisco;
        // Corpo de colisão
        this.forma.y = yDisco + this.difCorpo; this.forma.body.reset(this.forma.x, this.forma.y);
        // Corrente até o disco
        this.corrente.setTo(this.forma.x, MOVIMENTO.tetoY, this.forma.x, yDisco - 24);
    }

    atualizar(dt) {
        // Gira
        super.atualizar(dt);
        // Distância da frente do cubo até a serra
        const dx = this.forma.x - (this.fase.player.x + 20);
        // De 520 a 220 px de distância a serra desce (antes disso fica no alto; depois, no chão)
        const t = Phaser.Math.Clamp((520 - dx) / 300, 0, 1);
        // Posição suave (acelera no fim)
        this.posicionar(Phaser.Math.Linear(this.yAlto, this.yChaoDisco, t * t));
    }

    // Some com a corrente
    destruir() { this.corrente.destroy(); super.destruir(); }
}

// Cria um elemento clássico a partir do evento do roteiro; devolve true se criou
function criarClassico(fase, ev) {
    // Escolhe pelo tipo
    switch (ev.tipo) {
        case 'pad': new PadSalto(fase, ev.x, !!ev.teto, ev.azul ? 'azul' : !!ev.rosa); return true;
        case 'modo': new PortalModo(fase, ev.x, ev.modo || 'cubo'); return true;
        case 'mini': new MiniEspinho(fase, ev.x, ev.yBase || MOVIMENTO.chaoY); return true;
        case 'serraDesce': new SerraDescendo(fase, ev.x, ev.yBase || MOVIMENTO.chaoY); return true;
        case 'orbeSalto': new OrbeSalto(fase, ev.x, ev.y || MOVIMENTO.chaoY - 110, ev.azul ? 'azul' : !!ev.rosa); return true;
        case 'gravidade': new PortalGravidade(fase, ev.x, !!ev.inverte); return true;
        case 'velocidade': new PortalVelocidade(fase, ev.x, ev.mult || 1); return true;
        case 'serra': new Serra(fase, ev.x, !!ev.teto, ev.yBase !== undefined ? ev.yBase : null); return true;
        // Trecho no ritmo: cada caractere do padrão é UMA batida da música (distância = velocidade × 60 / BPM)
        //   ^ espinho · 3 três espinhos colados · S serra · P pad · O orbe · . nada
        case 'ritmo': {
            // Distância percorrida em uma batida
            const passo = fase.cfg.velocidade * 60 / (fase.cfg.bpm || 128);
            // Cada batida do padrão
            [...ev.padrao].forEach((ch, i) => {
                // Posição dessa batida
                const x = Math.round(ev.x + i * passo);
                // Cria pelo próprio roteiro da fase (respeita cores e dimensões de cada herói)
                if (ch === '^') fase.criarElemento({ tipo: 'espinho', x, dim: ev.dim });
                if (ch === '3') [0, 40, 80].forEach((d) => fase.criarElemento({ tipo: 'espinho', x: x + d, dim: ev.dim }));
                if (ch === 'S') fase.criarElemento({ tipo: 'serra', x, dim: ev.dim });
                if (ch === 'P') fase.criarElemento({ tipo: 'pad', x });
                if (ch === 'O') fase.criarElemento({ tipo: 'orbeSalto', x, y: MOVIMENTO.chaoY - 110 });
            });
            return true;
        }
        default: return false;
    }
}
