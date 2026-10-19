# ================================================================
# compor2.py — versão 2 do vídeo: transições no estilo dos efeitos dos filmes da Marvel entre as cenas
# (portal do Doutor Estranho, teia puxando a tela, flecha cortando, força estilhaçando, realidade
# vermelha) e ZOOM nas explicações (o cartão em foco cresce e fica legível).
# Reaproveita as cenas e o material de compor.py. Uso igual: compor2.py <pasta> <musica> <saida.mp4>
# ================================================================
import sys, math, random, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import compor as C
from compor import W, H, FPS, eo, eio, faixa, clamp, fonte, texto_alfa, quebrar, entra, tela_base, vinheta, HEROIS, OURO, BRANCO, CINZA

YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
CX, CY = W / 2, H / 2
RR = np.sqrt((XX - CX) ** 2 + (YY - CY) ** 2)

def arr(im): return np.asarray(im, dtype=np.float32)
def img(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
def misturar(A, B, m):   # m: máscara 0..1 (1 = B)
    m = m[..., None]; return img(arr(A) * (1 - m) + arr(B) * m)
def escalar(im, s, cx=CX, cy=CY):
    if abs(s - 1) < 1e-3: return im
    w, h = W / s, H / s
    cx = clamp(cx, w / 2, W - w / 2); cy = clamp(cy, h / 2, H - h / 2)   # enquadramento não sai da imagem
    return im.crop((int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2))).resize((W, H), Image.BILINEAR)

# ---------------- TRANSIÇÕES (A = tela que sai, B = tela que entra, p = 0..1) ----------------
def tr_portal(A, B, p):
    """Portal do Doutor Estranho: anel de faíscas abre no centro e a próxima tela aparece dentro dele."""
    r = 1250 * eio(p) ** 1.1
    m = np.clip((r - RR) / 8 + 0.5, 0, 1)
    out = misturar(A, escalar(B, 1 + 0.18 * (1 - p)), m)
    if r < 4: return out
    d = ImageDraw.Draw(out, 'RGBA'); rnd = random.Random(11); giro = p * 9
    k = math.sin(math.pi * clamp(p * 1.15))
    d.ellipse((CX - r - 10, CY - r - 10, CX + r + 10, CY + r + 10), outline=(255, 123, 0, int(80 * k)), width=22)
    for j in range(220):
        a = j / 220 * 2 * math.pi + giro + rnd.uniform(-.02, .02)
        rr = r + rnd.uniform(-10, 10); L = rnd.uniform(18, 44)
        x, y = CX + math.cos(a) * rr, CY + math.sin(a) * rr
        x2, y2 = x + math.cos(a + 1.5708) * L, y + math.sin(a + 1.5708) * L
        d.line([(x, y), (x2, y2)], fill=(255, rnd.choice([150, 190, 220, 240]), rnd.choice([40, 80, 140]), int(255 * k)), width=rnd.choice([2, 3, 3]))
    for j in range(60):   # faíscas soltando e caindo
        a = rnd.uniform(0, 2 * math.pi); dd = r + rnd.uniform(0, 70) * k
        x, y = CX + math.cos(a) * dd, CY + math.sin(a) * dd + rnd.uniform(0, 60) * p
        d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(255, 220, 140, int(220 * k)))
    return out

def tr_teia(A, B, p):
    """Teia do Homem-Aranha: fios grudam na tela e a puxam para fora, revelando a próxima."""
    fonte_teia = (W + 220, H * 0.18)
    k1 = eo(faixa(p, 0.0, 0.32)); k2 = eio(faixa(p, 0.30, 1.0))
    dx = int(W * 1.15 * k2 ** 1.6); s = 1 - 0.12 * k2; ang = -6 * k2
    out = img(arr(B) * (0.55 + 0.45 * k2))
    a2 = A.resize((int(W * s), int(H * s)), Image.BILINEAR).rotate(ang, expand=True, resample=Image.BILINEAR, fillcolor=(0, 0, 0))
    mascara = Image.new('L', A.size, 255).resize((int(W * s), int(H * s))).rotate(ang, expand=True)
    ox = int((W - a2.width) / 2) + dx; oy = int((H - a2.height) / 2)
    out.paste(a2, (ox, oy), mascara)
    d = ImageDraw.Draw(out, 'RGBA')
    ancoras = [(0.18, 0.22), (0.12, 0.55), (0.22, 0.85)]
    for (fx, fy) in ancoras:
        ax = ox + fx * a2.width; ay = oy + fy * a2.height
        ex = fonte_teia[0] + (ax - fonte_teia[0]) * k1; ey = fonte_teia[1] + (ay - fonte_teia[1]) * k1
        d.line([fonte_teia, (ex, ey)], fill=(245, 248, 255, 235), width=4)
        d.line([fonte_teia, (ex, ey)], fill=(200, 210, 255, 90), width=10)
        if k1 > 0.95:   # "gota" de teia grudada
            for q in range(6):
                aa = q / 6 * 2 * math.pi
                d.line([(ax, ay), (ax + math.cos(aa) * 26, ay + math.sin(aa) * 26)], fill=(245, 248, 255, 220), width=2)
            d.ellipse((ax - 18, ay - 18, ax + 18, ay + 18), outline=(245, 248, 255, 200), width=2)
    return out

