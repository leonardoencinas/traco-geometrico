# ================================================================
# teste_dificuldade.py — testa os obstáculos novos de Hulk, Wanda, Homem-Aranha e Doutor Estranho
# Uso: python3 tests/teste_dificuldade.py
# ================================================================
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from rodar_testes import nova_pagina, iniciar_fase, avancar, F, renderizar, registrar, resultados
from playwright.sync_api import sync_playwright

def tirar(pg, nome):
    # Screenshot renderizado
    renderizar(pg); pg.screenshot(path=f'tests/screenshots/{nome}.png')

def hulk(pg):
    iniciar_fase(pg, 'Hulk', True)
    # Bloco que cai: chega perto, ele despenca e vira parede no chão
    F(pg, "(p.body.reset(6250, 640), 0)"); avancar(pg, 900)
    b = "f.obstaculos.find(o => o instanceof BlocoQueda)"
    registrar('Hulk: concreto pendurado cai quando chega perto e vira parede', F(pg, f"{b}.estado === 'no chão' && f.podeColidir({b})"))
    # Sem fúria, cair em cima mata (invencibilidade desligada só agora)
    pg.evaluate("MODO_TESTE.invencivel = false")
    F(pg, f"(() => {{ const o = f.obstaculos.filter(o => o instanceof BlocoQueda)[1]; p.body.reset(o.forma.x, 640); o.estado = 'caindo'; o.forma.body.setVelocityY(600); }})()")
    avancar(pg, 500)
    registrar('Hulk: bloco caindo em cima do cubo sem fúria = morte', F(pg, "f.tentativa === 2 || !p.vivo"))
    avancar(pg, 800)
    # Com fúria, o bloco que cai estoura
    pg.evaluate("MODO_TESTE.invencivel = true")
    F(pg, "(p.body.reset(7150, 640), f.habilidade.ultimoUso = -Infinity, f.aoAcao(), 0)"); avancar(pg, 900)
    registrar('Hulk: com fúria o bloco que cai estoura (não mata)', F(pg, "p.vivo && !f.obstaculos.some(o => o instanceof BlocoQueda && o.forma.x > 7300 && o.forma.x < 7450)"))
    # Poça tóxica mata mesmo com fúria (é mortal e não é quebrável)
    registrar('Hulk: poça tóxica não quebra nem com fúria', F(pg, "(() => { const o = f.obstaculos.find(o => o instanceof PocaToxica); return o.categoria === 'mortal' && !(o instanceof Quebravel); })()"))
    # Plataforma instável desmorona depois de pisar
    F(pg, "(p.body.reset(8500, 540), 0)"); avancar(pg, 150)
    pis = F(pg, "(() => { const o = f.obstaculos.find(o => o instanceof PlataformaFragil); return o && o.timer !== null; })()")
    tirar(pg, 'dif_hulk_ponte')
    avancar(pg, 700)
    registrar('Hulk: plataforma instável começa a tremer ao pisar e desmorona', pis and F(pg, "f.obstaculos.filter(o => o instanceof PlataformaFragil).length < 6"))

def wanda(pg):
    iniciar_fase(pg, 'Wanda', True)
    port = "f.elementos.find(e => e instanceof PortaoCaos)"
    F(pg, "(p.body.reset(5000, 640), 0)"); avancar(pg, 200)
    baixo = F(pg, f"f.realidade === 'A' && Math.abs({port}.forma.y - {port}.yBaixo) < 1")
    F(pg, "(f.habilidade.ultimoUso = -Infinity, f.aoAcao(), 0)"); avancar(pg, 100)
    registrar('Wanda: portão desce na realidade dele e sobe na outra', baixo and F(pg, f"f.realidade === 'B' && Math.abs({port}.forma.y - {port}.yAlto) < 1"))
    tirar(pg, 'dif_wanda_portao')
    # Portão não desce em cima do cubo: espera ele sair
    F(pg, f"(p.body.reset({port}.forma.x, 640), f.habilidade.ultimoUso = -Infinity, f.aoAcao(), 0)"); avancar(pg, 50)
    pend = F(pg, f"{port}.pendente && Math.abs({port}.forma.y - {port}.yAlto) < 1")
    avancar(pg, 500)
    registrar('Wanda: portão espera o cubo passar antes de descer', pend and F(pg, f"!{port}.pendente && Math.abs({port}.forma.y - {port}.yBaixo) < 1"))
    # Campo de caos: mortal só na realidade dele
    campo = "f.elementos.find(e => e.tipo === 'campo')"
    registrar('Wanda: campo de caos só tem física na realidade dele', F(pg, f"{campo}.forma.body.enable === ({campo}.real === f.realidade)"))
    # Plataforma temporária: some depois do tempo e volta trocando de realidade 2x
    t = "f.elementos.find(e => e instanceof PlataformaTemporaria)"
    F(pg, f"(p.body.reset({t}.forma.x - 200, 640), f.realidade = {t}.real === 'A' ? 'B' : 'A', f.aplicarRealidade(false), f.habilidade.ultimoUso = -Infinity, f.aoAcao(), 0)")
    contou = F(pg, f"{t}.restante !== null && {t}.forma.body.enable")
    avancar(pg, 1500)
    gasta = F(pg, f"{t}.gasta && !{t}.forma.body.enable")
    F(pg, "(f.habilidade.ultimoUso = -Infinity, f.aoAcao(), f.habilidade.ultimoUso = -Infinity, f.aoAcao(), 0)"); avancar(pg, 50)
    registrar('Wanda: plataforma ⌛ conta, apaga e volta ao trocar de realidade', contou and gasta and F(pg, f"!{t}.gasta && {t}.forma.body.enable"))

