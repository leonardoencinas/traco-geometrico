# ================================================================
# teste_cadencia_ferro.py — mede o intervalo REAL entre os disparos do repulsor do Homem de Ferro
# (conta cada execução de Repulsor.usar, que é onde o feixe é criado) em 30 e em 144 quadros por segundo.
# Uso: python3 tests/teste_cadencia_ferro.py
# ================================================================
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from rodar_testes import nova_pagina, iniciar_fase, avancar, F, registrar, resultados
from playwright.sync_api import sync_playwright

ESPIAO = """(() => { window.__tiros = []; const orig = Repulsor.prototype.usar;
    Repulsor.prototype.usar = function (...a) { const r = orig.apply(this, a); if (r !== false) window.__tiros.push(this.fase.cena.time.now); return r; }; return 0; })()"""

def medir(pg, fps, ms=3000):
    pg.evaluate("window.__tiros = []")
    pg.keyboard.down('e')
    avancar(pg, ms, 1000 / fps)
    pg.keyboard.up('e')
    t = pg.evaluate("window.__tiros")
    inter = [round(b - a) for a, b in zip(t, t[1:])]
    return t, inter

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    pg, erros = nova_pagina(nav)
    iniciar_fase(pg, 'Homem de Ferro', True)
    pg.evaluate(ESPIAO)
    recarga = F(pg, "FERRO.recargaTiro")
    registrar('Ferro: recarga do repulsor bem mais curta que os 400 ms de antes', recarga <= 170, f"recarga={recarga} ms")
    for fps in (30, 60, 144):
        t, inter = medir(pg, fps)
        media = sum(inter) / len(inter) if inter else 0
        registrar(f'Ferro ({fps} fps): segurar E dispara em sequência na cadência da recarga, sem tiro duplo',
                  len(inter) >= 10 and min(inter) >= recarga - 1 and media <= recarga + 1000 / fps + 2,
                  f"{len(t)} tiros em 3 s · intervalo mín {min(inter) if inter else '-'} ms · médio {media:.0f} ms")
    # Um aperto rápido = um tiro só
    pg.evaluate("window.__tiros = []"); avancar(pg, 300)
    pg.keyboard.press('e'); avancar(pg, 60)
    registrar('Ferro: um toque rápido em E gera exatamente 1 tiro', pg.evaluate("window.__tiros.length") == 1, f"{pg.evaluate('window.__tiros.length')} tiro(s)")
    registrar('Ferro: sem erros de console', not erros, '; '.join(erros[:3]))
    nav.close()
falhas = [r for r in resultados if not r[1]]
print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} verificações de cadência passaram")
sys.exit(1 if falhas else 0)
