# ================================================================
# compor.py — vídeo de apresentação do Geometry Heroes (1920x1080, 30 fps, H.264)
# Composição programática: PIL desenha cada quadro (capturas REAIS do jogo + tipografia e
# transições temáticas) e manda os quadros crus para o ffmpeg, que junta a música do usuário.
# Uso: python3 compor.py <pasta_video> <musica.mp3> <saida.mp4> [--rapido]
# ================================================================
import sys, math, glob, subprocess, pathlib, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

V = pathlib.Path(sys.argv[1]); MUSICA = sys.argv[2]; SAIDA = sys.argv[3]
RAPIDO = '--rapido' in sys.argv
W, H, FPS = 1920, 1080, 30
JOGO = pathlib.Path('/home/user/Projetos/Projetos/Geometry-Heroes')

# ---------- sistema visual ----------
FUNDO = (7, 11, 30)
BRANCO = (245, 247, 255)
CINZA = (150, 160, 200)
OURO = (255, 201, 74)
F_TIT = str(V / 'fontes' / 'Bungee-Regular.ttf')
def inter(peso):
    m = {'black': 'Inter-Black', 'bold': 'Inter-Bold', 'semi': 'Inter-SemiBold', 'reg': 'Inter-Regular', 'mono': None}
    import subprocess as sp
    if peso == 'mono': return sp.run(['fc-match', '-f', '%{file}', 'DejaVu Sans Mono'], capture_output=True, text=True).stdout
    return sp.run(['fc-match', '-f', '%{file}', f'Inter:style={ {"black":"Black","bold":"Bold","semi":"SemiBold","reg":"Regular"}[peso] }'], capture_output=True, text=True).stdout
FONTES = {}
def fonte(tipo, tam):
    k = (tipo, tam)
    if k not in FONTES:
        FONTES[k] = ImageFont.truetype(F_TIT if tipo == 'tit' else inter(tipo), tam)
    return FONTES[k]

HEROIS = [  # ordem da seleção (por dificuldade) — textos conferidos com config.js / código
    dict(id='Homem-Aranha', pasta='Homem-Aranha', nome='HOMEM-ARANHA', cor=(255, 59, 85), cor2=(90, 138, 255),
         poder='Teia: segure no ar para balançar e solte para voar', fato='Cenário em camadas · teias nos prédios', fx='teia'),
    dict(id='Hulk', pasta='Hulk', nome='HULK', cor=(111, 220, 74), cor2=(198, 255, 176),
         poder='Fúria: cresce e atravessa o que quebra', fato='Cidade em ruínas · 5 camadas de parallax', fx='racha'),
    dict(id='Gaviao', pasta='Gaviao', nome='GAVIÃO ARQUEIRO', cor=(167, 123, 255), cor2=(184, 255, 90),
         poder='Arco: acerta alvos e abre caminho', fato='Trecho final no modo UFO', fx='flecha'),
    dict(id='Homem de Ferro', pasta='Homem_de_Ferro', nome='HOMEM DE FERRO', cor=(255, 194, 61), cor2=(92, 225, 255),
         poder='Voo: segure para subir · repulsor derruba drones', fato='Metrópole noturna · 5 camadas', fx='hud'),
    dict(id='DrEstranho', pasta='DrEstranho', nome='DOUTOR ESTRANHO', cor=(255, 165, 61), cor2=(176, 140, 255),
         poder='Portais, dimensão espelho e Joia do Tempo', fato='Portal único com anel de faíscas', fx='portal'),
    dict(id='Wanda', pasta='Wanda', nome='FEITICEIRA ESCARLATE', cor=(255, 42, 77), cor2=(176, 58, 255),
         poder='Realidade: troca entre vermelha e azul', fato='Floresta amaldiçoada · brasas do caos', fx='caos'),
]

# ---------- utilidades ----------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def eo(t): t = clamp(t); return 1 - (1 - t) ** 3            # ease-out (cúbico)
def eio(t): t = clamp(t); return 4*t*t*t if t < .5 else 1 - (-2*t + 2) ** 3 / 2   # ease-in-out
def faixa(t, a, b): return clamp((t - a) / (b - a)) if b > a else 1.0

CACHE = {}
def carregar(p, tam=None):
    k = (str(p), tam)
    if k not in CACHE:
        im = Image.open(p).convert('RGB')
        if tam: im = im.resize(tam, Image.LANCZOS)
        CACHE[k] = im
        if len(CACHE) > 400: CACHE.pop(next(iter(CACHE)))
    return CACHE[k]

def quadros_clipe(nome):
    return sorted(glob.glob(str(V / 'cap' / nome / '*.jpg')))
CLIPES = {}
def clipe(nome, t, vel=1.0):
    """Quadro do clipe capturado no tempo t (s), velocidade real (30 fps); trava no último."""
    if nome not in CLIPES: CLIPES[nome] = quadros_clipe(nome)
    fs = CLIPES[nome]
    if not fs: return Image.new('RGB', (1280, 720), (20, 20, 40))
    i = int(clamp(t * 30 * vel, 0, len(fs) - 1))
    return carregar(fs[i])

MENU = sorted(glob.glob(str(V / 'menu' / 'f_*.jpg')))
def menu_quadro(t):
    if not MENU: return Image.new('RGB', (1280, 720), (30, 40, 120))
    return carregar(MENU[int(clamp(t * 30, 0, len(MENU) - 1))])

