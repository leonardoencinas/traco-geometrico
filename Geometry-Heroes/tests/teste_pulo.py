# ================================================================
# teste_pulo.py — mede a resposta do pulo (entrada → cubo saindo do chão), quadro a quadro.
# Usa eventos REAIS do navegador (teclado e mouse do Playwright), não chama os ganchos direto.
# Uso: python3 tests/teste_pulo.py            (mostra a tabela de latência e confere tudo)
#      python3 tests/teste_pulo.py Hulk Wanda (só essas fases na tabela de latência)
# ================================================================
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from rodar_testes import nova_pagina, iniciar_fase, F, registrar, resultados
from playwright.sync_api import sync_playwright

FPS = (30, 60, 144)
FASES = ['Hulk', 'Gaviao', 'Wanda', 'DrEstranho', 'Homem-Aranha']
# Ponto de clique que vira pulo em todas as fases (terço esquerdo da tela, longe do HUD)
CLIQUE = (150, 600)

def quadros(pg, n, fps):
    """Avança n quadros do jogo a `fps` quadros por segundo."""
    pg.evaluate("""([n, dt]) => { for (let i = 0; i < n; i++) { window.__relogio += dt; window.jogo.headlessStep(window.__relogio, dt); } }""", [n, 1000 / fps])

def apertar(pg, fonte):
    if fonte == 'tecla': pg.keyboard.down('Space')
    else: pg.mouse.move(*CLIQUE); pg.mouse.down()

def soltar(pg, fonte):
    if fonte == 'tecla': pg.keyboard.up('Space')
    else: pg.mouse.up()

