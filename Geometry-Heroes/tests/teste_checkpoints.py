# ================================================================
# teste_checkpoints.py — testa o sistema de checkpoints nas 6 fases
# Uso: python3 tests/teste_checkpoints.py [Hulk Wanda ...]
# ================================================================
import sys, json, pathlib
# Deixa importar o rodar_testes.py (mesma pasta)
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
# Helpers da suíte principal (página, avançar, F, bots, registrar...)
import rodar_testes as T
from playwright.sync_api import sync_playwright

# Quantidade esperada de checkpoints por fase
# Hulk e Gavião ganharam um 4º checkpoint na rodada 5 (trechos da bola e do UFO)
ESPERADO = {'Hulk': 4, 'Homem de Ferro': 3, 'Gaviao': 4, 'Homem-Aranha': 3, 'DrEstranho': 3, 'Wanda': 3}

# JS: liga (uma vez) o contador de eventos 'checkpoint' e o registro de chamadas da barra percentual
JS_ESPIOES = """() => {
    // Lista de eventos 'checkpoint' recebidos
    window.__evCp = window.__evCp || [];
    // Cena do jogo
    const c = window.jogo.scene.getScene('Game');
    // Liga o ouvinte uma vez só (o emissor da cena sobrevive aos reinícios)
    if (!window.__ouvindoCp) { c.events.on('checkpoint', (d) => window.__evCp.push(d)); window.__ouvindoCp = true; }
    // Registra cada definir() da barra com o estado "concluída" da fase
    window.__barra = window.__barra || [];
    if (typeof BarraProgresso !== 'undefined' && !BarraProgresso.prototype.__espiado) {
        const orig = BarraProgresso.prototype.definir;
        BarraProgresso.prototype.definir = function (pct, animar) { window.__barra.push([pct, !!this.fase.concluida]); return orig.call(this, pct, animar); };
        BarraProgresso.prototype.__espiado = true;
    }
}"""

# Expressão JS: o jogador está apoiado (chão, ou teto quando a gravidade está invertida)?
APOIADO = "(p.body.blocked.down || p.body.touching.down || (p.invertido && (p.body.blocked.up || p.body.touching.up)))"