def colar_zoom(base, im, caixa, zoom=1.0, foco=(0.5, 0.5), alpha=1.0, raio=0, borda=None):
    """Cola `im` dentro de `caixa` (x0,y0,x1,y1) com zoom suave em torno de `foco`."""
    x0, y0, x1, y1 = [int(v) for v in caixa]; bw, bh = x1 - x0, y1 - y0
    if bw <= 2 or bh <= 2 or alpha <= 0: return
    iw, ih = im.size; esc = max(bw / iw, bh / ih) * zoom
    cw, ch = bw / esc, bh / esc
    cx = clamp(foco[0] * iw, cw / 2, iw - cw / 2); cy = clamp(foco[1] * ih, ch / 2, ih - ch / 2)
    rec = im.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))).resize((bw, bh), Image.BILINEAR if RAPIDO else Image.LANCZOS)
    mask = None
    if raio or alpha < 1:
        mask = Image.new('L', (bw, bh), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, bw - 1, bh - 1), radius=raio, fill=int(255 * alpha))
    base.paste(rec, (x0, y0), mask)
    if borda:
        ImageDraw.Draw(base).rounded_rectangle((x0, y0, x1 - 1, y1 - 1), radius=raio, outline=borda[0], width=borda[1])

def texto(d, xy, s, f, cor=BRANCO, anchor='la', alpha=1.0, sombra=True):
    if alpha <= 0: return
    c = tuple(int(v * alpha + FUNDO[i] * (1 - alpha)) for i, v in enumerate(cor[:3]))
    if sombra: d.text((xy[0] + 3, xy[1] + 4), s, font=f, fill=(0, 0, 0), anchor=anchor)
    d.text(xy, s, font=f, fill=c, anchor=anchor)

def texto_alfa(base, xy, s, f, cor=BRANCO, anchor='la', alpha=1.0, desloc=(0, 0), sombra=True):
    """Texto com transparência real (camada RGBA)."""
    if alpha <= 0: return
    cam = Image.new('RGBA', base.size, (0, 0, 0, 0)); d = ImageDraw.Draw(cam)
    x, y = xy[0] + desloc[0], xy[1] + desloc[1]
    if sombra: d.text((x + 3, y + 4), s, font=f, fill=(0, 0, 0, int(160 * alpha)), anchor=anchor)
    d.text((x, y), s, font=f, fill=cor[:3] + (int(255 * alpha),), anchor=anchor)
    base.paste(cam, (0, 0), cam)

def entra(t, t0, dur=0.45, dist=36):
    """(alpha, deslocamento) para tipografia cinética: sobe e aparece com ease-out."""
    k = eo(faixa(t, t0, t0 + dur)); return k, (0, int((1 - k) * dist))

def vinheta(base, forca=0.55):
    if 'vin' not in CACHE:
        y, x = np.ogrid[:H, :W]; r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
        CACHE['vin'] = np.clip(1 - forca * np.clip(r - 0.55, 0, 1) ** 1.3, 0, 1)[..., None]
    a = np.asarray(base).astype(np.float32) * CACHE['vin']
    return Image.fromarray(a.astype(np.uint8))

def grade_fundo(d, t, cor=(28, 40, 96), alpha=1.0):
    # padrão geométrico discreto (losangos), movendo devagar — identidade "geometry"
    off = (t * 20) % 80
    for x in range(-80, W + 80, 80):
        for y in range(-80, H + 80, 80):
            cx, cy = x + off, y + (off * 0.5)
            s = 6
            d.polygon([(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy)], outline=tuple(int(c * alpha + FUNDO[i]*(1-alpha)) for i, c in enumerate(cor)))

def tela_base(t, cor=None):
    im = Image.new('RGB', (W, H), FUNDO); d = ImageDraw.Draw(im)
    grade_fundo(d, t, cor or (24, 34, 84))
    return im, d

def logo_cubo(d, cx, cy, s, k=1.0, cor=OURO, larg=6):
    """Símbolo: cubo girado 45° (losango) com um losango interno — desenhado por linhas (k = progresso)."""
    pts = [(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy), (cx, cy - s)]
    tot = 4 * k
    for i in range(4):
        seg = clamp(tot - i)
        if seg <= 0: break
        a, b = pts[i], pts[i + 1]
        d.line([a, (a[0] + (b[0] - a[0]) * seg, a[1] + (b[1] - a[1]) * seg)], fill=cor, width=larg)
    if k > 0.7:
        s2 = s * 0.42 * eo((k - 0.7) / 0.3)
        d.polygon([(cx, cy - s2), (cx + s2, cy), (cx, cy + s2), (cx - s2, cy)], fill=cor)

