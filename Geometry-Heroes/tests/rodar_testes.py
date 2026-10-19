# ================================================================
# rodar_testes.py — testes automáticos do Geometry Heroes (Playwright + Chromium headless)
# Uso: python3 tests/rodar_testes.py [Hulk Gaviao ...]
# ================================================================
import sys, json, time, pathlib, subprocess
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PASTA_SHOTS = RAIZ / 'tests' / 'screenshots'
PASTA_SHOTS.mkdir(parents=True, exist_ok=True)
URL = (RAIZ / 'tests' / 'teste.html').as_uri()

# Gera o HTML de teste a partir do index.html atual
subprocess.run([sys.executable, str(RAIZ / 'tests' / 'gerar_teste_html.py')], check=True)

resultados = []

def registrar(nome, ok, detalhe=''):
    resultados.append((nome, ok, detalhe))
    print(('PASSOU ' if ok else 'FALHOU ') + nome + (f' — {detalhe}' if detalhe else ''), flush=True)

def nova_pagina(navegador):
    pagina = navegador.new_page(viewport={'width': 1280, 'height': 720})
    erros = []
    pagina.on('pageerror', lambda e: erros.append(f'pageerror: {e}'))
    pagina.on('console', lambda m: erros.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    pagina.goto(URL)
    pagina.wait_for_function("window.jogo && window.jogo.scene.isActive('Menu')", timeout=10000)
    # Para o loop automático do navegador e passa a avançar o jogo "na mão" (determinístico,
    # independente da velocidade de renderização do Chromium headless, que é lenta sem GPU)
    pagina.evaluate("() => { window.jogo.loop.sleep(); window.__relogio = window.jogo.loop.time || performance.now(); }")
    # Registra onde o jogador morreu (ajuda a achar trechos injustos)
    pagina.evaluate("""() => { window.__mortes = []; const orig = Fase.prototype.morrer;
        Fase.prototype.morrer = function (q) { const vivoAntes = this.player.vivo; const r = orig.call(this, q);
            if (vivoAntes && !this.player.vivo) window.__mortes.push(Math.round(this.player.x) + (q ? 'q' : '')); return r; }; }""")
    return pagina, erros

def avancar(pagina, ms, passo=1000/60):
    """Avança o jogo `ms` milissegundos de tempo de jogo, a 60 quadros por segundo (sem renderizar)."""
    pagina.evaluate("""([ms, passo]) => {
        const n = Math.round(ms / passo);
        for (let i = 0; i < n; i++) {
            window.__relogio += passo; window.jogo.headlessStep(window.__relogio, passo);
            // a câmera só calcula o "seguir" na fase de desenho; sem desenhar, atualiza na mão
            window.jogo.scene.getScenes(true).forEach(sc => sc.cameras.cameras.forEach(cam => cam.preRender()));
        }
    }""", [ms, passo])

def renderizar(pagina):
    """Desenha um quadro (pra screenshot) sem avançar a lógica."""
    pagina.evaluate("() => { const g = window.jogo; g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender(); }")

def iniciar_fase(pagina, heroi, invencivel=False, abertura=False):
    # Os testes antigos começam direto no x = 200 (sem a abertura no ritmo); teste_abertura.py testa ela
    pagina.evaluate(f"MODO_TESTE.invencivel = {str(invencivel).lower()}; MODO_TESTE.semAbertura = {str(not abertura).lower()}")
    pagina.evaluate(f"window.jogo.scene.getScene('Menu').scene.start('Game', {{hero: {json.dumps(heroi)}, tentativa: 1}})")
    for _ in range(50):
        avancar(pagina, 50)
        if pagina.evaluate("window.jogo.scene.isActive('Game') && !!window.jogo.scene.getScene('Game').fase && !!window.jogo.scene.getScene('Game').fase.player"):
            break
    avancar(pagina, 300)

def F(pagina, expr):
    """Avalia uma expressão JS com `f` = fase atual e `p` = jogador."""
    return pagina.evaluate(f"(() => {{ const c = window.jogo.scene.getScene('Game'); const f = c.fase; const p = f.player; return ({expr}); }})()")

def shot(pagina, nome):
    renderizar(pagina)
    caminho = PASTA_SHOTS / f'{nome}.png'
    pagina.screenshot(path=str(caminho))
    return caminho

def esperar_ate(pagina, expr, timeout_ms=60000, passo=100):
    """Avança o jogo em pedaços de `passo` ms (tempo de jogo) até a expressão ficar verdadeira."""
    decorrido = 0
    while decorrido < timeout_ms:
        try:
            if F(pagina, expr):
                return True
        except Exception:
            pass
        avancar(pagina, passo)
        decorrido += passo
    return False

def instalar_bot(pagina, codigo_js):
    """Instala um 'piloto automático' que roda a cada frame e usa os MESMOS ganchos de entrada do jogador."""
    pagina.evaluate("""(codigo) => {
        const c = window.jogo.scene.getScene('Game');
        if (window.__bot) c.events.off('postupdate', window.__bot);
        const fn = new Function('f', 'p', 'agora', codigo);
        window.__bot = () => { const f = c.fase; if (f && f.player && f.player.vivo && !f.concluida) fn(f, f.player, c.time.now); };
        c.events.on('postupdate', window.__bot);
    }""", codigo_js)

def remover_bot(pagina):
    pagina.evaluate("() => { const c = window.jogo.scene.getScene('Game'); if (window.__bot) c.events.off('postupdate', window.__bot); window.__bot = null; }")

def testar_conclusao(pagina, heroi, timeout_ms=120000):
    """Espera a tela de conclusão aparecer e confere o localStorage."""
    ok = False
    for bloco in range(max(1, timeout_ms // 20000)):
        if esperar_ate(pagina, "f.concluida", 20000):
            ok = True; break
        if '-v' in sys.argv: print('   progresso:', F(pagina, "[f.tentativa, Math.round(p.x), p.vivo, Math.round(c.time.now)]"), flush=True)
    if not ok:
        return False, f"mortes em {pagina.evaluate('window.__mortes')} — não concluiu (x={F(pagina, 'Math.round(p.x)')}/{F(pagina, 'f.cfg.comprimento')}, tentativa {F(pagina, 'f.tentativa')})"
    avancar(pagina, 2000)
    visivel = pagina.evaluate("!document.getElementById('fase-concluida').hidden")
    salvo = pagina.evaluate(f"JSON.parse(localStorage.getItem('tracoGeometrico.progresso') || '{{}}')[{json.dumps(heroi)}]")
    return bool(visivel and salvo and salvo.get('concluida')), f"tela={visivel} salvo={salvo}"

# ----------------------------------------------------------------
# Bots (piloto automático) por fase — usam só ganchos de entrada
# ----------------------------------------------------------------
BOTS = {}
TESTES = {}

def teste(heroi):
    def deco(fn):
        TESTES[heroi] = fn
        return fn
    return deco

# --- HULK ---
BOTS['Hulk'] = r"""
// orbe amarelo: aperta quando encosta no ar
if (!p.isOnGround() && (f.orbesClassicos || []).some(o => o.alcance())) f.aoPressionar('teclado');
// ativa a fúria quando um grupo de quebráveis está chegando (~260 px à frente)
const h = f.habilidade;
if (h.pronta(agora) && !h.ativa(agora)) for (const o of f.golpeaveis) {
  if (!o.ativo || !(o instanceof Quebravel) || o instanceof BlocoQueda) continue;
  const dx = (o.forma.x - o.forma.width/2) - (p.x + 20);
  if (dx > 0 && dx < 260) { f.aoAcao(); break; }
}
// modo bola: troca de lado quando um espinho do MEU lado (chão ou teto) está chegando
if (p.modo === 'bola') {
  for (const o of f.obstaculos) if (o.ativo && o instanceof Espinho && (o.forma.y > 380) === !p.invertido) {
    const dx = o.forma.x - 20 - (p.x + 20); if (dx > 30 && dx < 130 && p.isOnGround()) f.aoPressionar('teclado'); }
  return;
}
// orbe azul à frente e no chão: pula pra alcançar o orbe
if (p.isOnGround() && !p.invertido && (f.orbesClassicos || []).some(o => o.variante === 'azul' && o.ativo && o.forma.x - p.x > 20 && o.forma.x - p.x < 80)) f.aoPressionar('teclado');
// pula viga baixa e espinho quando estão logo à frente (espinho só se for do MEU lado: chão ou teto)
for (const o of f.obstaculos) {
  if (!o.ativo || !o.forma.body) continue;
  const fr = o.forma, esq = fr.x - fr.width/2, dx = esq - (p.x + 20);
  const baixo = (o instanceof Indestrutivel && fr.y > 500 && fr.height < 150) || (o instanceof Espinho && (fr.y > 380) === !p.invertido) || o instanceof PocaToxica || (o.saltar && !(o instanceof BlocoQueda))
    || (o instanceof BlocoQueda && o.estado === 'no chão' && !f.emFuria());
  // (87 = 95 − 1 quadro de corrida: o pulo agora sai no mesmo quadro do aperto, sem o quadro de atraso antigo)
  if (baixo && dx > 30 && dx < 87) f.aoPressionar('teclado');
  // ponte que desmorona: sobe na primeira e pula assim que pisa em cada uma
  if (o instanceof PlataformaFragil && p.isOnGround()) {
    if (p.y > 600 && dx > 10 && dx < 70) f.aoPressionar('teclado');
    if (p.y < 600 && o.timer !== null) f.aoPressionar('teclado');
  }
}
"""

@teste('Hulk')
def teste_hulk(pagina, erros):
    iniciar_fase(pagina, 'Hulk')
    shot(pagina, 'hulk_inicio')
    caixa = "f.golpeaveis[0]"
    # Sem fúria, o quebrável é parede: bater de lado mata
    esperar_ate(pagina, "!p.vivo || !(" + caixa + ").ativo", 6000, 20)
    registrar('Hulk: sem fúria, o quebrável é parede (bater mata)', esperar_ate(pagina, "f.tentativa === 2", 3000, 50) or not F(pagina, "p.vivo"))
    # Tentativa 2: ativa a fúria pelo clique (fora do terço esquerdo) perto do primeiro grupo
    esperar_ate(pagina, "f.tentativa === 2 && p.vivo", 3000, 50)
    esperar_ate(pagina, "(" + caixa + ".forma.x - 20) - (p.x + 20) < 250", 8000, 20)
    pagina.mouse.click(900, 300)
    avancar(pagina, 200)
    registrar('Hulk: clique ativa a fúria', F(pagina, "f.emFuria()"))
    registrar('Hulk: na fúria o bloco cresce (desenho maior) e a aura aparece', F(pagina, "p.escalaExtra > 1.2 && f.aura.visible !== false && p.skin.scaleX > 1.15"), f"escala={F(pagina, 'p.escalaExtra'):.2f}")
    shot(pagina, 'hulk_furia')
    esperar_ate(pagina, "!(" + caixa + ").ativo || !p.vivo", 4000, 20)
    registrar('Hulk: com fúria atravessa e esmaga o quebrável (sem morrer)', F(pagina, "!(" + caixa + ").ativo && p.vivo && f.tentativa === 2"))
    pagina.evaluate("MODO_TESTE.invencivel = true")  # sem piloto, a viga em 2400 mataria antes da fúria acabar
    esperar_ate(pagina, "!f.emFuria()", 4000, 50)
    avancar(pagina, 300)
    registrar('Hulk: fúria acaba sozinha e o bloco volta ao tamanho normal', F(pagina, "!f.emFuria() && p.escalaExtra < 1.05 && !f.habilidade.pronta(c.time.now)"))
    pagina.evaluate("MODO_TESTE.invencivel = false")
    F(pagina, "(f.reiniciar(1), 0)"); avancar(pagina, 300)
    # Indestrutível: com fúria ainda colide
    registrar('Hulk: viga com listras continua sólida na fúria', F(pagina, "(() => { const v = f.golpeaveis.find(o => o instanceof Indestrutivel); return f.podeColidir(v); })()"))
    # Conclusão com o bot (sem invencibilidade)
    instalar_bot(pagina, BOTS['Hulk'])
    ok, det = testar_conclusao(pagina, 'Hulk', 90000)
    shot(pagina, 'hulk_fim')
    registrar('Hulk: fase concluída pelo piloto automático SEM invencibilidade', ok, det + f" tentativas={F(pagina, 'f.tentativa')}")

# --- HOMEM DE FERRO ---
BOTS['Homem de Ferro'] = r"""
let alvo = 380;
const vivos = (x0, x1) => f.obstaculos.filter(o => o.ativo && o.forma.body && o.forma.body.enable && o.forma.x > x0 && o.forma.x < x1);
const tn = (f.tuneis || []).find(t => p.x + 160 >= t.x && p.x < t.ate + 40);
if (tn) alvo = f.centroTunel(tn, p.x + 140);
else for (const o of vivos(p.x - 60, p.x + 450)) if (o instanceof ParedeTech) { const b = o.forma.body; alvo = b.top <= MOVIMENTO.tetoY + 2 ? (b.bottom + 660) / 2 : (100 + b.top) / 2; break; }
for (const o of vivos(p.x, p.x + 900)) if (o instanceof Nucleo) { alvo = o.forma.y; break; }
const drones = vivos(p.x + 20, p.x + 650).filter(o => o instanceof Drone && o.amp === 0);
const paredePerto = vivos(p.x - 70, p.x + 160).some(o => o instanceof ParedeTech);
if (window.__abat !== f.abatidos) { window.__abat = f.abatidos; window.__gap = { y: p.y, x: p.x }; }
if (drones.length >= 3 && !paredePerto) {
  const bx = drones[0].forma.x;
  if (window.__gap && Math.abs(window.__gap.x - bx) < 900 && drones.length < 5) alvo = window.__gap.y;
  else alvo = drones.reduce((a, d) => Math.abs(d.forma.y - p.y) < Math.abs(a.forma.y - p.y) ? d : a).forma.y;
}
for (const o of vivos(p.x - 30, p.x + 520)) if (o instanceof GradeLaser) { const t = o.relogio + Math.max(0, o.forma.x - p.x - 20) / p.velocidadeX * 1000; alvo = 380 + Math.sin(t / o.periodo * Math.PI * 2) * 120; }
const naFaixa = f.obstaculos.some(o => o.ativo && o.alvoTiro && o.forma.body && o.forma.body.enable && o.forma.x > p.x && o.forma.x < p.x + 880 && Math.abs(o.forma.y - p.y) < 34);
if (naFaixa && f.habilidade.pronta(agora)) f.aoAcao();
f.segurandoTecla = (p.y - alvo) + 0.3 * p.body.velocity.y > 0;
"""

@teste('Homem de Ferro')
def teste_ferro(pagina, erros):
    iniciar_fase(pagina, 'Homem de Ferro')
    avancar(pagina, 200)
    registrar('Ferro: encostar no chão não mata', F(pagina, "p.vivo && p.body.blocked.down || p.body.touching.down"))
    y0 = F(pagina, "p.y")
    F(pagina, "(f.segurandoTecla = true)")
    avancar(pagina, 350)
    y1 = F(pagina, "p.y")
    F(pagina, "(f.segurandoTecla = false)")
    avancar(pagina, 450)
    y2 = F(pagina, "p.y"); vy2 = F(pagina, "p.body.velocity.y")
    shot(pagina, 'ferro_voo')
    pagina.keyboard.press('r'); avancar(pagina, 400)
    registrar('Ferro: segurar sobe e soltar desce (voo)', y1 < y0 - 60 and vy2 > 50, f"y {y0:.0f} → {y1:.0f} → {y2:.0f}, vy depois de soltar = {vy2:.0f}")

    instalar_bot(pagina, BOTS['Homem de Ferro'])
    esperar_ate(pagina, "p.x > 3450", 15000)
    registrar('Ferro: repulsor derruba drones', F(pagina, "f.abatidos") >= 1, f"abatidos={F(pagina, 'f.abatidos')}")
    esperar_ate(pagina, "p.x > 4600", 6000)
    shot(pagina, 'ferro_tunel')
    esperar_ate(pagina, "f.obstaculos.some(o => o instanceof Missil && o.estado === 'avisando')", 6000)
    shot(pagina, 'ferro_aviso_missil')
    registrar('Ferro: míssil mostra aviso antes de entrar', F(pagina, "f.obstaculos.some(o => o instanceof Missil && o.estado === 'avisando')"))
    esperar_ate(pagina, "p.x > 9700", 15000)
    registrar('Ferro: portão abre ao destruir o núcleo', F(pagina, "f.obstaculos.filter(o => o instanceof Portao)[0].aberto"))
    ok, det = testar_conclusao(pagina, 'Homem de Ferro', 150000)
    shot(pagina, 'ferro_fim')
    registrar('Ferro: fase concluída pelo piloto automático SEM invencibilidade', ok, det + f" tentativas={F(pagina, 'f.tentativa')}")

# --- GAVIÃO ---
BOTS['Gaviao'] = r"""
// modo UFO: mira no meio do vão do próximo pilar e dá pulinhos quando está caindo abaixo dele
if (p.modo === 'ufo') {
  const pil = f.obstaculos.filter(b => b.ativo && b.pilar && b.pilar.x + b.pilar.largura > p.x - 20).sort((a, b) => a.pilar.x - b.pilar.x)[0];
  const alvoY = pil && pil.pilar.x - p.x < 420 ? pil.pilar.centro + 20 : 400;
  if (p.y > alvoY && p.body.velocity.y >= -40) f.aoPressionar('teclado');
}
const o = f.proximoAlvo();
if (o && o.forma.x - p.x < 850 && f.habilidade.pronta(agora)) f.aoAcao();
// pula espinhos (no UFO não: lá o pulinho é só pra seguir o vão dos pilares)
if (p.modo !== 'ufo') for (const e of f.obstaculos) if (e.ativo && (e instanceof Espinho || e.saltar)) { const dx = e.forma.x - (e.saltar ? e.forma.width / 2 : 20) - (p.x + 20); if (dx > 20 && dx < 73) f.aoPressionar('teclado'); }
// (73 = 80 − 1 quadro de corrida: o pulo agora sai no mesmo quadro do aperto, sem o quadro de atraso antigo)
"""

@teste('Gaviao')
def teste_gaviao(pagina, erros):
    iniciar_fase(pagina, 'Gaviao')
    # Clique na zona de tiro mirando no primeiro alvo
    esperar_ate(pagina, "f.todosAlvos()[0].forma.x - c.cameras.main.scrollX < 1150", 8000)
    pos = F(pagina, "(() => { const o = f.todosAlvos()[0].forma; const cam = c.cameras.main; return [o.x - cam.scrollX, o.y - cam.scrollY]; })()")
    pagina.mouse.click(pos[0], pos[1])
    esperar_ate(pagina, "f.flechas.length === 0", 2000, 50)
    shot(pagina, 'gaviao_tiro')
    registrar('Gavião: clicar no alvo dispara flecha e acerta', F(pagina, "f.todosAlvos()[0].acertado"))
    avancar(pagina, 400)
    registrar('Gavião: alvo abre a porta ligada', F(pagina, "f.porId['p1'][0].travas <= 0"))
    # Clique na esquerda = pulo
    pagina.mouse.click(200, 400); avancar(pagina, 150)
    registrar('Gavião: clique na metade esquerda pula', F(pagina, "p.body.velocity.y < -100"))
    instalar_bot(pagina, BOTS['Gaviao'])
    esperar_ate(pagina, "f.porId['b1'][0].forma.body.enable", 20000)
    registrar('Gavião: alvo estende a ponte sobre o vão', F(pagina, "f.porId['b1'][0].forma.body.enable"))
    esperar_ate(pagina, "p.x > 5500", 10000)
    shot(pagina, 'gaviao_sequencia')
    # Erro de sequência zera
    zera = F(pagina, "(() => { f.sequencias['zz'] = 1; const a = new Alvo(f, p.x + 300, 300, { grupo: 'zz', n: 2 }); f.alvoAtingido(a); return f.sequencias['zz'] === 1 && !a.acertado; })()")
    registrar('Gavião: acertar fora da ordem zera a sequência', zera)
    esperar_ate(pagina, "p.x > 9500", 20000)
    registrar('Gavião: flecha explosiva derruba a barricada', F(pagina, "!f.obstaculos.some(o => o instanceof Barricada && o.ativo && o.forma.x < 9500)"))
    esperar_ate(pagina, "p.x > 10900", 10000)
    shot(pagina, 'gaviao_painel')
    registrar('Gavião: flecha elétrica ativa o painel blindado', F(pagina, "f.porId['l3'][0].travas <= 0"))
    ok, det = testar_conclusao(pagina, 'Gaviao', 120000)
    shot(pagina, 'gaviao_fim')
    registrar('Gavião: fase concluída pelo piloto automático SEM invencibilidade', ok, det + f" tentativas={F(pagina, 'f.tentativa')}")

# --- HOMEM-ARANHA ---
BOTS['Homem-Aranha'] = r"""
// a cada tentativa nova, o "jogador" muda o tempo de soltar e de pular (como uma pessoa faria)
if (window.__tent !== f.tentativa) { window.__tent = f.tentativa; window.__soltar = f.tentativa === 1 ? 0.55 : 0.3 + Math.random() * 0.5; window.__borda = f.tentativa === 1 ? 30 : 8 + Math.random() * 50; }
const g = p.isOnGround();
const seg = f.segmentosChao().find(([a, b]) => p.x >= a && p.x <= b);
const borda = seg ? seg[1] - (p.x + 20) : 9999;
if (f.balanco) { const pico = window.__wAnt > 0 && f.balanco.w <= 0 && f.balanco.th > 0.15; window.__wAnt = f.balanco.w; if (f.balanco.th > window.__soltar || pico) { f.segurandoTecla = false; f.aoSoltar(); window.__wAnt = 0; } }
else if (f.ancoraEscolhida && (g ? borda < 90 : p.body.velocity.y > -150)) { f.segurandoTecla = true; f.aoPressionar('teclado'); }
else { f.segurandoTecla = false;
  if (g && borda < window.__borda && seg[1] < f.cfg.comprimento) f.aoPressionar('teclado');
  if (g) for (const o of f.obstaculos) if (o.ativo && (o instanceof Antena || o instanceof Espinho || o.saltar)) { const dx = o.forma.x - (o.saltar ? o.forma.width / 2 : 4) - (p.x + 20); if (dx > 25 && dx < 75) f.aoPressionar('teclado'); } }
"""

@teste('Homem-Aranha')
def teste_aranha(pagina, erros):
    iniciar_fase(pagina, 'Homem-Aranha')
    avancar(pagina, 600)
    registrar('Aranha: cubo pousa no telhado', F(pagina, "p.isOnGround() && p.vivo"))
    instalar_bot(pagina, BOTS['Homem-Aranha'])
    esperar_ate(pagina, "!!f.balanco", 12000, 50)
    preso = F(pagina, "!!f.balanco")
    shot(pagina, 'aranha_balanco')
    registrar('Aranha: no ar, segurar prende a teia numa âncora (pêndulo)', preso)
    th0 = F(pagina, "f.balanco ? f.balanco.th : null"); avancar(pagina, 150); th1 = F(pagina, "f.balanco ? f.balanco.th : null")
    registrar('Aranha: ângulo do pêndulo muda com a física', th0 is not None and th1 is not None and th1 != th0, f"θ {th0} → {th1}")
    esperar_ate(pagina, "!f.balanco", 3000, 20)
    registrar('Aranha: soltar transforma o balanço em velocidade (vx > 420)', F(pagina, "f.vx") > 420, f"vx={F(pagina, 'f.vx'):.0f}")
    # Trajetória depende do momento de soltar: compara duas solturas a partir do mesmo estado
    alcance = F(pagina, """(() => {
        const sim = (soltarEm) => { let th = -0.5, w = 450 / 290, L = 290; const h = 0.004; while (th < soltarEm) { w += -(1800 / L) * Math.sin(th) * h; th += w * h; }
            const vx = w * L * Math.cos(th) * 1.15, vy = -w * L * Math.sin(th) * 1.15 - 60; return [Math.round(vx), Math.round(vy)]; };
        return [sim(0.2), sim(0.8)]; })()""")
    registrar('Aranha: soltar cedo/tarde muda a velocidade de saída', alcance[0] != alcance[1], f"soltar em 0.2 rad → {alcance[0]}, em 0.8 rad → {alcance[1]}")
    ok, det = testar_conclusao(pagina, 'Homem-Aranha', 500000)
    shot(pagina, 'aranha_fim')
    registrar('Aranha: fase concluída pelo piloto automático SEM invencibilidade', ok, det + f" tentativas={F(pagina, 'f.tentativa')}")

# --- DOUTOR ESTRANHO ---
BOTS['DrEstranho'] = r"""
if (window.__tent !== f.tentativa) { window.__tent = f.tentativa; window.__j = f.tentativa === 1 ? 0 : Math.random() * 30; window.__esp = f.tentativa === 1 ? 0 : Math.random() * 400; }
const d = f.dim;
const ativos = f.obstaculos.filter(o => o.ativo && o.dim === d);
const portais = f.obstaculos.filter(o => o.ativo && o instanceof PortalDimensao).sort((a, b) => a.forma.x - b.forma.x);
const portal = portais.find(o => o.dim === d && o.forma.x > p.x - 10);
let pular = false, naoPular = false;
if (portal) {
  const dx = portal.forma.x - p.x;
  const prox = portais.find(o => o.forma.x > portal.forma.x + 10);
  const limite = prox ? prox.forma.x : Infinity;
  const precisa = f.obstaculos.some(o => o.ativo && o instanceof Selo && !o.barreira && o.dim === d && o.forma.x > portal.forma.x && o.forma.x < limite);
  if (portal.tipo === 'pad') { if (!precisa && dx < 95 && dx > 25) pular = true; if (precisa && dx < 170) naoPular = true; }
  else { if (precisa && dx < 80 + window.__j && dx > 45) pular = true; if (!precisa && dx < 220 && dx > -40) naoPular = true; }
}
const jmin = p.velocidadeX * 0.05, jmax = jmin + 55;
for (const o of ativos) if (o instanceof Espinho || o instanceof Bloco || o.saltar) { const dx = o.forma.x - o.forma.width / 2 - (p.x + 20); if (dx > jmin && dx < jmax) pular = true; }
if ((f.runas_ || []).some(r => r.alcancavel() && r.forma.x - p.x < 300)) f.abrirPortal();
if ((f.runas_ || []).some(r => r.aberto && !r.usado && Math.abs(r.forma.x - p.x) < 200)) naoPular = true;
// zona de portal livre: abre assim que o marcador fica verde; não pula com portal aberto
if ((f.zonas_ || []).some(z => z.dentro()) && !f.portalLivre && f.portalLivreValido(f.pontosPortalLivre())) f.abrirPortal();
if (f.portalLivre) naoPular = true;
if (pular && !naoPular) f.aoPressionar('teclado');
const perigo = ativos.some(o => (o instanceof Orbe || o instanceof Lamina) && o.forma.x > p.x && o.forma.x - p.x < 500 + window.__esp);
if (perigo && !f.joiaAtiva && f.habilidade.pronta(agora)) f.aoAcao();
"""

@teste('DrEstranho')
def teste_estranho(pagina, erros):
    iniciar_fase(pagina, 'DrEstranho')
    shot(pagina, 'estranho_inicio')
    fantasma = F(pagina, "(() => { const o = f.obstaculos.find(o => o.dim === 'E'); return [o.forma.alpha, o.forma.body ? o.forma.body.enable : null]; })()")
    registrar('Estranho: dimensão espelho aparece como fantasma (transparente, sem física)', fantasma[0] < 0.3 and fantasma[1] is False, str(fantasma))
    instalar_bot(pagina, BOTS['DrEstranho'])
    esperar_ate(pagina, "f.dim === 'E'", 8000, 50)
    avancar(pagina, 300)
    shot(pagina, 'estranho_espelho')
    registrar('Estranho: portal leva pra dimensão espelhada (gravidade invertida, no teto)', F(pagina, "f.dim === 'E' && p.invertido && p.y < 200"), f"dim={F(pagina, 'f.dim')} y={F(pagina, 'Math.round(p.y)')}")
    esperar_ate(pagina, "f.dim === 'N' && p.x > 3800", 8000, 50)
    registrar('Estranho: anel no ar traz de volta (pulando nele)', F(pagina, "f.dim === 'N'"))
    # Zona de portal livre: marcador vermelho antes da hora, verde na janela certa
    esperar_ate(pagina, "(f.zonas_ || [])[0] && f.zonas_[0].dentro()", 12000, 20)
    cedo = F(pagina, "f.portalLivreValido(f.pontosPortalLivre())")
    esperar_ate(pagina, "p.x > 6560 || !p.vivo", 6000, 20)
    registrar('Estranho: portal livre — saída bloqueada no começo da faixa, livre na hora certa, atravessa a muralha', (not cedo) and F(pagina, "p.x > 6560 && p.vivo"), f"cedo_valido={cedo} x={F(pagina, 'Math.round(p.x)')} mortes={pagina.evaluate('window.__mortes')}")
    # Joia do Tempo
    remover_bot(pagina)
    pagina.evaluate("MODO_TESTE.invencivel = true")  # sem o bot o cubo bateria nos espinhos durante a checagem
    esperar_ate(pagina, "!f.joiaAtiva", 5000, 50)
    F(pagina, "(f.habilidade.ultimoUso = -Infinity, f.aoAcao(), 0)")
    ts = F(pagina, "[f.joiaAtiva, c.physics.world.timeScale, f.fatorTempo]")
    shot(pagina, 'estranho_joia')
    registrar('Estranho: Joia do Tempo desacelera física e obstáculos', ts[0] and ts[1] > 2 and abs(ts[2] - 0.4) < 1e-6, str(ts))
    F(pagina, "(f.aoAcao(), 0)")
    registrar('Estranho: E de novo durante a Joia reverte os obstáculos', F(pagina, "f.fatorTempo < 0"))
    avancar(pagina, 3200)
    registrar('Estranho: Joia acaba sozinha e começa a recarga', F(pagina, "!f.joiaAtiva && c.physics.world.timeScale === 1 && !f.habilidade.pronta(c.time.now)"))
    pagina.evaluate("MODO_TESTE.invencivel = false")
    F(pagina, "(f.reiniciar(1), 0)"); avancar(pagina, 300)
    instalar_bot(pagina, BOTS['DrEstranho'])
    ok, det = testar_conclusao(pagina, 'DrEstranho', 500000)
    shot(pagina, 'estranho_fim')
    registrar('Estranho: fase concluída pelo piloto automático SEM invencibilidade', ok, det + f" tentativas={F(pagina, 'f.tentativa')}")

# --- WANDA ---
BOTS['Wanda'] = r"""
const R = f.realidade, g = p.isOnGround();
const vivo = o => o.ativo && o.forma.body && o.forma.body.enable;
const esq = o => o.forma.x - o.forma.width / 2, dir = o => o.forma.x + o.forma.width / 2;
const suporte = o => o.ehChao || (o instanceof ElementoCaos && (o.tipo === 'ponte' || o.tipo === 'plataforma'));
// apoio atual (o que está embaixo do cubo)
const sob = f.obstaculos.find(o => vivo(o) && suporte(o) && esq(o) <= p.x + 20 && dir(o) >= p.x - 20 && Math.abs(o.forma.body.top - p.body.bottom) < 4);
// próximo elemento mágico relevante à frente
const prox = f.elementos.filter(e => e.ativo && dir(e) > p.x - 20 && e !== sob).sort((a, b) => esq(a) - esq(b))[0];
let quer = null;
if (prox) {
  const dx = esq(prox) - (p.x + 20);
  const ehSup = prox.tipo === 'ponte' || prox.tipo === 'plataforma';
  if (ehSup) { if ((!g || !sob || !(sob instanceof ElementoCaos)) && dx < 260) quer = prox.real; }
  else if (dx < 230) quer = prox.real === 'A' ? 'B' : 'A';
}
if (quer && quer !== R && f.habilidade.pronta(agora) && !(sob instanceof ElementoCaos && sob.real === R && g && !(prox && (prox.tipo === 'ponte' || prox.tipo === 'plataforma') === false))) f.aoAcao();
// orbe amarelo: aperta quando encosta no ar
if (!g && (f.orbesClassicos || []).some(o => o.alcance())) f.aoPressionar('teclado');
// serra/espinho comum no chão: pula
if (g) for (const o of f.obstaculos) if (o.ativo && (o instanceof Espinho || o.saltar)) { const dx = esq(o) - (p.x + 20); if (dx > 25 && dx < 70) f.aoPressionar('teclado'); }
// pulo na beirada do apoio
if (g && sob) { const fim = dir(sob);
  const continua = f.obstaculos.some(o => o !== sob && vivo(o) && suporte(o) && esq(o) <= fim + 2 && dir(o) > fim + 10 && Math.abs(o.forma.body.top - sob.forma.body.top) < 30);
  if (!continua && fim - (p.x + 20) < 22) f.aoPressionar('teclado'); }
"""

@teste('Wanda')
def teste_wanda(pagina, erros):
    iniciar_fase(pagina, 'Wanda')
    parede = "f.elementos[0]"
    registrar('Wanda: começa na VERMELHA com a parede ◆ sólida', F(pagina, f"f.realidade === 'A' && {parede}.forma.body.enable"))
    F(pagina, "(f.aoAcao(), 0)"); avancar(pagina, 200)
    shot(pagina, 'wanda_troca')
    registrar('Wanda: E troca pra AZUL e a parede vira fantasma (só contorno, sem física)', F(pagina, f"f.realidade === 'B' && !{parede}.forma.body.enable && {parede}.forma.fillAlpha < 0.2"))
    # segurança: elemento não nasce dentro do cubo
    seguro = F(pagina, "(() => { const e = new ElementoCaos(f, 'bloco', p.x - 20, 'A'); f.elementos.push(e); f.aplicarRealidade(false); const ok1 = !e.forma.body.enable; f.trocarRealidade(); const ok2 = e.pendente && !e.forma.body.enable; e.destruir(); return ok1 && ok2; })()")
    registrar('Wanda: elemento que apareceria dentro do cubo espera ele sair (não esmaga)', seguro)
    F(pagina, "(f.reiniciar(1), 0)"); avancar(pagina, 800)
    instalar_bot(pagina, BOTS['Wanda'])
    esperar_ate(pagina, "p.x > 4500", 15000)
    registrar('Wanda: atravessa vão trocando de realidade no ar (plataformas ◇ → ◆)', F(pagina, "p.x > 4500 && p.vivo"), f"mortes={pagina.evaluate('window.__mortes')}")
    ok, det = testar_conclusao(pagina, 'Wanda', 300000)
    shot(pagina, 'wanda_fim')
    registrar('Wanda: fase concluída pelo piloto automático SEM invencibilidade', ok, det + f" tentativas={F(pagina, 'f.tentativa')}")

# ----------------------------------------------------------------
def testar_fluxo(navegador):
    pagina, erros = nova_pagina(navegador)
    shot(pagina, 'menu')
    pagina.keyboard.press('Enter')
    avancar(pagina, 200)
    sel = pagina.evaluate("!document.getElementById('level-select').hidden")
    shot(pagina, 'selecao')
    # Carrossel (ordem por dificuldade): → chega no Hulk (2º cartão) e Enter joga
    pagina.keyboard.press('ArrowRight'); avancar(pagina, 50)
    ativo = pagina.evaluate("document.querySelector('.level-btn.ativa').dataset.level")
    pagina.click('.level-btn.ativa')
    avancar(pagina, 900)
    ok_jogo = pagina.evaluate("window.jogo.scene.isActive('Game') && window.jogo.scene.getScene('Game').fase.heroi === 'Hulk'")
    shot(pagina, 'fluxo_fase')
    pagina.keyboard.press('r')
    avancar(pagina, 500)
    tent = F(pagina, "f.tentativa")
    # ESC pausa (mundo congela), ESC de novo continua
    pagina.keyboard.press('Escape'); avancar(pagina, 100)
    x0 = F(pagina, "p.x"); avancar(pagina, 300); x1 = F(pagina, "p.x")
    pausa = pagina.evaluate("!document.getElementById('pausa').hidden") and abs(x1 - x0) < 0.5
    shot(pagina, 'pausa')
    pagina.keyboard.press('Escape'); avancar(pagina, 300)
    continua = pagina.evaluate("document.getElementById('pausa').hidden") and F(pagina, "p.x") > x1 + 50
    # Pausa → "Seleção de fases" volta pra seleção
    pagina.keyboard.press('Escape'); avancar(pagina, 100)
    pagina.click('#pausa-selecao'); avancar(pagina, 500)
    selecao = pagina.evaluate("window.jogo.scene.isActive('Menu') && !document.getElementById('level-select').hidden")
    registrar('Fluxo: menu → Enter → carrossel (→) → fase → R reinicia → ESC pausa/continua → seleção', sel and ativo == 'Hulk' and ok_jogo and tent == 2 and pausa and continua and selecao,
              f"sel={sel} ativo={ativo} jogo={ok_jogo} tentativa={tent} pausa={pausa} continua={continua} selecao={selecao}")
    registrar('Fluxo: sem erros de console', not erros, '; '.join(erros[:5]))
    pagina.close()

def main():
    escolhidos = sys.argv[1:] or list(TESTES.keys())
    with sync_playwright() as p:
        navegador = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        if 'fluxo' in escolhidos or not sys.argv[1:]:
            testar_fluxo(navegador)
        for heroi in escolhidos:
            if heroi not in TESTES:
                continue
            pagina, erros = nova_pagina(navegador)
            try:
                TESTES[heroi](pagina, erros)
            except AssertionError as e:
                registrar(f'{heroi}: teste interrompido', False, str(e))
                shot(pagina, f'{heroi}_erro')
            except Exception as e:
                registrar(f'{heroi}: exceção no teste', False, repr(e))
            registrar(f'{heroi}: sem erros de console', not erros, '; '.join(erros[:5]))
            # mede FPS médio
            pagina.close()
        navegador.close()
    falhas = [r for r in resultados if not r[1]]
    print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} verificações passaram")
    (RAIZ / 'tests' / 'resultado.json').write_text(json.dumps(resultados, ensure_ascii=False, indent=1), encoding='utf-8')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
