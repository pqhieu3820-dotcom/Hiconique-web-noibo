"""
Đóng gói HICONIQUE Agent (app.py, PyQt5, 5 tab) thành 1 file .exe và chuẩn bị bản phát hành để các máy tự cập nhật.

Quy trình phát hành bản mới:
  1. Sửa app.py, tăng VERSION (ví dụ 2.0.1), thêm mục mới (đầu danh sách) vào CHANGELOG.json.
  2. python build.py    (cần: pip install pyinstaller PyQt5 pandas openpyxl pillow)
  3. git add -A && git commit && git push   -> Hub (Cloudflare) phục vụ public/agent/*, các máy tự tải bản mới trong ~6 giờ.

Kết quả:
  public/agent/HiconiqueAgentSetup.exe   file gửi cho nhân viên cài lần đầu (bấm 2 lần là cài)
  public/agent/latest.json               {"version","url","sha256"} — agent đã cài đọc file này để tự cập nhật

Lưu ý: từ bản 2.0.0 dùng PyQt5 + pandas + openpyxl (công cụ Lấy màu cần Excel), file .exe nặng hơn nhiều
(khoảng 150–250MB so với ~12MB bản Tkinter cũ) và build lâu hơn (vài phút). --add-data đính kèm icon.ico
vào bên trong .exe để cửa sổ ứng dụng (không chỉ file/shortcut) cũng dùng đúng icon.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'agent'))
SITE = 'https://hiconique-web-noibo.pqhieu3820.workers.dev/'
ICON = os.path.join(HERE, 'icon.ico')  # tạo bằng make_icon.py — icon riêng cho exe, cửa sổ và shortcut Desktop
ENTRY = os.path.join(HERE, 'app.py')

src = open(ENTRY, encoding='utf-8').read()
version = re.search(r"^VERSION = '([^']+)'", src, re.M).group(1)

if not os.path.exists(ICON):
    subprocess.check_call([sys.executable, os.path.join(HERE, 'make_icon.py')])

subprocess.check_call([
    sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onefile', '--noconsole',
    '--name', 'HiconiqueAgent',
    '--icon', ICON,
    '--add-data', '%s%s.' % (ICON, os.pathsep),   # nhúng icon.ico vào trong exe để cửa sổ app cũng dùng đúng icon
    '--hidden-import', 'PyQt5.QtNetwork',
    '--hidden-import', 'pandas', '--hidden-import', 'openpyxl',
    '--exclude-module', 'matplotlib', '--exclude-module', 'pandas.tests', '--exclude-module', 'tkinter',
    '--distpath', os.path.join(HERE, 'dist'),
    '--workpath', os.path.join(HERE, 'build'), '--specpath', os.path.join(HERE, 'build'),
    ENTRY,
])

exe = os.path.join(HERE, 'dist', 'HiconiqueAgent.exe')
os.makedirs(OUT, exist_ok=True)
shutil.copy2(exe, os.path.join(OUT, 'HiconiqueAgentSetup.exe'))  # cùng nội dung: tên "Setup" cho lần cài đầu
sha = hashlib.sha256(open(exe, 'rb').read()).hexdigest()
history = json.load(open(os.path.join(HERE, 'CHANGELOG.json'), encoding='utf-8'))  # [{version,date,notes}] mới nhất ở đầu
assert history[0]['version'] == version, 'CHANGELOG.json chưa có mục cho phiên bản %s' % version
json.dump({'version': version, 'url': SITE + 'agent/HiconiqueAgentSetup.exe', 'sha256': sha,
           'size': os.path.getsize(exe), 'releasedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'notes': history[0]['notes'], 'history': history[:10]},
          open(os.path.join(OUT, 'latest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('OK', version, sha, os.path.getsize(exe) // 1024 // 1024, 'MB')
