// ================================================================
// cenas.js — cenas do Phaser: fundo compartilhado, Menu e Game
// ================================================================

// Liga o nome do herói (data-level do HTML) à classe da fase dele (polimorfismo: todas são Fase)
const FASES = {
    'Homem-Aranha':   FaseAranha,
    'Homem de Ferro': FaseFerro,
    'Hulk':           FaseHulk,
    'Gaviao':         FaseGaviao,
    'DrEstranho':     FaseEstranho,
    'Wanda':          FaseWanda
};

// CENA BASE: GeometricScene
// Cenário compartilhado que provê o fundo e elementos visuais reutilizáveis.
class GeometricScene extends Phaser.Scene {

    // Constrói o fundo do menu: cor sólida, brilho atrás do título, faixas de luz diagonais,
    // cubos flutuando nas cores dos heróis e um chão com blocos e espinhos passando devagar
    // (como na tela inicial dos jogos de plataforma musicais). Sem grade de "editor".
    // tema = conjunto de cores (TEMAS.padrao se não passar nada)
    createBackdrop(tema = TEMAS.padrao) {
        // Define a cor de fundo da câmera
        this.cameras.main.setBackgroundColor(tema.fundo);
        const animar = !reducedMotion.matches;

        // Brilho suave atrás do título (círculos sobrepostos bem transparentes)
        for (let r = 460; r >= 140; r -= 40) this.add.circle(640, 300, r, 0x7fb4ff, 0.018);

        // Faixas de luz diagonais (atravessam a tela de cima a baixo)
        [[250, 120], [520, 60], [860, 150], [1120, 70]].forEach(([x, larg], i) => {
            const faixa = this.add.rectangle(x, 360, larg, 1100, 0xffffff, 0.035).setAngle(24);
            if (animar) this.tweens.add({ targets: faixa, alpha: 0.075, duration: 2600 + i * 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        });

        // Cubos flutuando com as cores dos heróis (contorno claro, miolo translúcido)
        const cubos = [
            [440, 110, 30, 0xff5a6e], [850, 96, 24, 0xffc23d], [420, 612, 22, 0x6fdc4a],
            [880, 600, 28, 0xa77bff], [560, 64, 18, 0x3dff8a], [730, 640, 18, 0xff2a4d]
        ];
        cubos.forEach(([x, y, lado, cor], i) => {
            const cubo = this.add.rectangle(x, y, lado, lado, cor, 0.22).setStrokeStyle(3, cor, 0.7).setAngle(15 + i * 12);
            if (animar) this.tweens.add({ targets: cubo, y: y - 18, angle: cubo.angle + 90, duration: 3400 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        });

        // Chão: faixa escura com linha brilhante em cima
        this.add.rectangle(640, 690, 1280, 60, tema.faixa);
        this.add.rectangle(640, 661, 1280, 3, tema.linha, 0.9);
        this.add.rectangle(640, 666, 1280, 8, tema.linha, 0.15);

        // Silhuetas de blocos e espinhos em cima do chão, passando para a esquerda (loop de 640 px)
        const silhueta = this.add.graphics().setAlpha(0.28);
        silhueta.fillStyle(0x0a1650, 1);
        for (let base = 0; base < 1920; base += 640) {
            // Bloco, degrau, espinhos e bloco alto (mesmo desenho a cada 640 px)
            silhueta.fillRect(base + 60, 621, 40, 40);
            silhueta.fillRect(base + 100, 601, 40, 60);
            [200, 230, 260].forEach((x) => silhueta.fillTriangle(base + x, 661, base + x + 15, 631, base + x + 30, 661));
            silhueta.fillRect(base + 380, 581, 40, 80);
            silhueta.fillTriangle(base + 470, 661, base + 485, 631, base + 500, 661);
            silhueta.fillRect(base + 540, 621, 80, 40);
        }
        if (animar) this.tweens.add({ targets: silhueta, x: -640, duration: 9000, repeat: -1, ease: 'Linear' });
    }
}

// CENA 1: MenuScene
// Gerencia a interface do menu principal e a transição para o jogo.
class MenuScene extends GeometricScene {
    constructor() {
        super('Menu');
    }

    // Recebe dados (abrirSelecao = true quando volta da tela de conclusão)
    init(data) {
        // Guarda se deve abrir direto a seleção de fases
        this.abrirSelecao = !!(data && data.abrirSelecao);
    }

    create() {
        // Desenha o cenário de fundo estático/animado
        this.createBackdrop();
        this.starting = false;
        // Trilha do menu (menu e seleção são a mesma cena: a música não reinicia ao trocar de tela)
        som.iniciarTrilhaMenu();
        // Cor do fundo do menu muda devagar (azul → roxo → magenta → verde-azulado), como nos jogos de ritmo
        const cores = [0x2f5bd1, 0x7a2fd1, 0xd12f8a, 0x1fa58f];
        const veu = this.add.rectangle(640, 360, 1280, 720, cores[0], 0.22).setDepth(1);
        const contador = { t: 0 };
        if (!reducedMotion.matches) this.tweens.add({ targets: contador, t: cores.length, duration: 16000, repeat: -1, onUpdate: () => {
            // Duas cores vizinhas e quanto falta de uma pra outra
            const i = Math.floor(contador.t) % cores.length, f = contador.t % 1;
            const a = Phaser.Display.Color.IntegerToColor(cores[i]), b = Phaser.Display.Color.IntegerToColor(cores[(i + 1) % cores.length]);
            const m = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, Math.round(f * 100));
            veu.setFillStyle(Phaser.Display.Color.GetColor(m.r, m.g, m.b), 0.22);
        } });

        // Acessa e prepara os elementos de UI do DOM (HTML)
        const menu = document.getElementById('menu');
        const play = document.getElementById('play-button');
        const levelSelect = document.getElementById('level-select');
        const levelButtons = document.querySelectorAll('.level-btn');
        const backBtn = document.getElementById('back-button');

        // Reseta o estado inicial (caso o jogador tenha morrido e voltado pro menu)
        menu.hidden = false;
        menu.classList.remove('is-leaving');
        // Animação de entrada do elenco e do título (só agora, não toda vez que um painel fecha)
        menu.classList.add('entrada');
        this.time.delayedCall(900, () => menu.classList.remove('entrada'));
        menu.inert = false;
        play.disabled = false;
        levelSelect.hidden = true;
        levelSelect.style.opacity = "1";
        backBtn.hidden = true;
        document.getElementById('ability-button').hidden = true;
        document.getElementById('fase-concluida').hidden = true;
        document.getElementById('menu-status').innerHTML = 'ou pressione <kbd>Enter</kbd>';
        // Marca as fases já concluídas (✓ nos botões) e preenche dificuldade/progresso dos cartões
        Progresso.marcarBotoes(); Progresso.preencherCartoes();

        // CARROSSEL DA SELEÇÃO: um cartão por vez, setas e bolinhas
        const pontos = document.getElementById('sel-pontos');
        const setaAnt = document.getElementById('sel-ant'), setaProx = document.getElementById('sel-prox');
        // Fase aparecendo (lembra a última escolhida enquanto o jogo está aberto)
        this.indice = MenuScene.ultimoIndice || 0;
        // Bolinhas (uma por fase)
        pontos.innerHTML = '';
        levelButtons.forEach((btn, i) => { const d = document.createElement('i'); d.addEventListener('click', () => mostrar(i)); pontos.appendChild(d); });
        // Mostra o cartão i (com volta: depois do último vem o primeiro)
        const mostrar = (i, foco = true) => {
            // Índice dentro do intervalo
            this.indice = (i + levelButtons.length) % levelButtons.length;
            // Liga só o cartão atual
            levelButtons.forEach((btn, k) => btn.classList.toggle('ativa', k === this.indice));
            // Bolinha atual
            [...pontos.children].forEach((d, k) => d.classList.toggle('ativa', k === this.indice));
            // Lembra
            MenuScene.ultimoIndice = this.indice;
            // Foco no cartão (Enter joga)
            if (foco && !levelSelect.hidden) levelButtons[this.indice].focus({ preventScroll: true });
        };
        // Setas
        const anterior = () => { som.tocar('clique'); mostrar(this.indice - 1); };
        const proxima = () => { som.tocar('clique'); mostrar(this.indice + 1); };
        setaAnt.addEventListener('click', anterior); setaProx.addEventListener('click', proxima);
        // Teclado ← →
        const onEsq = () => { if (!levelSelect.hidden && !this.starting) anterior(); };
        const onDir = () => { if (!levelSelect.hidden && !this.starting) proxima(); };
        this.input.keyboard.on('keydown-LEFT', onEsq); this.input.keyboard.on('keydown-RIGHT', onDir);
        // Começa no cartão lembrado
        mostrar(this.indice, false);

        // PAINÉIS (Heróis e Como jogar)
        const painelHerois = document.getElementById('painel-herois'), painelAjuda = document.getElementById('painel-ajuda');
        // Lista de heróis (gerada a partir do config.js, na ordem da seleção)
        document.getElementById('lista-herois').innerHTML = [...levelButtons].map((btn) => {
            const h = btn.getAttribute('data-level'), cfg = CONFIG_FASES[h], info = HEROIS_INFO[h];
            return `<div class="heroi-item" style="--cor:${info.cor}"><i class="heroi-foto" data-heroi="${h}"></i><b>${cfg.nome}</b><span>${info.habilidade}</span></div>`;
        }).join('');
        // Abre um painel (esconde o menu)
        const abrirPainel = (painel) => { som.tocar('clique'); menu.hidden = true; painel.hidden = false; painel.querySelector('.painel-fechar').focus({ preventScroll: true }); };
        // Fecha qualquer painel aberto
        const fecharPaineis = () => { if (painelHerois.hidden && painelAjuda.hidden) return false; painelHerois.hidden = true; painelAjuda.hidden = true; menu.hidden = false; play.focus({ preventScroll: true }); return true; };
        const abrirHerois = () => abrirPainel(painelHerois), abrirAjuda = () => abrirPainel(painelAjuda);
        document.getElementById('herois-button').addEventListener('click', abrirHerois);
        document.getElementById('ajuda-button').addEventListener('click', abrirAjuda);
        const fechadores = document.querySelectorAll('.painel-fechar');
        fechadores.forEach((b) => b.addEventListener('click', fecharPaineis));
        painelHerois.hidden = true; painelAjuda.hidden = true;

        // Botão de som do canto
        const botaoSom = document.getElementById('som-button');
        const textoSom = () => { botaoSom.textContent = som.mudo ? 'SOM: DESLIGADO' : 'SOM: LIGADO'; botaoSom.classList.toggle('mudo', som.mudo); };
        const alternarSom = () => { som.alternarMudo(); textoSom(); };
        botaoSom.addEventListener('click', alternarSom); textoSom(); botaoSom.hidden = false;

        // Botão "Jogar" abre a seleção de fases
        const OpenLevelSelect = () => {
            menu.hidden = true;
            levelSelect.hidden = false;
            backBtn.hidden = false;
            // Som de clique
            som.tocar('clique');
            // Atualiza os cartões e foca o atual (Enter joga).
            // setTimeout: espera o Enter que abriu a seleção terminar; senão esse mesmo Enter "aperta" o botão focado
            Progresso.preencherCartoes();
            setTimeout(() => mostrar(this.indice), 0);
        }

        // Botão de voltar (da seleção de fases para o menu principal)
        const CloseLevelSelect = () => {
            if (this.starting) return;
            levelSelect.hidden = true;
            backBtn.hidden = true;
            menu.hidden = false;
            play.focus({ preventScroll: true });
        }

        // Enter no menu principal abre a seleção (o texto do menu promete isso)
        const onEnter = () => {
            // Só funciona se o menu principal estiver aparecendo
            if (!menu.hidden) OpenLevelSelect();
        };

        // ESC na seleção de fases volta pro menu principal
        const onEsc = () => {
            // Painel aberto: fecha ele
            if (fecharPaineis()) return;
            // Só funciona se a seleção estiver aparecendo
            if (!levelSelect.hidden) CloseLevelSelect();
        };

        // Inicia o jogo ao clicar em uma fase
        const StartLevel = (event) => {
            if (this.starting) return;
            this.starting = true;

            // currentTarget = o botão (target poderia ser o <small> de dentro)
            const heroName = event.currentTarget.getAttribute('data-level');
            // Som de clique
            som.tocar('clique');

            // Animação de saída da tela de seleção
            levelSelect.style.opacity = "0";
            backBtn.hidden = true;

            const duration = reducedMotion.matches ? 0 : 480;

            // Cor da transição vem do tema da fase
            const [r, g, b] = TEMAS[CONFIG_FASES[heroName].tema].fade;

            if (duration) {
                this.tweens.add({
                    targets: this.cameras.main,
                    zoom: 1.08,
                    duration,
                    ease: 'Cubic.In'
                });
                this.cameras.main.fadeOut(duration, r, g, b);
            }

            // Transita para a cena "Game" enviando o nome do herói
            this.time.delayedCall(duration, () => {
                levelSelect.hidden = true;
                this.scene.start('Game', { hero: heroName, tentativa: 1 } );
            });
        };

        // Listeners de eventos para os botões do menu e seleção de fases
        play.addEventListener('click', OpenLevelSelect);
        backBtn.addEventListener('click', CloseLevelSelect);
        this.input.keyboard.on('keydown-ENTER', onEnter);
        this.input.keyboard.on('keydown-ESC', onEsc);

        levelButtons.forEach(btn => {
            btn.addEventListener('click', StartLevel);
        });

        // Limpeza de listeners ao encerrar/mudar esta cena
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            // Entrando numa fase: a trilha do menu para (a fase tem a batida dela)
            som.pararTrilhaMenu();
            play.removeEventListener('click', OpenLevelSelect);
            backBtn.removeEventListener('click', CloseLevelSelect);
            this.input.keyboard.off('keydown-ENTER', onEnter);
            this.input.keyboard.off('keydown-ESC', onEsc);
            // Carrossel, painéis e som
            setaAnt.removeEventListener('click', anterior); setaProx.removeEventListener('click', proxima);
            this.input.keyboard.off('keydown-LEFT', onEsq); this.input.keyboard.off('keydown-RIGHT', onDir);
            document.getElementById('herois-button').removeEventListener('click', abrirHerois);
            document.getElementById('ajuda-button').removeEventListener('click', abrirAjuda);
            fechadores.forEach((b) => b.removeEventListener('click', fecharPaineis));
            botaoSom.removeEventListener('click', alternarSom); botaoSom.hidden = true;
            painelHerois.hidden = true; painelAjuda.hidden = true;

            levelButtons.forEach(btn => {
                btn.removeEventListener('click', StartLevel);
            });
        });

        // Voltando da tela de conclusão: abre a seleção direto
        if (this.abrirSelecao) OpenLevelSelect();
        // Senão, foco no botão Jogar
        else play.focus({ preventScroll: true });
    }
}

// CENA 2: GameScene ('Game')
// Só cria a fase certa e repassa o update — toda a lógica fica nas classes de Fase.
class GameScene extends Phaser.Scene {
    constructor() {
        super('Game');
    }

