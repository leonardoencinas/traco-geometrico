# Testes extras: custo de CPU por quadro, toque (celular) e modo "menos movimento"
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import rodar_testes as T
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    nav = p.chromium.launch()
    # 4) Encerramentos: as 6 fases terminam com animação + tela; "Próxima fase" leva à fase seguinte
    pg, erros = T.nova_pagina(nav)
    ordem = ['Homem-Aranha', 'Hulk', 'Gaviao', 'Homem de Ferro', 'DrEstranho', 'Wanda']
    for i, heroi in enumerate(ordem):
        # A primeira fase é aberta direto; as outras chegam pelo botão "Próxima fase" (fluxo real)
        if i == 0: T.iniciar_fase(pg, heroi, invencivel=True)
        else: pg.evaluate("MODO_TESTE.invencivel = true")
        T.F(pg, "(p.body.reset(f.cfg.comprimento - 60, p.invertido ? 120 : 400), 0)")
        T.esperar_ate(pg, "f.concluida", 3000, 50)
        cedo = pg.evaluate("!document.getElementById('fase-concluida').hidden")
        T.avancar(pg, 1800)
        tela = pg.evaluate("!document.getElementById('fase-concluida').hidden")
        texto = pg.evaluate("document.getElementById('fc-heroi').textContent")
        prox_visivel = pg.evaluate("!document.getElementById('fc-proxima').hidden")
        esperado_prox = i < len(ordem) - 1
        T.shot(pg, f'final_{heroi}')
        ok = (not cedo) and tela and (prox_visivel == esperado_prox) and '—' in texto
        if esperado_prox:
            pg.click('#fc-proxima'); T.avancar(pg, 600)
            ok = ok and pg.evaluate(f"window.jogo.scene.getScene('Game').fase.heroi === {json.dumps(ordem[i + 1])}")
        T.registrar(f'Encerramento: {heroi} — animação, tela depois da animação e "Próxima fase" certa', ok, f"cedo={cedo} tela={tela} próxima={prox_visivel} texto='{texto}'")
    T.registrar('Encerramentos: sem erros de console', not erros, '; '.join(erros[:3]))
    nav.close()
falhas = [r for r in T.resultados if not r[1]]
print(f"\n{len(T.resultados) - len(falhas)}/{len(T.resultados)} verificações extras passaram")