def tr_flecha(A, B, p):
    """Flecha do Gavião Arqueiro: atravessa a tela e a imagem é cortada atrás dela."""
    yc = H * 0.5; inc = -0.12
    xa = -300 + (W + 700) * eo(p * 1.05)
    borda = xa - 60 - (YY - yc) * 0.35
    m = np.clip((borda - XX) / 6, 0, 1)
    out = misturar(A, B, m)
    d = ImageDraw.Draw(out, 'RGBA'); y = yc + (xa - CX) * inc * 0.2
    for j in range(7):   # rastro de movimento
        yy = y + (j - 3) * 7; L = 260 + j * 30
        d.line([(xa - 40 - L, yy), (xa - 40, yy)], fill=(184, 255, 90, 60 + 20 * (3 - abs(j - 3))), width=2)
    d.line([(xa - 240, y), (xa - 10, y)], fill=(235, 235, 245, 255), width=6)          # haste
    d.polygon([(xa + 34, y), (xa - 14, y - 16), (xa - 4, y), (xa - 14, y + 16)], fill=(167, 123, 255, 255))   # ponta
    d.polygon([(xa - 240, y), (xa - 275, y - 22), (xa - 205, y)], fill=(184, 255, 90, 255))   # penas
    d.polygon([(xa - 240, y), (xa - 275, y + 22), (xa - 205, y)], fill=(150, 220, 70, 255))
    return out

def tr_forca(A, B, p):
    """Força do Hulk: impacto (tremor + rachaduras) e a tela se estilhaça em pedaços que caem."""
    rnd = random.Random(5)
    if p < 0.28:
        k = p / 0.28; sh = int(22 * (1 - k * 0.3))
        out = Image.new('RGB', (W, H), (0, 0, 0)); out.paste(A, (rnd.randint(-sh, sh) if k > 0 else 0, rnd.randint(-sh, sh)))
        d = ImageDraw.Draw(out, 'RGBA')
        for j in range(10):
            x, y = CX, CY; ang = j / 10 * 2 * math.pi + rnd.uniform(-.25, .25); pts = [(x, y)]
            for s_ in range(10):
                ang += rnd.uniform(-.4, .4); step = 110 * eo(k); x += math.cos(ang) * step; y += math.sin(ang) * step; pts.append((x, y))
            d.line(pts, fill=(111, 220, 74, 230), width=5); d.line(pts, fill=(255, 255, 255, 230), width=2)
        return out
    k = (p - 0.28) / 0.72
    sh = int(14 * (1 - k)); out = Image.new('RGB', (W, H), (0, 0, 0))
    out.paste(B, (rnd.randint(-sh, sh), rnd.randint(-sh, sh)))
    # cacos: grade irregular de triângulos, cada um voa do centro, gira e cai
    cols, lins = 8, 5; pts = {}
    for i in range(cols + 1):
        for j in range(lins + 1):
            jx = 0 if i in (0, cols) else rnd.uniform(-60, 60); jy = 0 if j in (0, lins) else rnd.uniform(-50, 50)
            pts[(i, j)] = (i * W / cols + jx, j * H / lins + jy)
    for i in range(cols):
        for j in range(lins):
            for tri in ([(i, j), (i + 1, j), (i + 1, j + 1)], [(i, j), (i + 1, j + 1), (i, j + 1)]):
                P = [pts[q] for q in tri]
                x0, y0 = int(min(q[0] for q in P)), int(min(q[1] for q in P)); x1, y1 = int(max(q[0] for q in P)) + 1, int(max(q[1] for q in P)) + 1
                cx_, cy_ = sum(q[0] for q in P) / 3, sum(q[1] for q in P) / 3
                vx, vy = (cx_ - CX) / 600, (cy_ - CY) / 600
                rnd2 = random.Random(int(cx_ * 7 + cy_))
                vel = rnd2.uniform(700, 1300)
                tx = vx * vel * k; ty = vy * vel * k + 1600 * k * k; rot = rnd2.uniform(-120, 120) * k
                alfa = 1 - faixa(k, 0.55, 1.0)
                if alfa <= 0: continue
                caco = A.crop((x0, y0, x1, y1)); mk = Image.new('L', caco.size, 0)
                ImageDraw.Draw(mk).polygon([(q[0] - x0, q[1] - y0) for q in P], fill=int(255 * alfa))
                caco = caco.rotate(rot, expand=True, resample=Image.BILINEAR); mk = mk.rotate(rot, expand=True)
                out.paste(caco, (int(cx_ + tx - caco.width / 2), int(cy_ + ty - caco.height / 2)), mk)
    return out

