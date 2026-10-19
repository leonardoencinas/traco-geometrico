# ================================================================
# teste_barra.py — testa a BarraProgresso nas 6 fases
# Uso: python3 tests/teste_barra.py
# ================================================================
import sys, pathlib
# Deixa importar os helpers de rodar_testes.py (que fica nesta mesma pasta)
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
# Ao importar, rodar_testes.py só define funções e gera o teste.html (o main dele fica protegido)
from rodar_testes import nova_pagina, iniciar_fase, avancar, F, shot, sync_playwright

# Os 6 heróis (chaves usadas pelo jogo)
HEROIS = ['Homem-Aranha', 'Homem de Ferro', 'Hulk', 'Gaviao', 'DrEstranho', 'Wanda']
# Contador de falhas
falhas = 0

def checar(nome, ok, detalhe=''):
    """Imprime PASSOU/FALHOU e conta as falhas."""
    global falhas
    if not ok: falhas += 1
    print(('PASSOU ' if ok else 'FALHOU ') + nome + (f' — {detalhe}' if detalhe else ''), flush=True)

# Expressão JS que devolve a barra: a integrada pelo Agente 1 (f.barraPct) ou cria uma nova
PEGAR = "(f.barraPct || (window.__barra && !window.__barra.destruida ? window.__barra : (window.__barra = new BarraProgresso(f))))"

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    for heroi in HEROIS:
        pagina, erros = nova_pagina(nav)
        iniciar_fase(pagina, heroi, invencivel=True)
        # Garante a barra (integrada ou criada aqui)
        integrada = F(pagina, "!!f.barraPct")
        F(pagina, PEGAR + " && true")
        # 0% instantâneo
        F(pagina, PEGAR + ".definir(0, false)")
        checar(f'{heroi}: texto 0%', F(pagina, PEGAR + ".textoPct.text") == '0%')
        checar(f'{heroi}: preenchimento 0', F(pagina, PEGAR + ".preench.scaleX") == 0)
        # 33%: número muda na hora, preenchimento ainda não
        F(pagina, PEGAR + ".definir(33)")
        checar(f'{heroi}: texto 33% imediato', F(pagina, PEGAR + ".textoPct.text") == '33%')
        checar(f'{heroi}: alvo 0.33', abs(F(pagina, PEGAR + ".alvo") - 0.33) < 1e-9)
        # Tweens usam o relógio real (Date.now): espera 30 ms reais e avança 1 quadro, 16 vezes (~480 ms)
        for _ in range(16):
            pagina.wait_for_timeout(30)
            avancar(pagina, 1000 / 60)
        # Largura visível = scaleX * largura total
        lv = F(pagina, f"(() => {{ const b = {PEGAR}; return b.preench.scaleX * b.largura / b.largura; }})()")
        checar(f'{heroi}: preenchimento ≈ 33% após animação', abs(lv - 0.33) < 0.02, f'{lv:.3f}')
        # Marcos: 3 losangos
        F(pagina, PEGAR + ".marcos([25, 50, 75])")
        checar(f'{heroi}: 3 tiques', F(pagina, PEGAR + ".tiques.length") == 3)
        # 100%
        F(pagina, PEGAR + ".definir(100)")
        checar(f'{heroi}: texto 100%', F(pagina, PEGAR + ".textoPct.text") == '100%')
        # Screenshot com ~50% (instantâneo, sem brilho)
        F(pagina, PEGAR + ".definir(50, false)")
        # Altura dos controles (pra ver se a linha quebra e encosta na barra)
        base = F(pagina, "f.hudControles.y + f.hudControles.height")
        checar(f'{heroi}: controles terminam acima da barra', base <= 78, f'base={base}')
        shot(pagina, f'barra_{heroi}')
        # destruir() não pode quebrar (só na barra criada pelo teste)
        if not integrada:
            F(pagina, "(window.__barra.destruir(), window.__barra.destruir(), true)")
            checar(f'{heroi}: destruir', F(pagina, "window.__barra.destruida") is True)
        checar(f'{heroi}: sem erros de console', not erros, '; '.join(erros[:3]))
        pagina.close()
    nav.close()

print('FALHAS:', falhas)
sys.exit(1 if falhas else 0)