# ---------- transições temáticas (desenhadas por cima; p = 0..1) ----------
def fx_transicao(base, tipo, p, cor, cor2):
    if p <= 0 or p >= 1: return base
    d = ImageDraw.Draw(base, 'RGBA'); rnd = random.Random(7)
    k = math.sin(math.pi * p)   # sobe e desce
    if tipo == 'teia':          # fios de teia diagonais varrendo a tela
        cx, cy = -200 + p * (W + 400), H * 0.2
        for i in range(14):
            a = -0.2 + i * 0.12
            d.line([(cx, cy), (cx + math.cos(a) * 2400, cy + math.sin(a) * 2400)], fill=(235, 240, 255, int(200 * k)), width=3)
        for r in range(120, 1800, 160):
            d.arc((cx - r, cy - r, cx + r, cy + r), -12, 80, fill=(235, 240, 255, int(150 * k)), width=2)
    elif tipo == 'racha':       # rachaduras partindo do centro + fragmentos
        rnd = random.Random(3)
        for j in range(9):
            x, y = W / 2, H / 2; ang = j / 9 * 2 * math.pi + rnd.uniform(-.2, .2)
            comp = 900 * eo(p * 1.6)
            pts = [(x, y)]
            n = 12
            for s in range(n):
                ang += rnd.uniform(-.35, .35); x += math.cos(ang) * comp / n; y += math.sin(ang) * comp / n; pts.append((x, y))
            d.line(pts, fill=cor + (int(255 * k),), width=5); d.line(pts, fill=(255, 255, 255, int(180 * k)), width=1)
    elif tipo == 'flecha':      # trajetórias de flecha atravessando
        for i in range(6):
            y = H * (0.15 + i * 0.14); x = -400 + (W + 800) * eo(clamp(p * 1.4 - i * 0.06))
            d.line([(x - 700, y), (x, y)], fill=cor + (int(200 * k),), width=4)
            d.polygon([(x, y), (x - 34, y - 14), (x - 34, y + 14)], fill=cor2 + (int(255 * k),))
    elif tipo == 'hud':         # linhas de energia e retícula tecnológica
        for i in range(0, H, 54):
            w = int(W * eo(clamp(p * 1.5 - i / H * 0.4)))
            d.line([(0, i), (w, i)], fill=cor2 + (int(110 * k),), width=2)
        r = 120 + 380 * eo(p); cx, cy = W / 2, H / 2
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=cor + (int(230 * k),), width=4)
        d.arc((cx - r * .8, cy - r * .8, cx + r * .8, cy + r * .8), p * 360, p * 360 + 220, fill=cor2 + (int(230 * k),), width=8)
    elif tipo == 'portal':      # anel de faíscas que cresce como portal
        r = 30 + 1300 * eio(p); cx, cy = W / 2, H / 2
        for j in range(140):
            a = j / 140 * 2 * math.pi + p * 6
            rr = r + rnd.uniform(-14, 14)
            x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
            d.line([(x, y), (x + math.cos(a + 1.7) * 26, y + math.sin(a + 1.7) * 26)], fill=(255, rnd.choice([165, 201, 230]), 61, int(255 * k)), width=3)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=cor + (int(200 * k),), width=6)
    elif tipo == 'caos':        # partículas escarlates e onda de energia
        r = 1400 * eo(p); cx, cy = W / 2, H / 2
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=cor + (int(200 * k),), width=10)
        for j in range(160):
            a = rnd.uniform(0, 2 * math.pi); dist = rnd.uniform(0, 1) * r
            x, y = cx + math.cos(a) * dist, cy + math.sin(a) * dist; s = rnd.uniform(2, 6)
            d.ellipse((x - s, y - s, x + s, y + s), fill=rnd.choice([cor, cor2, (255, 143, 163)]) + (int(220 * k),))
    return base

# ================================================================
# CENAS (cada uma recebe o tempo local t em segundos e devolve a imagem)
# ================================================================
def cena_abertura(t, D):
    im, d = tela_base(t, (14, 20, 52)); d = ImageDraw.Draw(im, 'RGBA')
    # linhas luminosas convergindo para o símbolo
    k = eo(faixa(t, 0.2, 2.4))
    for i in range(10):
        a = i / 10 * 2 * math.pi + 0.3
        x1, y1 = W / 2 + math.cos(a) * 1300, H / 2 - 60 + math.sin(a) * 1300
        x2, y2 = W / 2 + math.cos(a) * (1300 - 1150 * k), H / 2 - 60 + math.sin(a) * (1300 - 1150 * k)
        d.line([(x1, y1), (x2, y2)], fill=(255, 201, 74, int(90 * (1 - faixa(t, 2.4, 3.4)))), width=2)
    logo_cubo(d, W / 2, H / 2 - 120, 110, eo(faixa(t, 1.2, 3.2)))
    a, dsl = entra(t, 3.0, 0.6, 40)
    texto_alfa(im, (W / 2, H / 2 + 70), 'GEOMETRY', fonte('tit', 120), BRANCO, 'mm', a, dsl)
    a2, dsl2 = entra(t, 3.3, 0.6, 40)
    texto_alfa(im, (W / 2, H / 2 + 200), 'HEROES', fonte('tit', 150), OURO, 'mm', a2, dsl2)
    a3, dsl3 = entra(t, 4.4, 0.6, 20)
    texto_alfa(im, (W / 2, H / 2 + 320), 'Game Development  •  AI Engineering  •  Creative Design', fonte('semi', 34), CINZA, 'mm', a3, dsl3, sombra=False)
    # saída: escurece
    if t > D - 0.6:
        f = faixa(t, D - 0.6, D); im = Image.blend(im, Image.new('RGB', (W, H), (0, 0, 0)), eio(f) * 0.9)
    return vinheta(im)