def tr_realidade(A, B, p):
    """Realidade da Feiticeira Escarlate: onda de energia vermelha distorce a imagem e troca a realidade."""
    rr = 1250 * eio(p)
    banda = np.exp(-((RR - rr) / 110) ** 2)                      # perto da frente da onda
    desl = 26 * banda * np.sin((RR - rr) / 14)                     # ondulação radial
    ux = np.where(RR > 0, (XX - CX) / np.maximum(RR, 1), 0); uy = np.where(RR > 0, (YY - CY) / np.maximum(RR, 1), 0)
    sx = np.clip(XX + ux * desl, 0, W - 1).astype(np.int32); sy = np.clip(YY + uy * desl, 0, H - 1).astype(np.int32)
    a, b = arr(A), arr(B)
    m = np.clip((rr - RR) / 10 + 0.5, 0, 1)[..., None]
    mix = a * (1 - m) + b * m
    dist = mix[sy, sx]
    # separação de cor (vermelho para fora, azul para dentro) na frente da onda
    ab = (banda * 9).astype(np.int32)
    xr = np.clip(sx + ab, 0, W - 1); xb = np.clip(sx - ab, 0, W - 1)
    dist[..., 0] = mix[sy, xr, 0]; dist[..., 2] = mix[sy, xb, 2]
    # tinta escarlate: forte na onda, fraca no resto (pico no meio da transição)
    pico = math.sin(math.pi * p)
    tinta = (0.35 * banda + 0.18 * pico)[..., None]
    dist = dist * (1 - tinta) + np.array([255, 30, 70], np.float32) * tinta
    out = img(dist)
    d = ImageDraw.Draw(out, 'RGBA'); rnd = random.Random(int(p * 1000) // 40)
    for j in range(70):
        ang = rnd.uniform(0, 2 * math.pi); r = rr + rnd.uniform(-60, 60); s = rnd.uniform(2, 5)
        x, y = CX + math.cos(ang) * r, CY + math.sin(ang) * r
        d.ellipse((x - s, y - s, x + s, y + s), fill=(255, rnd.choice([42, 90, 143]), 120, int(230 * pico)))
    return out

def tr_hud(A, B, p):
    """Homem de Ferro: varredura de interface (faixas revelam a próxima tela) com retícula de mira."""
    faixas = 12; out = A.copy(); hb = H / faixas
    for i in range(faixas):
        k = eio(faixa(p, i * 0.035, 0.55 + i * 0.035))
        if k <= 0: continue
        w = int(W * k); y0 = int(i * hb); y1 = int((i + 1) * hb)
        out.paste(B.crop((0, y0, w, y1)), (0, y0))
        ImageDraw.Draw(out, 'RGBA').line([(w, y0), (w, y1)], fill=(92, 225, 255, 220), width=3)
    d = ImageDraw.Draw(out, 'RGBA'); k = math.sin(math.pi * p); r = 140 + 260 * eo(p)
    d.ellipse((CX - r, CY - r, CX + r, CY + r), outline=(255, 194, 61, int(220 * k)), width=3)
    d.arc((CX - r * .75, CY - r * .75, CX + r * .75, CY + r * .75), p * 400, p * 400 + 230, fill=(92, 225, 255, int(230 * k)), width=6)
    for a in range(0, 360, 90):
        ar = math.radians(a + p * 90)
        d.line([(CX + math.cos(ar) * (r + 10), CY + math.sin(ar) * (r + 10)), (CX + math.cos(ar) * (r + 50), CY + math.sin(ar) * (r + 50))], fill=(255, 194, 61, int(230 * k)), width=4)
    return out

TRANS = {'portal': tr_portal, 'teia': tr_teia, 'flecha': tr_flecha, 'forca': tr_forca, 'realidade': tr_realidade, 'hud': tr_hud}

# ---------------- CENAS COM ZOOM NAS EXPLICAÇÕES ----------------
def cena_heroi_sem_fx(t, D, h, idx):
    orig = C.fx_transicao; C.fx_transicao = lambda base, *a, **k: base   # a transição agora é entre as cenas
    try: return C.cena_heroi(t, D, h, idx)
    finally: C.fx_transicao = orig

def cena_tecnicas_zoom(t, D):
    im = C.cena_tecnicas(t, D)
    n = len(C.TECNICAS); dur = D / n; tl = t - min(int(t / dur), n - 1) * dur
    # câmera aproxima do texto da técnica para leitura e volta antes da próxima
    z = 1 + 0.42 * eio(faixa(tl, 0.75, 1.25)) * (1 - eio(faixa(tl, dur - 0.35, dur)))
    return escalar(im, z, 1560, 470) if z > 1.001 else im

def cartao_tech(im, j, x0, y0, s, alfa):
    nome, para, cod, arq = C.TECH[j]; cor = HEROIS[j]['cor']
    d = ImageDraw.Draw(im, 'RGBA'); A = int(255 * alfa)
    d.rounded_rectangle((x0, y0, x0 + 540 * s, y0 + 360 * s), radius=int(20 * s), fill=(14, 20, 48, int(245 * alfa)), outline=cor + (A,), width=max(2, int(3 * s)))
    texto_alfa(im, (x0 + 28 * s, y0 + 24 * s), nome, fonte('tit', int(30 * s)), cor, 'la', alfa, sombra=False)
    for q, l in enumerate(quebrar(para, fonte('semi', int(24 * s)), 490 * s)):
        texto_alfa(im, (x0 + 28 * s, y0 + 74 * s + q * 32 * s), l, fonte('semi', int(24 * s)), BRANCO, 'la', alfa, sombra=False)
    d = ImageDraw.Draw(im, 'RGBA')
    d.rounded_rectangle((x0 + 20 * s, y0 + 150 * s, x0 + 520 * s, y0 + 340 * s), radius=int(12 * s), fill=(4, 6, 18, A))
    for q, l in enumerate(cod):
        texto_alfa(im, (x0 + 36 * s, y0 + 160 * s + q * 28 * s), l, fonte('mono', int(18 * s)), (170, 230, 255), 'la', alfa, sombra=False)
    texto_alfa(im, (x0 + 520 * s, y0 + 342 * s), arq, fonte('reg', int(17 * s)), CINZA, 'rb', alfa, sombra=False)

def cena_tech_zoom(t, D):
    im, d = tela_base(t, (20, 30, 70))
    a, ds = entra(t, 0.05, 0.5, 30)
    texto_alfa(im, (110, 80), 'TECNOLOGIAS', fonte('tit', 54), OURO, 'la', a, ds)
    texto_alfa(im, (112, 156), 'Tudo roda no navegador: HTML + CSS + JavaScript, sem instalação', fonte('semi', 28), CINZA, 'la', a, ds, sombra=False)
    n = len(C.TECH); intro = 1.3; dur = (D - intro) / n
    foco = int((t - intro) / dur) if t >= intro else -1; foco = min(foco, n - 1)
    tl = (t - intro) - foco * dur if foco >= 0 else 0
    ki = eio(faixa(tl, 0, 0.4)) * (1 - eio(faixa(tl, dur - 0.3, dur))) if foco >= 0 else 0
    for j in range(n):
        if j == foco: continue
        col, lin = j % 3, j // 3; x0, y0 = 110 + col * 580, 250 + lin * 400
        k = eo(faixa(t, 0.2 + j * 0.12, 0.6 + j * 0.12))
        if k > 0: cartao_tech(im, j, x0, y0 + (1 - k) * 40, 1.0, k * (1 - 0.65 * ki))
    if foco >= 0:
        j = foco; col, lin = j % 3, j // 3; gx, gy = 110 + col * 580, 250 + lin * 400
        s = 1 + 0.95 * ki; bx, by = (W - 540 * 1.95) / 2, 225
        cartao_tech(im, j, gx + (bx - gx) * ki, gy + (by - gy) * ki, s, 1.0)
    return vinheta(im, 0.35)

def cartao_grande(im, k, titulo, sub, expl, cor, numero):
    """Cartão em foco (zoom): cresce do tamanho pequeno até ocupar o centro, texto grande."""
    s = 0.55 + 0.45 * eo(k); a = clamp(k * 1.4)
    w, h = 1560 * s, 560 * s; x0, y0 = (W - w) / 2, 300 + (1 - s) * 120
    d = ImageDraw.Draw(im, 'RGBA')
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=int(28 * s), fill=(12, 16, 42, int(245 * a)), outline=cor + (int(255 * a),), width=4)
    d.rectangle((x0, y0 + 30 * s, x0 + 14 * s, y0 + h - 30 * s), fill=cor + (int(255 * a),))
    texto_alfa(im, (x0 + 70 * s, y0 + 50 * s), numero, fonte('tit', int(40 * s)), cor, 'la', a, sombra=False)
    texto_alfa(im, (x0 + 70 * s, y0 + 110 * s), titulo, fonte('tit', int(84 * s)), BRANCO, 'la', a, sombra=False)
    texto_alfa(im, (x0 + 74 * s, y0 + 222 * s), sub, fonte('bold', int(40 * s)), cor, 'la', a, sombra=False)
    for q, l in enumerate(quebrar(expl, fonte('reg', int(38 * s)), 1400 * s)[:4]):
        texto_alfa(im, (x0 + 74 * s, y0 + 300 * s + q * 52 * s), l, fonte('reg', int(38 * s)), (215, 222, 248), 'la', a, sombra=False)