def aranha(pg):
    iniciar_fase(pg, 'Homem-Aranha', True)
    x0 = F(pg, "f.ancoras.filter(a => a instanceof AncoraMovel).map(a => a.forma.x)")
    # 400 ms (e não 700): o gancho faz vai-e-vem e 700 ms podia cair em pontos simétricos do seno (mesma posição)
    avancar(pg, 400)
    x1 = F(pg, "f.ancoras.filter(a => a instanceof AncoraMovel).map(a => a.forma.x)")
    registrar('Aranha: 4 ganchos de guindaste andando no trilho', len(x0) == 4 and all(abs(a - b) > 1 for a, b in zip(x0, x1)), f"{x0} → {x1}")
    registrar('Aranha: letreiros estreitos no meio dos vãos (rota de recuperação)', F(pg, "f.segmentosChao().filter(s => s[1] - s[0] <= 160).length === 2"))
    # Balanço num guindaste: a teia acompanha o gancho
    F(pg, "(() => { const a = f.ancoras.find(a => a instanceof AncoraMovel); p.body.reset(a.forma.x - 250, 420); f.prender(a); })()")
    avancar(pg, 300)
    tirar(pg, 'dif_aranha_guindaste')
    registrar('Aranha: dá pra balançar num gancho móvel (cubo na ponta da corda)', F(pg, "!!f.balanco && Math.abs(Math.hypot(p.x - f.balanco.ancora.forma.x, p.y - f.balanco.ancora.forma.y) - f.balanco.L) < 3"))

def estranho(pg):
    iniciar_fase(pg, 'DrEstranho', True)
    z = "f.zonas_[0]"
    F(pg, f"(p.body.reset({z}.x0 + 10, 640), 0)"); avancar(pg, 50)
    cedo = F(pg, "f.portalLivreValido(f.pontosPortalLivre())")
    abriu_cedo = F(pg, "f.abrirPortal()")
    registrar('Estranho: portal livre recusa saída dentro da muralha (marcador vermelho)', (not cedo) and (not abriu_cedo) and F(pg, "!f.portalLivre"))
    F(pg, "(p.body.reset(6080, 640), 0)"); avancar(pg, 30)
    tirar(pg, 'dif_estranho_zona')
    ok = F(pg, "f.portalLivreValido(f.pontosPortalLivre()) && f.abrirPortal()")
    avancar(pg, 400)
    registrar('Estranho: na hora certa abre e atravessa pra depois da muralha', ok and F(pg, "p.x > 6560 && !f.portalLivre"))
    registrar('Estranho: 2 zonas de portal livre com muralhas', F(pg, "f.zonas_.length === 2"))

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    for fn in (hulk, wanda, aranha, estranho):
        pg, erros = nova_pagina(nav)
        try: fn(pg)
        except Exception as e: registrar(f'{fn.__name__}: exceção', False, repr(e))
        registrar(f'{fn.__name__}: sem erros de console', not erros, '; '.join(erros[:3]))
        pg.close()
    nav.close()
falhas = [r for r in resultados if not r[1]]
print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} verificações de dificuldade passaram")
