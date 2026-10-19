// ================================================================
// habilidade.js — CLASSE BASE Habilidade (cada fase tem uma subclasse)
// ================================================================

// CLASSE BASE: Habilidade
// Guarda o que toda habilidade tem em comum: nome, tempo de recarga e o controle de "pronta ou não".
// Cada herói cria uma classe filha que sobrescreve usar() (polimorfismo).
class Habilidade {

    // fase = fase dona; config = { nome, recarga, cor }
    constructor(fase, config) {
        // Guarda a fase (pra acessar cena, jogador, efeitos)
        this.fase = fase;
        // Nome curto que aparece no HUD e no botão
        this.nome = config.nome;
        // Tempo de recarga em ms
        this.recarga = config.recarga;
        // Cor da barra de recarga e dos efeitos
        this.cor = config.cor;
        // Último momento em que foi usada (-Infinity = começa pronta)
        this.ultimoUso = -Infinity;
    }

    // Retorna true se já passou o tempo de recarga
    pronta(agora) {
        // Compara o tempo desde o último uso com a recarga
        return agora - this.ultimoUso >= this.recarga;
    }

    // Retorna de 0 a 1 o quanto já recarregou (usado na barra do HUD)
    progresso(agora) {
        // Clamp = trava entre 0 e 1
        return Phaser.Math.Clamp((agora - this.ultimoUso) / this.recarga, 0, 1);
    }

    // Tenta usar: só funciona se estiver pronta e o jogador vivo; retorna true se usou
    ativar(agora, alvo = null) {
        // Recarregando ou jogador morto: não usa
        if (!this.pronta(agora) || !this.fase.player.vivo) {
            // Som de "ainda não"
            som.tocar('erro');
            // Avisa que não usou
            return false;
        }
        // Executa o efeito específico; se a subclasse disser que não deu (ex.: sem alvo), não gasta a recarga
        if (this.usar(agora, alvo) === false) return false;
        // Marca a hora do uso (começa a recarga)
        this.ultimoUso = agora;
        // Avisa que usou
        return true;
    }

    // Efeito da habilidade: cada herói sobrescreve (retornar false = não usou)
    usar(agora, alvo) { return true; }
}
