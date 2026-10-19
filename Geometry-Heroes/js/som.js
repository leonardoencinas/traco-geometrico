// ================================================================
// som.js — efeitos sonoros sintetizados com Web Audio (sem arquivos de áudio)
// ================================================================

// Classe Som: um único objeto pro jogo todo (sobrevive ao reinício das cenas)
class Som {
    constructor() {
        // Contexto de áudio (só pode ser criado depois de um clique/tecla do jogador)
        this.ctx = null;
        // Volume geral (o "master")
        this.master = null;
        // Buffer de ruído branco (usado em impactos e explosões), criado uma vez
        this.bufferRuido = null;
        // Som ligado ou desligado (tecla M); lê a preferência salva
        this.mudo = this.lerMudo();
        // Na primeira interação do jogador, liga o áudio
        const destravar = () => this.iniciar();
        // Escuta clique/toque na página inteira
        window.addEventListener('pointerdown', destravar);
        // Escuta tecla na página inteira
        window.addEventListener('keydown', destravar);
    }

    // Lê do localStorage se o som estava desligado (try/catch: pode falhar em aba anônima)
    lerMudo() {
        // Tenta ler a chave salva
        try { return localStorage.getItem('tracoGeometrico.mudo') === '1'; }
        // Se der erro, começa com som ligado
        catch (e) { return false; }
    }

    // Cria o contexto de áudio (ou retoma se o navegador pausou)
    iniciar() {
        // Pega a classe de AudioContext (Safari antigo usa o prefixo webkit)
        const Contexto = window.AudioContext || window.webkitAudioContext;
        // Navegador sem Web Audio: sai sem som
        if (!Contexto) return;
        // Se ainda não existe contexto, cria
        if (!this.ctx) {
            // Novo contexto de áudio
            this.ctx = new Contexto();
            // Nó de ganho geral
            this.master = this.ctx.createGain();
            // Volume geral baixinho (0 se estiver mudo)
            this.master.gain.value = this.mudo ? 0 : 0.18;
            // Liga o master na saída (alto-falante)
            this.master.connect(this.ctx.destination);
            // Cria 1 segundo de ruído branco
            this.bufferRuido = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
            // Pega os dados do canal pra preencher
            const dados = this.bufferRuido.getChannelData(0);
            // Preenche com valores aleatórios entre -1 e 1
            for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
        }
        // Se o navegador suspendeu o contexto, retoma
        if (this.ctx.state === 'suspended') this.ctx.resume();
        // O menu pediu a trilha antes do primeiro clique (o navegador não deixa tocar antes): começa agora
        if (this.querTrilha && !this.trilha) this.iniciarTrilhaMenu();
    }

    // Liga/desliga o som (tecla M) e salva a escolha
    alternarMudo() {
        // Inverte o estado
        this.mudo = !this.mudo;
        // Ajusta o volume geral, se o contexto já existir
        if (this.master) this.master.gain.value = this.mudo ? 0 : 0.18;
        // Salva a preferência (try/catch: pode falhar)
        try { localStorage.setItem('tracoGeometrico.mudo', this.mudo ? '1' : '0'); } catch (e) {}
        // Devolve o novo estado (a cena mostra "SOM: LIGADO/DESLIGADO")
        return this.mudo;
    }

