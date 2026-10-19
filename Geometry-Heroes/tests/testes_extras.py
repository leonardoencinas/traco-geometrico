# Testes extras: custo de CPU por quadro, toque (celular) e modo "menos movimento"
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import rodar_testes as T
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    nav = p.chromium.launch()
    # 1) Custo médio da lógica por quadro (CPU, sem desenhar) em cada fase
    err = []
    for heroi in ['Hulk', 'Homem de Ferro', 'Gaviao', 'Homem-Aranha', 'DrEstranho', 'Wanda']:
        pg, e = T.nova_pagina(nav)
        T.iniciar_fase(pg, heroi, invencivel=True)
        T.instalar_bot(pg, T.BOTS[heroi])
        ms = pg.evaluate("""() => { const n = 600; const t0 = performance.now();
            for (let i = 0; i < n; i++) { window.__relogio += 1000/60; window.jogo.headlessStep(window.__relogio, 1000/60);
              window.jogo.scene.getScenes(true).forEach(sc => sc.cameras.cameras.forEach(cam => cam.preRender())); }
            return (performance.now() - t0) / n; }""")
        T.registrar(f'Desempenho: {heroi} — lógica custa {ms:.2f} ms por quadro (orçamento de 60 fps = 16,7 ms)', ms < 8)
        T.remover_bot(pg); err += e; pg.close()
    T.registrar('Desempenho: sem erros de console', not err, '; '.join(err[:3]))
    # 2) Toque (celular): tocar à direita ativa a fúria (Hulk); tocar à direita atira (Gavião)
    ctx = nav.new_context(viewport={'width': 1280, 'height': 720}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); erros = []
    pg.on('pageerror', lambda e: erros.append(str(e)))
    pg.goto(T.URL); pg.wait_for_function("window.jogo && window.jogo.scene.isActive('Menu')")
    pg.evaluate("() => { window.jogo.loop.sleep(); window.__relogio = performance.now(); }")
    T.iniciar_fase(pg, 'Hulk')
    T.avancar(pg, 500)
    pg.touchscreen.tap(900, 400); T.avancar(pg, 100)
    T.registrar('Toque: tocar à direita ativa a fúria (Hulk)', T.F(pg, "f.emFuria()"))
    pg.touchscreen.tap(300, 400); T.avancar(pg, 120)
    T.registrar('Toque: tocar fora dos obstáculos pula (Hulk)', T.F(pg, "p.body.velocity.y < -100"))
    T.registrar('Toque: sem erros', not erros, '; '.join(erros[:3]))
    ctx.close()
    # 3) Modo "menos movimento" do sistema: as 6 fases abrem sem erro
    ctx = nav.new_context(viewport={'width': 1280, 'height': 720}, reduced_motion='reduce')
    pg = ctx.new_page(); erros = []
    pg.on('pageerror', lambda e: erros.append(str(e)))
    pg.goto(T.URL); pg.wait_for_function("window.jogo && window.jogo.scene.isActive('Menu')")
    pg.evaluate("() => { window.jogo.loop.sleep(); window.__relogio = performance.now(); }")
    certos = 0
    for heroi in ['Hulk', 'Homem de Ferro', 'Gaviao', 'Homem-Aranha', 'DrEstranho', 'Wanda']:
        # Fluxo real: Enter no menu (se a seleção não estiver aberta) → herói → jogar 2 s → ESC pausa → Seleção de fases
        if pg.evaluate("document.getElementById('level-select').hidden"): pg.keyboard.press('Enter'); T.avancar(pg, 200)
        pg.evaluate(f"document.querySelector('.level-btn[data-level=\"{heroi}\"]').click()"); T.avancar(pg, 600)
        certos += pg.evaluate(f"window.jogo.scene.isActive('Game') && window.jogo.scene.getScene('Game').fase.heroi === {json.dumps(heroi)}")
        T.avancar(pg, 2000); pg.keyboard.press('Escape'); T.avancar(pg, 100)
        pg.evaluate("document.getElementById('pausa-selecao').click()"); T.avancar(pg, 300)
    T.registrar('Menos movimento: as 6 fases abrem pelo menu (Enter → herói → ESC pausa → seleção) sem erro', certos == 6 and not erros, f"{certos}/6; " + '; '.join(erros[:3]))
    ctx.close()
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
