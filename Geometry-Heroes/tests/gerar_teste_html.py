# Gera tests/teste.html a partir do index.html: troca o Phaser do CDN pelo arquivo local
# e ajusta os caminhos (o teste fica dentro da pasta tests/)
import re, pathlib, json
raiz = pathlib.Path(__file__).resolve().parent.parent
html = (raiz / 'index.html').read_text(encoding='utf-8')
html = html.replace('https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js', '../phaser.local.min.js')
html = html.replace('href="style.css"', 'href="../style.css"')
html = re.sub(r'src="(js/[^"]+|main\.js|assets/[^"]+)"', r'src="../\1"', html)
# Artes de fundo (CENARIOS_IMAGEM): a página de teste fica em tests/ (prefixo ../) e abre em file://,
# onde o WebGL recusa imagens de arquivo local — por isso as cenas vão embutidas como data: URI
import base64
dados = {}
for arq in sorted((raiz / 'assets' / 'backgrounds').glob('*/*.webp')):
    rel = arq.relative_to(raiz).as_posix()
    dados[rel] = 'data:image/webp;base64,' + base64.b64encode(arq.read_bytes()).decode()
inj = "<script>window.BASE_ASSETS='../'; window.DADOS_ASSETS=" + json.dumps(dados) + ";</script>\n        "
html = html.replace('<script src="js/config.js">', inj + '<script src="js/config.js">', 1).replace('<script src="../js/config.js">', inj + '<script src="../js/config.js">', 1)
(raiz / 'tests' / 'teste.html').write_text(html, encoding='utf-8')
print('tests/teste.html gerado')
