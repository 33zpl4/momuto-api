# Build a per-template asset file:  window.__RTP_ASSETS = {...}
# Usage: python3 build-assets.py <template-slug> [asset-dir]
import base64, json, io, sys
from PIL import Image
slug = sys.argv[1] if len(sys.argv)>1 else "fracture"
A = (sys.argv[2].rstrip("/")+"/") if len(sys.argv)>2 else "assets/"
def webp(p, lossless=False, q=82):
    im=Image.open(A+p).convert("RGBA"); buf=io.BytesIO()
    im.save(buf,"WEBP",lossless=lossless,quality=q,method=6)
    return "data:image/webp;base64,"+base64.b64encode(buf.getvalue()).decode()
def svg(p): return "data:image/svg+xml;base64,"+base64.b64encode(open(A+p,'rb').read()).decode()
data={
 "blank-shirt-front.png": webp("blank-shirt-front.png", lossless=True),
 "blank-shirt-back.png":  webp("blank-shirt-back.png", lossless=True),
 "front-design.png": webp("front-design.png", q=82),
 "back-design.png":  webp("back-design.png", q=82),
 "sleeve-design.png": webp("sleeve-design.png", q=84),
 "logo-momuto.png": webp("logo-momuto.png", q=90),
 "fonts/font-1.svg": svg("fonts/font-1.svg"),
 "fonts/font-2.svg": svg("fonts/font-2.svg"),
 "fonts/font-3.svg": svg("fonts/font-3.svg"),
 "slots": json.load(open(A+"template-slots.json")),
}
out=f"assets-{slug}.js"
open(out,"w").write(f"/* MOMUTO RTP assets — {slug} */\nwindow.__RTP_ASSETS="+json.dumps(data)+";\n")
import os; print(out, os.path.getsize(out)//1024, "KB")
