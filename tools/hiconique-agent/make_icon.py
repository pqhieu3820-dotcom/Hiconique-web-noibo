"""Tạo icon.ico đơn giản cho HICONIQUE Agent (chữ H trên nền đồng — tông màu thương hiệu). Cần Pillow: pip install pillow."""
from PIL import Image, ImageDraw, ImageFont
import os

BRONZE = (176, 141, 87)
DARK = (11, 13, 16)
SIZES = [16, 24, 32, 48, 64, 128, 256]

img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([8, 8, 248, 248], radius=56, fill=BRONZE)
font = None
for name in ('segoeuib.ttf', 'arialbd.ttf', 'Arial Bold.ttf'):
    try:
        font = ImageFont.truetype(name, 150)
        break
    except Exception:
        continue
if not font:
    font = ImageFont.load_default()
text = 'H'
bbox = d.textbbox((0, 0), text, font=font)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((256 - w) / 2 - bbox[0], (256 - h) / 2 - bbox[1] - 6), text, fill=DARK, font=font)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icon.ico')
img.save(out, sizes=[(s, s) for s in SIZES])
print('OK', out)
