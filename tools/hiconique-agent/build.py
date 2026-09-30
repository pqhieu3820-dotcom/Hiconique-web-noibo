"""
Đóng gói HICONIQUE Agent (app.py, PyQt5, 5 tab) thành 1 file .exe, phát hành lên GitHub Releases
(file .exe > 25MB nên không host được qua Cloudflare Pages — giới hạn 25MB/file) và cập nhật
public/agent/latest.json (nhỏ, vẫn ở Cloudflare) để các máy đã cài tự phát hiện bản mới.

Quy trình phát hành bản mới:
  1. Sửa app.py, tăng VERSION (ví dụ 2.0.1), thêm mục mới (đầu danh sách) vào CHANGELOG.json.
  2. python build.py    (cần: pip install pyinstaller PyQt5 pandas openpyxl pillow, và đã `git push`
     thành công ít nhất 1 lần trước đó để Git Credential Manager có sẵn token GitHub dùng lại)
  3. git add -A && git commit && git push   -> đẩy latest.json mới lên Cloudflare; các máy đã cài
     kiểm tra latest.json mỗi 6 giờ, tải bản mới TỪ GITHUB RELEASES (không phải từ Cloudflare),
     kiểm SHA-256, thay file rồi tự khởi động lại.

Kết quả:
  public/agent/latest.json                              {"version","url","sha256"} — url trỏ sang
                                                          GitHub Releases (link "latest" ổn định,
                                                          không đổi qua mỗi bản)
  GitHub Release "agent-v<version>"                      chứa file HiconiqueAgentSetup.exe thật

Lưu ý: từ bản 2.0.0 dùng PyQt5 + pandas + openpyxl (công cụ Lấy màu cần Excel), file .exe nặng hơn
nhiều (~67MB) và build lâu hơn (vài phút). Token GitHub lấy tạm thời từ Git Credential Manager lúc
build (không lưu vào bất kỳ file nào trong repo).
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'agent'))
SITE = 'https://hiconique-web-noibo.pqhieu3820.workers.dev/'
REPO = 'pqhieu3820-dotcom/Hiconique-web-noibo'
ICON = os.path.join(HERE, 'icon.ico')  # tạo bằng make_icon.py — icon riêng cho exe, cửa sổ và shortcut Desktop
ENTRY = os.path.join(HERE, 'app.py')
ASSET_NAME = 'HiconiqueAgentSetup.exe'


def github_token():
    """Lấy token GitHub đã lưu trong Git Credential Manager (không ghi ra file nào)."""
    out = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n',
                         capture_output=True, text=True, cwd=HERE).stdout
    for line in out.splitlines():
        if line.startswith('password='):
            return line[len('password='):]
    raise RuntimeError('Không lấy được token GitHub từ Git Credential Manager — hãy `git push` (bất kỳ thay đổi nhỏ nào) 1 lần trước để đăng nhập.')


def gh_api(method, url, token, data=None, content_type='application/json'):
    body = data if isinstance(data, (bytes, type(None))) else json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, method=method, headers={
        'Authorization': 'token %s' % token, 'Accept': 'application/vnd.github+json', 'Content-Type': content_type,
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode('utf-8')) if r.length != 0 else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError('GitHub API %s %s -> %s: %s' % (method, url, e.code, e.read().decode('utf-8', 'ignore')))


def publish_release(version, exe_path, notes):
    ASSET_NAME = 'HiconiqueAgentSetup-v%s.exe' % version   # tên file tải về CÓ số phiên bản
    token = github_token()
    tag = 'agent-v%s' % version
    api = 'https://api.github.com/repos/%s' % REPO
    try:
        rel = gh_api('GET', '%s/releases/tags/%s' % (api, tag), token)
    except RuntimeError:
        rel = gh_api('POST', '%s/releases' % api, token,
                     {'tag_name': tag, 'name': 'HICONIQUE Agent v%s' % version, 'body': notes, 'draft': False, 'prerelease': False})
    for a in rel.get('assets', []):
        if a['name'] == ASSET_NAME:
            gh_api('DELETE', a['url'], token)  # ghi đè: xóa asset cũ (build lại cùng version) trước khi tải bản mới
    upload_url = rel['upload_url'].split('{')[0] + '?name=%s' % ASSET_NAME
    with open(exe_path, 'rb') as f:
        asset = gh_api('POST', upload_url, token, f.read(), content_type='application/octet-stream')
    # browser_download_url: https://github.com/<repo>/releases/download/<tag>/<asset> -> .../releases/latest/download/<asset>
    return asset['browser_download_url']   # .../releases/download/agent-v<ver>/HiconiqueAgentSetup-v<ver>.exe (cố định theo phiên bản)


src = open(ENTRY, encoding='utf-8').read()
version = re.search(r"^VERSION = '([^']+)'", src, re.M).group(1)

LOGO = os.path.join(HERE, 'logo.png')  # logo hiện trên thanh tiêu đề của app (cùng do make_icon.py tạo)
if not os.path.exists(ICON) or not os.path.exists(LOGO):
    subprocess.check_call([sys.executable, os.path.join(HERE, 'make_icon.py')])

subprocess.check_call([
    sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onefile', '--noconsole',
    '--name', 'HiconiqueAgent',
    '--icon', ICON,
    '--add-data', '%s%s.' % (ICON, os.pathsep),   # nhúng icon.ico vào trong exe để cửa sổ app cũng dùng đúng icon
    '--add-data', '%s%s.' % (LOGO, os.pathsep),
    '--hidden-import', 'PyQt5.QtSvg',
    '--hidden-import', 'PyQt5.QtNetwork',
    '--hidden-import', 'pandas', '--hidden-import', 'openpyxl',
    '--exclude-module', 'matplotlib', '--exclude-module', 'pandas.tests', '--exclude-module', 'tkinter',
    '--distpath', os.path.join(HERE, 'dist'),
    '--workpath', os.path.join(HERE, 'build'), '--specpath', os.path.join(HERE, 'build'),
    ENTRY,
])

exe = os.path.join(HERE, 'dist', 'HiconiqueAgent.exe')
# bản sao có HẬU TỐ PHIÊN BẢN để phát/lưu trữ (file cài đặt dùng đúng tên HiconiqueAgent.exe nên giữ nguyên bản gốc)
import shutil
VERSIONED = os.path.join(HERE, 'dist', 'HiconiqueAgent-v%s.exe' % version)
shutil.copy2(exe, VERSIONED)
print('Bản có hậu tố phiên bản:', VERSIONED)
sha = hashlib.sha256(open(exe, 'rb').read()).hexdigest()
size = os.path.getsize(exe)
history = json.load(open(os.path.join(HERE, 'CHANGELOG.json'), encoding='utf-8'))  # [{version,date,notes}] mới nhất ở đầu
assert history[0]['version'] == version, 'CHANGELOG.json chưa có mục cho phiên bản %s' % version

DESKTOP = os.path.join(os.path.expanduser('~'), 'Desktop')
if os.path.isdir(DESKTOP):   # luôn copy 1 bản có hậu tố phiên bản ra Desktop
    shutil.copy2(VERSIONED, os.path.join(DESKTOP, os.path.basename(VERSIONED)))
    print('Đã copy ra Desktop:', os.path.join(DESKTOP, os.path.basename(VERSIONED)))
# FILE CÀI ĐẶT lên folder Google Drive (link trong GHI_CHU_DU_AN.md, mục QUAN TRỌNG). Cách chính: kéo thả qua link trên trình duyệt.
# CÁCH DỰ PHÒNG (người dùng cho phép 2026-09-30, khi không upload được qua link): copy vào thư mục đồng bộ Google Drive for Desktop của tài khoản
# hiconique.group (ổ J:) — Drive tự đồng bộ lên đúng folder đó. Xem ghi chú dự án để biết đường dẫn.
DRIVE_FALLBACK = r'J:\My Drive\DỮ LIỆU HICONIQUE\DỮ LIỆU GỐC (KHÔNG CHIA SẺ)\Folder cài đặt HICONIQUE APP PC'
if os.path.isdir(DRIVE_FALLBACK):
    shutil.copy2(VERSIONED, os.path.join(DRIVE_FALLBACK, 'HiconiqueAgentSetup-v%s.exe' % version))
    print('Đã copy vào folder Drive (cách dự phòng qua ổ J:):', DRIVE_FALLBACK)
else:
    print('>> Ổ J: không có — hãy đưa file lên folder Drive theo link: %s' % VERSIONED)
if '--no-publish' in sys.argv:
    print('OK (--no-publish): chỉ build + copy Desktop, chưa đăng release/latest.json', version, sha)
    sys.exit(0)

print('Đang tải lên GitHub Releases (HiconiqueAgentSetup-v%s.exe, ~%d MB)...' % (version, size // 1024 // 1024))
stable_url = publish_release(version, exe, history[0]['notes'])
print('OK ->', stable_url)

os.makedirs(OUT, exist_ok=True)
json.dump({'version': version, 'url': stable_url, 'sha256': sha,
           'size': size, 'releasedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'notes': history[0]['notes'], 'history': history[:10]},
          open(os.path.join(OUT, 'latest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('OK', version, sha, size // 1024 // 1024, 'MB — public/agent/latest.json đã cập nhật, giờ git add/commit/push.')