def cena_skills_zoom(t, D):
    im, d = tela_base(t, (30, 20, 60))
    a, ds = entra(t, 0.05, 0.5, 30)
    texto_alfa(im, (110, 80), 'SKILLS USADAS', fonte('tit', 54), OURO, 'la', a, ds)
    n = len(C.SKILLS); dur = D / n; i = min(int(t / dur), n - 1); tl = t - i * dur
    # trilha de chips no topo (onde estamos)
    for j, (nome, _, _, cor) in enumerate(C.SKILLS):
        x = 110 + j * 340; ativo = j == i
        dd = ImageDraw.Draw(im, 'RGBA')
        dd.rounded_rectangle((x, 175, x + 310, 235), radius=30, fill=cor + (255 if ativo else 40,), outline=cor + (255,), width=2)
        texto_alfa(im, (x + 155, 205), nome, fonte('tit', 22), (10, 12, 30) if ativo else cor, 'mm', 1.0, sombra=False)
    nome, sub, expl, cor = C.SKILLS[i]
    k = eo(faixa(tl, 0, 0.45)) * (1 - eio(faixa(tl, dur - 0.25, dur)))
    cartao_grande(im, k, nome, sub, expl, cor, f"{i + 1:02d}")
    return vinheta(im, 0.35)

def cena_engenharia_zoom(t, D):
    im, d = tela_base(t, (16, 28, 60))
    a, ds = entra(t, 0.05, 0.5, 30)
    texto_alfa(im, (110, 80), 'ENGENHARIA COM IA', fonte('tit', 54), OURO, 'la', a, ds)
    d = ImageDraw.Draw(im, 'RGBA')
    for j, pss in enumerate(C.PASSOS):
        x = 110 + j * 350; k = eo(faixa(t, 0.2 + j * 0.15, 0.6 + j * 0.15)); cor = HEROIS[j]['cor']
        if k <= 0: continue
        d.rounded_rectangle((x, 175, x + 300, 245), radius=35, outline=cor + (int(255 * k),), width=3, fill=(14, 20, 48, int(230 * k)))
        texto_alfa(im, (x + 150, 210), pss, fonte('tit', 24), cor, 'mm', k, sombra=False)
        d = ImageDraw.Draw(im, 'RGBA')
        if j < 4: d.line((x + 300, 210, x + 350, 210), fill=(255, 255, 255, int(200 * k)), width=3)
    intro = 1.2; n = len(C.CASOS); dur = (D - intro) / n
    if t >= intro:
        i = min(int((t - intro) / dur), n - 1); tl = (t - intro) - i * dur
        prob, num, como = C.CASOS[i]
        k = eo(faixa(tl, 0, 0.45)) * (1 - eio(faixa(tl, dur - 0.25, dur)))
        cartao_grande(im, k, num.upper(), prob, como, HEROIS[(i * 2) % 6]['cor'], f"CASO {i + 1}")
    return vinheta(im, 0.35)

