# ================================================================
# teste_respawn.py — renascer nos checkpoints das 6 fases
# Para cada checkpoint: ativa, morre 3 vezes SEGUIDAS e confere a cada vez:
#   · renasce no mesmo checkpoint (índice e x), vivo
#   · câmera alinhada com o cubo (cubo na posição normal da tela, não fora dela)
#   · sem apertar nada, sobrevive pelo menos ~0,75 s (o primeiro perigo não está colado no checkpoint)
# Uso: python3 tests/teste_respawn.py [Hulk Wanda ...]
# ================================================================
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import rodar_testes as T
from playwright.sync_api import sync_playwright

HEROIS = ['Hulk', 'Homem de Ferro', 'Gaviao', 'Homem-Aranha', 'DrEstranho', 'Wanda']
# Tempo mínimo vivo (ms) contado a partir de 700 ms depois da morte (o reinício leva ~520 ms + 1 quadro)
VIVO_MIN = 600
# Onde o cubo fica na tela (MOVIMENTO.telaX ≈ 268): aceita uma faixa em volta
TELA_MIN, TELA_MAX = 200, 360


def testar(nav, heroi):
    pg, erros = T.nova_pagina(nav)
    T.iniciar_fase(pg, heroi)
    n = T.F(pg, "f.listaCheckpoints.length")
    for k in range(n):
        T.esperar_ate(pg, "p.vivo && p.body.enable", 3000)
        # Ativa o checkpoint k (teleporte invencível só pra chegar nele)
        T.F(pg, f"(MODO_TESTE.invencivel = true, f.segurandoTecla = false, f.balanco && f.soltar && f.soltar(), p.body.reset(f.listaCheckpoints[{k}].x + 4, f.yDoCheckpoint(f.listaCheckpoints[{k}])), 0)")
        T.avancar(pg, 1000 / 60); T.avancar(pg, 300)
        cpx = T.F(pg, f"f.listaCheckpoints[{k}].x")
        falhas = []
        for rep in range(3):
            T.F(pg, "(MODO_TESTE.invencivel = false, p.invencivelAte = 0, p.vivo && f.morrer(), 0)")
            T.avancar(pg, 700)
            ativ, x, tela, vivo = T.F(pg, "[f.cpAtivados, Math.round(p.x), Math.round(p.x - c.cameras.main.scrollX), p.vivo]")
            pg.evaluate("window.__mortes = []")
            vive = 0
            while vive < 2000 and not pg.evaluate("window.__mortes.length"):
                T.avancar(pg, 100); vive += 100
            if ativ != k + 1 or not vivo or x < cpx or x > cpx + 200: falhas.append(f'morte {rep + 1}: ativos={ativ} x={x} vivo={vivo}')
            if not (TELA_MIN <= tela <= TELA_MAX): falhas.append(f'morte {rep + 1}: câmera desalinhada (cubo em {tela}px da borda)')
            if vive < VIVO_MIN: falhas.append(f'morte {rep + 1}: morreu {vive} ms depois de renascer')
        T.registrar(f'{heroi}: checkpoint {k + 1} (x={cpx}) — 3 mortes seguidas, renasce certo e com tempo de reagir', not falhas, '; '.join(falhas))
    T.registrar(f'{heroi}: renascimento sem erros de console', not erros, '; '.join(erros[:3]))
    pg.close()


if __name__ == '__main__':
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        for h in (sys.argv[1:] or HEROIS):
            testar(nav, h)
        nav.close()
    ok = sum(1 for r in T.resultados if r[1])
    print(f'\n{ok}/{len(T.resultados)} verificações de renascimento passaram')
    sys.exit(0 if ok == len(T.resultados) else 1)
