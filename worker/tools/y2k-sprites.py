# Рендерит хромовые спрайты Y2K-темы в public/themes/y2k/*.webp и печатает их размеры для y2k.js.
# Запуск (нужен Chromium из Playwright, например из Scrapling):
#   ~/.local/share/uv/tools/scrapling/bin/python tools/y2k-sprites.py
import base64, json, pathlib
from playwright.sync_api import sync_playwright

here = pathlib.Path(__file__).resolve().parent
out = here.parent / "public" / "themes" / "y2k"
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"], headless=True, channel="chromium")
    pg = b.new_page()
    pg.goto((here / "y2k-sprites.html").as_uri())
    pg.wait_for_function("window.ready === true", timeout=60000)
    res = pg.evaluate("window.renderAll()")
    b.close()
meta = {}
for name, r in res.items():
    data = base64.b64decode(r["url"].split(",", 1)[1])
    (out / f"{name}.webp").write_bytes(data)
    meta[name] = {"w": r["w"], "h": r["h"], "aspect": round(r["aspect"], 4), "kb": round(len(data) / 1024, 1)}
print(json.dumps(meta, indent=1))
