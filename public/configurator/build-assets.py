# Build a per-template asset file:  window.__RTP_ASSETS = {...}
# Usage:
#   python3 build-assets.py <template-slug> [asset-dir]              # blank+overlay pipeline (e.g. fracture)
#   python3 build-assets.py <template-slug> [asset-dir] --composite  # on-body composite pipeline (e.g. apex)
import base64, json, io, sys, os
from PIL import Image
args=[a for a in sys.argv[1:] if not a.startswith("--")]
flags=set(a for a in sys.argv[1:] if a.startswith("--"))
slug = args[0] if len(args)>0 else "fracture"
A = (args[1].rstrip("/")+"/") if len(args)>1 else "assets/"
composite = "--composite" in flags
def webp(p, lossless=False, q=82):
    im=Image.open(A+p).convert("RGBA"); buf=io.BytesIO()
    im.save(buf,"WEBP",lossless=lossless,quality=q,method=6)
    return "data:image/webp;base64,"+base64.b64encode(buf.getvalue()).decode()
def svg(p): return "data:image/svg+xml;base64,"+base64.b64encode(open(A+p,'rb').read()).decode()
if composite:
    data={
     "composite-front.png": webp("the-apex-front.png", lossless=True),
     "composite-back.png":  webp("the-apex-back.png", lossless=True),
     "logo-momuto.png": webp("logo-momuto.png", q=90),
     "fonts/font-1.svg": svg("fonts/font-1.svg"),
     "fonts/font-2.svg": svg("fonts/font-2.svg"),
     "fonts/font-3.svg": svg("fonts/font-3.svg"),
     "slots": json.load(open(A+"template-slots.json")),
    }
else:
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
open(out,"w").write(f"/* MOMUTO RTP assets — {slug}{' (composite)' if composite else ''} */\nwindow.__RTP_ASSETS="+json.dumps(data)+";\n")
print(out, os.path.getsize(out)//1024, "KB")