def cena_jogo(t, D):
    im, d = tela_base(t)
    # 0–4.6 s: menu real; 4.6–8 s: seleção (carrossel real); 8–D: montagem de gameplay
    a, dsl = entra(t, 0.1, 0.5, 30)
    texto_alfa(im, (110, 90), 'O JOGO EM AÇÃO', fonte('tit', 54), OURO, 'la', a, dsl)
    texto_alfa(im, (112, 168), 'Plataforma rítmica · 6 heróis · 6 fases · jogável no navegador', fonte('semi', 30), CINZA, 'la', a, dsl, sombra=False)
    caixa = (110, 225, 110 + 1360, 225 + 765)
    if t < 8.2:
        z = 1.0 + 0.05 * eio(faixa(t, 0, 8))
        tm = 5.0 + t if t < 4.6 else 16.2 + (t - 4.6) * 1.5   # menu real; depois o carrossel real (UI a 1,5x)
        colar_zoom(im, menu_quadro(tm), caixa, z, (0.5, 0.5), raio=26, borda=((255, 201, 74), 3))
        rot = 'Menu com o elenco' if t < 4.6 else 'Seleção de fases por dificuldade'
    else:
        tl = t - 8.2; ordem = ['Homem-Aranha_0', 'Hulk_0', 'Homem_de_Ferro_0', 'Wanda_0']
        i = min(int(tl / 1.6), 3); nome = ordem[i]
        z = 1.08 + 0.06 * eio((tl % 1.6) / 1.6)
        colar_zoom(im, clipe(nome, 1.0 + (tl % 1.6)), caixa, z, (0.35, 0.6), raio=26, borda=((255, 201, 74), 3))
        rot = 'Jogabilidade real (piloto automático dos testes)'
    # legenda lateral
    d = ImageDraw.Draw(im)
    for j, (titulo, sub) in enumerate([('6', 'heróis e fases'), ('254', 'verificações de teste'), ('~9.900', 'linhas de JavaScript')]):
        aa, ds = entra(t, 0.8 + j * 0.25, 0.5, 24)
        texto_alfa(im, (1540, 300 + j * 230), titulo, fonte('tit', 68), OURO, 'la', aa, ds)
        texto_alfa(im, (1542, 386 + j * 230), sub, fonte('semi', 24), CINZA, 'la', aa, ds, sombra=False)
    texto_alfa(im, (112, 1010), rot, fonte('semi', 26), BRANCO, 'la', 1.0, sombra=False)
    return vinheta(im, 0.4)

def cena_heroi(t, D, h, idx):
    cor, cor2 = h['cor'], h['cor2']
    im, d = tela_base(t, tuple(int(c * 0.22) for c in cor))
    d = ImageDraw.Draw(im, 'RGBA')
    # faixa de cor do herói à esquerda
    d.rectangle((0, 0, 14, H), fill=cor)
    # clipe real: janela grande com zoom lento (dois trechos)
    tl = t; nome = f"{h['pasta']}_0" if tl < D / 2 else f"{h['pasta']}_1"
    tt = tl if tl < D / 2 else tl - D / 2
    z = 1.04 + 0.08 * eio(tt / (D / 2)); foco = (0.38 + 0.08 * eio(tt / (D / 2)), 0.62)
    caixa = (720, 150, 720 + 1100, 150 + 619)
    colar_zoom(im, clipe(nome, 0.3 + tt), caixa, z, foco, raio=24, borda=(cor, 4))
    # mini-quadro do retrato (arte do jogo)
    retrato = JOGO / 'assets' / 'herois' / {'Homem-Aranha': 'homem-aranha', 'Hulk': 'hulk', 'Gaviao': 'gaviao-arqueiro', 'Homem de Ferro': 'homem-de-ferro', 'DrEstranho': 'doutor-estranho', 'Wanda': 'wanda'}[h['id']]
    # tipografia cinética
    a, ds = entra(t, 0.25, 0.5, 40)
    texto_alfa(im, (110, 200), f"FASE {idx + 1}", fonte('tit', 34), cor, 'la', a, ds)
    nome_f = fonte('tit', 66 if len(h['nome']) < 16 else 52)
    for j, linha in enumerate(h['nome'].split(' ') if len(h['nome']) > 14 else [h['nome']]):
        aa, dd = entra(t, 0.35 + j * 0.1, 0.5, 40)
        texto_alfa(im, (106, 250 + j * 74), linha, nome_f, BRANCO, 'la', aa, dd)
    yb = 250 + 74 * (len(h['nome'].split(' ')) if len(h['nome']) > 14 else 1) + 30
    a2, d2 = entra(t, 0.7, 0.5, 24)
    linhas = quebrar(h['poder'], fonte('semi', 32), 560)
    for j, l in enumerate(linhas):
        texto_alfa(im, (110, yb + j * 44), l, fonte('semi', 32), (225, 230, 250), 'la', a2, d2, sombra=False)
    a3, d3 = entra(t, 1.0, 0.5, 24)
    yb2 = yb + len(linhas) * 44 + 30
    d = ImageDraw.Draw(im, 'RGBA')
    if a3 > 0:
        d.rounded_rectangle((110, yb2 + d3[1], 110 + 18, yb2 + 18 + d3[1]), radius=4, fill=cor + (int(255 * a3),))
    texto_alfa(im, (146, yb2 - 6), h['fato'], fonte('bold', 26), cor2, 'la', a3, d3, sombra=False)
    # legenda sob o clipe
    texto_alfa(im, (720, 800), 'Captura real do jogo', fonte('reg', 22), CINZA, 'la', 1.0, sombra=False)
    # transição temática entrando (primeiros 0,9 s) e saindo (últimos 0,7 s)
    im = vinheta(im, 0.4)
    if t < 0.9: im = fx_transicao(im, h['fx'], 0.5 + 0.5 * (t / 0.9), cor, cor2)
    if t > D - 0.7: im = fx_transicao(im, h['fx'], 0.5 * faixa(t, D - 0.7, D), cor, cor2)
    return im

