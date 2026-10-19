# Captura quadros REAIS do jogo (piloto automático dos testes, velocidade normal, 30 fps de vídeo)
import sys, os, json, pathlib
sys.path.insert(0, 'tests'); sys.argv = [sys.argv[0]] + sys.argv[1:]
import rodar_testes as rt
from playwright.sync_api import sync_playwright
heroi, saida = sys.argv[1], pathlib.Path(sys.argv[2])
# (checkpoint de onde começa ou None = largada, duração); DUR0/DUR1 encurtam; SEGS=1 grava só o 2º trecho
segs = [(None, float(os.environ.get('DUR0', 7.0))), (1, float(os.environ.get('DUR1', 6.0)))]
if os.environ.get('SEGS') == '1': segs = [None, segs[1]]
if os.environ.get('SEGS') == '0': segs = [segs[0], None]   # só a largada (mais rápido)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
    pg, erros = rt.nova_pagina(b)
    for k, seg in enumerate(segs):
        if seg is None: continue
        frac, dur = seg
        pg.evaluate("MODO_TESTE.invencivel = true; MODO_TESTE.semAbertura = true")
        cp = 'null' if frac is None else '{indice: %d, tempo: 20000}' % frac
        pg.evaluate(f"window.jogo.scene.getScene('Menu').scene.start('Game', {{hero: {json.dumps(heroi)}, tentativa: 2, checkpoint: {cp}}})")
        for _ in range(60):
            rt.avancar(pg, 50)
            if pg.evaluate("!!(window.jogo.scene.isActive('Game') && window.jogo.scene.getScene('Game').fase && window.jogo.scene.getScene('Game').fase.player)"): break
        if heroi in rt.BOTS: rt.instalar_bot(pg, rt.BOTS[heroi])
        rt.avancar(pg, 1200 if frac is None else 600)   # sai do ponto de partida
        # PRE (ms): avança sem gravar até o momento escolhido (ex.: o herói usando o poder)
        if k == 0 and os.environ.get('PRE'): rt.avancar(pg, float(os.environ['PRE']))
        pasta = saida / f"{heroi.replace(' ', '_')}_{k}"; pasta.mkdir(parents=True, exist_ok=True)
        for i in range(int(dur * 30)):
            rt.avancar(pg, 1000/30, 1000/60)
            rt.renderizar(pg)
            pg.screenshot(path=str(pasta / f"{i:04d}.jpg"), type='jpeg', quality=92)
        print(heroi, k, 'x final', rt.F(pg, "Math.round(p.x)"), 'tentativa', rt.F(pg, "f.tentativa"), flush=True)
        rt.remover_bot(pg)
        pg.evaluate("window.jogo.scene.getScene('Game').scene.start('Menu')"); rt.avancar(pg, 300)
    print('erros', erros[:3]); b.close()
