// ================================================================
// progresso.js — salva quais fases foram concluídas (localStorage)
// ================================================================

// Objeto com funções de progresso (não precisa de instância)
const Progresso = {
    // Nome da chave no localStorage
    CHAVE: 'tracoGeometrico.progresso',

    // Lê todo o progresso salvo (objeto vazio se não tiver ou se der erro)
    ler() {
        // try/catch: localStorage pode estar bloqueado (aba anônima, preview)
        try { return JSON.parse(localStorage.getItem(this.CHAVE)) || {}; }
        // Erro: começa sem progresso
        catch (e) { return {}; }
    },

    // Salva a conclusão de uma fase (guarda o melhor tempo e menos tentativas)
    salvar(heroi, tempoMs, tentativas) {
        // Lê o que já existe
        const dados = this.ler();
        // Dados anteriores dessa fase (ou objeto vazio)
        const antes = dados[heroi] || {};
        // Atualiza a fase
        dados[heroi] = {
            // Marca como concluída
            concluida: true,
            // Guarda o menor tempo entre o antigo e o novo
            melhorTempo: Math.min(antes.melhorTempo || Infinity, tempoMs),
            // Guarda o menor número de tentativas
            menosTentativas: Math.min(antes.menosTentativas || Infinity, tentativas),
            // Concluiu = 100%
            melhorPct: 100
        };
        // Grava (try/catch)
        try { localStorage.setItem(this.CHAVE, JSON.stringify(dados)); } catch (e) {}
        // Devolve os dados da fase (a tela de conclusão mostra o melhor tempo)
        return dados[heroi];
    },

    // Guarda a maior porcentagem já alcançada numa fase (checkpoints), sem marcar como concluída
    registrarPct(heroi, pct) {
        // Lê o que já existe
        const dados = this.ler();
        // Dados da fase
        const fase = dados[heroi] || {};
        // Só sobe (nunca diminui)
        if ((fase.melhorPct || 0) >= pct) return;
        // Atualiza
        fase.melhorPct = pct; dados[heroi] = fase;
        // Grava (try/catch)
        try { localStorage.setItem(this.CHAVE, JSON.stringify(dados)); } catch (e) {}
    },

    // Guarda a maior porcentagem alcançada no MODO PRÁTICA (barra "Prática" do cartão)
    registrarPctPratica(heroi, pct) {
        const dados = this.ler(), fase = dados[heroi] || {};
        if ((fase.melhorPctPratica || 0) >= pct) return;
        fase.melhorPctPratica = pct; dados[heroi] = fase;
        try { localStorage.setItem(this.CHAVE, JSON.stringify(dados)); } catch (e) {}
    },

    // Preenche cada cartão da seleção: dificuldade com estrelas, barra de progresso e recordes
    preencherCartoes() {
        // Lê o progresso
        const dados = this.ler();
        // Cada botão de fase
        document.querySelectorAll('.level-btn').forEach((btn) => {
            // Herói e dados
            const heroi = btn.getAttribute('data-level'), info = dados[heroi] || {};
            // Configuração (dificuldade) e cores
            const cfg = CONFIG_FASES[heroi], dif = DIFICULDADES[cfg.dificuldade] || DIFICULDADES.Normal;
            // Porcentagem (100 se concluída)
            const pct = info.concluida ? 100 : (info.melhorPct || 0);
            // Bloco extra do cartão (criado uma vez)
            let extra = btn.querySelector('.card-extra');
            if (!extra) { extra = document.createElement('span'); extra.className = 'card-extra'; btn.appendChild(extra); }
            // Conteúdo: dificuldade, barra e recordes
            extra.innerHTML =
                `<span class="card-dif" style="--dif:${dif.cor}"><i class="dif-icone"></i>${cfg.dificuldade.toUpperCase()} <em>${'★'.repeat(dif.estrelas)}</em></span>` +
                // Progresso: rótulo e porcentagem na mesma linha (fora da barra, sempre legíveis); barra embaixo
                `<span class="card-progresso"><span class="card-modo">Progresso</span><b class="card-pct">${pct}%</b>` +
                `<span class="card-barra"><i style="width:${pct}%"></i></span></span>` +
                `<span class="card-stats">${info.concluida ? `Melhor tempo ${this.formatar(info.melhorTempo)} · ${info.menosTentativas} tentativa(s)` : 'Ainda não concluída'}</span>`;
        });
    },

    // Formata ms como m:ss.d (ex.: 0:41.2)
    formatar(ms) {
        // Total de segundos
        const s = ms / 1000;
        // Minutos inteiros
        const min = Math.floor(s / 60);
        // Segundos restantes com 1 casa decimal (com zero à esquerda)
        const seg = (s % 60).toFixed(1).padStart(4, '0');
        // Junta
        return `${min}:${seg}`;
    },

    // Marca os botões da seleção de fases que já foram concluídas
    marcarBotoes() {
        // Lê o progresso
        const dados = this.ler();
        // Passa por cada botão de fase
        document.querySelectorAll('.level-btn').forEach((btn) => {
            // Herói desse botão
            const heroi = btn.getAttribute('data-level');
            // Dados salvos dele
            const info = dados[heroi];
            // Liga/desliga a classe .concluida (o CSS mostra o ✓)
            btn.classList.toggle('concluida', !!(info && info.concluida));
            // Texto pro leitor de tela
            if (info && info.concluida) {
                // Ex.: "Hulk — concluída, melhor tempo 0:41.2"
                btn.setAttribute('aria-label', `${btn.firstChild.textContent.trim()} — concluída, melhor tempo ${this.formatar(info.melhorTempo)}`);
            } else {
                // Sem conclusão: tira o aria-label extra
                btn.removeAttribute('aria-label');
            }
        });
    }
};