# ---------------- LINHA DO TEMPO + TRANSIÇÕES ----------------
LINHA = [('abertura', 7.0), ('jogo', 13.6)] + [(f'heroi{i}', 7.5) for i in range(6)] + \
        [('tecnicas', 15.0), ('tech', 14.0), ('skills', 11.0), ('engenharia', 9.5)]
LINHA.append(('final', max(7.0, C.DUR_MUSICA - sum(d for _, d in LINHA))))
TOTAL = sum(d for _, d in LINHA)
# transição na emenda que TERMINA a cena i (o herói da cena seguinte "abre" a tela dele)
EMENDAS = ['portal', 'teia', 'forca', 'flecha', 'hud', 'portal', 'realidade', 'teia', 'hud', 'portal', 'flecha', 'forca']
MEIA = 0.5   # meia duração da transição (s)

def cena(nome, t, dur):
    if nome == 'abertura': return C.cena_abertura(t, dur)
    if nome == 'jogo': return C.cena_jogo(t, dur)
    if nome.startswith('heroi'): i = int(nome[5:]); return cena_heroi_sem_fx(t, dur, HEROIS[i], i)
    if nome == 'tecnicas': return cena_tecnicas_zoom(t, dur)
    if nome == 'tech': return cena_tech_zoom(t, dur)
    if nome == 'skills': return cena_skills_zoom(t, dur)
    if nome == 'engenharia': return cena_engenharia_zoom(t, dur)
    return C.cena_final(t, dur)