def quebrar(s, f, larg):
    palavras, linhas, atual = s.split(' '), [], ''
    for p in palavras:
        teste = (atual + ' ' + p).strip()
        if f.getlength(teste) > larg and atual: linhas.append(atual); atual = p
        else: atual = teste
    if atual: linhas.append(atual)
    return linhas

# Técnicas de design: cada uma com um exemplo REAL do jogo e anotação
TECNICAS = [
    ('TEORIA DAS CORES', 'Uma paleta por herói: o jogador reconhece a fase pela cor', 'paleta'),
    ('HIERARQUIA VISUAL', 'Cubo e obstáculos na frente; cenário escurecido atrás', 'hierarquia'),
    ('CONTRASTE E LEITURA', 'Linha neon marca onde se pisa; triângulo = perigo', 'contraste'),
    ('COMPOSIÇÃO', 'Centro limpo para jogar; detalhes nas bordas da tela', 'composicao'),
    ('ANIMAÇÃO E MOVIMENTO', 'Parallax lento e transições curtas com ease-out', 'motion'),
    ('DESIGN DAS FASES', 'Obstáculos no ritmo da música, um desafio por vez', 'level'),
]
def cena_tecnicas(t, D):
    im, d = tela_base(t)
    a, ds = entra(t, 0.05, 0.5, 30)
    texto_alfa(im, (110, 80), 'TÉCNICAS DE DESIGN', fonte('tit', 54), OURO, 'la', a, ds)
    n = len(TECNICAS); dur = D / n; i = min(int(t / dur), n - 1); tl = t - i * dur
    nome, expl, tipo = TECNICAS[i]
    cores = [h['cor'] for h in HEROIS]; cor = cores[i % 6]
    caixa = (110, 230, 110 + 1180, 230 + 664)
    exemplo = {'paleta': None, 'hierarquia': 'Hulk_1', 'contraste': 'Gaviao_0', 'composicao': 'Homem_de_Ferro_1', 'motion': 'DrEstranho_0', 'level': 'Homem-Aranha_1'}[tipo]
    k = eo(faixa(tl, 0, 0.4))
    if tipo == 'paleta':
        # as 6 paletas reais (cor do herói + destaque), lado a lado, com um quadro de cada fase
        cw = caixa[2] - caixa[0]; w6 = cw / 6
        for j, h in enumerate(HEROIS):
            x0 = caixa[0] + j * w6; kk = eo(faixa(tl, j * 0.08, j * 0.08 + 0.4))
            colar_zoom(im, clipe(f"{h['pasta']}_0", 2.0), (x0 + 4, caixa[1] + (1 - kk) * 40, x0 + w6 - 4, caixa[3] - 140 + (1 - kk) * 40), 1.6, (0.35, 0.55), alpha=kk, raio=14)
            dd = ImageDraw.Draw(im)
            if kk > 0.05:
                dd.rectangle((x0 + 4, caixa[3] - 120, x0 + w6 - 4, caixa[3] - 70), fill=h['cor'])
                dd.rectangle((x0 + 4, caixa[3] - 64, x0 + w6 - 4, caixa[3] - 30), fill=h['cor2'])
    else:
        colar_zoom(im, clipe(exemplo, 0.3 + tl), caixa, 1.02 + 0.05 * eio(tl / dur), (0.4, 0.6), raio=22, borda=(cor, 3))
        dd = ImageDraw.Draw(im, 'RGBA'); x0, y0, x1, y1 = caixa; sx, sy = (x1 - x0) / 1280, (y1 - y0) / 720
        A = int(255 * k)
        if tipo == 'hierarquia':     # destaca o cubo (frente) e a faixa do cenário (atrás)
            dd.rectangle((x0, y0 + 100 * sy, x1, y0 + 560 * sy), outline=(150, 160, 200, A), width=2)
            texto_alfa(im, (x0 + 20, y0 + 110 * sy), 'cenário: fundo, escurecido', fonte('bold', 24), CINZA, 'la', k, sombra=True)
            dd.ellipse((x0 + 160 * sx, y0 + 520 * sy, x0 + 360 * sx, y0 + 700 * sy), outline=cor + (A,), width=5)
            texto_alfa(im, (x0 + 380 * sx, y0 + 600 * sy), 'jogador: frente, alto contraste', fonte('bold', 26), cor, 'la', k)
        elif tipo == 'contraste':    # linha do chão
            dd.line((x0, y0 + 662 * sy, x1, y0 + 662 * sy), fill=(255, 255, 255, A), width=4)
            texto_alfa(im, (x0 + 24, y0 + 600 * sy), 'superfície jogável = linha neon', fonte('bold', 26), BRANCO, 'la', k)
        elif tipo == 'composicao':   # terços e zona central limpa
            for f_ in (1 / 3, 2 / 3):
                dd.line((x0 + (x1 - x0) * f_, y0, x0 + (x1 - x0) * f_, y1), fill=(255, 255, 255, int(120 * k)), width=2)
                dd.line((x0, y0 + (y1 - y0) * f_, x1, y0 + (y1 - y0) * f_), fill=(255, 255, 255, int(120 * k)), width=2)
            dd.rectangle((x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, x0 + 2 * (x1 - x0) / 3, y0 + 2 * (y1 - y0) / 3), fill=cor + (int(40 * k),))
        elif tipo == 'motion':
            for j in range(5):
                yy = y0 + (120 + j * 100) * sy; ww = (x1 - x0) * (0.12 + j * 0.05) * eo(faixa(tl, 0.2, 1.2))
                dd.line((x1 - ww, yy, x1, yy), fill=(255, 201, 74, int(160 * k)), width=3)
            texto_alfa(im, (x0 + 24, y0 + 30), 'camadas: 0,01 → 0,18 da câmera', fonte('bold', 26), OURO, 'la', k)
        elif tipo == 'level':
            texto_alfa(im, (x0 + 24, y0 + 30), 'roteiro escrito à mão por fase', fonte('bold', 26), BRANCO, 'la', k)
    # texto da técnica
    a2, d2 = entra(tl, 0.1, 0.45, 30)
    texto_alfa(im, (1350, 300), f"{i + 1:02d}", fonte('tit', 60), cor, 'la', a2, d2)
    for j, l in enumerate(quebrar(nome, fonte('tit', 44), 480)):
        texto_alfa(im, (1350, 390 + j * 56), l, fonte('tit', 44), BRANCO, 'la', a2, d2)
    a3, d3 = entra(tl, 0.3, 0.45, 20)
    for j, l in enumerate(quebrar(expl, fonte('semi', 30), 470)):
        texto_alfa(im, (1352, 520 + j * 42), l, fonte('semi', 30), (215, 222, 245), 'la', a3, d3, sombra=False)
    return vinheta(im, 0.4)

