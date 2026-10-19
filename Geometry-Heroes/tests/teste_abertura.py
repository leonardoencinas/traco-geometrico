# ================================================================
# teste_abertura.py — abertura no ritmo (antes do x = 0) em 5 fases + cenário geométrico
# Uso: python3 tests/teste_abertura.py
# ================================================================
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from rodar_testes import nova_pagina, iniciar_fase, avancar, F, registrar, resultados, instalar_bot, esperar_ate, renderizar
from playwright.sync_api import sync_playwright

# Piloto só da abertura: pula espinhos no nível do pé, sobe na plataforma, pula na beirada dela e usa o orbe
BOT_ABERTURA = r"""
const g = p.isOnGround();
if (!g && (f.orbesClassicos || []).some(o => o.alcance())) f.aoPressionar('teclado');
if (!g) return;
for (const o of f.obstaculos) {
  if (!o.ativo || !o.abertura) continue;
  const esq = o.forma.x - o.forma.width / 2, dx = esq - (p.x + 20);
  if (o instanceof Espinho && p.body.bottom > o.forma.y - 30 && dx > 20 && dx < 70) f.aoPressionar('teclado');
  if ((o instanceof MiniEspinho) && dx > 20 && dx < 70) f.aoPressionar('teclado');
  if (o.saltar && p.isOnGround()) { const dl = o.forma.x - o.forma.width / 2 - (p.x + 20); if (dl > 20 && dl < 70) f.aoPressionar('teclado'); }
  if (o instanceof Bloco && !(o instanceof Plataforma) && p.body.bottom > o.forma.body.top + 4 && dx > 20 && dx < 60) f.aoPressionar('teclado');
  if (o instanceof Plataforma && dx > 10 && dx < 60) f.aoPressionar('teclado');
  if (o instanceof Plataforma && Math.abs(p.body.bottom - o.forma.body.top) < 4 && (o.forma.x + o.forma.width / 2) - (p.x + 20) < 18) f.aoPressionar('teclado');
}
"""

import os
for_heroes = os.environ.get('HEROIS', 'Hulk,Gaviao,DrEstranho,Wanda,Homem-Aranha').split(',')
with sync_playwright() as pw:
    nav = pw.chromium.launch()
    for heroi in for_heroes:
        pg, erros = nova_pagina(nav)
        iniciar_fase(pg, heroi, abertura=True)
        info = F(pg, "[f.aberturaAtiva, Math.round(f.xInicio), Math.round(p.x), f.obstaculos.filter(o => o.abertura).length]")
        registrar(f'{heroi}: abertura criada antes do x = 0 com os elementos marcados', info[0] and info[1] < -3000 and info[3] >= 15, str(info))
        pg.evaluate("window.__mortes = []")
        instalar_bot(pg, BOT_ABERTURA)
        esperar_ate(pg, "p.x > -2400", 20000, 20)
        renderizar(pg); pg.screenshot(path=f'tests/screenshots/abertura_{heroi}.png')
        esperar_ate(pg, "p.x > 50 || f.tentativa > 1", 30000, 20)
        usouOrbe = F(pg, "(f.orbesClassicos || []).some(o => o.abertura && o.ultimo > 0)")
        usouPad = F(pg, "f.obstaculos.some(o => o instanceof PadSalto && o.abertura && o.ultimo > 0)")
        registrar(f'{heroi}: abertura passável (piloto atravessa sem morrer, usando pad e orbe)', F(pg, "p.x > 50 && f.tentativa === 1") and usouOrbe and (usouPad or 'P' not in F(pg, 'f.padraoAbertura()').upper()),
                  f"x={F(pg, 'Math.round(p.x)')} tentativa={F(pg, 'f.tentativa')} mortes={pg.evaluate('window.__mortes')} orbe={usouOrbe} pad={usouPad}")
        # Espinhos da abertura caem nas batidas (múltiplos do passo)
        alinhado = F(pg, "(() => { const S = f.xInicio + 500; return f.obstaculos.some(o => o.abertura && o instanceof Espinho && Math.abs(o.forma.x - 20 - Math.round(S)) < 2); })()")
        tipos = F(pg, "[...new Set(f.obstaculos.filter(o => o.abertura).map(o => o.constructor.name))].join(',')")
        registrar(f'{heroi}: abertura no ritmo com variedade de obstáculos', alinhado and len(tipos.split(',')) >= 4, tipos)
        # Depois de morrer na fase com checkpoint, não repete a abertura
        registrar(f'{heroi}: sem erros de console', not erros, '; '.join(erros[:3]))
        pg.close()
    nav.close()
falhas = [r for r in resultados if not r[1]]
print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} verificações da abertura passaram")
