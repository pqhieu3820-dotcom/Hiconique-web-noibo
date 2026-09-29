"""Tạo icon.ico cho HICONIQUE Agent từ đúng icon app đang dùng trên điện thoại (public/icon-512.png —
logo trắng trên nền gradient đen-xám-xanh), bo góc như icon app. Cần Pillow: pip install pillow."""
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'icon-512.png'))
SIZES = [16, 24, 32, 48, 64, 128, 256]
RADIUS_RATIO = 0.22  # độ bo góc so với cạnh (giống icon app trên điện thoại)

src = Image.open(SRC).convert('RGBA').resize((1024, 1024), Image.LANCZOS)
mask = Image.new('L', (1024, 1024), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 1023, 1023], radius=int(1024 * RADIUS_RATIO), fill=255)
src.putalpha(mask)

out = os.path.join(HERE, 'icon.ico')
src.resize((256, 256), Image.LANCZOS).save(out, sizes=[(s, s) for s in SIZES])
# bản PNG dùng làm logo trên thanh tiêu đề trong app (nạp qua QPixmap, không cần đọc .ico)
src.resize((128, 128), Image.LANCZOS).save(os.path.join(HERE, 'logo.png'))
print('OK', out)
