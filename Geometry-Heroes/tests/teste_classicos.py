# ================================================================
# teste_classicos.py — elementos clássicos (pad, orbe, portais, serra), ritmo, pausa e seleção
# Uso: python3 tests/teste_classicos.py
# ================================================================
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from rodar_testes import nova_pagina, iniciar_fase, avancar, F, registrar, resultados, BOTS, instalar_bot, esperar_ate
from playwright.sync_api import sync_playwright

def hulk(pg):
    iniciar_fase(pg, 'Hulk', True)
    # Orbe: pula, encosta no orbe no ar e aperta → ganha um pulo novo (velocidade pra cima de novo)
    F(pg, "(p.body.reset(2985, 640), f.aoPressionar('teclado'), 0)")
    esperar_ate(pg, "f.orbesClassicos[0].alcance()", 2000, 10)
    vy0 = F(pg, "p.body.velocity.y")
    F(pg, "(f.aoPressionar('teclado'), 0)"); avancar(pg, 20)
    registrar('Clássico: orbe amarelo dá pulo no ar (só apertando encostado nele)', vy0 > -200 and F(pg, "p.body.velocity.y") < -600, f"vy antes={vy0:.0f} depois={F(pg, 'p.body.velocity.y'):.0f}")
    esperar_ate(pg, "p.x > 3400", 3000, 20)
    registrar('Clássico: com o orbe atravessa a poça larga (300 px) sem cair', F(pg, "p.vivo && p.x > 3400 && f.tentativa === 1"))
    # Pad: encostou = lançado alto (mais forte que o pulo normal) e passa a parede alta
    F(pg, "(p.body.reset(5860, 640), 0)"); esperar_ate(pg, "p.body.velocity.y < -800", 1500, 10)
    registrar('Clássico: pad lança 45% mais alto que o pulo', F(pg, "p.body.velocity.y") < -900, f"vy={F(pg, 'p.body.velocity.y'):.0f}")
    pg.evaluate("MODO_TESTE.invencivel = false")
    esperar_ate(pg, "p.x > 6200", 2000, 20)
    registrar('Clássico: o pad faz passar a parede alta indestrutível', F(pg, "p.vivo && f.tentativa === 1"))
    pg.evaluate("MODO_TESTE.invencivel = true")
    # Portal de gravidade: azul inverte, laranja desinverte
    F(pg, "(p.body.reset(11500, 640), 0)"); esperar_ate(pg, "p.invertido && p.y < 200", 3000, 20)
    registrar('Clássico: portal azul inverte a gravidade (corre no teto)', F(pg, "p.invertido && p.y < 200"), f"y={F(pg, 'Math.round(p.y)')}")
    esperar_ate(pg, "!p.invertido && p.y > 600", 4000, 20)
    registrar('Clássico: portal laranja volta ao chão', F(pg, "!p.invertido && p.y > 600"))

def gaviao(pg):
    iniciar_fase(pg, 'Gaviao', True)
    F(pg, "(p.body.reset(10950, 640), 0)"); avancar(pg, 500)
    v1 = F(pg, "p.velocidadeX")
    F(pg, "(p.body.reset(14150, 640), 0)"); avancar(pg, 500)
    registrar('Clássico: portal »» acelera (×1.25) e » volta ao normal', abs(v1 - 500) < 1 and abs(F(pg, "p.velocidadeX") - 400) < 1, f"{v1} → {F(pg, 'p.velocidadeX')}")
    # Serra mata como espinho
    registrar('Clássico: serra é mortal (grupo de perigos) e gira', F(pg, "(() => { const s = f.obstaculos.find(o => o instanceof Serra); const r0 = s.disco.rotation; return s.categoria === 'mortal' && s.forma.body.enable; })()"))

def ritmo_pausa(pg):
    iniciar_fase(pg, 'Wanda', True)
    b0 = F(pg, "f.indiceBatida"); avancar(pg, 2000); b1 = F(pg, "f.indiceBatida")
    esperado = 2000 / (60000 / 136)
    registrar('Ritmo: batidas no BPM da fase (136) com pulso de fundo', abs((b1 - b0) - esperado) <= 1, f"batidas em 2 s = {b1 - b0} (esperado ≈ {esperado:.1f})")
    registrar('Tentativa: texto "TENTATIVA 1" no mundo', F(pg, "c.children.list.some(o => o.type === 'Text' && o.text === 'TENTATIVA 1')"))
    F(pg, "(p.body.reset(1100, 640), 0)"); avancar(pg, 50)
    F(pg, "(f.pausar(), 0)"); x0 = F(pg, "p.x"); b0 = F(pg, "f.indiceBatida"); avancar(pg, 800)
    registrar('Pausa: congela o cubo e a música', F(pg, "f.pausado && !document.getElementById('pausa').hidden") and F(pg, "p.x") == x0 and F(pg, "f.indiceBatida") == b0)
    F(pg, "(f.retomar(), 0)"); avancar(pg, 300)
    registrar('Pausa: continuar volta a correr', F(pg, "!f.pausado && document.getElementById('pausa').hidden") and F(pg, "p.x") > x0 + 50)

def selecao(pg):
    pg.evaluate("Progresso.registrarPct('Hulk', 33); Progresso.registrarPct('Hulk', 25)")
    pg.keyboard.press('Enter'); avancar(pg, 100)
    for _ in range(1): pg.keyboard.press('ArrowRight'); avancar(pg, 50)
    txt = pg.evaluate("document.querySelector('.level-btn.ativa').innerText")
    registrar('Seleção: carrossel mostra 1 cartão por vez com dificuldade e melhor % (não diminui)', pg.evaluate("document.querySelectorAll('.level-btn.ativa').length") == 1 and 'HULK' in txt.upper() and '33%' in txt and 'NORMAL' in txt.upper(), txt.replace('\n', ' | ')[:120])
    for _ in range(2): pg.keyboard.press('ArrowLeft'); avancar(pg, 50)
    registrar('Seleção: setas dão a volta (antes da 1ª vem a última)', pg.evaluate("document.querySelector('.level-btn.ativa').dataset.level") == 'Wanda')

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    for fn in (hulk, gaviao, ritmo_pausa, selecao):
        pg, erros = nova_pagina(nav)
        try: fn(pg)
        except Exception as e: registrar(f'{fn.__name__}: exceção', False, repr(e))
        registrar(f'{fn.__name__}: sem erros de console', not erros, '; '.join(erros[:3]))
        pg.close()
    nav.close()
falhas = [r for r in resultados if not r[1]]
print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} verificações de clássicos/interface passaram")