def testar_heroi(nav, heroi):
    # Página nova com captura de erros
    pg, erros = T.nova_pagina(nav)
    # Começa a fase SEM invencibilidade
    T.iniciar_fase(pg, heroi)
    # Liga os espiões
    pg.evaluate(JS_ESPIOES)
    # Quantidade de checkpoints
    n = T.F(pg, "f.listaCheckpoints.length")
    T.registrar(f'{heroi}: quantidade de checkpoints = {ESPERADO[heroi]}', n == ESPERADO[heroi], f'n={n}')
    # Começo: 0% e barra existe (se o arquivo da barra carregou)
    ini = T.F(pg, "[f.porcentagemAtual(), f.cpAtivados, !!f.barraPct, f.barraPct ? f.barraPct.pct : null]")
    T.registrar(f'{heroi}: começa em 0% sem checkpoint ativo', ini[0] == 0 and ini[1] == 0, f'{ini}')
    # Lista declarada
    lista = T.F(pg, "f.listaCheckpoints")
    ok_geral = True
    for k, cp in enumerate(lista):
        esperado_pct = round(100 * (k + 1) / (n + 1))
        # --- Ativação: teleporta o jogador logo depois do checkpoint k (invencível só no teleporte) ---
        eventos_antes = pg.evaluate("window.__evCp.length")
        # (se o Homem-Aranha estiver balançando, solta a teia antes: no balanço a teia controla a posição)
        T.F(pg, f"(MODO_TESTE.invencivel = true, f.segurandoTecla = false, f.balanco && f.soltar && f.soltar(), p.body.reset({cp['x']} + 4, f.yDoCheckpoint(f.listaCheckpoints[{k}])), 0)")
        T.avancar(pg, 1000 / 60)
        r = T.F(pg, "[f.cpAtivados, f.porcentagemAtual(), f.marcosCheckpoint.map(m => m.aceso)]")
        ev = pg.evaluate("window.__evCp.slice(-1)[0]")
        # Mais alguns quadros: não pode disparar de novo
        T.avancar(pg, 300)
        eventos_depois = pg.evaluate("window.__evCp.length")
        ok_ativ = (r[0] == k + 1 and r[1] == esperado_pct and r[2][k] and eventos_depois - eventos_antes == 1
                   and ev and ev['indice'] == k and ev['total'] == n and ev['porcentagem'] == esperado_pct)
        T.registrar(f'{heroi}: checkpoint {k + 1} ativa uma vez ({esperado_pct}%) e emite evento', ok_ativ,
                    f'ativados={r[0]} pct={r[1]} eventos+={eventos_depois - eventos_antes} ev={ev}')
        # --- Morte depois do checkpoint k: reaparece nele ---
        antes = T.F(pg, "[f.tentativa, f.tempo]")
        eventos_antes = pg.evaluate("window.__evCp.length")
        T.F(pg, "(MODO_TESTE.invencivel = false, p.invencivelAte = 0, f.morrer(), 0)")
        # 520 ms de espera + reinício da cena
        T.avancar(pg, 700)
        depois = T.F(pg, f"""[f.tentativa, Math.round(p.x), Math.round(p.y), f.porcentagemAtual(), f.cpAtivados,
            f.marcosCheckpoint.map(m => m.aceso), p.vivo, f.tempo, f.realidade || null, f.dim || null, !!p.invertido,
            f.barraPct ? f.barraPct.pct : null, {APOIADO}]""")
        eventos_respawn = pg.evaluate("window.__evCp.length") - eventos_antes
        tent, x, y, pct, ativ, acesos, vivo, tempo, real, dim, inv, barra, apoiado = depois
        ok = (tent == antes[0] + 1 and abs(x - cp['x']) < 200 and x >= cp['x'] and pct == esperado_pct and ativ == k + 1
              and all(acesos[:k + 1]) and not any(acesos[k + 1:]) and vivo and tempo >= antes[1] and eventos_respawn == 0
              and (barra is None or barra == esperado_pct) and apoiado)
        # Estado restaurado (declarado na lista)
        if 'realidade' in cp: ok = ok and real == cp['realidade']
        if 'dim' in cp: ok = ok and dim == cp['dim'] and inv == (cp['dim'] == 'E')
        T.registrar(f'{heroi}: morte depois do checkpoint {k + 1} reaparece nele com estado certo', ok,
                    f'tentativa {antes[0]}→{tent} x={x} (cp {cp["x"]}) y={y} pct={pct} barra={barra} acesos={acesos} '
                    f'tempo {round(antes[1])}→{round(tempo)} real={real} dim={dim} invertido={inv} apoiado={apoiado} eventos={eventos_respawn}')
        ok_geral = ok_geral and ok
        # --- Sem loop de morte: 1,5 s jogando (piloto automático da fase) depois de reaparecer ---
        tent0 = T.F(pg, "f.tentativa")
        # Bots do Aranha/Estranho sorteiam o jeito de jogar a cada tentativa; aqui fixa o jeito da 1ª (determinístico)
        T.F(pg, "(window.__tent = f.tentativa, window.__soltar = 0.55, window.__borda = 30, window.__j = 0, window.__esp = 0, 0)")
        T.instalar_bot(pg, T.BOTS[heroi])
        T.avancar(pg, 1500)
        T.remover_bot(pg)
        fim = T.F(pg, "[f.tentativa, p.vivo, Math.round(p.x)]")
        T.registrar(f'{heroi}: 1,5 s depois de reaparecer no checkpoint {k + 1} continua vivo', fim[0] == tent0 and fim[1],
                    f'tentativa {tent0}→{fim[0]} vivo={fim[1]} x={fim[2]} mortes={pg.evaluate("window.__mortes.slice(-3)")}')
    # --- R reinicia do zero (0%, começo da fase) ---
    t0 = T.F(pg, "f.tentativa")
    pg.keyboard.press('r')
    T.avancar(pg, 500)
    r = T.F(pg, "[f.tentativa, f.cpAtivados, f.porcentagemAtual(), Math.round(p.x), Math.round(f.tempo), f.barraPct ? f.barraPct.pct : null, f.marcosCheckpoint.some(m => m.aceso)]")
    T.registrar(f'{heroi}: R reinicia do zero (0%, sem checkpoint)', r[0] == t0 + 1 and r[1] == 0 and r[2] == 0 and r[3] < 500 and r[4] < 1000 and r[5] in (None, 0) and not r[6], f'{r}')
    # --- Vitória: só aqui a barra chega a 100 ---
    T.F(pg, "(MODO_TESTE.invencivel = true, p.body.reset(f.cfg.comprimento - 60, p.invertido ? 120 : 400), 0)")
    concluiu = T.esperar_ate(pg, "f.concluida", 3000, 50)
    barra = pg.evaluate("window.__barra")
    cedo = [v for v in barra if v[0] >= 100 and not v[1]]
    ok100 = concluiu and not cedo and (not barra or barra[-1] == [100, True])
    T.registrar(f'{heroi}: 100% só ao concluir', ok100, f'concluiu={concluiu} chamadas={len(barra)} 100_antes={cedo} última={barra[-1] if barra else None}')
    T.registrar(f'{heroi}: checkpoints sem erros de console', not erros, '; '.join(erros[:3]))
    pg.close()


if __name__ == '__main__':
    escolhidos = sys.argv[1:] or list(ESPERADO.keys())
    with sync_playwright() as p:
        nav = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for heroi in escolhidos:
            try:
                testar_heroi(nav, heroi)
            except Exception as e:
                T.registrar(f'{heroi}: exceção no teste de checkpoints', False, repr(e))
        nav.close()
    falhas = [r for r in T.resultados if not r[1]]
    print(f"\n{len(T.resultados) - len(falhas)}/{len(T.resultados)} verificações de checkpoint passaram")
    sys.exit(1 if falhas else 0)
