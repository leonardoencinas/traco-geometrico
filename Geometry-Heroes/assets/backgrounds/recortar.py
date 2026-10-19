# Recorta a área de arte limpa de cada prévia do Gemini, apaga textos/logos por inpainting e exporta o fundo
import sys, os, numpy as np, cv2
from PIL import Image
UP = '/root/.claude/uploads/0a3989e0-ea2b-5f53-af07-49eaeefabead/'
OUT = sys.argv[1]
K = 2752 / 2000  # coordenadas medidas na imagem exibida a 2000 px
# heroi: (arquivo, recorte (x0,y0,x1,y1), [retângulos a apagar] — tudo em coordenadas de exibição)
CENAS = {
    'homem-de-ferro': ('1bef59bd', (0, 86, 2000, 800), [(940, 225, 1030, 310)]),
    'gaviao':         ('99960819', (668, 284, 1948, 940), []),
    'dr-estranho':    ('96dd4064', (576, 274, 1972, 765), []),
    'wanda':          ('9b84493b', (0, 86, 2000, 585), []),
    'hulk':           ('7173c56c', (668, 284, 1948, 860), []),
    'homem-aranha':   ('f20e3c68', (0, 0, 2000, 870), [(10, 5, 510, 50), (10, 262, 525, 305), (10, 442, 550, 485),
                                                     # aros neon da arte (pareciam portais do jogo)
                                                     (340, 512, 428, 658), (780, 422, 868, 562), (1752, 478, 1848, 622)]),
}
for heroi, (arq, (x0, y0, x1, y1), apagar) in CENAS.items():
    im = cv2.imread(UP + arq + '-image.jpg')
    m = np.zeros(im.shape[:2], np.uint8)
    for (a, b, c, d) in apagar: m[int(b*K):int(d*K), int(a*K):int(c*K)] = 255
    if heroi == 'homem-aranha':
        # Faixa preta atrás dos prédios distantes (fundo da camada original): vira céu
        y_a, y_b = int(250*K), int(372*K)
        faixa = im[y_a:y_b]
        preto = (faixa.max(axis=2) < 46)
        # Cor do céu logo acima da faixa (média por coluna), escurecendo um pouco pra baixo
        ceu = im[y_a - 12:y_a - 2].mean(axis=0)
        for k in range(y_b - y_a):
            t = k / (y_b - y_a)
            cor = (ceu * (1 - 0.35 * t)).astype(np.uint8)
            linha = faixa[k]; linha[preto[k]] = cor[preto[k]]
        # Suaviza só a emenda entre o céu pintado e os prédios
        borda = cv2.dilate(preto.astype(np.uint8), np.ones((5, 5), np.uint8)) - cv2.erode(preto.astype(np.uint8), np.ones((5, 5), np.uint8))
        m[y_a:y_b][borda > 0] = 255
    if m.any(): im = cv2.inpaint(im, m, 5, cv2.INPAINT_TELEA)
    rec = im[int(y0*K):int(y1*K), int(x0*K):int(x1*K)]
    img = Image.fromarray(cv2.cvtColor(rec, cv2.COLOR_BGR2RGB))
    # Altura final 720 px (altura do jogo), largura proporcional
    h = 720; w = round(img.width * h / img.height)
    img = img.resize((w, h), Image.LANCZOS)
    os.makedirs(f'{OUT}/{heroi}', exist_ok=True)
    img.save(f'{OUT}/{heroi}/{heroi}_cena.webp', quality=86, method=6)
    print(heroi, 'recorte', rec.shape[1], 'x', rec.shape[0], '-> usado', w, 'x', h, os.path.getsize(f'{OUT}/{heroi}/{heroi}_cena.webp') // 1024, 'KB')
