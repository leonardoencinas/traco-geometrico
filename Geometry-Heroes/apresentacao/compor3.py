# ================================================================
# compor3.py — versão 3 do vídeo (duração da música, ~123,6 s): mesmas cenas e transições da v2 (compor2.py),
# capturas novas (interface HQ, cards padronizados, efeitos 8-bit)
# e textos atualizados com as correções desta rodada. Música: a mesma da v2, cortada com fade-out.
# Uso: python3 apresentacao/compor3.py <pasta> <musica.mp3> <saida.mp4>   (rodar da raiz do jogo)
# ================================================================
import sys, subprocess
import compor as C
import compor2 as V2
from compor import W, H, FPS, eo, eio, faixa, fonte, texto_alfa, entra, tela_base, vinheta, OURO, BRANCO, CINZA
from PIL import ImageDraw

TOTAL_TESTES = int(sys.argv[sys.argv.index('--testes') + 1]) if '--testes' in sys.argv else 280

# Textos conferidos com o que de fato foi usado no projeto
C.SKILLS = [
    ('ANIMATE', 'Skill de animação', 'Decidir o que deve animar, curva ease-out e duração curta: portais, rastro, parallax do Homem de Ferro.', (255, 194, 61)),
    ('EMIL DESIGN ENG', 'Skill de engenharia de design', 'Revisão de UI e movimento: detalhes invisíveis, legibilidade e feedback.', (176, 140, 255)),
    ('AGENTES', '3 agentes em paralelo (rodadas 7 e 8)', 'Cenários, pulo e tela inicial divididos por arquivos; um agente principal integrou e testou.', (111, 220, 74)),
    ('MANUS · CHATGPT', 'Outras IAs usadas pelo grupo', 'ChatGPT para escrever os prompts enviados ao Claude; Manus para o design dos fundos, depois recortados em camadas.', (92, 225, 255)),
]
C.CASOS = [
    ('Renascer colado no perigo', '0,3 s → ≥ 0,8 s', 'checkpoints recuados, câmera alinhada e 0,5 s de respiro; teste com 3 mortes seguidas'),
    ('Cubo tremendo em telas de 120 Hz', '8 px → 0,3 px', 'desenho e câmera interpolados entre passos fixos da física'),
    ('Toque perdido no celular', '1 → 3 dedos', 'multitoque ligado; foco preso em botão não bloqueia mais o pulo'),
]

# Cena "o jogo em ação" com a gravação nova do menu (menu de 1 a 13 s; seleção a partir de 13,3 s)
def cena_jogo(t, D):
    im, d = tela_base(t)
    a, dsl = entra(t, 0.1, 0.5, 30)
    texto_alfa(im, (110, 90), 'O JOGO EM AÇÃO', fonte('tit', 54), OURO, 'la', a, dsl)
    texto_alfa(im, (112, 168), 'Plataforma rítmica · 6 heróis · 6 fases · jogável no navegador', fonte('semi', 30), CINZA, 'la', a, dsl, sombra=False)
    caixa = (110, 225, 110 + 1360, 225 + 765)
    corte = D * 0.6
    if t < corte:
        z = 1.0 + 0.05 * eio(faixa(t, 0, corte))
        tm = 4.5 + t if t < 3.6 else 13.4 + (t - 3.6) * 1.6
        C.colar_zoom(im, C.menu_quadro(tm), caixa, z, (0.5, 0.5), raio=26, borda=((255, 201, 74), 3))
        rot = 'Menu no estilo HQ com o elenco' if t < 3.6 else 'Seleção de fases (cards padronizados)'
    else:
        tl = t - corte; ordem = ['Homem-Aranha_0', 'Hulk_0', 'Homem_de_Ferro_0', 'Wanda_0']
        i = min(int(tl / 1.0), 3); nome = ordem[i]
        z = 1.08 + 0.06 * eio((tl % 1.0) / 1.0)
        C.colar_zoom(im, C.clipe(nome, 1.5 + (tl % 1.0)), caixa, z, (0.35, 0.6), raio=26, borda=((255, 201, 74), 3))
        rot = 'Jogabilidade real (piloto automático dos testes)'
    for j, (titulo, sub) in enumerate([('6', 'heróis e fases'), (str(TOTAL_TESTES), 'verificações de teste'), ('~10.100', 'linhas de JavaScript')]):
        aa, ds = entra(t, 0.8 + j * 0.25, 0.5, 24)
        texto_alfa(im, (1540, 300 + j * 230), titulo, fonte('tit', 68), OURO, 'la', aa, ds)
        texto_alfa(im, (1542, 386 + j * 230), sub, fonte('semi', 24), CINZA, 'la', aa, ds, sombra=False)
    texto_alfa(im, (112, 1010), rot, fonte('semi', 26), BRANCO, 'la', 1.0, sombra=False)
    return vinheta(im, 0.4)
C.cena_jogo = cena_jogo

# Ordem da seleção (por dificuldade): o Homem de Ferro agora é Insano e vem depois do Doutor Estranho
_ordem = ['Homem-Aranha', 'Hulk', 'Gaviao', 'DrEstranho', 'Homem de Ferro', 'Wanda']
C.HEROIS[:] = sorted(C.HEROIS, key=lambda h: _ordem.index(h['id']))