# Tecnologias — conferidas no código (index.html, js/, tests/, assets/backgrounds/recortar.py)
TECH = [
    ('PHASER 3', 'Renderização, física Arcade e partículas', ['physics: {', "  default: 'arcade',", '  arcade: {', '    gravity: { y: MOVIMENTO.gravidade }', '  }', '}'], 'main.js'),
    ('JAVASCRIPT · POO', 'Uma classe por fase e por habilidade (método template)', ['class Fase {', '  criar() { ... } // chão, HUD', '}', 'class FaseHulk extends Fase {', '  ...', '}'], 'js/fases/'),
    ('HTML · CSS', 'Menu, seleção de fases e telas responsivas', ['<button class="level-btn"', '        data-level="Wanda">', '  Feiticeira Escarlate', '</button>'], 'index.html'),
    ('WEB AUDIO API', 'Trilha sintetizada no BPM de cada fase', ['const Contexto =', '  window.AudioContext ||', '  window.webkitAudioContext;', 'this.ctx.createOscillator();'], 'js/som.js'),
    ('PYTHON · PLAYWRIGHT', 'Testes automáticos com piloto automático', ['# Chromium sem tela, quadro a quadro', 'window.jogo.headlessStep(', '    window.__relogio, passo)', 'rt.instalar_bot(pg, BOTS[heroi])'], 'tests/'),
    ('PILLOW · OPENCV', 'Preparação dos cenários (recorte, inpainting, WebP)', ['im = cv2.inpaint(im, m, 5,', '        cv2.INPAINT_TELEA)', 'img = img.resize((w, h),', '        Image.LANCZOS)'], 'recortar.py'),
]
def cena_tech(t, D):
    im, d = tela_base(t, (20, 30, 70))
    a, ds = entra(t, 0.05, 0.5, 30)
    texto_alfa(im, (110, 80), 'TECNOLOGIAS', fonte('tit', 54), OURO, 'la', a, ds)
    texto_alfa(im, (112, 156), 'Tudo roda no navegador: HTML + CSS + JavaScript, sem instalação', fonte('semi', 28), CINZA, 'la', a, ds, sombra=False)
    n = len(TECH); dur = D / n
    d = ImageDraw.Draw(im, 'RGBA')
    for j, (nome, para, cod, arq) in enumerate(TECH):
        col, lin = j % 3, j // 3
        x0, y0 = 110 + col * 580, 250 + lin * 400
        k = eo(faixa(t, 0.25 + j * dur * 0.9, 0.25 + j * dur * 0.9 + 0.5))
        if k <= 0: continue
        dy = int((1 - k) * 40)
        d.rounded_rectangle((x0, y0 + dy, x0 + 540, y0 + 360 + dy), radius=20, fill=(14, 20, 48, int(240 * k)), outline=HEROIS[j]['cor'] + (int(255 * k),), width=3)
        texto_alfa(im, (x0 + 28, y0 + 24 + dy), nome, fonte('tit', 30), HEROIS[j]['cor'], 'la', k, sombra=False)
        for q, l in enumerate(quebrar(para, fonte('semi', 24), 490)):
            texto_alfa(im, (x0 + 28, y0 + 74 + q * 32 + dy), l, fonte('semi', 24), BRANCO, 'la', k, sombra=False)
        d = ImageDraw.Draw(im, 'RGBA')
        d.rounded_rectangle((x0 + 20, y0 + 150 + dy, x0 + 520, y0 + 340 + dy), radius=12, fill=(4, 6, 18, int(255 * k)))
        for q, l in enumerate(cod):
            texto_alfa(im, (x0 + 36, y0 + 160 + q * 28 + dy), l, fonte('mono', 18), (170, 230, 255), 'la', k, sombra=False)
        texto_alfa(im, (x0 + 520, y0 + 316 + dy), arq, fonte('reg', 17), CINZA, 'ra', k, sombra=False)
    return vinheta(im, 0.35)

