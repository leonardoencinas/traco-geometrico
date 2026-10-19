# ================================================================
# teste_rodada5.py — modos bola/UFO, pad/orbe azul, portais de modo e modo prática
# Uso: python3 tests/teste_rodada5.py
# ================================================================
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from rodar_testes import nova_pagina, iniciar_fase, avancar, F, registrar, resultados, BOTS, instalar_bot, remover_bot, esperar_ate, shot
from playwright.sync_api import sync_playwright

def bola(pg):
    iniciar_fase(pg, 'Hulk', True)
    F(pg, "(p.body.reset(17300, 640), 0)"); esperar_ate(pg, "p.modo === 'bola'", 2000, 20)
    registrar('Bola: portal ● transforma o cubo em bola (anel desenhado)', F(pg, "p.modo === 'bola' && !!p.adorno"))
    avancar(pg, 100)
    F(pg, "(f.aoPressionar('teclado'), 0)"); avancar(pg, 60)
    registrar('Bola: apertar no chão inverte a gravidade e já sai do chão', F(pg, "p.invertido && p.body.velocity.y < 0"))
    esperar_ate(pg, "p.isOnGround()", 2000, 20)
    registrar('Bola: chega no teto', F(pg, "p.invertido && p.y < 200"), f"y={F(pg, 'Math.round(p.y)')}")
    shot(pg, 'r5_bola')
    F(pg, "(f.aoPressionar('teclado'), 0)"); avancar(pg, 40); F(pg, "(f.aoPressionar('teclado'), 0)"); avancar(pg, 40)
    registrar('Bola: no ar, apertar de novo não troca (só encostado)', F(pg, "!p.invertido"))
    F(pg, "(p.body.reset(19150, 130), p.inverterGravidade(true), 0)"); esperar_ate(pg, "p.modo === 'cubo'", 2000, 20)
    registrar('Portal ■ volta a ser cubo (mantém a gravidade invertida)', F(pg, "p.modo === 'cubo' && !p.adorno && p.invertido"))
    esperar_ate(pg, "!p.invertido", 3000, 20)
    registrar('Pad azul no teto devolve o cubo pro chão sozinho', F(pg, "!p.invertido && p.x > 19500 && p.x < 19800"), f"x={F(pg, 'Math.round(p.x)')}")
    F(pg, "(p.body.reset(20150, 640), 0)"); avancar(pg, 50)
    F(pg, "(f.aoPressionar('teclado'), 0)")
    esperar_ate(pg, "(f.orbesClassicos || []).some(o => o.variante === 'azul' && o.alcance())", 1500, 10)
    F(pg, "(f.aoPressionar('teclado'), 0)"); avancar(pg, 40)
    registrar('Orbe azul: apertar encostado no ar inverte a gravidade', F(pg, "p.invertido"))
    esperar_ate(pg, "!p.invertido && p.x > 20800", 4000, 20)
    registrar('Portal laranja depois do poço devolve ao chão', F(pg, "!p.invertido"))

def ufo(pg):
    iniciar_fase(pg, 'Gaviao', True)
    F(pg, "(p.body.reset(17700, 640), 0)"); esperar_ate(pg, "p.modo === 'ufo'", 2000, 20)
    registrar('UFO: portal ◓ transforma em UFO (disco desenhado)', F(pg, "p.modo === 'ufo' && !!p.adorno"))
    F(pg, "(f.aoPressionar('teclado'), 0)"); avancar(pg, 50); y1 = F(pg, "p.y")
    avancar(pg, 150)
    F(pg, "(f.aoPressionar('teclado'), 0)"); avancar(pg, 50)
    registrar('UFO: toque no ar dá outro pulinho', F(pg, "p.body.velocity.y < -300 && !p.isOnGround()"), f"vy={F(pg, 'Math.round(p.body.velocity.y)')}")
    F(pg, "(f.segurandoTecla = true, 0)"); avancar(pg, 400)
    registrar('UFO: segurar não repete o pulinho (cai)', F(pg, "p.body.velocity.y > 0"))
    F(pg, "(f.segurandoTecla = false, 0)")
    avancar(pg, 800)
    registrar('UFO: queda limitada (cai devagar)', F(pg, "p.body.velocity.y <= 651"))
    shot(pg, 'r5_ufo')