def preparar(pg, inicio, fps):
    """Volta o cubo pro ponto de partida (modo cubo, gravidade normal) e espera ele assentar no chão."""
    F(pg, f"(p.body.reset({inicio[0]}, {inicio[1]}), p.body.setVelocity(0, 0), p.invertido && p.inverterGravidade(false), p.definirModo('cubo'), f.balanco = null, 0)")
    for _ in range(int(fps * 1.5)):
        quadros(pg, 1, fps)
        if F(pg, "p.isOnGround() && p.body.velocity.y === 0"): break
    quadros(pg, max(2, fps // 10), fps)
    return F(pg, "p.isOnGround()")

def contar_ate_subir(pg, fps, y0, limite=40):
    """(quadros, passos de física) até o cubo sair do lugar pra cima (≥ 0,5 px). (None, None) se não subiu.
    A física do Phaser anda em passos fixos de 60 Hz: a 144 fps nem todo quadro tem passo, então o ideal
    é o cubo subir já no PRIMEIRO passo de física depois da entrada."""
    # Conta os passos de física pelo evento 'worldstep' do Phaser (instalado uma vez por cena)
    F(pg, "(p.scene.__contaPassos || (p.scene.__contaPassos = true, p.scene.physics.world.on('worldstep', () => window.__passos = (window.__passos || 0) + 1)), 0)")
    p0 = pg.evaluate("window.__passos || 0")
    for i in range(1, limite + 1):
        quadros(pg, 1, fps)
        if y0 - F(pg, "p.y") >= 0.5: return i, pg.evaluate("window.__passos || 0") - p0
    return None, None

def latencia(pg, inicio, fonte, fps, cenario):
    """Quadros entre o evento (tecla/clique) e o cubo começar a subir."""
    if not preparar(pg, inicio, fps): return None, 'não assentou'
    if cenario == 'pouso':
        # Cai de 70 px e aperta no PRIMEIRO quadro em que encosta (logo após pousar)
        F(pg, "(p.body.reset(p.x, p.y - 70), p.body.setVelocity(0, 0), 0)")
        quadros(pg, 1, fps)
        for _ in range(fps):
            quadros(pg, 1, fps)
            if F(pg, "p.isOnGround()"): break
    y0 = F(pg, "p.y")
    apertar(pg, fonte)
    q, passos = contar_ate_subir(pg, fps, y0)
    soltar(pg, fonte)
    quadros(pg, fps, fps)
    return (q, passos), ''

def buffer(pg, inicio, fps, antecedencia):
    """Aperta `antecedencia` ms antes de pousar. Devolve (pulou_ao_pousar, quadros_parado_no_chao)."""
    preparar(pg, inicio, fps)
    chao = F(pg, "p.y")
    F(pg, "(p.body.reset(p.x, p.y - 150), p.body.setVelocity(0, 0), 0)")
    g = F(pg, "MOVIMENTO.gravidade")
    for _ in range(fps * 2):
        quadros(pg, 1, fps)
        y, vy = F(pg, "[p.y, p.body.velocity.y]")
        d = chao - y
        if vy > 0 and d > 0 and ((-vy + (vy * vy + 2 * g * d) ** 0.5) / g) * 1000 <= antecedencia: break
    pg.keyboard.down('Space'); quadros(pg, 1, fps); pg.keyboard.up('Space')
    # Espera encostar
    for _ in range(fps):
        if F(pg, "p.isOnGround()"): break
        quadros(pg, 1, fps)
    # Conta quadros no chão até subir (ou desiste em 0,4 s)
    parado = 0
    for _ in range(int(fps * 0.4)):
        if F(pg, "p.body.velocity.y < -300"): return True, parado
        parado += 1
        quadros(pg, 1, fps)
    return F(pg, "p.body.velocity.y < -300"), parado

def coyote(pg, inicio, fps, atraso):
    """Sai da beirada de uma plataforma e aperta `atraso` ms depois. Devolve True se pulou."""
    preparar(pg, inicio, fps)
    # Plataforma temporária no ar, à frente do cubo (some no fim)
    F(pg, """(() => { const c = p.scene; const X = p.x + 400;
        const r = c.add.rectangle(X, 400, 200, 40, 0x888888); c.physics.add.existing(r, true);
        window.__plat = r; window.__col = c.physics.add.collider(p, r);
        p.body.reset(X - 60, 360); p.body.setVelocity(0, 0); return 0; })()""")
    for _ in range(fps):
        quadros(pg, 1, fps)
        if F(pg, "p.isOnGround()"): break
    # Corre até sair da beirada (guarda a hora do último quadro com os pés na plataforma)
    t_chao = F(pg, "p.scene.time.now")
    for _ in range(fps * 2):
        quadros(pg, 1, fps)
        if not F(pg, "p.isOnGround()"): break
        t_chao = F(pg, "p.scene.time.now")
    # Aperta de modo que o jogo processe a tecla no 1º quadro com ≥ `atraso` ms desde o último chão
    dt = 1000 / fps
    while F(pg, "p.scene.time.now") + dt - t_chao < atraso - 0.01: quadros(pg, 1, fps)
    vy_antes = F(pg, "p.body.velocity.y")
    real = F(pg, "p.scene.time.now") + dt - t_chao
    pg.keyboard.down('Space'); quadros(pg, 2, fps); pg.keyboard.up('Space')
    pulou = F(pg, "p.body.velocity.y") < -300 and vy_antes >= 0
    F(pg, "(window.__col.destroy(), window.__plat.destroy(), 0)")
    quadros(pg, fps, fps)
    return pulou, round(real, 1)

def latencia_bloco(pg, inicio, fps):
    """Pulo em cima de um bloco sólido (corpo estático, como os blocos/plataformas das fases): quadros até subir."""
    preparar(pg, inicio, fps)
    F(pg, """(() => { const c = p.scene; const X = p.x + 400;
        const r = c.add.rectangle(X, 400, 400, 40, 0x888888); c.physics.add.existing(r, true);
        window.__plat = r; window.__col = c.physics.add.collider(p, r);
        p.body.reset(X - 160, 360); p.body.setVelocity(0, 0); return 0; })()""")
    for _ in range(fps):
        quadros(pg, 1, fps)
        if F(pg, "p.isOnGround()"): break
    quadros(pg, 2, fps)
    y0 = F(pg, "p.y")
    pg.keyboard.down('Space')
    q, passos = contar_ate_subir(pg, fps, y0)
    pg.keyboard.up('Space')
    F(pg, "(window.__col.destroy(), window.__plat.destroy(), 0)")
    quadros(pg, fps, fps)
    return q, passos

def pulos_em(pg, fps, ms, segurar):
    """Aperta uma vez (ou segura) e conta quantos pulos começaram em `ms`."""
    pg.keyboard.down('Space')
    n, subindo = 0, False
    for i in range(int(ms * fps / 1000)):
        quadros(pg, 1, fps)
        if not segurar and i == 0: pg.keyboard.up('Space')
        vy = F(pg, "p.body.velocity.y")
        if vy < -500 and not subindo: n += 1
        subindo = vy < -100
    if segurar: pg.keyboard.up('Space')
    return n

def arco(pg, inicio, fps):
    """Altura máxima (px) e tempo no ar (ms) de um pulo com um aperto."""
    preparar(pg, inicio, fps)
    y0 = F(pg, "p.y")
    pg.keyboard.down('Space'); quadros(pg, 1, fps); pg.keyboard.up('Space')
    topo, t0, saiu = y0, F(pg, "p.scene.time.now"), False
    for _ in range(fps * 2):
        quadros(pg, 1, fps)
        y, chao = F(pg, "[p.y, p.isOnGround()]")
        topo = min(topo, y)
        if y < y0 - 1: saiu = True
        if saiu and chao: break
    return round(y0 - topo, 1), round(F(pg, "p.scene.time.now") - t0, 1)

def main():
    fases = [a for a in sys.argv[1:] if not a.startswith('-')] or FASES
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        # 1) Latência em cada fase de corrida, por fonte de entrada, cenário e FPS
        piores = {}
        for heroi in fases:
            pg, erros = nova_pagina(nav)
            iniciar_fase(pg, heroi, True)
            inicio = F(pg, "[Math.round(p.x), Math.round(p.y)]")
            linhas = []
            for fps in FPS:
                for fonte in ('tecla', 'ponteiro'):
                    for cen in ('chao', 'pouso'):
                        r, obs = latencia(pg, inicio, fonte, fps, cen)
                        q, passos = r if r else (None, None)
                        linhas.append(f"{fps:>3} fps {fonte:<8} {cen:<5} → " + (f"{q} quadro(s) = {q * 1000 / fps:5.1f} ms, {passos} passo(s) de física" if q else f"NÃO PULOU {obs}"))
                        # Ideal: o cubo sobe no 1º quadro (até 60 fps) / no 1º passo de física (acima de 60 fps,
                        # onde nem todo quadro tem passo). Guarda o pior atraso em "unidades mínimas" (1 = ideal).
                        atraso = (q if fps <= 60 else passos) if q else 99
                        piores[(heroi, fps)] = max(piores.get((heroi, fps), 0), atraso)
            print(f"\n[{heroi}] latência entrada → cubo subindo"); print('\n'.join('   ' + l for l in linhas), flush=True)
            for fps in FPS:
                unidade = 'quadro(s)' if fps <= 60 else 'passo(s) de física'
                registrar(f'{heroi}: pulo sai no 1º {"quadro" if fps <= 60 else "passo de física"} depois da entrada a {fps} fps (tecla/clique, chão/pouso)', piores[(heroi, fps)] == 1, f"pior caso = {piores[(heroi, fps)]} {unidade}")
            registrar(f'{heroi}: sem erros de console', not erros, '; '.join(erros[:3]))
            pg.close()

        # 2) Buffer, coyote, pulo único e consistência entre FPS (no Hulk: chão liso no início)
        pg, erros = nova_pagina(nav)
        iniciar_fase(pg, 'Hulk', True)
        inicio = F(pg, "[Math.round(p.x), Math.round(p.y)]")
        buf = F(pg, "MOVIMENTO.jumpBuffer"); coy = F(pg, "MOVIMENTO.coyoteTime")
        for fps in FPS:
            ok, parado = buffer(pg, inicio, fps, 60)
            registrar(f'Buffer {fps} fps: apertou 60 ms antes de pousar → pula assim que encosta', ok and parado <= 1, f"quadros parado no chão = {parado}")
            q, passos = latencia_bloco(pg, inicio, fps)
            registrar(f'Bloco {fps} fps: pulo em cima de bloco sai no 1º {"quadro" if fps <= 60 else "passo de física"}', (q if fps <= 60 else passos) == 1, f"{q} quadro(s), {passos} passo(s)")
            ok2, _ = buffer(pg, inicio, fps, buf + 90)
            registrar(f'Buffer {fps} fps: apertou {buf + 90} ms antes (fora da janela de {buf} ms) → não pula sozinho', not ok2)
            ok, real = coyote(pg, inicio, fps, 50)
            registrar(f'Coyote {fps} fps: ~50 ms depois de sair da beirada ainda pula', ok, f"aperto processado {real} ms após o último chão")
            ok, real = coyote(pg, inicio, fps, coy + 60)
            registrar(f'Coyote {fps} fps: {coy + 60} ms depois (fora da janela de {coy} ms) → não pula', not ok, f"{real} ms")
            preparar(pg, inicio, fps)
            registrar(f'Pulo único {fps} fps: um aperto = um pulo (sem pulo duplo)', pulos_em(pg, fps, 1400, False) == 1)
            preparar(pg, inicio, fps)
            n = pulos_em(pg, fps, 1400, True)
            registrar(f'Segurar {fps} fps: segurando continua pulando ao pousar (como antes)', n >= 2, f"{n} pulos em 1,4 s")
        arcos = {fps: arco(pg, inicio, fps) for fps in FPS}
        print('\nArco do pulo por FPS (altura px, tempo no ar ms):', arcos)
        alturas = [a[0] for a in arcos.values()]; tempos = [a[1] for a in arcos.values()]
        registrar('Consistência 30/60/144 fps: mesma altura do pulo (±3 px)', max(alturas) - min(alturas) <= 3, str(alturas))
        registrar('Consistência 30/60/144 fps: mesmo tempo no ar (± 1 passo de física, 17 ms)', max(tempos) - min(tempos) <= 17, str(tempos))
        registrar('Hulk (buffer/coyote): sem erros de console', not erros, '; '.join(erros[:3]))
        pg.close()

        # 3) Ferro (voo): o clique NÃO vira pulo de corrida (o voo continua sendo da fase)
        pg, erros = nova_pagina(nav)
        iniciar_fase(pg, 'Homem de Ferro', True)
        quadros(pg, 30, 60)
        vy0 = F(pg, "p.body.velocity.y")
        pg.mouse.move(*CLIQUE); pg.mouse.down()
        vy1 = F(pg, "p.body.velocity.y")
        quadros(pg, 20, 60)
        subiu = F(pg, "p.body.velocity.y") < 0
        pg.mouse.up()
        registrar('Ferro: clicar não dá pulo de corrida (voo segue com empuxo)', vy1 == vy0 and vy1 != -F(pg, "p.forcaPulo") and subiu, f"vy {vy0}→{vy1}")
        registrar('Ferro: sem erros de console', not erros, '; '.join(erros[:3]))
        pg.close()
        nav.close()
    falhas = [r for r in resultados if not r[1]]
    print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} verificações de pulo passaram")
    for f in falhas: print('  FALHOU:', f[0], f[2])
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