SKILLS = [
    ('REA', 'Engenharia reversa por observação', 'Estudo das referências do gênero (layout, ritmo, cores). A skill de REA foi consultada; como não havia binário para analisar, a análise foi feita por observação (REA_ESQUEMA.md).', (255, 59, 85)),
    ('ANIMATE', 'Skill de animação (filosofia Emil Kowalski)', 'Decidir o que deve animar, curva ease-out e duração curta: portais, rastro, parallax.', (255, 194, 61)),
    ('EMIL DESIGN ENG', 'Skill de engenharia de design', 'Revisão de UI e movimento: detalhes invisíveis, legibilidade e feedback.', (176, 140, 255)),
    ('AGENTES', '3 agentes em paralelo (rodada 8)', 'Cenários, pulo e tela inicial divididos por arquivos; um agente principal integrou.', (111, 220, 74)),
    ('TESTES', 'Code review e testes de regressão', 'Cada mudança validada por 6 suítes (254 verificações) antes de enviar.', (92, 225, 255)),
]
def cena_skills(t, D):
    im, d = tela_base(t, (30, 20, 60))
    a, ds = entra(t, 0.05, 0.5, 30)
    texto_alfa(im, (110, 80), 'SKILLS USADAS', fonte('tit', 54), OURO, 'la', a, ds)
    n = len(SKILLS); dur = D / n
    for j, (nome, sub, expl, cor) in enumerate(SKILLS):
        y0 = 210 + j * 160
        k = eo(faixa(t, 0.2 + j * dur * 0.75, 0.2 + j * dur * 0.75 + 0.5))
        if k <= 0: continue
        dx = int((1 - k) * -60)
        d = ImageDraw.Draw(im, 'RGBA')
        d.rounded_rectangle((110 + dx, y0, 1810 + dx, y0 + 136), radius=18, fill=(14, 18, 44, int(235 * k)))
        d.rectangle((110 + dx, y0, 122 + dx, y0 + 136), fill=cor + (int(255 * k),))
        texto_alfa(im, (160 + dx, y0 + 24), nome, fonte('tit', 40), cor, 'la', k, sombra=False)
        texto_alfa(im, (160 + dx, y0 + 82), sub, fonte('bold', 24), BRANCO, 'la', k, sombra=False)
        for q, l in enumerate(quebrar(expl, fonte('reg', 24), 1020)[:3]):
            texto_alfa(im, (760 + dx, y0 + 22 + q * 32), l, fonte('reg', 24), (205, 212, 240), 'la', k, sombra=False)
    return vinheta(im, 0.35)

PASSOS = ['AUDITAR', 'DIAGNOSTICAR', 'IMPLEMENTAR', 'TESTAR', 'REVISAR']
CASOS = [
    ('Cubo tremendo em telas de 120 Hz', '8 px → 0,3 px', 'desenho e câmera interpolados entre passos fixos da física'),
    ('Pulo atrasado', '2 → 1 quadro', 'decisão do pulo no mesmo quadro do toque (coyote 90 ms, buffer 120 ms)'),
    ('Cubo da Feiticeira “parado” no ar', 'causa real', 'a tiara girava só até 45° e voltava; agora gira com o corpo'),
]
def cena_engenharia(t, D):
    im, d = tela_base(t, (16, 28, 60))
    a, ds = entra(t, 0.05, 0.5, 30)
    texto_alfa(im, (110, 80), 'ENGENHARIA COM IA', fonte('tit', 54), OURO, 'la', a, ds)
    texto_alfa(im, (112, 156), 'Não só imagens: cada problema medido, corrigido na causa e testado', fonte('semi', 28), CINZA, 'la', a, ds, sombra=False)
    d = ImageDraw.Draw(im, 'RGBA')
    # fluxo animado
    for j, p in enumerate(PASSOS):
        x = 110 + j * 350; k = eo(faixa(t, 0.4 + j * 0.25, 0.9 + j * 0.25))
        if k <= 0: continue
        cor = HEROIS[j]['cor']
        d.rounded_rectangle((x, 250, x + 300, 330), radius=40, outline=cor + (int(255 * k),), width=3, fill=(14, 20, 48, int(230 * k)))
        texto_alfa(im, (x + 150, 290), p, fonte('tit', 26), cor, 'mm', k, sombra=False)
        d = ImageDraw.Draw(im, 'RGBA')
        if j < 4:
            kk = eo(faixa(t, 0.7 + j * 0.25, 1.1 + j * 0.25))
            d.line((x + 300, 290, x + 300 + 50 * kk, 290), fill=(255, 255, 255, 200), width=3)
    for j, (prob, num, como) in enumerate(CASOS):
        y0 = 410 + j * 200; k = eo(faixa(t, 2.0 + j * 0.7, 2.5 + j * 0.7))
        if k <= 0: continue
        dd = int((1 - k) * 40)
        d = ImageDraw.Draw(im, 'RGBA')
        d.rounded_rectangle((110, y0 + dd, 1810, y0 + 170 + dd), radius=18, fill=(12, 16, 40, int(235 * k)))
        texto_alfa(im, (150, y0 + 26 + dd), prob, fonte('bold', 34), BRANCO, 'la', k, sombra=False)
        texto_alfa(im, (150, y0 + 90 + dd), como, fonte('reg', 26), (200, 208, 238), 'la', k, sombra=False)
        texto_alfa(im, (1770, y0 + 52 + dd), num, fonte('tit', 46), OURO, 'ra', k, sombra=False)
    return vinheta(im, 0.35)

