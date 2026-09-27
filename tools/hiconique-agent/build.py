"""
Đóng gói HICONIQUE Agent thành 1 file .exe và chuẩn bị bản phát hành để các máy tự cập nhật.

Quy trình phát hành bản mới:
  1. Sửa agent.py, tăng VERSION (ví dụ 1.0.1).
  2. python build.py                   (cần: pip install pyinstaller)
  3. git add -A && git commit && git push   -> Hub (Cloudflare) phục vụ public/agent/*, các máy tự tải bản mới trong ~6 giờ.

Kết quả:
  public/agent/HiconiqueAgentSetup.exe   file gửi cho nhân viên cài lần đầu (bấm 2 lần là cài)
  public/agent/latest.json               {"version","url","sha256"} — agent đã cài đọc file này để tự cập nhật
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'agent'))
SITE = 'https://hiconique-web-noibo.pqhieu3820.workers.dev/'
ICON = os.path.join(HERE, 'icon.ico')  # tạo bằng make_icon.py — icon riêng cho exe và cho shortcut Desktop

src = open(os.path.join(HERE, 'agent.py'), encoding='utf-8').read()
version = re.search(r"^VERSION = '([^']+)'", src, re.M).group(1)

if not os.path.exists(ICON):
    subprocess.check_call([sys.executable, os.path.join(HERE, 'make_icon.py')])

icon_args = ['--icon', ICON] if os.path.exists(ICON) else []
subprocess.check_call([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onefile', '--noconsole',
                       '--name', 'HiconiqueAgent'] + icon_args + ['--distpath', os.path.join(HERE, 'dist'),
                       '--workpath', os.path.join(HERE, 'build'), '--specpath', os.path.join(HERE, 'build'),
                       os.path.join(HERE, 'agent.py')])

exe = os.path.join(HERE, 'dist', 'HiconiqueAgent.exe')
os.makedirs(OUT, exist_ok=True)
shutil.copy2(exe, os.path.join(OUT, 'HiconiqueAgentSetup.exe'))  # cùng nội dung: tên "Setup" cho lần cài đầu
sha = hashlib.sha256(open(exe, 'rb').read()).hexdigest()
from datetime import datetime, timezone
history = json.load(open(os.path.join(HERE, 'CHANGELOG.json'), encoding='utf-8'))  # [{version,date,notes}] mới nhất ở đầu
assert history[0]['version'] == version, 'CHANGELOG.json chưa có mục cho phiên bản %s' % version
json.dump({'version': version, 'url': SITE + 'agent/HiconiqueAgentSetup.exe', 'sha256': sha,
           'size': os.path.getsize(exe), 'releasedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'notes': history[0]['notes'], 'history': history[:10]},
          open(os.path.join(OUT, 'latest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('OK', version, sha, os.path.getsize(exe) // 1024, 'KB')