# (a duração da linha do tempo segue a música; ver abaixo)
# Gameplay inteira na tela: a captura (1280×720) entra sem zoom, para não cortar HUD, chão e bordas
_colar_orig = C.colar_zoom
def _colar(base, im, caixa, zoom=1.0, foco=(0.5, 0.5), **k):
    if im.size == (1280, 720): zoom = 1.0
    return _colar_orig(base, im, caixa, zoom, foco, **k)
C.colar_zoom = _colar
# Cena das técnicas sem o zoom de leitura (ele cortava a gameplay ao lado do texto)
V2.cena_tecnicas_zoom = lambda t, D: C.cena_tecnicas(t, D)

# Takes por herói: "_0" (largada) e, quando existir, "_1" (depois do 1º checkpoint).
# Todos tocam em VELOCIDADE REAL (nada de esticar: repetir quadros fazia a gameplay engasgar).
# Por isso a cena de cada herói dura o que o take dele permite. Os takes mostram o PODER em ação
# (capturados com PRE: teia, fúria, flechas, Joia do Tempo/portal, repulsor, troca de realidade).
_clipe_orig = C.clipe
def _quadros(nome):
    if nome not in C.CLIPES: C.CLIPES[nome] = C.quadros_clipe(nome)
    return C.CLIPES[nome]
def dur_heroi(h):
    # dois takes: 6 s; um take: o que ele cobre em velocidade real (começa em 0,3 s; folga de 0,1 s)
    if _quadros(h['pasta'] + '_1'): return 6.0
    return round(max(3.0, min(6.0, len(_quadros(h['pasta'] + '_0')) / 30 - 0.4)), 2)
_CENA = [None]     # duração da cena do herói sendo desenhada (None fora dela)
_FORCAR = [None]   # '_0' ou '_1': força qual take a cena usa (para a fusão entre eles)
def _clipe(nome, t, vel=1.0):
    D = _CENA[0]
    if D and _FORCAR[0] and nome[-2:] in ('_0', '_1') and nome[-2:] != _FORCAR[0]:
        t = t + D / 2 if _FORCAR[0] == '_0' else max(0.3, t - D / 2)
        nome = nome[:-2] + _FORCAR[0]
    if nome.endswith('_1') and not _quadros(nome):
        # herói com um take só: na cena dele o "_1" é a continuação do "_0"; fora dela, o mesmo instante
        nome, t = nome[:-2] + '_0', (t + D / 2 if D else t)
    return _clipe_orig(nome, t)
C.clipe = _clipe

# Troca do 1º para o 2º take no meio da cena do herói: fusão de 0,6 s em vez de corte seco
from PIL import Image as _Im
_heroi_orig = V2.cena_heroi_sem_fx
def _heroi_suave(t, D, h, idx):
    _CENA[0] = D
    try:
        meio, m = D / 2, 0.3
        if not _quadros(h['pasta'] + '_1') or abs(t - meio) >= m: return _heroi_orig(t, D, h, idx)
        _FORCAR[0] = '_0'; A = _heroi_orig(t, D, h, idx)
        _FORCAR[0] = '_1'; B = _heroi_orig(t, D, h, idx)
        k = (t - (meio - m)) / (2 * m); k = k * k * (3 - 2 * k)
        return _Im.blend(A, B, k)
    finally: _FORCAR[0] = None; _CENA[0] = None
V2.cena_heroi_sem_fx = _heroi_suave

# Duração = a música inteira (tema dos Vingadores, ~123,6 s), como nas versões anteriores.
# O tempo que sobra das cenas curtas vai para as cenas de explicação (mais tempo de leitura).
_herois = [(f'heroi{i}', dur_heroi(h)) for i, h in enumerate(C.HEROIS)]
_sobra = sum(6.0 - d for _, d in _herois)
V2.LINHA = [('abertura', 8.0), ('jogo', 14.0)] + _herois + \
           [('tecnicas', 16.0 + _sobra * 0.4), ('tech', 15.0 + _sobra * 0.3), ('skills', 13.0), ('engenharia', 11.0 + _sobra * 0.3)]
V2.LINHA.append(('final', max(7.0, C.DUR_MUSICA - sum(d for _, d in V2.LINHA))))
V2.EMENDAS = ['portal', 'teia', 'forca', 'flecha', 'hud', 'portal', 'realidade', 'teia', 'hud', 'portal', 'flecha', 'forca']
TOTAL = sum(d for _, d in V2.LINHA)

if __name__ == '__main__':
    if '--quadros' in sys.argv:
        for tg in [float(x) for x in sys.argv[sys.argv.index('--quadros') + 1].split(',')]:
            V2.quadro(tg).save(str(C.V / f'v3_{tg:07.2f}.jpg'), quality=88)
        sys.exit(0)
    print(f'total {TOTAL:.1f}s · {int(TOTAL * FPS)} quadros', flush=True)
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', C.MUSICA, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-af', f'afade=t=in:d=0.5,afade=t=out:st={TOTAL - 3:.2f}:d=3', '-t', f'{TOTAL:.2f}',
           '-movflags', '+faststart', C.SAIDA]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(TOTAL * FPS)
    for i in range(n):
        pr.stdin.write(V2.quadro(i / FPS).tobytes())
        if i % 300 == 0: print(f'{i}/{n}', flush=True)
    pr.stdin.close(); pr.wait()
    print('ok', C.SAIDA)