def quadro(tg):
    ini = [0]
    for _, d in LINHA: ini.append(ini[-1] + d)
    for i, (nome, dur) in enumerate(LINHA):
        if tg < ini[i + 1] or i == len(LINHA) - 1:
            t = tg - ini[i]
            # perto do fim da cena i (ou do começo dela): transição com a vizinha
            if i < len(LINHA) - 1 and t > dur - MEIA:
                p = (t - (dur - MEIA)) / (2 * MEIA)
                A = cena(nome, min(t, dur - 1e-3), dur); nb, db = LINHA[i + 1]; B = cena(nb, 0.0, db)
                return TRANS[EMENDAS[i]](A, B, p)
            if i > 0 and t < MEIA:
                p = 0.5 + t / (2 * MEIA)
                na, da = LINHA[i - 1]; A = cena(na, da - 1e-3, da); B = cena(nome, t, dur)
                return TRANS[EMENDAS[i - 1]](A, B, p)
            return cena(nome, t, dur)

if __name__ == '__main__':
    if '--quadros' in sys.argv:
        for tg in [float(x) for x in sys.argv[sys.argv.index('--quadros') + 1].split(',')]:
            quadro(tg).save(str(C.V / f'v2_{tg:07.2f}.jpg'), quality=88)
        sys.exit(0)
    print(f'total {TOTAL:.1f}s · música {C.DUR_MUSICA:.1f}s · {int(TOTAL * FPS)} quadros', flush=True)
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', C.MUSICA, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-af', f'afade=t=out:st={TOTAL - 3:.2f}:d=3', '-shortest', '-movflags', '+faststart', C.SAIDA]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(TOTAL * FPS)
    for i in range(n):
        pr.stdin.write(quadro(i / FPS).tobytes())
        if i % 300 == 0: print(f'{i}/{n}', flush=True)
    pr.stdin.close(); pr.wait()
    print('ok', C.SAIDA)