    // Toca um tom: onda ('sine','square','sawtooth','triangle'), freq inicial f0, final f1, duração ms, volume
    tom(onda, f0, f1, ms, vol = 0.08, atraso = 0) {
        // Sem contexto (jogador ainda não interagiu) ou mudo: não toca
        if (!this.ctx || this.mudo) return;
        // Momento de começar (agora + atraso em segundos)
        const t = this.ctx.currentTime + atraso / 1000;
        // Cria o oscilador
        const osc = this.ctx.createOscillator();
        // Cria o ganho (envelope de volume)
        const ganho = this.ctx.createGain();
        // Define o tipo de onda
        osc.type = onda;
        // Frequência inicial
        osc.frequency.setValueAtTime(f0, t);
        // Rampa até a frequência final (exponencial soa mais natural)
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + ms / 1000);
        // Volume começa em zero
        ganho.gain.setValueAtTime(0.0001, t);
        // Sobe rápido (5 ms de ataque)
        ganho.gain.exponentialRampToValueAtTime(vol, t + 0.005);
        // Cai até quase zero no fim
        ganho.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
        // Liga oscilador → ganho → master
        osc.connect(ganho).connect(this.master);
        // Começa a tocar
        osc.start(t);
        // Para um pouquinho depois do fim
        osc.stop(t + ms / 1000 + 0.02);
    }

    // Toca ruído filtrado (impactos, explosões, poeira)
    ruido(ms, vol = 0.1, filtroHz = 1200, atraso = 0) {
        // Sem contexto ou mudo: não toca
        if (!this.ctx || this.mudo) return;
        // Momento de começar
        const t = this.ctx.currentTime + atraso / 1000;
        // Fonte que toca o buffer de ruído
        const fonte = this.ctx.createBufferSource();
        // Usa o ruído branco criado no iniciar()
        fonte.buffer = this.bufferRuido;
        // Filtro passa-baixa (deixa o ruído mais "grave")
        const filtro = this.ctx.createBiquadFilter();
        // Tipo do filtro
        filtro.type = 'lowpass';
        // Frequência de corte
        filtro.frequency.value = filtroHz;
        // Envelope de volume
        const ganho = this.ctx.createGain();
        // Começa no volume pedido
        ganho.gain.setValueAtTime(vol, t);
        // Some até o fim
        ganho.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
        // Liga fonte → filtro → ganho → master
        fonte.connect(filtro).connect(ganho).connect(this.master);
        // Começa
        fonte.start(t);
        // Para no fim
        fonte.stop(t + ms / 1000 + 0.02);
    }

    // Som contínuo (jato, vento): um oscilador que fica ligado e muda só o volume
    // Retorna um objeto com volume(v) e parar(); funciona mesmo antes do áudio destravar (fica mudo)
    continuo(onda = 'sawtooth', freq = 90, filtroHz = 400) {
        // Objeto de controle (começa vazio)
        const ctrl = { ganho: null, osc: null };
        // Cria os nós de áudio (se o contexto já existir)
        const montar = () => {
            // Já montado ou sem contexto: não faz nada
            if (ctrl.osc || !this.ctx) return;
            // Oscilador contínuo
            ctrl.osc = this.ctx.createOscillator();
            // Tipo de onda
            ctrl.osc.type = onda;
            // Frequência fixa
            ctrl.osc.frequency.value = freq;
            // Filtro passa-baixa (deixa o som abafado, tipo motor)
            const filtro = this.ctx.createBiquadFilter();
            // Tipo do filtro
            filtro.type = 'lowpass';
            // Frequência de corte
            filtro.frequency.value = filtroHz;
            // Ganho (volume) começa em zero
            ctrl.ganho = this.ctx.createGain();
            // Volume inicial zero
            ctrl.ganho.gain.value = 0;
            // Liga oscilador → filtro → ganho → master
            ctrl.osc.connect(filtro).connect(ctrl.ganho).connect(this.master);
            // Começa a tocar (em silêncio)
            ctrl.osc.start();
        };
        // Muda o volume suavemente (80 ms)
        ctrl.volume = (v) => {
            // Monta se ainda não montou
            montar();
            // Sem nó de ganho: sai
            if (!ctrl.ganho) return;
            // Rampa até o novo volume
            ctrl.ganho.gain.setTargetAtTime(this.mudo ? 0 : v, this.ctx.currentTime, 0.03);
        };
        // Para e desliga o oscilador
        ctrl.parar = () => {
            // Se existe, para
            if (ctrl.osc) { try { ctrl.osc.stop(); } catch (e) {} ctrl.osc.disconnect(); ctrl.osc = null; }
        };
        // Devolve o controle
        return ctrl;
    }

    // Trilha das fases em 8 BITS (chiptune), tocada uma batida por vez no BPM da fase.
    // Timbres dos consoles antigos: baixo em onda TRIANGULAR, arpejo e melodia em onda QUADRADA,
    // bateria feita de RUÍDO curto. i = número da batida; raiz = nota base do herói (Hz);
    // intervalo = ms entre batidas.
    batidaMusica(i, raiz, intervalo) {
        // Sem som: nada
        if (!this.ctx || this.mudo) return;
        // Posição dentro do compasso (4 batidas) e da frase (16 batidas)
        const b = i % 4, frase = Math.floor(i / 4) % 4;
        // Grau do acorde em cada compasso da frase: I, I, VI, V (menor: raiz, raiz, 6ª abaixo, 5ª abaixo)
        const grau = [1, 1, 0.84, 0.75][frase];
        // Bumbo 8-bit: triangular com queda rápida de tom
        this.tom('triangle', 180, 50, 90, 0.16);
        // Chimbal de ruído agudo no contratempo
        this.ruido(25, 0.025, 8000, intervalo / 2);
        // Caixa de ruído nas batidas 2 e 4
        if (b === 1 || b === 3) this.ruido(80, 0.06, 2500);
        // Baixo triangular saltando oitava (raiz, oitava, quinta, oitava)
        const baixo = raiz * grau * [1, 2, 1.5, 2][b];
        this.tom('triangle', baixo, baixo, intervalo * 0.45, 0.07);
        this.tom('triangle', baixo, baixo, intervalo * 0.4, 0.05, intervalo / 2);
        // Arpejo em onda quadrada (semicolcheias: tônica, terça menor, quinta, oitava), o som clássico
        // dos 8 bits — entra a partir do 2º compasso da frase pra a música "crescer"
        if (frase >= 1) [1, 1.19, 1.5, 2].forEach((m, k) => this.tom('square', raiz * grau * 2 * m, raiz * grau * 2 * m, intervalo * 0.22, 0.018, k * intervalo / 4));
        // Melodia curta em onda quadrada na 1ª batida dos compassos 3 e 4
        if (frase >= 2 && b === 0) this.tom('square', raiz * grau * 4, raiz * grau * 4, intervalo * 0.9, 0.025);
    }

    // ---------------------------------------------------------------
    // TRILHA DO MENU E DA SELEÇÃO: marcha heroica original em 8 bits (composição própria, sintetizada
    // aqui mesmo — nada de arquivo de áudio). Ré menor, 132 BPM, 8 compassos em loop:
    //   Dm · B♭ · C · Dm · Dm · B♭ · F · A  (o lá maior no fim "puxa" de volta pro começo)
    // Agendamento com antecedência (lookahead) no relógio do Web Audio: não falha nem acelera
    // com quedas de FPS, e um único loop por vez (chamar de novo não duplica nem reinicia).
    // ---------------------------------------------------------------
    iniciarTrilhaMenu() {
        // Lembra que o menu quer música (se o áudio ainda não destravou, iniciar() chama de novo)
        this.querTrilha = true;
        // Sem contexto ainda, ou já tocando: nada (evita trilha duplicada ou recomeçando)
        if (!this.ctx || this.trilha) return;
        const ctx = this.ctx;
        // Volume próprio da trilha (abaixo dos efeitos), entrando suave
        const ganho = ctx.createGain(); ganho.gain.value = 0; ganho.connect(this.master);
        ganho.gain.setTargetAtTime(0.75, ctx.currentTime, 0.5);
        // Colcheia a 132 BPM
        const colcheia = 60 / 132 / 2;
        const t = { ganho, passo: 0, proximo: ctx.currentTime + 0.12, timer: null };
        t.timer = setInterval(() => {
            // Aba em segundo plano atrasou o timer: pula pro presente em vez de despejar notas acumuladas
            if (t.proximo < ctx.currentTime) t.proximo = ctx.currentTime + 0.05;
            // Agenda tudo que cai nos próximos 250 ms
            while (t.proximo < ctx.currentTime + 0.25) { this.passoTrilha(t.passo, t.proximo, colcheia, ganho); t.passo++; t.proximo += colcheia; }
        }, 60);
        this.trilha = t;
    }

    // Para a trilha com fade curto (ao entrar numa fase)
    pararTrilhaMenu() {
        this.querTrilha = false;
        const t = this.trilha; if (!t) return;
        this.trilha = null;
        clearInterval(t.timer);
        t.ganho.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
        setTimeout(() => t.ganho.disconnect(), 900);
    }

    // Uma nota da trilha num instante exato (t0 em segundos do relógio do áudio), indo pro ganho da trilha
    notaTrilha(onda, freq, t0, dur, vol, destino) {
        const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
        osc.type = onda; osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
        g.gain.setValueAtTime(vol * 0.8, t0 + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(destino); osc.start(t0); osc.stop(t0 + dur + 0.02);
    }

    // Toca o passo (colcheia) número i da trilha: bateria, baixo em marcha, acorde de "metais" e melodia
    passoTrilha(i, t0, colcheia, destino) {
        const RE = 293.66, nota = (st) => RE * Math.pow(2, st / 12);
        const passo = i % 8, compasso = Math.floor(i / 8) % 8;
        // Acordes (semitons a partir do ré): Dm, B♭, C, Dm, Dm, B♭, F, A
        const ACORDES = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7], [0, 3, 7], [-4, 0, 3], [3, 7, 10], [-5, -1, 2]];
        // Melodia: [passo no compasso, semitom, duração em colcheias]
        const MELODIA = [
            [[0, 0, 3], [3, 7, 1], [4, 5, 2], [6, 3, 1], [7, 5, 1]],
            [[0, 3, 4], [4, 2, 2], [6, 0, 2]],
            [[0, -2, 2], [2, 2, 2], [4, 5, 3], [7, 7, 1]],
            [[0, 12, 6], [6, 7, 2]],
            [[0, 0, 2], [2, 0, 1], [3, 7, 1], [4, 12, 3], [7, 10, 1]],
            [[0, 10, 3], [3, 7, 1], [4, 5, 2], [6, 3, 2]],
            [[0, 3, 2], [2, 5, 2], [4, 7, 2], [6, 10, 2]],
            [[0, 7, 3], [3, 11, 1], [4, 14, 4]]
        ];
        const acorde = ACORDES[compasso];
        // Bateria: bumbo nos tempos 1 e 3, caixa no 2 e 4, rufo no fim do último compasso
        if (passo === 0 || passo === 4) this.notaTrilha('sine', 120, t0, 0.14, 0.5, destino);
        if (passo === 2 || passo === 6 || (compasso === 7 && passo >= 5)) this.ruidoTrilha(t0, 0.09, destino);
        // Baixo em marcha (colcheias na fundamental, oitava abaixo)
        this.notaTrilha('triangle', nota(acorde[0] - 12), t0, colcheia * 0.9, 0.32, destino);
        // "Metais": acorde segurado no começo de cada compasso
        if (passo === 0) acorde.forEach((st) => this.notaTrilha('sawtooth', nota(st), t0, colcheia * 7.5, 0.035, destino));
        // Melodia (onda quadrada, o timbre clássico dos 8 bits)
        MELODIA[compasso].forEach(([p, st, d]) => { if (p === passo) this.notaTrilha('square', nota(st + 12), t0, colcheia * d * 0.95, 0.06, destino); });
    }

    // Caixa da trilha: ruído curto filtrado
    ruidoTrilha(t0, vol, destino) {
        const fonte = this.ctx.createBufferSource(); fonte.buffer = this.bufferRuido;
        const filtro = this.ctx.createBiquadFilter(); filtro.type = 'highpass'; filtro.frequency.value = 1500;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
        fonte.connect(filtro).connect(g).connect(destino); fonte.start(t0); fonte.stop(t0 + 0.13);
    }

    // Sons prontos usados em todas as fases (nome → receita)
    tocar(nome) {
        // Escolhe a receita pelo nome
        switch (nome) {
            // Pulo: bip curto subindo
            case 'pulo': this.tom('square', 520, 780, 90, 0.06); break;
            // Morte: queda grave + ruído
            case 'morte': this.tom('sawtooth', 320, 60, 380, 0.12); this.ruido(200, 0.1, 1200); break;
            // Aviso: tique agudo
            case 'aviso': this.tom('square', 1200, 1200, 40, 0.06); break;
            // Chegada: arpejo de 4 notas
            case 'chegada': [523, 659, 784, 1046].forEach((f, i) => this.tom('triangle', f, f, 110, 0.1, i * 110)); break;
            // Clique de interface
            case 'clique': this.tom('sine', 880, 660, 50, 0.05); break;
            // Erro / sem efeito
            case 'erro': this.tom('sine', 300, 200, 80, 0.05); break;
        }
    }
}

// Instância única usada pelo jogo inteiro
const som = new Som();