    // Recebe o herói, a tentativa e o checkpoint (se houver)
    init(data) {
        // Herói escolhido (se vier inválido, usa o Hulk)
        this.heroi = FASES[data.hero] ? data.hero : 'Hulk';
        // Número da tentativa (começa em 1)
        this.tentativa = data.tentativa || 1;
        // Checkpoint pra reaparecer ({ indice, tempo }); sem ele, a fase começa do zero
        this.checkpointSalvo = data.checkpoint || null;
        // Modo prática ({ diamantes: [...] }) ou null = partida normal
        this.pratica = data.pratica || null;
    }

    // Carrega só a arte de fundo do herói desta fase (CENARIOS_IMAGEM); sem ela, a fase usa o cenário procedural.
    // Em file:// o WebGL recusa imagens de arquivo local, então só carrega por http(s) ou se vier embutida
    // (window.DADOS_ASSETS, usado pela página de teste). Prefixo opcional: window.BASE_ASSETS.
    preload() {
        // Vídeo de fundo (opcional, VIDEOS_FUNDO em config.js): sem áudio, só por http(s)
        const vids = (typeof VIDEOS_FUNDO !== 'undefined') && VIDEOS_FUNDO[this.heroi];
        if (vids && location.protocol !== 'file:' && !this.cache.video.exists('video-' + this.heroi)) {
            this.load.video('video-' + this.heroi, vids, 'loadeddata', false, true);
        }
        const def = (typeof CENARIOS_IMAGEM !== 'undefined') && CENARIOS_IMAGEM[this.heroi];
        const chave = 'cena-' + this.heroi;
        if (!def || this.textures.exists(chave)) return;
        const url = (arq) => (window.DADOS_ASSETS && window.DADOS_ASSETS[arq]) || (location.protocol === 'file:' ? null : (window.BASE_ASSETS || '') + arq);
        if (def.camadas) {
            def.camadas.forEach((c, i) => { const u = url(c.arquivo), k = chave + '-c' + i; if (u && !this.textures.exists(k)) this.load.image(k, u); });
            return;
        }
        if (def.sequencia) {
            def.sequencia.forEach((arq, i) => { const u = url(arq), k = chave + '-' + i; if (u && !this.textures.exists(k)) this.load.image(k, u); });
            return;
        }
        const u = url(def.arquivo);
        if (u) this.load.image(chave, u);
    }

    create() {
        // Garante que a física volta a rodar (ela é pausada quando o jogador morre)
        this.physics.resume();
        // Garantia: nenhuma trilha do menu tocando durante a partida
        som.pararTrilhaMenu();
        // Garante que as telas do menu estão escondidas (não podem ficar por cima do jogo)
        document.getElementById('menu').hidden = true;
        document.getElementById('level-select').hidden = true;
        document.getElementById('fase-concluida').hidden = true;
        // Pega a classe da fase pelo herói
        const ClasseFase = FASES[this.heroi];
        // Cria a fase (FaseHulk, FaseFerro...) — polimorfismo
        this.fase = new ClasseFase(this, this.heroi, this.tentativa);
        // Monta a fase (método template)
        this.fase.criar();
    }

    // Roda todo frame (Phaser chama sozinho)
    update(time, delta) {
        // Repassa pra fase
        this.fase.atualizar(time, delta);
    }
}
