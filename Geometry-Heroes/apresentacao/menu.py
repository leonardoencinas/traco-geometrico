import sys, pathlib
from playwright.sync_api import sync_playwright
S = pathlib.Path(sys.argv[1]); URL = pathlib.Path('tests/teste.html').resolve().as_uri()
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
    ctx = b.new_context(viewport={'width':1280,'height':720}, record_video_dir=str(S/'menu'), record_video_size={'width':1280,'height':720})
    pg = ctx.new_page(); pg.goto(URL)
    pg.wait_for_function("window.jogo && window.jogo.scene.isActive('Menu')", timeout=15000)
    pg.wait_for_timeout(4500)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
    for i in range(5): pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(1100)
    pg.wait_for_timeout(800)
    ctx.close(); b.close()