def comecar_pratica(pg, heroi):
    remover_bot(pg)
    pg.evaluate("MODO_TESTE.invencivel = false; MODO_TESTE.semAbertura = true")
    pg.evaluate(f"void (window.jogo.scene.isActive('Game') ? window.jogo.scene.getScene('Game') : window.jogo.scene.getScene('Menu')).scene.start('Game', {{hero: '{heroi}', tentativa: 1, pratica: {{ diamantes: [] }}}})")
    avancar(pg, 600)

def morrer_e_voltar(pg):
    t = F(pg, "f.tentativa")
    F(pg, "(f.morrer(), 0)")
    esperar_ate(pg, f"f.tentativa === {t + 1} && p.vivo", 3000, 50)
    avancar(pg, 50)

def pratica(pg):
    iniciar_fase(pg, 'Hulk')
    pg.evaluate("localStorage.clear()")
    # Liga pela pausa
    pg.keyboard.press('Escape'); avancar(pg, 100)
    registrar('Prática: botão na pausa', pg.evaluate("document.getElementById('pausa-pratica').textContent.includes('Modo prática')"))
    pg.click('#pausa-pratica'); avancar(pg, 200)
    registrar('Prática: ligar continua a partida e mostra os botões ◆/✕', F(pg, "!!f.pratica && !f.pausado") and pg.evaluate("!document.getElementById('pratica-marcar').hidden && !document.getElementById('pratica-apagar').hidden"))
    registrar('Prática: HUD mostra PRÁTICA', F(pg, "f.hudTitulo.text.includes('PRÁTICA')"))
    # Z marca um diamante
    F(pg, "(MODO_TESTE.invencivel = true, p.body.reset(5000, 640), 0)"); avancar(pg, 300)
    pg.keyboard.press('z'); avancar(pg, 50)
    dx = F(pg, "f.pratica.diamantes.length ? f.pratica.diamantes[0].x : null")
    registrar('Prática: Z marca um diamante verde onde o jogador está', dx is not None and F(pg, "f.desenhoDiamantes.length === 1"), f"x={dx}")
    # Passa da bandeira: na prática não salva % no cartão
    esperar_ate(pg, "p.x > 5800", 3000, 50)
    registrar('Prática: bandeira não grava melhor % (não conta recorde)', pg.evaluate("!(JSON.parse(localStorage.getItem('tracoGeometrico.progresso') || '{}').Hulk || {}).melhorPct"))
    pg.evaluate("MODO_TESTE.invencivel = false")
    morrer_e_voltar(pg)
    registrar('Prática: morreu → reaparece no diamante (não na bandeira)', abs(F(pg, "p.x") - dx) < 80 and F(pg, "f.pratica.diamantes.length === 1 && f.desenhoDiamantes.length === 1"), f"x={F(pg, 'Math.round(p.x)')} diamante={dx}")
    shot(pg, 'r5_pratica')
    pg.keyboard.press('x'); avancar(pg, 50)
    registrar('Prática: X apaga o último diamante', F(pg, "f.pratica.diamantes.length === 0 && f.desenhoDiamantes.length === 0"))
    # Sair da prática recomeça do zero, partida normal
    pg.keyboard.press('Escape'); avancar(pg, 100)
    registrar('Prática: na pausa o botão vira "Sair da prática"', pg.evaluate("document.getElementById('pausa-pratica').textContent.includes('Sair')"))
    pg.click('#pausa-pratica'); avancar(pg, 400)
    registrar('Prática: sair recomeça do zero sem prática', F(pg, "!f.pratica && p.x < 600") and pg.evaluate("document.getElementById('pratica-marcar').hidden"))

