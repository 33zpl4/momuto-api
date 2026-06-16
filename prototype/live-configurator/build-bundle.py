import base64, json, io
from PIL import Image
A="assets/"
def webp(path, lossless=False, q=82):
    im=Image.open(A+path).convert("RGBA"); buf=io.BytesIO()
    im.save(buf,"WEBP",lossless=lossless,quality=q,method=6)
    return "data:image/webp;base64,"+base64.b64encode(buf.getvalue()).decode()
def svg(path):
    return "data:image/svg+xml;base64,"+base64.b64encode(open(A+path,'rb').read()).decode()
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
embed=open("embed.js").read()
hdr="/* MOMUTO RTP — self-contained bundle (code + assets inlined). Host on momuto.com via abcshoppy 'Custom file'. */\n"
hdr+="window.__RTP_ASSETS="+json.dumps(data)+";\n"
open("embed.bundle.js","w").write(hdr+embed)
print("embed.bundle.js:", (len(hdr)+len(embed))//1024, "KB")