def cena_final(t, D):
    im = Image.new('RGB', (W, H), (0, 0, 0))
    # montagem rápida (0–4,2 s): um quadro de cada herói, 0,7 s cada, com a transição dele
    if t < 4.2:
        i = min(int(t / 0.7), 5); h = HEROIS[i]; tl = t - i * 0.7
        colar_zoom(im, clipe(f"{h['pasta']}_1", 1.0 + tl), (0, 0, W, H), 1.05 + 0.08 * tl, (0.4, 0.6))
        im = vinheta(im, 0.5)
        im = fx_transicao(im, h['fx'], clamp(tl / 0.7) * 0.5 + 0.25, h['cor'], h['cor2'])
        return im
    tl = t - 4.2
    im, d = tela_base(tl, (14, 20, 52)); d = ImageDraw.Draw(im, 'RGBA')
    logo_cubo(d, W / 2, H / 2 - 190, 80, eo(faixa(tl, 0.0, 1.0)))
    a, ds = entra(tl, 0.3, 0.6, 40)
    texto_alfa(im, (W / 2, H / 2), 'GEOMETRY HEROES', fonte('tit', 110), BRANCO, 'mm', a, ds)
    a2, d2 = entra(tl, 0.9, 0.6, 20)
    texto_alfa(im, (W / 2, H / 2 + 120), 'Designed. Engineered. Built with AI.', fonte('semi', 44), OURO, 'mm', a2, d2, sombra=False)
    a3, d3 = entra(tl, 1.5, 0.6, 10)
    texto_alfa(im, (W / 2, H - 110), 'Projeto escolar de POO · feito em equipe · Phaser 3', fonte('reg', 26), CINZA, 'mm', a3, d3, sombra=False)
    # respiro final: escurece devagar nos últimos 1,6 s
    if t > D - 1.6: im = Image.blend(im, Image.new('RGB', (W, H), (0, 0, 0)), eio(faixa(t, D - 1.6, D)))
    return vinheta(im)

# ================================================================
# LINHA DO TEMPO (total ≈ 123,6 s, a duração da música)
# ================================================================
DUR_MUSICA = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', MUSICA], capture_output=True, text=True).stdout.strip() or 120)
LINHA = [('abertura', 7.0), ('jogo', 14.6)] + [(f'heroi{i}', 8.0) for i in range(6)] + \
        [('tecnicas', 16.0), ('tech', 11.0), ('skills', 10.0), ('engenharia', 9.0)]
resto = DUR_MUSICA - sum(d for _, d in LINHA)
LINHA.append(('final', max(7.0, resto)))
TOTAL = sum(d for _, d in LINHA)

def quadro(tg):
    acc = 0
    for nome, dur in LINHA:
        if tg < acc + dur:
            t = tg - acc
            if nome == 'abertura': return cena_abertura(t, dur)
            if nome == 'jogo': return cena_jogo(t, dur)
            if nome.startswith('heroi'): i = int(nome[5:]); return cena_heroi(t, dur, HEROIS[i], i)
            if nome == 'tecnicas': return cena_tecnicas(t, dur)
            if nome == 'tech': return cena_tech(t, dur)
            if nome == 'skills': return cena_skills(t, dur)
            if nome == 'engenharia': return cena_engenharia(t, dur)
            return cena_final(t, dur)
        acc += dur
    return cena_final(LINHA[-1][1], LINHA[-1][1])

def fade_entre(tg, img):
    # crossfade curto (0,25 s) nas emendas entre cenas que não têm transição própria
    acc = 0
    for nome, dur in LINHA[:-1]:
        acc += dur
        if abs(tg - acc) < 0.12:
            k = 1 - abs(tg - acc) / 0.12
            return Image.blend(img, Image.new('RGB', (W, H), (0, 0, 0)), 0.55 * k)
    return img

if __name__ == '__main__':
    so = None
    if '--quadros' in sys.argv:   # gera só alguns quadros de checagem
        for tg in [float(x) for x in sys.argv[sys.argv.index('--quadros') + 1].split(',')]:
            quadro(tg).save(str(V / f'chk_{tg:06.2f}.jpg'), quality=88)
        sys.exit(0)
    print(f'total {TOTAL:.1f}s · música {DUR_MUSICA:.1f}s · {int(TOTAL * FPS)} quadros', flush=True)
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', MUSICA, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-af', f'afade=t=out:st={TOTAL - 3:.2f}:d=3', '-shortest', '-movflags', '+faststart', SAIDA]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(TOTAL * FPS)
    for i in range(n):
        tg = i / FPS
        img = fade_entre(tg, quadro(tg))
        pr.stdin.write(img.tobytes())
        if i % 300 == 0: print(f'{i}/{n}', flush=True)
    pr.stdin.close(); pr.wait()
    print('ok', SAIDA)