def pratica_estado(pg):
    # Hulk: modo bola no teto
    comecar_pratica(pg, 'Hulk')
    F(pg, "(MODO_TESTE.invencivel = true, p.body.reset(17300, 640), 0)"); esperar_ate(pg, "p.modo === 'bola'", 2000, 20)
    F(pg, "(f.aoPressionar('teclado'), 0)"); esperar_ate(pg, "p.invertido && p.isOnGround()", 2000, 20)
    F(pg, "(f.marcarDiamante(), MODO_TESTE.invencivel = false, 0)"); morrer_e_voltar(pg)
    registrar('Prática: diamante guarda o modo bola e a gravidade invertida', F(pg, "p.modo === 'bola' && p.invertido"))
    # Wanda: realidade
    comecar_pratica(pg, 'Wanda')
    F(pg, "(MODO_TESTE.invencivel = true, f.aoAcao(), 0)"); avancar(pg, 200)
    real = F(pg, "f.realidade")
    F(pg, "(f.marcarDiamante(), MODO_TESTE.invencivel = false, 0)"); morrer_e_voltar(pg)
    registrar('Prática (Wanda): diamante guarda a realidade', F(pg, "f.realidade") == real and real == 'B', f"realidade={F(pg, 'f.realidade')}")
    # Gavião: porta aberta e flechas especiais continuam ao reaparecer
    comecar_pratica(pg, 'Gaviao')
    F(pg, "(MODO_TESTE.invencivel = true, f.acionar('p1'), f.municao.explosiva = 2, p.body.reset(1500, 640), 0)"); avancar(pg, 100)
    F(pg, "(f.marcarDiamante(), MODO_TESTE.invencivel = false, 0)"); morrer_e_voltar(pg)
    registrar('Prática (Gavião): porta já aberta e flechas especiais voltam com o diamante', F(pg, "f.porId['p1'][0].travas <= 0 && f.municao.explosiva === 2"))
    # Aranha: no ar não deixa marcar
    comecar_pratica(pg, 'Homem-Aranha')
    F(pg, "(p.body.reset(1600, 300), 0)"); avancar(pg, 30)
    registrar('Prática (Aranha): no ar não marca diamante', F(pg, "!f.marcarDiamante() && f.pratica.diamantes.length === 0"))
    # Doutor Estranho: dimensão
    comecar_pratica(pg, 'DrEstranho')
    instalar_bot(pg, BOTS['DrEstranho']); esperar_ate(pg, "f.dim === 'E' && p.isOnGround()", 10000, 20); remover_bot(pg)
    F(pg, "(f.marcarDiamante(), 0)"); morrer_e_voltar(pg)
    registrar('Prática (Estranho): diamante guarda a dimensão espelho', F(pg, "f.dim === 'E' && p.invertido"), f"dim={F(pg, 'f.dim')}")

def conclusoes(pg):
    # Hulk do checkpoint 4 até o fim, sem invencibilidade, com o piloto
    for heroi, idx in (('Hulk', 3), ('Gaviao', 3)):
        remover_bot(pg)
        pg.evaluate("MODO_TESTE.invencivel = false; MODO_TESTE.semAbertura = true")
        pg.evaluate(f"void (window.jogo.scene.getScene('Game').scene.isActive() ? window.jogo.scene.getScene('Game').scene.restart({{hero: '{heroi}', tentativa: 1, checkpoint: {{indice: {idx}, tempo: 0}}}}) : window.jogo.scene.getScene('Menu').scene.start('Game', {{hero: '{heroi}', tentativa: 1, checkpoint: {{indice: {idx}, tempo: 0}}}}))")
        avancar(pg, 600)
        instalar_bot(pg, BOTS[heroi])
        ok = esperar_ate(pg, "f.concluida", 60000, 200)
        registrar(f'{heroi}: trecho novo (do 4º checkpoint) concluído pelo piloto SEM invencibilidade', ok, f"mortes={pg.evaluate('window.__mortes')} tentativas={F(pg, 'f.tentativa')}")

if __name__ == '__main__':
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        for fn in (bola, ufo, pratica, pratica_estado, conclusoes):
            pg, erros = nova_pagina(nav)
            try: fn(pg)
            except Exception as e: registrar(f'{fn.__name__}: exceção', False, repr(e))
            registrar(f'{fn.__name__}: sem erros de console', not erros, '; '.join(erros[:3]))
            pg.close()
        nav.close()
    falhas = [r for r in resultados if not r[1]]
    print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} verificações da rodada 5 passaram")
    sys.exit(1 if falhas else 0)
