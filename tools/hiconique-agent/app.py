"""
HICONIQUE Agent — ứng dụng Windows 1 file .exe, viết bằng PyQt5, gồm 5 tab:
  1. Kiểm soát dữ liệu thao tác  — bật/tạm dừng ghi nhận, xem ứng dụng đã dùng hôm nay, gửi ngay lên Hub
  2. Thông số linh kiện máy tính — quét CPU/RAM/ổ cứng/card đồ họa... hiển thị đầy đủ, nút "Cập nhật lên web"
  3. Chuyển đổi Ảnh ↔ SketchUp Material (.skm)
  4. Lấy màu (Pick Color) — trích màu từ ảnh/màn hình, quản lý danh sách màu, xuất ảnh/Excel hàng loạt
  5. Hẹn giờ tắt máy
Đóng cửa sổ (nút X) chỉ ẩn xuống khay hệ thống (system tray) — app vẫn chạy nền. Chuột phải icon khay > Thoát mới tắt hẳn.
Tự cài, tự khởi động cùng Windows, tự cập nhật online, gỡ như ứng dụng bình thường (Cài đặt Windows > Ứng dụng).

Công khai với nhân viên: hiện thông báo khi cài; dữ liệu của chính mình xem được ngay trong ứng dụng (tab Kiểm soát dữ liệu thao tác)
và trên trang Theo dõi hiệu suất của Hub. Dữ liệu trên máy được MÃ HÓA (Windows DPAPI) — không có file văn bản đọc/sửa được.
Chỉ cài trên máy công ty, có sự đồng ý của người dùng.
Ghi: tên ứng dụng + tiêu đề cửa sổ đang mở (trong giờ làm việc) + cấu hình phần cứng máy.
KHÔNG ghi: chụp màn hình, phím gõ, nội dung file/tin nhắn, clipboard, camera, micro.
"""
import base64
import ctypes
import hashlib
import io
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.parse
import urllib.request
import zipfile
from ctypes import wintypes
from datetime import datetime, timezone

VERSION = '2.0.8'

COMPANY_NAME = 'CÔNG TY TNHH THIẾT KẾ VÀ XÂY DỰNG HICONIQUE'


def write_excel_with_heading(df, file_path, sheet_name='Dữ liệu'):
    """Xuất DataFrame ra Excel với tiêu đề văn bản chuẩn (tên công ty, Quốc hiệu, Tiêu ngữ, địa danh ngày tháng) — đồng bộ với web."""
    import datetime
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from openpyxl.utils import get_column_letter
    with pd_excel_writer(file_path) as writer:
        df.to_excel(writer, index=False, startrow=5, sheet_name=sheet_name)
        ws = writer.sheets[sheet_name]
        n = max(len(df.columns), 5)
        right = min(5, max(2, n // 2)); left = max(1, min(4, n - right))
        r0, r1 = left + 1, left + right
        now = datetime.date.today()
        def put(r, c1, c2, val, bold=False, italic=False, size=12, h='center'):
            if c2 > c1:
                ws.merge_cells(start_row=r, start_column=c1, end_row=r, end_column=c2)
            c = ws.cell(row=r, column=c1, value=val)
            c.font = Font(name='Times New Roman', size=size, bold=bold, italic=italic)
            c.alignment = Alignment(horizontal=h, vertical='center', wrap_text=True)
        put(1, 1, left, COMPANY_NAME, bold=True, size=11)
        put(1, r0, r1, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold=True)
        put(2, 1, left, 'Số: ....../......', size=11)
        put(2, r0, r1, 'Độc lập - Tự do - Hạnh phúc', bold=True)
        put(3, r0, r1, 'Hải Phòng, ngày %d tháng %d năm %d' % (now.day, now.month, now.year), italic=True, h='right')
        ws.row_dimensions[1].height = 32
        thin = Side(style='thin', color='FF999999')
        for c in range(1, len(df.columns) + 1):
            cell = ws.cell(row=6, column=c)
            cell.font = Font(name='Times New Roman', size=12, bold=True)
            cell.fill = PatternFill('solid', fgColor='FFE8EEF7')
            cell.alignment = Alignment(horizontal='center', vertical='center')
            width = max([len(str(cell.value or ''))] + [len(str(v)) for v in df.iloc[:, c - 1].tolist()]) + 4
            ws.column_dimensions[get_column_letter(c)].width = min(max(width, 12), 40)
        for row in ws.iter_rows(min_row=7, max_row=ws.max_row, max_col=len(df.columns)):
            for cell in row:
                cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
        ws.freeze_panes = 'A7'
        ws.page_setup.paperSize = 9
        ws.page_setup.orientation = 'landscape' if len(df.columns) > 7 else 'portrait'
        ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.oddFooter.left.text = 'Hải Phòng, ngày &D'; ws.oddFooter.right.text = 'Trang &P / &N'


def pd_excel_writer(file_path):
    import pandas as pd
    return pd.ExcelWriter(file_path, engine='openpyxl')

APP_NAME = 'HiconiqueAgent'
FROZEN = getattr(sys, 'frozen', False)
BASE = os.path.dirname(os.path.abspath(sys.executable if FROZEN else __file__))
LOCAL = os.environ.get('LOCALAPPDATA', BASE)
DATA_DIR = os.path.join(LOCAL, 'HiconiqueAgent')                       # cấu hình + nhật ký + dữ liệu trong ngày
INSTALL_DIR = os.path.join(LOCAL, 'Programs', 'HiconiqueAgent')        # nơi đặt file exe đã cài
INSTALL_EXE = os.path.join(INSTALL_DIR, 'HiconiqueAgent.exe')
ICON_PATH = os.path.join(sys._MEIPASS, 'icon.ico') if hasattr(sys, '_MEIPASS') else os.path.join(BASE, 'icon.ico')
RUN_KEY = r'Software\Microsoft\Windows\CurrentVersion\Run'
UNINSTALL_KEY = r'Software\Microsoft\Windows\CurrentVersion\Uninstall\HiconiqueAgent'
IPC_SERVER_NAME = 'HiconiqueAgentIPC'
os.makedirs(DATA_DIR, exist_ok=True)

SITE = 'https://hiconique-web-noibo.pqhieu3820.workers.dev/'
GITHUB_RELEASES_PREFIX = 'https://github.com/pqhieu3820-dotcom/Hiconique-web-noibo/releases/'
# File .exe (>25MB) không thể host qua Cloudflare (giới hạn 25MB/file) nên tải từ GitHub Releases;
# latest.json (nhỏ) vẫn ở Cloudflare — chỉ 2 nguồn này được coi là hợp lệ để tự cập nhật.
ALLOWED_UPDATE_HOSTS = (SITE, GITHUB_RELEASES_PREFIX)
DEFAULTS = {
    'apiUrl': 'https://script.google.com/macros/s/AKfycbzgg0dfNgDTFgcTGlNvF2IHLUusK6YuBk1pot9SrbYi5B9al-H2nmmMlKLz5CpDlLY/exec',
    'memberId': '',              # mã thành viên trên Hub của người dùng máy này (trình cài đặt điền sẵn)
    'sampleSeconds': 15,         # tần suất kiểm tra cửa sổ đang mở
    'flushMinutes': 2,           # tần suất gửi lên Sheet (2026-09-30: 5 → 2 phút để trang Theo dõi hiệu suất gần thời gian thực)
    'idleSeconds': 120,          # không chuột/phím quá lâu này thì tính "không thao tác", không ghi ứng dụng
    'workHours': '07:30-18:00',  # ngoài khung giờ này không ghi gì
    'workDays': [0, 1, 2, 3, 4, 5],  # 0=Thứ 2 ... 6=Chủ nhật
    'sendTitles': True,          # false = chỉ gửi tên ứng dụng, không gửi tiêu đề cửa sổ
    'topTitles': 5,              # số tiêu đề nhiều nhất giữ lại cho mỗi ứng dụng
    'updateUrl': SITE + 'agent/latest.json',   # {"version","url","sha256"}; chỉ nhận file tải từ SITE (https)
    'updateCheckHours': 6,
    'reportHardware': True,      # gửi cấu hình phần cứng (CPU/RAM/ổ cứng...) lên trang Thiết bị; false = tắt
    'sendSerials': True,         # kèm số serial máy và địa chỉ MAC; false = không gửi
    'hardwareHours': 24,         # tần suất gửi lại cấu hình
}


def log(*a):
    try:
        p = os.path.join(DATA_DIR, 'agent.log')
        if os.path.exists(p) and os.path.getsize(p) > 300000:
            os.replace(p, p + '.old')
        with open(p, 'a', encoding='utf-8') as f:
            f.write('%s %s\n' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), ' '.join(str(x) for x in a)))
        if not FROZEN:
            print(*a)
    except Exception:
        pass


# ---- Lưu trữ KÍN trên máy (2026-09-30, yêu cầu bảo mật): mọi dữ liệu ghi nhận/cấu hình/cấu hình máy đều mã hóa bằng Windows DPAPI
# (khóa gắn với tài khoản Windows đang dùng + chuỗi bí mật riêng của ứng dụng) — mở bằng Notepad chỉ thấy ký tự vô nghĩa, sửa/copy sang
# máy khác/tài khoản khác đều KHÔNG giải mã được (coi như hỏng → bỏ, không tin). Không còn file .txt/.json đọc được.
import ctypes.wintypes as _wt

_SEC_MAGIC = b'HQ1'
_SEC_ENTROPY = b'HICONIQUE-Agent/secure-store/v1'


class _BLOB(ctypes.Structure):
    _fields_ = [('cbData', _wt.DWORD), ('pbData', ctypes.POINTER(ctypes.c_char))]


def _to_blob(b):
    buf = ctypes.create_string_buffer(b, len(b))
    return _BLOB(len(b), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char))), buf


def _dpapi(data, protect):
    inb, keep1 = _to_blob(data)
    ent, keep2 = _to_blob(_SEC_ENTROPY)
    out = _BLOB()
    fn = ctypes.windll.crypt32.CryptProtectData if protect else ctypes.windll.crypt32.CryptUnprotectData
    if protect:
        ok = fn(ctypes.byref(inb), None, ctypes.byref(ent), None, None, 1, ctypes.byref(out))
    else:
        ok = fn(ctypes.byref(inb), None, ctypes.byref(ent), None, None, 1, ctypes.byref(out))
    if not ok:
        return None
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out.pbData)


def write_secure(path, obj):
    raw = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    enc = _dpapi(raw, True)
    if enc is None:
        raise OSError('Không mã hóa được dữ liệu (DPAPI)')
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(_SEC_MAGIC + enc)
    os.replace(tmp, path)


def read_secure(path, default=None):
    try:
        with open(path, 'rb') as f:
            blob = f.read()
        if not blob.startswith(_SEC_MAGIC):
            return default
        raw = _dpapi(blob[len(_SEC_MAGIC):], False)
        if raw is None:
            log('Dữ liệu mã hóa không hợp lệ (bị sửa/khác tài khoản):', os.path.basename(path))
            return default
        return json.loads(raw.decode('utf-8'))
    except FileNotFoundError:
        return default
    except Exception as e:
        log('Đọc dữ liệu mã hóa lỗi:', os.path.basename(path), e)
        return default


CONFIG_SECURE = os.path.join(DATA_DIR, 'config.dat')


def load_config():
    cfg = dict(DEFAULTS)
    saved = read_secure(CONFIG_SECURE)
    if saved is None:
        # Nâng cấp từ bản cũ (config.json đọc/sửa được): nhập 1 lần rồi XÓA file văn bản. File config.json cạnh exe bị bỏ qua hoàn toàn.
        legacy = os.path.join(DATA_DIR, 'config.json')
        if os.path.exists(legacy):
            try:
                with open(legacy, encoding='utf-8-sig') as f:
                    saved = json.load(f)
                keep = {k: saved[k] for k in ('memberId', 'workHours', 'workDays', 'sendTitles') if k in saved}
                write_secure(CONFIG_SECURE, keep)
                saved = keep
                os.remove(legacy)
                log('Đã chuyển cấu hình sang dạng mã hóa')
            except Exception as e:
                log('Chuyển cấu hình lỗi:', e)
                saved = None
    if isinstance(saved, dict):
        cfg.update({k: v for k, v in saved.items() if k in ('memberId', 'workHours', 'workDays', 'sendTitles')})
    return cfg


def save_config(cfg):
    keep = {k: cfg[k] for k in ('memberId', 'workHours', 'workDays', 'sendTitles') if k in cfg}
    write_secure(CONFIG_SECURE, keep)


def msgbox(title, text, flags=0x40):
    """Hộp thoại không cần QApplication — dùng cho các nhánh rất sớm trước khi có Qt (hiếm khi cần)."""
    try:
        return ctypes.windll.user32.MessageBoxW(0, text, title, flags | 0x40000)
    except Exception:
        return 0


def spawn_detached(args):
    subprocess.Popen(args, close_fds=True, creationflags=0x00000008 | 0x00000200)  # DETACHED | NEW_GROUP


# ---------------- Windows API (ctypes) — theo dõi cửa sổ đang mở / thời gian không thao tác ----------------
user32 = ctypes.WinDLL('user32', use_last_error=True)
kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel32.OpenProcess.restype = wintypes.HANDLE
kernel32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [('cbSize', wintypes.UINT), ('dwTime', wintypes.DWORD)]


def idle_seconds():
    li = LASTINPUTINFO()
    li.cbSize = ctypes.sizeof(LASTINPUTINFO)
    if not user32.GetLastInputInfo(ctypes.byref(li)):
        return 0
    return ((kernel32.GetTickCount() - li.dwTime) & 0xFFFFFFFF) / 1000.0


def foreground():
    """(tên ứng dụng, tiêu đề cửa sổ) của cửa sổ phía trước, hoặc (None, None)."""
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None, None
    n = user32.GetWindowTextLengthW(hwnd)
    buf = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(hwnd, buf, n + 1)
    title = buf.value.strip()
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    app = None
    h = kernel32.OpenProcess(0x1000, False, pid.value)  # PROCESS_QUERY_LIMITED_INFORMATION
    if h:
        size = wintypes.DWORD(1024)
        path = ctypes.create_unicode_buffer(1024)
        if kernel32.QueryFullProcessImageNameW(h, 0, path, ctypes.byref(size)):
            app = os.path.basename(path.value)
            if app.lower().endswith('.exe'):
                app = app[:-4]
        kernel32.CloseHandle(h)
    return app, title


PRIVATE_RE = re.compile(r'inprivate|incognito|ẩn danh|private browsing|mật khẩu|password', re.I)
SKIP_APPS = {'LockApp', 'LogonUI', 'ScreenClippingHost', 'HiconiqueAgent'}


def clean_title(t, send_titles):
    if not send_titles or not t:
        return ''
    if PRIVATE_RE.search(t):
        return '(cửa sổ riêng tư)'
    return t[:80]


def in_work_time(cfg, now):
    if now.weekday() not in cfg['workDays']:
        return False
    a, b = cfg['workHours'].split('-')
    ah, am = map(int, a.split(':'))
    bh, bm = map(int, b.split(':'))
    cur = now.hour * 60 + now.minute
    return ah * 60 + am <= cur < bh * 60 + bm


# Tên tiến trình Windows → tên quen thuộc (khóa viết thường, không .exe). Ứng dụng lạ: hiện tên gốc đã làm đẹp.
FRIENDLY_APPS = {
    'browser': 'Cốc Cốc', 'coccoc': 'Cốc Cốc', 'chrome': 'Google Chrome', 'msedge': 'Microsoft Edge', 'firefox': 'Firefox',
    'opera': 'Opera', 'brave': 'Brave', 'safari': 'Safari', 'iexplore': 'Internet Explorer',
    'explorer': 'Thư mục (File Explorer)', 'winword': 'Word', 'excel': 'Excel', 'powerpnt': 'PowerPoint', 'outlook': 'Outlook',
    'onenote': 'OneNote', 'msaccess': 'Access', 'mspub': 'Publisher', 'wps': 'WPS Office', 'et': 'WPS Spreadsheets', 'wpp': 'WPS Presentation',
    'acrobat': 'Adobe Acrobat', 'acrord32': 'Adobe Reader', 'foxitpdfreader': 'Foxit PDF Reader', 'foxitreader': 'Foxit PDF Reader',
    'notepad': 'Notepad (Ghi chú)', 'notepad++': 'Notepad++', 'code': 'Visual Studio Code', 'devenv': 'Visual Studio',
    'claude': 'Claude', 'zalo': 'Zalo', 'zalopc': 'Zalo', 'telegram': 'Telegram', 'skype': 'Skype', 'viber': 'Viber',
    'teams': 'Microsoft Teams', 'ms-teams': 'Microsoft Teams', 'slack': 'Slack', 'zoom': 'Zoom', 'discord': 'Discord',
    'taskmgr': 'Trình quản lý tác vụ (Task Manager)', 'applicationframehost': 'Cài đặt / ứng dụng Windows',
    'systemsettings': 'Cài đặt Windows', 'searchhost': 'Tìm kiếm Windows', 'searchapp': 'Tìm kiếm Windows', 'searchui': 'Tìm kiếm Windows',
    'shellexperiencehost': 'Giao diện Windows', 'startmenuexperiencehost': 'Menu Start', 'textinputhost': 'Bàn phím Windows',
    'winrar': 'WinRAR', '7zfm': '7-Zip', 'googledrivefs': 'Google Drive (đồng bộ)', 'onedrive': 'OneDrive', 'dropbox': 'Dropbox',
    'mmc': 'Bảng quản trị Windows (Services…)', 'cmd': 'Dòng lệnh (CMD)', 'powershell': 'PowerShell', 'windowsterminal': 'Windows Terminal',
    'conhost': 'Cửa sổ dòng lệnh', 'regedit': 'Registry Editor', 'control': 'Control Panel', 'mstsc': 'Kết nối máy tính từ xa',
    'anydesk': 'AnyDesk', 'teamviewer': 'TeamViewer', 'ultraviewer': 'UltraViewer',
    'sketchup': 'SketchUp', 'layout': 'LayOut (SketchUp)', 'acad': 'AutoCAD', 'revit': 'Revit', '3dsmax': '3ds Max', 'vray': 'V-Ray',
    'lumion': 'Lumion', 'enscape': 'Enscape', 'photoshop': 'Photoshop', 'illustrator': 'Illustrator', 'indesign': 'InDesign',
    'lightroom': 'Lightroom', 'premiere pro': 'Premiere Pro', 'afterfx': 'After Effects', 'canva': 'Canva',
    'vlc': 'VLC', 'wmplayer': 'Windows Media Player', 'spotify': 'Spotify', 'mspaint': 'Paint', 'snippingtool': 'Công cụ cắt ảnh',
    'calculatorapp': 'Máy tính (Calculator)', 'calc': 'Máy tính (Calculator)', 'photos': 'Ảnh (Photos)', 'microsoft.photos': 'Ảnh (Photos)',
    'misa': 'MISA', 'misasme': 'MISA SME', 'hiconiqueagent': 'HICONIQUE Agent', 'python': 'Python', 'pythonw': 'Python',
    'node': 'Node.js', 'git': 'Git', 'gitkraken': 'GitKraken', 'postman': 'Postman', 'figma': 'Figma', 'obs64': 'OBS Studio',
}


def friendly_app(raw):
    k = str(raw or '').strip()
    if k.lower().endswith('.exe'):
        k = k[:-4]
    hit = FRIENDLY_APPS.get(k.lower())
    if hit:
        return hit
    nice = re.sub(r'[_\-]+', ' ', k).strip()
    return nice[:1].upper() + nice[1:] if nice else str(raw)


def slug(s):
    return re.sub(r'[^A-Za-z0-9]+', '_', s).strip('_')[:40] or 'app'


def state_path(day):
    return os.path.join(DATA_DIR, 'state-%s.dat' % day)


def purge_legacy_plaintext():
    """Xóa các file văn bản cũ (đọc/sửa được) của bản trước: state-*.json, hoat-dong-hom-nay.txt, config.json."""
    try:
        for n in os.listdir(DATA_DIR):
            if (n.startswith('state-') and n.endswith('.json')) or n == 'hoat-dong-hom-nay.txt':
                try:
                    os.remove(os.path.join(DATA_DIR, n))
                except OSError:
                    pass
    except Exception:
        pass


def load_state(day):
    st = read_secure(state_path(day))
    if isinstance(st, dict) and isinstance(st.get('apps'), dict):
        return st
    return {'apps': {}, 'idleSec': 0}


def save_state(day, st):
    write_secure(state_path(day), st)


def cleanup_old_days(keep_days=7):
    try:
        limit = time.time() - keep_days * 86400
        for n in os.listdir(DATA_DIR):
            if n.startswith(('state-', 'da-thong-bao-')) and os.path.getmtime(os.path.join(DATA_DIR, n)) < limit:
                os.remove(os.path.join(DATA_DIR, n))
    except Exception:
        pass


def flush(cfg, day, st):
    device = socket.gethostname()
    rows = []
    for app, v in st['apps'].items():
        if v['sec'] < 30:
            continue
        top = sorted(v['titles'].items(), key=lambda kv: -kv[1])[:cfg['topTitles']]
        rows.append({
            'id': 'app_%s_%s_%s_%s' % (cfg['memberId'], day, slug(device), slug(app)),
            'memberId': cfg['memberId'], 'date': day, 'device': device, 'app': friendly_app(app), 'appRaw': app,
            'minutes': round(v['sec'] / 60, 1),
            'titles': ' | '.join('%s (%dp)' % (t, round(s / 60)) for t, s in top) if cfg['sendTitles'] else '',
            'lastSeen': datetime.now().strftime('%Y-%m-%d %H:%M'),
        })
    if not rows:
        return True
    body = urllib.parse.urlencode({'action': 'upsertAppUsage', 'data': json.dumps(rows, ensure_ascii=False)}).encode('utf-8')
    try:
        req = urllib.request.Request(cfg['apiUrl'], data=body, method='POST')
        with urllib.request.urlopen(req, timeout=60) as r:
            r.read()
        return True
    except Exception as e:
        log('Gửi thất bại, sẽ thử lại:', e)
        return False


# ---------------- Tự cập nhật ----------------
def vtuple(v):
    return tuple(int(x) for x in re.findall(r'\d+', str(v))[:4])


CRLF_ = chr(13) + chr(10)


def http_open(url, timeout=30):
    """urlopen có User-Agent riêng. BẮT BUỘC: Cloudflare (chỗ host web Hub) chặn 403 (mã 1010) mọi yêu cầu mang
    User-Agent mặc định 'Python-urllib' — trước đây nút/luồng kiểm tra cập nhật luôn báo lỗi mạng vì lý do này."""
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'HiconiqueAgent/%s' % VERSION}), timeout=timeout)


def relaunch_after_exit(exe):
    """Mở lại exe SAU KHI tiến trình hiện tại đã thoát (tránh bản mới tưởng đã có cửa sổ đang chạy rồi tự thoát)."""
    bat = os.path.join(tempfile.gettempdir(), 'hiconique_relaunch.bat')
    with open(bat, 'w', encoding='utf-8') as f:
        f.write('@echo off' + CRLF_ + 'ping -n 3 127.0.0.1 >nul' + CRLF_ + 'start "" "%s" --run --after-update' % exe + CRLF_ + 'del "%~f0"' + CRLF_)
    subprocess.Popen(['cmd', '/c', bat], close_fds=True, creationflags=0x08000000 | 0x00000008)  # NO_WINDOW | DETACHED


def fmt_bytes(n):
    return '%.1f MB' % (n / 1048576.0) if n >= 1048576 else '%d KB' % (n // 1024)


def fmt_eta(sec):
    sec = int(max(0, sec))
    return '%d:%02d' % (sec // 60, sec % 60) if sec < 3600 else '%d:%02d:%02d' % (sec // 3600, sec % 3600 // 60, sec % 60)


def download_file(url, dest, total, sha_progress=None, parts=4):
    """Tải file bằng NHIỀU kết nối song song (Range) — mạng bị giới hạn/chậm theo từng kết nối (GitHub CDN ở VN hay chỉ ~40 KB/s/kết nối)
    tải 4 luồng nhanh gấp ~3-4 lần. Máy chủ không hỗ trợ Range thì tự về 1 luồng. sha_progress(done, total, speed_bps, eta_sec) gọi ~mỗi 0,5s.
    Trả về số byte đã tải; ném lỗi nếu thiếu dữ liệu."""
    final_url, size, ranged = url, total, False
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'HiconiqueAgent/%s' % VERSION, 'Range': 'bytes=0-0'})
        with urllib.request.urlopen(req, timeout=30) as r:
            final_url = r.geturl()
            cr = r.headers.get('Content-Range') or ''
            if r.status == 206 and '/' in cr:
                size, ranged = int(cr.rsplit('/', 1)[1]), True
            elif not size:
                size = int(r.headers.get('Content-Length') or 0)
    except Exception as e:
        log('Dò Range lỗi, tải 1 luồng:', e)
    state = {'done': 0, 'err': None}
    lock = threading.Lock()
    t0 = time.time()
    stop = threading.Event()

    def report():
        while not stop.is_set():
            time.sleep(0.5)
            if sha_progress and size:
                d = state['done']
                sp = d / max(0.5, time.time() - t0)
                sha_progress(d, size, sp, (size - d) / sp if sp > 0 else 0)

    threading.Thread(target=report, daemon=True).start()

    def fetch(lo, hi):
        for attempt in range(4):
            try:
                req = urllib.request.Request(final_url, headers={'User-Agent': 'HiconiqueAgent/%s' % VERSION, 'Range': 'bytes=%d-%d' % (lo, hi)})
                with urllib.request.urlopen(req, timeout=60) as r, open(dest, 'r+b') as f:
                    if r.status != 206:
                        raise RuntimeError('không hỗ trợ Range')
                    f.seek(lo)
                    while lo <= hi:
                        chunk = r.read(min(1 << 18, hi - lo + 1))
                        if not chunk:
                            raise RuntimeError('đứt kết nối')
                        f.write(chunk)
                        lo += len(chunk)
                        with lock:
                            state['done'] += len(chunk)
                return
            except Exception as e:
                state['err'] = e
                if attempt == 3:
                    raise
                time.sleep(1 + attempt)

    try:
        if ranged and size > (4 << 20):
            with open(dest, 'wb') as f:
                f.truncate(size)
            step = -(-size // parts)
            errs = []
            ths = []
            for i in range(parts):
                lo, hi = i * step, min(size - 1, (i + 1) * step - 1)
                if lo > hi:
                    continue
                th = threading.Thread(target=lambda a=lo, b=hi: (fetch(a, b) if True else None), daemon=True)
                ths.append(th)
                th.start()
            for th in ths:
                th.join()
            if state['done'] < size:
                raise RuntimeError('tải thiếu dữ liệu (%d/%d): %s' % (state['done'], size, state['err']))
        else:
            with http_open(url, timeout=600) as r, open(dest, 'wb') as f:
                size = size or int(r.headers.get('Content-Length') or 0)
                while True:
                    chunk = r.read(1 << 18)
                    if not chunk:
                        break
                    f.write(chunk)
                    state['done'] += len(chunk)
    finally:
        stop.set()
    if sha_progress and size:
        sha_progress(size, size, size / max(0.5, time.time() - t0), 0)
    return state['done']


def check_update(cfg, progress=None, exe=None, restart=True):
    """Kiểm tra bản mới; nếu có thì TỰ TẢI về, kiểm SHA-256 rồi ghi đè file exe đang chạy.
    Trả về: 'latest' (đã mới nhất), 'updated:<ver>' (đã ghi đè xong, restart=False để giao diện tự khởi động lại;
    restart=True thì tự khởi động lại luôn và không bao giờ trả về), 'bad_url'/'bad_sha' (dữ liệu bản cập nhật
    đáng ngờ, đã hủy), 'error:<msg>' (lỗi mạng/khác), 'not_frozen' (chạy từ mã nguồn, không áp dụng).
    progress(text): gọi khi tìm thấy bản mới / trong lúc tải (để giao diện hiện tiến trình). exe: file cần ghi đè (mặc định
    chính exe đang chạy — tham số này chỉ để kiểm thử)."""
    target = exe or sys.executable
    if not FROZEN and not exe:
        return 'not_frozen'
    try:
        with http_open(cfg['updateUrl'], timeout=30) as r:
            info = json.loads(r.read().decode('utf-8'))
        if vtuple(info['version']) <= vtuple(VERSION):
            return 'latest'
        url = info['url']
        if not url.startswith(cfg.get('_allowedUpdateHosts', ALLOWED_UPDATE_HOSTS)):
            log('Bỏ qua bản cập nhật: URL lạ', url)
            return 'bad_url'
        if progress:
            progress('Có bản mới %s — đang tải về…' % info['version'])
        tmp = os.path.join(DATA_DIR, 'update.exe')
        total = int(info.get('size') or 0)
        last_txt = [0.0]

        def on_progress(done, size, speed, eta):
            if progress and time.time() - last_txt[0] >= 0.5:
                last_txt[0] = time.time()
                progress('Đang tải v%s… %d%% · %s/%s · %s/s · còn %s' % (
                    info['version'], min(99, int(done * 100 / size)), fmt_bytes(done), fmt_bytes(size), fmt_bytes(int(speed)), fmt_eta(eta)))

        download_file(url, tmp, total, on_progress)
        if progress:
            progress('Đang kiểm tra tệp tải về…')
        h = hashlib.sha256()
        with open(tmp, 'rb') as f:
            for chunk in iter(lambda: f.read(1 << 20), b''):
                h.update(chunk)
        if h.hexdigest().lower() != str(info['sha256']).lower():
            log('Bản cập nhật sai mã SHA-256, hủy')
            os.remove(tmp)
            return 'bad_sha'
        if progress:
            progress('Đang cài bản %s…' % info['version'])
        old = target + '.old'
        if os.path.exists(old):
            try:
                os.remove(old)
            except OSError:
                pass
        os.replace(target, old)   # Windows cho phép đổi tên exe đang chạy; file mới ghi vào đúng đường dẫn cũ
        try:
            shutil.copy2(tmp, target)
        except Exception:
            os.replace(old, target)   # ghi đè hỏng giữa chừng — khôi phục bản cũ để app vẫn mở được
            raise
        os.remove(tmp)
        log('Đã tải bản cập nhật', VERSION, '->', info['version'], '- sẽ khởi động lại')
        if not restart:
            return 'updated:%s' % info['version']
        relaunch_after_exit(target)
        os._exit(0)
    except Exception as e:
        log('Kiểm tra cập nhật lỗi:', e)
        return 'error:%s' % e


# ---------------- Báo cấu hình phần cứng (trang Thiết bị) ----------------
HW_SAVED_FILE = os.path.join(DATA_DIR, 'hardware_saved.dat')


def load_saved_hardware():
    d = read_secure(HW_SAVED_FILE)
    return d if isinstance(d, dict) and d.get('specs') is not None else None


def save_hardware(hw):
    try:
        write_secure(HW_SAVED_FILE, hw)
    except Exception as e:
        log('Lưu cấu hình máy lỗi:', e)


def report_hardware(cfg, hw=None):
    """Đọc cấu hình máy (hardware.py) và gửi lên sheet TB-Máy đã báo. Trả về (ok, hw|error_str)."""
    try:
        import hardware
        if hw is None:
            saved = load_saved_hardware()
            if saved and saved.get('edited'):
                hw = saved          # người dùng đã chỉnh sửa tay -> giữ nguyên nội dung đó, không quét đè
            else:
                hw = hardware.collect(send_serials=cfg['sendSerials'])
                hw['_idHost'] = hw.get('hostname', '')
                hw['edited'] = False
                hw['savedAt'] = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                save_hardware(hw)
        rec = {
            'id': 'pc_%s_%s' % (slug(hw.get('_idHost') or hw['hostname']), slug(cfg['memberId'])), 'memberId': cfg['memberId'], 'hostname': hw['hostname'],
            'agentVersion': VERSION, 'brand': hw['brand'], 'model': hw['model'], 'serial': hw['serial'], 'os': hw['os'],
            'specs': json.dumps(hw['specs'], ensure_ascii=False), 'live': json.dumps(hw['live'], ensure_ascii=False),
            'alerts': json.dumps(hw['alerts'], ensure_ascii=False), 'bootedAt': hw['bootedAt'],
            'reportedAt': datetime.now().strftime('%Y-%m-%d %H:%M'),
        }
        body = urllib.parse.urlencode({'action': 'upsertPcReport', 'data': json.dumps(rec, ensure_ascii=False)}).encode('utf-8')
        with urllib.request.urlopen(urllib.request.Request(cfg['apiUrl'], data=body, method='POST'), timeout=60) as r:
            r.read()
        log('Đã báo cấu hình máy', hw['hostname'], len(hw['specs']), 'mục,', len(hw['alerts']), 'cảnh báo')
        return True, hw
    except Exception as e:
        log('Báo cấu hình lỗi:', e)
        return False, str(e)


# ---------------- Icon Desktop (shortcut .lnk) ----------------
def desktop_shortcut_path():
    return os.path.join(os.path.join(os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Desktop'), 'HICONIQUE Agent.lnk')


def versioned_icon_path():
    """Windows lưu icon theo ĐƯỜNG DẪN file (icon cache) nên đổi logo mà file vẫn cùng đường dẫn thì shortcut/Apps&features vẫn hiện
    logo cũ. Mỗi phiên bản dùng 1 bản sao icon có TÊN KHÁC (HiconiqueAgent-<ver>.ico trong thư mục dữ liệu) → Windows buộc nạp icon mới."""
    dst = os.path.join(DATA_DIR, 'HiconiqueAgent-%s.ico' % VERSION)
    try:
        if os.path.exists(ICON_PATH) and not os.path.exists(dst):
            shutil.copy2(ICON_PATH, dst)
        for f in os.listdir(DATA_DIR):
            if f.startswith('HiconiqueAgent-') and f.endswith('.ico') and f != os.path.basename(dst):
                try:
                    os.remove(os.path.join(DATA_DIR, f))
                except OSError:
                    pass
    except Exception as e:
        log('Tạo icon theo phiên bản lỗi:', e)
    return dst if os.path.exists(dst) else INSTALL_EXE


def create_desktop_shortcut():
    try:
        lnk = desktop_shortcut_path()
        ps_lines = [
            "$s = New-Object -ComObject WScript.Shell",
            "$lnk = $s.CreateShortcut('%s')" % lnk,
            "$lnk.TargetPath = '%s'" % INSTALL_EXE,
            "$lnk.IconLocation = '%s,0'" % versioned_icon_path(),
            "$lnk.WorkingDirectory = '%s'" % INSTALL_DIR,
            "$lnk.Description = 'HICONIQUE Agent - bang dieu khien'",
            "$lnk.Save()",
        ]
        enc = base64.b64encode('\n'.join(ps_lines).encode('utf-16-le')).decode('ascii')
        subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc],
                       capture_output=True, timeout=30, creationflags=0x08000000)
    except Exception as e:
        log('Tạo icon Desktop lỗi:', e)


def remove_desktop_shortcut():
    try:
        p = desktop_shortcut_path()
        if os.path.exists(p):
            os.remove(p)
    except Exception:
        pass


# ---------------- Cài đặt Windows (Run key + Apps & features) ----------------
def register_windows():
    import winreg
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
        winreg.SetValueEx(k, APP_NAME, 0, winreg.REG_SZ, '"%s" --run' % INSTALL_EXE)
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY) as k:
        for name, val in (('DisplayName', 'HICONIQUE Agent'), ('DisplayVersion', VERSION), ('Publisher', 'HICONIQUE'),
                          ('InstallLocation', INSTALL_DIR), ('DisplayIcon', versioned_icon_path()),
                          ('UninstallString', '"%s" --uninstall' % INSTALL_EXE)):
            winreg.SetValueEx(k, name, 0, winreg.REG_SZ, val)
        winreg.SetValueEx(k, 'NoModify', 0, winreg.REG_DWORD, 1)
        winreg.SetValueEx(k, 'NoRepair', 0, winreg.REG_DWORD, 1)


def unregister_windows():
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
            winreg.DeleteValue(k, APP_NAME)
    except OSError:
        pass
    try:
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY)
    except OSError:
        pass


MEMBERS_CACHE = os.path.join(DATA_DIR, 'members_cache.json')


def load_members_cache():
    try:
        with open(MEMBERS_CACHE, encoding='utf-8') as f:
            return [tuple(x) for x in json.load(f)]
    except Exception:
        return []


def fetch_members(cfg, attempts=4, timeout=60, progress=None):
    """Tải danh sách thành viên từ Hub. Máy chủ Google Sheet đôi lúc trả lời rất chậm (16-35 giây) hoặc lỗi 404 thoáng qua,
    nên chờ tối đa `timeout` giây/lần và tự thử lại `attempts` lần. Trả về (danh_sách, lỗi_cuối); thành công thì lưu cache ra đĩa."""
    err = ''
    for i in range(attempts):
        if progress:
            progress(i + 1, attempts)
        try:
            with http_open(cfg['apiUrl'] + '?action=getMembers', timeout=timeout) as r:
                items = json.loads(r.read().decode('utf-8'))
            out = []
            for m in items:
                if m.get('id') and m.get('name') and m.get('visible', True) is not False:
                    out.append((str(m['name']), str(m['id'])))
            out = sorted(out)
            if out:
                try:
                    with open(MEMBERS_CACHE, 'w', encoding='utf-8') as f:
                        json.dump(out, f, ensure_ascii=False)
                except Exception:
                    pass
                return out, ''
            err = 'danh sách rỗng'
        except Exception as e:
            err = str(e)
            log('Không tải được danh sách thành viên (lần %d/%d): %s' % (i + 1, attempts, e))
        time.sleep(2)
    return [], err


# ==============================================================================
# PyQt5 — toàn bộ giao diện. Cài từ requirements: PyQt5, pandas, openpyxl, pillow (chỉ build icon)
# ==============================================================================
from PyQt5.QtCore import Qt, QTimer, QThread, pyqtSignal, QSettings, QRectF, QRect, QStandardPaths, QByteArray, QSize
from PyQt5.QtGui import QIcon, QColor, QPainter, QFont, QImage, QBrush, QPen, QPainterPath, QCloseEvent, QPixmap
from PyQt5.QtSvg import QSvgRenderer
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QFormLayout,
    QPushButton, QLabel, QLineEdit, QComboBox, QCheckBox, QSpinBox, QTextEdit, QTabWidget,
    QTableWidget, QTableWidgetItem, QHeaderView, QListWidget, QListWidgetItem, QAbstractItemView,
    QFileDialog, QMessageBox, QDialog, QGroupBox, QSystemTrayIcon, QMenu, QAction, QScrollArea,
    QGraphicsView, QGraphicsScene, QGraphicsRectItem, QGraphicsTextItem, QGraphicsLineItem,
    QGraphicsItem, QSizePolicy, QSplitter, QRadioButton, QButtonGroup, QStackedWidget, QFrame, QProgressBar,
)
from PyQt5.QtNetwork import QLocalServer, QLocalSocket

BRONZE = '#B08D57'
DARK_BG = '#14161A'
SURFACE = '#1D2025'
BORDER = '#2C2F36'
TEXT = '#F4F1EC'
MUTED = '#9AA0AA'
SUN_COLOR = '#C7A464'    # cùng màu icon mặt trời/mặt trăng trên web (tokens.css: --color-warning / --color-blue)
MOON_COLOR = '#3B6B8C'

# Nền sáng/tối — cùng 1 khung QSS, chỉ đổi bảng màu. Toggle ở góc phải thanh tiêu đề, nhớ lựa chọn qua QSettings.
THEME_COLORS = {
    'dark': {'bg': DARK_BG, 'surface': SURFACE, 'border': BORDER, 'text': TEXT, 'muted': MUTED, 'bronze': BRONZE, 'hover': '#262A31', 'sel': 'rgba(176,141,87,0.22)'},
    'light': {'bg': '#F7F4EF', 'surface': '#FFFFFF', 'border': '#E1DACD', 'text': '#20221F', 'muted': '#7A7568', 'bronze': BRONZE, 'hover': '#F0EBE2', 'sel': 'rgba(176,141,87,0.20)'},
}
QSS_TEMPLATE = """
QMainWindow, QDialog, QMessageBox { background: %(bg)s; }
QWidget { background: %(bg)s; color: %(text)s; font-family: 'Segoe UI'; font-size: 13px; }
QLabel, QCheckBox, QRadioButton { background: transparent; color: %(text)s; }
QLabel[muted="true"] { color: %(muted)s; }
QLabel#h1 { font-size: 19px; font-weight: 700; }
QWidget#header { background: %(surface)s; border-bottom: 1px solid %(border)s; }
QWidget#header QLabel, QWidget#sidebar QLabel { background: transparent; }
QWidget#sidebar { background: %(surface)s; border-right: 1px solid %(border)s; }
QPushButton#nav { text-align: left; padding: 11px 14px; border: none; border-radius: 9px; color: %(muted)s; background: transparent; font-size: 13px; }
QPushButton#nav:hover { background: %(hover)s; color: %(text)s; }
QPushButton#nav:checked { background: %(sel)s; color: %(bronze)s; font-weight: 600; }
QPushButton#iconbtn { padding: 0; border: 1px solid %(border)s; border-radius: 9px; background: %(bg)s; }
QPushButton#iconbtn:hover { border-color: %(bronze)s; }
QFrame#card { background: %(surface)s; border: 1px solid %(border)s; border-radius: 14px; }
QFrame#card QLabel { background: transparent; }
QFrame#card QSpinBox { background: %(bg)s; }
QTabWidget::pane { border: 1px solid %(border)s; border-radius: 9px; top: -1px; background: %(surface)s; }
QTabBar { background: transparent; }
QTabBar::tab { background: transparent; color: %(muted)s; padding: 9px 18px; margin-right: 4px; border: 1px solid transparent; border-bottom: none; border-top-left-radius: 9px; border-top-right-radius: 9px; }
QTabBar::tab:selected { background: %(surface)s; color: %(bronze)s; border-color: %(border)s; }
QTabBar::tab:hover { color: %(text)s; }
QPushButton { background: %(surface)s; color: %(text)s; border: 1px solid %(border)s; border-radius: 8px; padding: 7px 14px; }
QPushButton:hover { border-color: %(bronze)s; color: %(bronze)s; }
QPushButton:disabled { color: %(muted)s; border-color: %(border)s; }
QPushButton#primary { background: %(bronze)s; color: #0B0D10; font-weight: 700; border: none; }
QPushButton#primary:hover { background: #C7A464; color: #0B0D10; }
QPushButton#primary:disabled { background: %(border)s; color: %(muted)s; }
QPushButton#danger { color: #D07070; }
QPushButton#danger:hover { border-color: #D07070; color: #D07070; }
QPushButton#preset { padding: 5px 12px; border-radius: 12px; }
QLineEdit, QComboBox, QSpinBox, QTextEdit, QListWidget, QTableWidget { background: %(surface)s; color: %(text)s; border: 1px solid %(border)s; border-radius: 8px; padding: 6px 8px; selection-background-color: %(sel)s; selection-color: %(text)s; }
QLineEdit, QComboBox, QSpinBox { min-height: 22px; }
QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QTextEdit:focus { border-color: %(bronze)s; }
QComboBox QAbstractItemView { background: %(surface)s; color: %(text)s; border: 1px solid %(border)s; selection-background-color: %(sel)s; selection-color: %(text)s; }
QTableWidget { gridline-color: %(border)s; alternate-background-color: %(bg)s; }
QTableWidget::item { padding: 4px 8px; }
QTableWidget::item:selected { background: %(sel)s; color: %(text)s; }
QTableCornerButton::section { background: %(surface)s; border: none; }
QHeaderView { background: %(surface)s; }
QHeaderView::section { background: %(surface)s; color: %(muted)s; border: none; border-bottom: 1px solid %(border)s; padding: 8px; font-weight: 600; }
QGroupBox { border: 1px solid %(border)s; border-radius: 10px; margin-top: 14px; padding: 14px 10px 10px 10px; background: transparent; }
QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 6px; color: %(bronze)s; font-weight: 600; }
QScrollBar:vertical { background: transparent; width: 10px; margin: 0; }
QScrollBar::handle:vertical { background: %(border)s; border-radius: 5px; min-height: 28px; }
QScrollBar::handle:vertical:hover { background: %(muted)s; }
QScrollBar:horizontal { background: transparent; height: 10px; margin: 0; }
QScrollBar::handle:horizontal { background: %(border)s; border-radius: 5px; min-width: 28px; }
QScrollBar::handle:horizontal:hover { background: %(muted)s; }
QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; }
QScrollBar::add-page, QScrollBar::sub-page { background: transparent; }
QMenu { background: %(surface)s; color: %(text)s; border: 1px solid %(border)s; padding: 4px; }
QMenu::item { padding: 7px 22px; border-radius: 6px; }
QMenu::item:selected { background: %(sel)s; color: %(bronze)s; }
QProgressBar { background: %(bg)s; border: 1px solid %(border)s; border-radius: 6px; text-align: center; min-height: 14px; max-height: 14px; font-size: 10px; color: %(text)s; }
QProgressBar::chunk { background: %(bronze)s; border-radius: 5px; }
QFrame#kpi { background: %(surface)s; border: 1px solid %(border)s; border-radius: 14px; }
QFrame#kpi QLabel { background: transparent; }
QLabel#kpiTitle { color: %(muted)s; font-size: 11px; font-weight: 600; }
QLabel#kpiValue { font-size: 24px; font-weight: 700; }
QLabel#kpiSub { color: %(muted)s; font-size: 11px; }
QLabel#pillOk { background: rgba(79,111,82,0.20); color: #6FA274; border: 1px solid rgba(79,111,82,0.55); border-radius: 12px; padding: 4px 12px; font-weight: 700; }
QLabel#pillBad { background: rgba(208,112,112,0.16); color: #D07070; border: 1px solid rgba(208,112,112,0.5); border-radius: 12px; padding: 4px 12px; font-weight: 700; }
QLabel#chip { background: %(surface)s; border: 1px solid %(border)s; border-radius: 10px; padding: 3px 10px; color: %(muted)s; }
QFrame#hero { background: %(surface)s; border: 1px solid %(border)s; border-radius: 16px; }
QFrame#hero QLabel, QFrame#note QLabel { background: transparent; }
QFrame#note { background: %(surface)s; border: 1px solid %(border)s; border-radius: 12px; }
QToolTip { background: %(surface)s; color: %(text)s; border: 1px solid %(border)s; padding: 4px 8px; }
"""


def qss_for(theme):
    return QSS_TEMPLATE % THEME_COLORS.get(theme, THEME_COLORS['dark'])


APP_QSS = qss_for('dark')  # giữ tên cũ để tương thích — mặc định khởi động là nền tối


PREFS_FILE = os.path.join(DATA_DIR, 'prefs.dat')


def load_theme():
    # Nhớ chế độ nền sáng/tối kể cả offline: lưu vào file trên máy (prefs.dat) VÀ registry (QSettings) — đọc file trước
    p = read_secure(PREFS_FILE)
    if isinstance(p, dict) and p.get('theme') in THEME_COLORS:
        return p['theme']
    v = QSettings('HICONIQUE', 'HiconiqueAgent').value('theme', 'dark')
    return v if v in THEME_COLORS else 'dark'


def save_theme(theme):
    try:
        prefs = read_secure(PREFS_FILE) or {}
        prefs['theme'] = theme
        write_secure(PREFS_FILE, prefs)
    except Exception as e:
        log('Lưu chế độ nền lỗi:', e)
    st = QSettings('HICONIQUE', 'HiconiqueAgent')
    st.setValue('theme', theme)
    st.sync()


def app_icon():
    return QIcon(ICON_PATH) if os.path.exists(ICON_PATH) else QIcon()


def logo_pixmap(size):
    p = os.path.join(sys._MEIPASS, 'logo.png') if hasattr(sys, '_MEIPASS') else os.path.join(BASE, 'logo.png')
    if os.path.exists(p):
        return QPixmap(p).scaled(size, size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
    return app_icon().pixmap(size, size)


# Icon nét mảnh (stroke) cùng phong cách icon SVG trên web — vẽ bằng QtSvg, đổi màu theo nền sáng/tối.
SVG_ICONS = {
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke-linecap="round"/>',
    'moon': '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke-linecap="round" stroke-linejoin="round"/>',
    'activity': '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-linecap="round" stroke-linejoin="round"/>',
    'cpu': '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" stroke-linecap="round"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21" stroke-linecap="round" stroke-linejoin="round"/>',
    'drop': '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke-linecap="round" stroke-linejoin="round"/>',
    'power': '<path d="M18.36 6.64a9 9 0 1 1-12.73 0" stroke-linecap="round"/><line x1="12" y1="2" x2="12" y2="12" stroke-linecap="round"/>',
    'refresh': '<polyline points="23 4 23 10 17 10" stroke-linecap="round" stroke-linejoin="round"/><polyline points="1 20 1 14 7 14" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke-linecap="round" stroke-linejoin="round"/>',
}


def svg_icon(name, color, size=18):
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.6">%s</svg>'
           % (color, SVG_ICONS[name]))
    scale = 2  # nét sắc trên màn hình DPI cao
    pm = QPixmap(size * scale, size * scale)
    pm.fill(Qt.transparent)
    painter = QPainter(pm)
    painter.setRenderHint(QPainter.Antialiasing)
    QSvgRenderer(QByteArray(svg.encode('utf-8'))).render(painter)
    painter.end()
    pm.setDevicePixelRatio(scale)
    return QIcon(pm)


class Shared:
    """Trạng thái dùng chung giữa luồng nền (ghi nhận) và giao diện (chỉ đọc để hiển thị)."""
    def __init__(self, cfg):
        self.cfg = cfg
        self.day = datetime.now().strftime('%Y-%m-%d')
        self.st = load_state(self.day)
        self.paused = False   # luôn False — đã bỏ nút tạm dừng ghi nhận (yêu cầu 2026-09-30)
        self.last_flush_at = None
        self.last_flush_ok = None
        self.next_flush_at = time.time() + cfg['flushMinutes'] * 60   # mốc gửi kế tiếp (giao diện đếm ngược)


class BackgroundWorker(QThread):
    """Luồng nền: ghi nhận ứng dụng đang dùng, gửi định kỳ lên Hub, báo cấu hình máy, tự kiểm tra cập nhật."""
    dayChanged = pyqtSignal(str)

    def __init__(self, shared):
        super().__init__()
        self.shared = shared
        self._stop = False

    def stop(self):
        self._stop = True

    def run(self):
        cfg = self.shared.cfg
        purge_legacy_plaintext()
        cleanup_old_days()
        if not os.path.exists(os.path.join(DATA_DIR, 'da-thong-bao-' + self.shared.day)):
            open(os.path.join(DATA_DIR, 'da-thong-bao-' + self.shared.day), 'w').close()
        last_flush = time.time()
        last_hw = time.time() - cfg['hardwareHours'] * 3600 + 90
        last_update = time.time() - 300  # kiểm tra cập nhật sau ~5 phút mở app, rồi theo chu kỳ
        step = cfg['sampleSeconds']
        while not self._stop:
            now = datetime.now()
            d = now.strftime('%Y-%m-%d')
            if d != self.shared.day:
                flush(cfg, self.shared.day, self.shared.st)
                self.shared.day, self.shared.st = d, load_state(d)
                cleanup_old_days()
                self.dayChanged.emit(d)
            if not self.shared.paused and in_work_time(cfg, now):
                st = self.shared.st
                if idle_seconds() >= cfg['idleSeconds']:
                    st['idleSec'] = st.get('idleSec', 0) + step
                else:
                    app, title = foreground()
                    if app and app not in SKIP_APPS:
                        v = st['apps'].setdefault(app, {'sec': 0, 'titles': {}})
                        v['sec'] += step
                        t = clean_title(title, cfg['sendTitles'])
                        if t:
                            v['titles'][t] = v['titles'].get(t, 0) + step
                            if len(v['titles']) > 30:
                                for k in sorted(v['titles'], key=v['titles'].get)[:10]:
                                    del v['titles'][k]
                save_state(self.shared.day, st)
            if time.time() - last_flush >= cfg['flushMinutes'] * 60:
                ok = flush(cfg, self.shared.day, self.shared.st)
                self.shared.last_flush_at = datetime.now()
                self.shared.last_flush_ok = ok
                last_flush = time.time() if ok else time.time() - cfg['flushMinutes'] * 60 + 60
                self.shared.next_flush_at = last_flush + cfg['flushMinutes'] * 60
            if cfg['reportHardware'] and time.time() - last_hw >= cfg['hardwareHours'] * 3600:
                last_hw = time.time()
                report_hardware(cfg)
            if time.time() - last_update >= cfg['updateCheckHours'] * 3600:
                last_update = time.time()
                check_update(cfg)
            for _ in range(step):
                if self._stop:
                    break
                time.sleep(1)


# ==============================================================================
# TAB 1 — Kiểm soát dữ liệu thao tác
# ==============================================================================
def fmt_dur(sec):
    m = int(round(sec / 60.0))
    if sec < 60:
        return '%d giây' % int(sec)
    return '%dh %02dp' % (m // 60, m % 60) if m >= 60 else '%d phút' % m


def make_kpi(title):
    f = QFrame()
    f.setObjectName('kpi')
    v = QVBoxLayout(f)
    v.setContentsMargins(16, 12, 16, 12)
    v.setSpacing(2)
    t = QLabel(title.upper())
    t.setObjectName('kpiTitle')
    val = QLabel('—')
    val.setObjectName('kpiValue')
    sub = QLabel('')
    sub.setObjectName('kpiSub')
    sub.setWordWrap(True)
    for w in (t, val, sub):
        v.addWidget(w)
    return f, val, sub


class ActivityTab(QWidget):
    def __init__(self, shared, parent=None):
        super().__init__(parent)
        self.shared = shared
        self.sel_app = None
        lay = QVBoxLayout(self)
        lay.setContentsMargins(28, 22, 28, 22)
        lay.setSpacing(12)

        top = QHBoxLayout()
        head = QLabel('Kiểm soát dữ liệu thao tác')
        head.setObjectName('h1')
        top.addWidget(head)
        top.addStretch(1)
        self.lblStatus = QLabel()
        top.addWidget(self.lblStatus)
        lay.addLayout(top)

        sub = QLabel('Ghi nhận tên ứng dụng và tiêu đề cửa sổ đang dùng trong giờ làm việc — không chụp màn hình, không ghi phím gõ. '
                     'Dữ liệu tự gửi lên Hub mỗi %d phút.' % shared.cfg['flushMinutes'])
        sub.setWordWrap(True)
        sub.setProperty('muted', True)
        lay.addWidget(sub)

        chips = QHBoxLayout()
        chips.setSpacing(8)
        for txt in ('👤  %s' % (shared.cfg.get('memberId') or '(chưa cấu hình)'),
                    '🕒  Giờ làm việc %s' % shared.cfg.get('workHours'),
                    '💻  %s' % socket.gethostname()):
            c = QLabel(txt)
            c.setObjectName('chip')
            chips.addWidget(c)
        chips.addStretch(1)
        lay.addLayout(chips)

        kp = QHBoxLayout()
        kp.setSpacing(12)
        self.kActive, self.vActive, self.sActive = make_kpi('Đang hoạt động hôm nay')
        self.kIdle, self.vIdle, self.sIdle = make_kpi('Không thao tác')
        self.kApps, self.vApps, self.sApps = make_kpi('Ứng dụng đã dùng')
        self.kSend, self.vSend, self.sSend = make_kpi('Gửi lên Hub')
        for k in (self.kActive, self.kIdle, self.kApps, self.kSend):
            kp.addWidget(k, 1)
        lay.addLayout(kp)

        body = QSplitter(Qt.Horizontal)   # kéo thanh giữa để đổi độ rộng 2 bảng
        body.setChildrenCollapsible(False)
        body.setHandleWidth(12)
        body.setStyleSheet('QSplitter::handle{background:transparent;}QSplitter::handle:hover{background:rgba(176,141,87,0.35);border-radius:4px;}')
        leftCard = QFrame()
        leftCard.setObjectName('card')
        lv = QVBoxLayout(leftCard)
        lv.setContentsMargins(14, 12, 14, 12)
        lt = QLabel('Ứng dụng hôm nay')
        lt.setStyleSheet('font-weight:700;')
        lv.addWidget(lt)
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(['Ứng dụng', 'Tên gốc', 'Thời gian', 'Tỉ lệ'])
        hh = self.table.horizontalHeader()
        hh.setSectionResizeMode(0, QHeaderView.Stretch)
        hh.setSectionResizeMode(1, QHeaderView.Interactive)
        hh.setSectionResizeMode(2, QHeaderView.Interactive)
        hh.setSectionResizeMode(3, QHeaderView.Interactive)
        hh.setStretchLastSection(False)
        self.table.setColumnWidth(1, 110)
        self.table.setColumnWidth(2, 90)
        self.table.setColumnWidth(3, 130)
        hh.setHighlightSections(False)
        hh.setDefaultAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        self.table.verticalHeader().setVisible(False)
        self.table.verticalHeader().setDefaultSectionSize(36)
        self.table.setShowGrid(False)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.itemSelectionChanged.connect(self.on_select)
        self.table.setStyleSheet('QTableWidget{border:none;background:transparent;}')
        lv.addWidget(self.table, 1)
        body.addWidget(leftCard)

        rightCard = QFrame()
        rightCard.setObjectName('card')
        rv = QVBoxLayout(rightCard)
        rv.setContentsMargins(14, 12, 14, 12)
        self.lblDetail = QLabel('Chi tiết')
        self.lblDetail.setStyleSheet('font-weight:700;')
        rv.addWidget(self.lblDetail)
        self.detail = QTableWidget(0, 2)
        self.detail.setHorizontalHeaderLabels(['Tiêu đề cửa sổ', 'Phút'])
        dh = self.detail.horizontalHeader()
        dh.setSectionResizeMode(0, QHeaderView.Stretch)
        dh.setSectionResizeMode(1, QHeaderView.Interactive)
        self.detail.setColumnWidth(1, 70)
        dh.setHighlightSections(False)
        dh.setDefaultAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        self.detail.verticalHeader().setVisible(False)
        self.detail.verticalHeader().setDefaultSectionSize(30)
        self.detail.setShowGrid(False)
        self.detail.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.detail.setSelectionMode(QAbstractItemView.NoSelection)
        self.detail.setWordWrap(True)
        self.detail.setStyleSheet('QTableWidget{border:none;background:transparent;}')
        rv.addWidget(self.detail, 1)
        self.lblHint = QLabel('Chọn một ứng dụng bên trái để xem các cửa sổ/tab đã mở.')
        self.lblHint.setProperty('muted', True)
        self.lblHint.setWordWrap(True)
        rv.addWidget(self.lblHint)
        body.addWidget(rightCard)
        body.setStretchFactor(0, 3)
        body.setStretchFactor(1, 2)
        body.setSizes([620, 420])
        lay.addWidget(body, 1)

        btnRow = QHBoxLayout()
        btnFlush = QPushButton('Gửi ngay lên Hub')
        btnFlush.setObjectName('primary')
        btnFlush.clicked.connect(self.flush_now)
        btnRow.addWidget(btnFlush)
        btnRow.addStretch(1)
        self.lblFlush = QLabel('')
        self.lblFlush.setProperty('muted', True)
        btnRow.addWidget(self.lblFlush)
        lay.addLayout(btnRow)

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.refresh)
        self.timer.start(1000)
        self.refresh()

    def flush_now(self):
        ok = flush(self.shared.cfg, self.shared.day, self.shared.st)
        self.shared.last_flush_at = datetime.now()
        self.shared.last_flush_ok = ok
        self.shared.next_flush_at = time.time() + self.shared.cfg['flushMinutes'] * 60
        self.refresh()

    def on_select(self):
        rows = self.table.selectionModel().selectedRows()
        if rows:
            it = self.table.item(rows[0].row(), 0)
            self.sel_app = it.data(Qt.UserRole) if it else None
        self.fill_detail()

    def fill_detail(self):
        apps = self.shared.st.get('apps', {})
        v = apps.get(self.sel_app) if self.sel_app else None
        if not v:
            self.lblDetail.setText('Chi tiết')
            self.detail.setRowCount(0)
            self.lblHint.setText('Chọn một ứng dụng bên trái để xem các cửa sổ/tab đã mở.')
            return
        titles = sorted(v.get('titles', {}).items(), key=lambda kv: -kv[1])
        self.lblDetail.setText('Chi tiết — %s  ·  %s' % (friendly_app(self.sel_app), fmt_dur(v['sec'])))
        self.detail.setRowCount(len(titles))
        for i, (t, sec) in enumerate(titles):
            a = QTableWidgetItem(t)
            a.setToolTip(t)
            self.detail.setItem(i, 0, a)
            b = QTableWidgetItem('%.1f' % (sec / 60.0))
            b.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.detail.setItem(i, 1, b)
        self.lblHint.setText('' if titles else 'Ứng dụng này không có tiêu đề cửa sổ được ghi (hoặc đang tắt gửi tiêu đề).')

    def refresh(self):
        sh = self.shared
        in_work = in_work_time(sh.cfg, datetime.now())
        self.lblStatus.setText('●  Đang ghi nhận' if in_work else '●  Chờ giờ làm việc')
        self.lblStatus.setObjectName('pillOk')
        self.lblStatus.style().unpolish(self.lblStatus)
        self.lblStatus.style().polish(self.lblStatus)

        apps = sorted(sh.st.get('apps', {}).items(), key=lambda kv: -kv[1]['sec'])
        active = sum(v['sec'] for _, v in apps)
        idle = sh.st.get('idleSec', 0)
        tracked = active + idle
        self.vActive.setText(fmt_dur(active))
        self.sActive.setText('%d%% thời gian đo' % round(active * 100.0 / tracked) if tracked else 'chưa có dữ liệu')
        self.vIdle.setText(fmt_dur(idle))
        self.sIdle.setText('không chạm chuột/phím ≥ %d phút' % max(1, sh.cfg['idleSeconds'] // 60))
        self.vApps.setText(str(len(apps)))
        self.sApps.setText('%s nhiều nhất' % apps[0][0] if apps else 'chưa có ứng dụng nào')
        if sh.last_flush_at:
            self.vSend.setText('✓ %s' % sh.last_flush_at.strftime('%H:%M') if sh.last_flush_ok else '✗ lỗi')
        else:
            self.vSend.setText('—')
        left = max(0, int(sh.next_flush_at - time.time()))
        self.sSend.setText('gửi tiếp sau %d:%02d' % (left // 60, left % 60))
        if sh.last_flush_at:
            self.lblFlush.setText('Gửi lần cuối lúc %s — %s' % (sh.last_flush_at.strftime('%H:%M:%S'), 'thành công' if sh.last_flush_ok else 'thất bại, sẽ thử lại'))

        # bảng ứng dụng: cập nhật tại chỗ (không dựng lại toàn bộ để khỏi nháy/mất chọn)
        self.table.blockSignals(True)
        if self.table.rowCount() != len(apps):
            self.table.setRowCount(len(apps))
        total = float(active) or 1.0
        for i, (name, v) in enumerate(apps):
            it = self.table.item(i, 0)
            if it is None:
                it = QTableWidgetItem()
                self.table.setItem(i, 0, it)
                raw = QTableWidgetItem()
                raw.setForeground(QColor('#8B8578'))
                self.table.setItem(i, 1, raw)
                tm = QTableWidgetItem()
                tm.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
                self.table.setItem(i, 2, tm)
                bar = QProgressBar()
                bar.setRange(0, 100)
                self.table.setCellWidget(i, 3, bar)
            it.setText(friendly_app(name))
            it.setData(Qt.UserRole, name)
            self.table.item(i, 1).setText(name)
            self.table.item(i, 2).setText(fmt_dur(v['sec']))
            self.table.cellWidget(i, 3).setValue(int(round(v['sec'] * 100 / total)))
        if self.sel_app is None and apps:
            self.sel_app = apps[0][0]
        for i, (name, _) in enumerate(apps):
            if name == self.sel_app and not self.table.selectionModel().isRowSelected(i, self.table.rootIndex()):
                self.table.selectRow(i)
        self.table.blockSignals(False)
        self.fill_detail()


# ==============================================================================
# TAB 2 — Thông số linh kiện máy tính
# ==============================================================================
class HardwareScanThread(QThread):
    done = pyqtSignal(bool, object)

    def __init__(self, cfg, upload=False, hw=None):
        super().__init__()
        self.cfg = cfg
        self.upload = upload
        self.hw = hw          # có sẵn dữ liệu (đã chỉnh sửa) -> chỉ gửi lên web, KHÔNG quét lại

    def run(self):
        try:
            hw = self.hw
            if hw is None:
                import hardware
                hw = hardware.collect(send_serials=self.cfg['sendSerials'])
                hw['_idHost'] = hw.get('hostname', '')   # mã bản ghi trên web luôn theo tên máy thật lúc quét, dù sau này tên hiển thị bị sửa
                hw['edited'] = False
                hw['savedAt'] = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                save_hardware(hw)
            if self.upload:
                ok, _ = report_hardware(self.cfg, hw=hw)
                self.done.emit(ok, hw)
            else:
                self.done.emit(True, hw)
        except Exception as e:
            self.done.emit(False, str(e))


class HardwareTab(QWidget):
    def __init__(self, shared, parent=None):
        super().__init__(parent)
        self.shared = shared
        self.hw = None
        self.dirty = False
        self._loading = False
        lay = QVBoxLayout(self)
        lay.setContentsMargins(28, 24, 28, 24)
        lay.setSpacing(10)

        head = QLabel('Thông số linh kiện máy tính')
        head.setObjectName('h1')
        lay.addWidget(head)
        sub = QLabel('Quét CPU, mainboard, RAM, ổ cứng, card đồ họa, màn hình, pin, bảo mật... của chính máy này. '
                     'Nhấp đúp vào một ô để sửa nội dung, rồi bấm "Lưu chỉnh sửa" — phần đã sửa được giữ nguyên cho tới khi bạn bấm '
                     '"Quét lại phần cứng". "Cập nhật lên web" gửi đúng nội dung đang hiển thị (bình thường app tự gửi mỗi %d giờ).' % shared.cfg['hardwareHours'])
        sub.setWordWrap(True)
        sub.setProperty('muted', True)
        lay.addWidget(sub)

        row = QHBoxLayout()
        self.btnScan = QPushButton('Quét lại phần cứng')
        self.btnScan.clicked.connect(self.on_scan_clicked)
        row.addWidget(self.btnScan)
        self.btnSave = QPushButton('Lưu chỉnh sửa')
        self.btnSave.setEnabled(False)
        self.btnSave.clicked.connect(self.save_edits)
        row.addWidget(self.btnSave)
        self.btnDiscard = QPushButton('Hủy chỉnh sửa')
        self.btnDiscard.setEnabled(False)
        self.btnDiscard.clicked.connect(self.discard_edits)
        row.addWidget(self.btnDiscard)
        self.btnUpload = QPushButton('Cập nhật lên web')
        self.btnUpload.setObjectName('primary')
        self.btnUpload.clicked.connect(self.upload_current)
        row.addWidget(self.btnUpload)
        row.addStretch(1)
        self.lblStatus = QLabel('')
        self.lblStatus.setProperty('muted', True)
        row.addWidget(self.lblStatus)
        lay.addLayout(row)

        self.table = QTableWidget(0, 3)
        self.table.setHorizontalHeaderLabels(['Loại', 'Tên / Model', 'Thông số'])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.table.horizontalHeader().setHighlightSections(False)
        self.table.horizontalHeader().setDefaultAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        self.table.verticalHeader().setVisible(False)
        self.table.setAlternatingRowColors(True)
        self.table.setShowGrid(False)
        self.table.setWordWrap(True)
        self.table.setTextElideMode(Qt.ElideNone)
        self.table.setSelectionBehavior(QAbstractItemView.SelectItems)
        self.table.setEditTriggers(QAbstractItemView.DoubleClicked | QAbstractItemView.EditKeyPressed)   # nhấp đúp (hoặc F2) để sửa
        self.table.itemChanged.connect(self.on_item_changed)
        lay.addWidget(self.table, 2)

        self.txtAlerts = QTextEdit()
        self.txtAlerts.setReadOnly(True)
        self.txtAlerts.setMaximumHeight(110)
        self.txtAlerts.setPlaceholderText('Không có cảnh báo.')
        lay.addWidget(self.txtAlerts)

        saved = load_saved_hardware()
        if saved:
            # Có dữ liệu đã lưu (đã sửa hoặc lần quét trước) -> hiện luôn, KHÔNG tự quét đè lên phần đã chỉnh sửa
            self.hw = saved
            self.render(saved)
            self.lblStatus.setText('Đang hiển thị dữ liệu %s lúc %s' % ('đã chỉnh sửa' if saved.get('edited') else 'quét', saved.get('savedAt', '?')))
        else:
            QTimer.singleShot(300, lambda: self.scan(False))

    # ---- hiển thị / theo dõi chỉnh sửa ----
    def render(self, hw):
        self._loading = True
        self.table.setRowCount(0)
        header = [('Máy', hw.get('hostname', ''), ' '.join(x for x in (hw.get('brand'), hw.get('model')) if x)),
                  ('Hệ điều hành', hw.get('os', ''), '')]
        rows = header + [(s['type'], s['name'], s['spec']) for s in hw.get('specs', [])]
        self.table.setRowCount(len(rows))
        for i, (t, n, s) in enumerate(rows):
            it0 = QTableWidgetItem(t)
            if i < 2:
                it0.setFlags(it0.flags() & ~Qt.ItemIsEditable)   # 2 dòng đầu: nhãn cố định
            self.table.setItem(i, 0, it0)
            self.table.setItem(i, 1, QTableWidgetItem(n))
            it2 = QTableWidgetItem(s)
            if i == 1:
                it2.setFlags(it2.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(i, 2, it2)
        self.table.resizeRowsToContents()
        alerts = hw.get('alerts', [])
        live = hw.get('live', [])
        text = ''
        if alerts:
            text += 'CẢNH BÁO:\n' + '\n'.join('⚠ ' + a for a in alerts) + '\n\n'
        if live:
            text += 'Tình trạng hiện tại: ' + ' · '.join(live)
        self.txtAlerts.setPlainText(text or 'Không có cảnh báo.')
        self._loading = False
        self._set_dirty(False)

    def _set_dirty(self, dirty):
        self.dirty = dirty
        self.btnSave.setEnabled(dirty)
        self.btnDiscard.setEnabled(dirty)

    def on_item_changed(self, item):
        if self._loading:
            return
        self._set_dirty(True)
        self.table.resizeRowToContents(item.row())
        self.lblStatus.setText('Có chỉnh sửa chưa lưu — bấm "Lưu chỉnh sửa"')

    def _cell(self, r, c):
        it = self.table.item(r, c)
        return it.text().strip() if it else ''

    def save_edits(self):
        """Ghi nội dung bảng (đã sửa) vào dữ liệu máy và lưu ra file — mở lại app vẫn giữ nguyên."""
        if not self.hw:
            return
        hw = self.hw
        n = self.table.rowCount()
        if n >= 1:
            hw['hostname'] = self._cell(0, 1)
            orig = ' '.join(x for x in (hw.get('brand'), hw.get('model')) if x)
            new_bm = self._cell(0, 2)
            if new_bm != orig:            # chỉ khi có sửa mới ghi đè (hãng/model gộp 1 ô nên không tách lại được)
                hw['brand'], hw['model'] = new_bm, ''
        if n >= 2:
            hw['os'] = self._cell(1, 1)
        specs = hw.get('specs', [])
        for i in range(2, n):
            k = i - 2
            if k < len(specs):
                specs[k] = {'type': self._cell(i, 0), 'name': self._cell(i, 1), 'spec': self._cell(i, 2)}
        hw['edited'] = True
        hw['savedAt'] = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        save_hardware(hw)
        self._set_dirty(False)
        self.lblStatus.setText('Đã lưu chỉnh sửa lúc %s' % datetime.now().strftime('%H:%M:%S'))

    def discard_edits(self):
        if self.hw:
            self.render(self.hw)
            self.lblStatus.setText('Đã hủy chỉnh sửa chưa lưu')

    # ---- quét / gửi lên web ----
    def on_scan_clicked(self):
        if self.dirty and QMessageBox.question(self, 'Quét lại phần cứng',
                                               'Bạn có chỉnh sửa CHƯA LƯU. Quét lại sẽ ghi đè toàn bộ bảng bằng kết quả quét mới.\nTiếp tục quét?',
                                               QMessageBox.Yes | QMessageBox.No, QMessageBox.No) != QMessageBox.Yes:
            return
        if not self.dirty and self.hw and self.hw.get('edited') and QMessageBox.question(
                self, 'Quét lại phần cứng',
                'Bảng đang có nội dung bạn đã chỉnh sửa. Quét lại sẽ thay bằng kết quả quét mới.\nTiếp tục quét?',
                QMessageBox.Yes | QMessageBox.No, QMessageBox.No) != QMessageBox.Yes:
            return
        self.scan(False)

    def upload_current(self):
        if not self.hw:
            self.scan(True)
            return
        if self.dirty:
            self.save_edits()
        self._start_thread(upload=True, hw=self.hw, msg='Đang gửi lên web…')

    def scan(self, upload):
        self._start_thread(upload=upload, hw=None, msg='Đang quét… (có thể mất 10–20 giây)')

    def _start_thread(self, upload, hw, msg):
        for b in (self.btnScan, self.btnUpload):
            b.setEnabled(False)
        self.lblStatus.setText(msg)
        self.hwThread = HardwareScanThread(self.shared.cfg, upload=upload, hw=hw)
        self.hwThread.done.connect(lambda ok, res: self.on_done(ok, res, upload, hw is not None))
        self.hwThread.start()

    def on_done(self, ok, hw, upload, was_resend):
        self.btnScan.setEnabled(True)
        self.btnUpload.setEnabled(True)
        if not ok or isinstance(hw, str):
            self.lblStatus.setText('Lỗi: %s' % hw if isinstance(hw, str) else ('Gửi lên web thất bại, thử lại sau' if upload else 'Lỗi quét'))
            return
        now = datetime.now().strftime('%H:%M:%S')
        if not was_resend:                 # vừa quét mới -> thay bảng
            self.hw = hw
            self.render(hw)
        self.lblStatus.setText(('Đã cập nhật lên web lúc %s' if upload else 'Đã quét lúc %s') % now)


# ==============================================================================
# TAB 5 — Hẹn giờ tắt máy
# ==============================================================================
SHUTDOWN_STATE_FILE = os.path.join(tempfile.gettempdir(), 'hiconique_shutdown_state.txt')


class ShutdownTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.time_left = 0
        self.scheduled = False
        outer = QVBoxLayout(self)
        outer.setContentsMargins(28, 24, 28, 24)
        outer.setSpacing(6)

        head = QLabel('Hẹn giờ tắt máy')
        head.setObjectName('h1')
        outer.addWidget(head)
        sub = QLabel('Đặt thời gian đếm ngược, máy tính sẽ tự tắt khi hết giờ. Có thể hủy bất cứ lúc nào.')
        sub.setProperty('muted', True)
        sub.setWordWrap(True)
        outer.addWidget(sub)
        outer.addSpacing(14)

        card = QFrame()
        card.setObjectName('card')
        card.setMaximumWidth(560)
        cl = QVBoxLayout(card)
        cl.setContentsMargins(32, 28, 32, 28)
        cl.setSpacing(16)

        self.lblCountdown = QLabel('00:00:00')
        self.lblCountdown.setAlignment(Qt.AlignCenter)
        self.lblCountdown.setStyleSheet('font-size:46px;font-weight:300;letter-spacing:2px;')
        cl.addWidget(self.lblCountdown)
        self.lblStatus = QLabel('Chưa có lịch hẹn')
        self.lblStatus.setAlignment(Qt.AlignCenter)
        self.lblStatus.setProperty('muted', True)
        cl.addWidget(self.lblStatus)
        self.lblExact = QLabel('')
        self.lblExact.setAlignment(Qt.AlignCenter)
        self.lblExact.setProperty('muted', True)
        cl.addWidget(self.lblExact)

        line = QFrame()
        line.setFixedHeight(1)
        line.setStyleSheet('background:rgba(128,128,128,0.25);')
        cl.addWidget(line)

        presets = QHBoxLayout()
        presets.setSpacing(8)
        presets.addStretch(1)
        for label, mins in (('15 phút', 15), ('30 phút', 30), ('1 giờ', 60), ('2 giờ', 120), ('3 giờ', 180)):
            b = QPushButton(label)
            b.setObjectName('preset')
            b.setCursor(Qt.PointingHandCursor)
            b.clicked.connect(lambda _c=False, m=mins: self.set_preset(m))
            presets.addWidget(b)
        presets.addStretch(1)
        cl.addLayout(presets)

        grid = QGridLayout()
        grid.setHorizontalSpacing(14)
        grid.setVerticalSpacing(4)
        self.spinH = QSpinBox()
        self.spinH.setRange(0, 47)
        self.spinM = QSpinBox()
        self.spinM.setRange(0, 59)
        for sp in (self.spinH, self.spinM):
            sp.setButtonSymbols(QSpinBox.NoButtons)
            sp.setAlignment(Qt.AlignCenter)
            sp.setFixedSize(110, 56)
            sp.setStyleSheet('font-size:26px;font-weight:600;')
        colon = QLabel(':')
        colon.setAlignment(Qt.AlignCenter)
        colon.setStyleSheet('font-size:26px;font-weight:600;')
        lh = QLabel('Giờ')
        lm = QLabel('Phút')
        for lb in (lh, lm):
            lb.setAlignment(Qt.AlignCenter)
            lb.setProperty('muted', True)
        grid.setColumnStretch(0, 1)
        grid.addWidget(self.spinH, 0, 1)
        grid.addWidget(colon, 0, 2)
        grid.addWidget(self.spinM, 0, 3)
        grid.setColumnStretch(4, 1)
        grid.addWidget(lh, 1, 1)
        grid.addWidget(lm, 1, 3)
        cl.addLayout(grid)

        btnRow = QHBoxLayout()
        btnRow.setSpacing(10)
        btnSet = QPushButton('Hẹn giờ tắt')
        btnSet.setObjectName('primary')
        btnSet.setMinimumHeight(44)
        btnSet.setCursor(Qt.PointingHandCursor)
        btnSet.clicked.connect(self.schedule)
        btnRow.addWidget(btnSet, 2)
        btnCancel = QPushButton('Hủy hẹn giờ')
        btnCancel.setObjectName('danger')
        btnCancel.setMinimumHeight(44)
        btnCancel.setCursor(Qt.PointingHandCursor)
        btnCancel.clicked.connect(self.cancel)
        btnRow.addWidget(btnCancel, 1)
        cl.addLayout(btnRow)

        outer.addWidget(card, 0, Qt.AlignHCenter | Qt.AlignTop)
        outer.addStretch(1)

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.tick)
        self.check_existing()

    def set_preset(self, minutes):
        self.spinH.setValue(minutes // 60)
        self.spinM.setValue(minutes % 60)

    def check_existing(self):
        if os.path.exists(SHUTDOWN_STATE_FILE):
            try:
                target = float(open(SHUTDOWN_STATE_FILE).read().strip())
                remain = target - time.time()
                if remain > 0:
                    self.time_left = int(remain)
                    self.scheduled = True
                    self.show_exact(target)
                    self.tick()
                    self.timer.start(1000)
                else:
                    os.remove(SHUTDOWN_STATE_FILE)
            except Exception:
                pass

    def show_exact(self, target_time):
        self.lblExact.setText('Tắt lúc %s' % time.strftime('%H:%M:%S — %d/%m/%Y', time.localtime(target_time)))

    def schedule(self):
        total = self.spinH.value() * 3600 + self.spinM.value() * 60
        if total <= 0:
            QMessageBox.warning(self, 'Cảnh báo', 'Vui lòng nhập thời gian lớn hơn 0!')
            return
        os.system('shutdown -s -t %d' % total)
        target = time.time() + total
        with open(SHUTDOWN_STATE_FILE, 'w') as f:
            f.write(str(target))
        self.time_left = total
        self.scheduled = True
        self.show_exact(target)
        self.tick()
        self.timer.start(1000)

    def cancel(self):
        os.system('shutdown -a')
        self.scheduled = False
        self.timer.stop()
        if os.path.exists(SHUTDOWN_STATE_FILE):
            os.remove(SHUTDOWN_STATE_FILE)
        self.lblCountdown.setText('00:00:00')
        self.lblStatus.setText('Đã hủy lịch tắt máy')
        self.lblStatus.setStyleSheet('color:#D07070;')
        self.lblExact.setText('')

    def tick(self):
        if self.scheduled and self.time_left > 0:
            h, rem = divmod(self.time_left, 3600)
            m, s = divmod(rem, 60)
            self.lblCountdown.setText('%02d:%02d:%02d' % (h, m, s))
            self.lblStatus.setText('Máy sẽ tự tắt sau khi đếm ngược kết thúc')
            self.lblStatus.setStyleSheet('color:#4F6F52;font-weight:600;')
            self.time_left -= 1
        elif self.scheduled:
            self.lblCountdown.setText('00:00:00')
            self.lblStatus.setText('Đang tắt máy…')
            self.lblExact.setText('')
            self.scheduled = False
            self.timer.stop()
            if os.path.exists(SHUTDOWN_STATE_FILE):
                os.remove(SHUTDOWN_STATE_FILE)


# ==============================================================================
# TAB 3 — Chuyển đổi Ảnh ↔ SketchUp Material (.skm)
# Hàm lõi (đọc/ghi .skm) giữ nguyên logic từ Convert_JPEG_sang_SKM.py, chỉ đổi lớp giao diện sang Qt.
# ==============================================================================
from PIL import Image as PILImage

SKM_SUPPORTED_EXTS = ('.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp', '.gif')
SKM_NS = 'http://sketchup.google.com/schemas/sketchup/1.0/material'
SKM_REF_NS = 'http://sketchup.google.com/schemas/1.0/references'
SKM_DOCPROPS_NS = 'http://sketchup.google.com/schemas/1.0/documentproperties'
SKM_MM_PER_INCH = 25.4
SKM_MM_PRESETS = {
    '300 x 300 mm (gạch nền)': (300, 300), '300 x 600 mm (gạch ốp tường)': (300, 600),
    '500 x 500 mm': (500, 500), '600 x 600 mm (gạch/đá phổ biến)': (600, 600), '600 x 1200 mm': (600, 1200),
    '800 x 800 mm': (800, 800), '1000 x 1000 mm (mặc định)': (1000, 1000), '1200 x 2400 mm': (1200, 2400),
    '1220 x 2440 mm (ván MFC/MDF/Melamine)': (1220, 2440), '1830 x 2440 mm (ván khổ lớn)': (1830, 2440),
    '2000 x 1000 mm': (2000, 1000),
}
SKM_DEFAULT_PRESET = '1000 x 1000 mm (mặc định)'


def skm_escape_xml(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&apos;')


def skm_sanitize_filename(name):
    return re.sub(r'[\\/:*?"<>|]', '_', name).strip() or 'material'


def skm_unique_path(path):
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    i = 1
    while True:
        cand = '%s (%d)%s' % (base, i, ext)
        if not os.path.exists(cand):
            return cand
        i += 1


def skm_texture_internal_name(filename):
    base, ext = os.path.splitext(filename)
    return '%s_1%s' % (base, ext)


def skm_compute_avg_color(img):
    small = img.convert('RGB').resize((32, 32))
    pixels = list(small.getdata())
    n = len(pixels) or 1
    r = sum(p[0] for p in pixels) // n
    g = sum(p[1] for p in pixels) // n
    b = sum(p[2] for p in pixels) // n
    return r, g, b


def skm_build_thumbnail(img, size=256):
    src = img.convert('RGB')
    w, h = src.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    cropped = src.crop((left, top, left + side, top + side))
    return cropped.resize((size, size), PILImage.LANCZOS)


def skm_build_document_xml(material_name, texture_filename, width_mm, height_mm, r, g, b):
    internal_name = skm_texture_internal_name(texture_filename)
    avg_color = (b << 16) | (g << 8) | r
    x_scale = width_mm / SKM_MM_PER_INCH
    y_scale = height_mm / SKM_MM_PER_INCH
    return '''<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<materialDocument
  xmlns="%(ns)s"
  xmlns:mat="%(ns)s"
  xmlns:r="%(ref)s"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="%(ns)s http://sketchup.google.com/schemas/sketchup/1.0/material.xsd">
  <mat:material name="%(name)s" type="1" workflow="0"
    colorRed="%(r)s" colorGreen="%(g)s" colorBlue="%(b)s"
    colorizeType="0" trans="0" useTrans="0" hasTexture="1">
    <mat:texture textureFilename="%(tex)s"
      xScale="%(xs).6f" yScale="%(ys).6f" avgColor="%(avg)s">
      <mat:images>
        <mat:image id="1" path="%(internal)s" file_name="%(tex)s" />
      </mat:images>
    </mat:texture>
  </mat:material>
</materialDocument>
''' % {'ns': SKM_NS, 'ref': SKM_REF_NS, 'name': skm_escape_xml(material_name), 'r': r, 'g': g, 'b': b,
       'tex': skm_escape_xml(texture_filename), 'xs': x_scale, 'ys': y_scale, 'avg': avg_color, 'internal': skm_escape_xml(internal_name)}


def skm_build_document_properties_xml(material_name):
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    return '''<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<documentProperties xmlns="%(ns)s" xmlns:dp="%(ns)s" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="%(ns)s %(ns)s.xsd">
  <dp:title>%(title)s</dp:title>
  <dp:description></dp:description>
  <dp:creator></dp:creator>
  <dp:keywords></dp:keywords>
  <dp:lastModifiedBy></dp:lastModifiedBy>
  <dp:revision>0</dp:revision>
  <dp:created>%(now)s</dp:created>
  <dp:modified>%(now)s</dp:modified>
  <dp:thumbnail>doc_thumbnail.png</dp:thumbnail>
  <dp:generator dp:name="Material" dp:version="1" />
</documentProperties>
''' % {'ns': SKM_DOCPROPS_NS, 'title': skm_escape_xml(material_name), 'now': now}


def skm_build_references_xml():
    return ('<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n'
            '<references xmlns="%(ns)s" xmlns:r="%(ns)s" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
            'xsi:schemaLocation="%(ns)s %(ns)s.xsd" />\n' % {'ns': SKM_REF_NS})


def skm_convert_image_to_skm(image_path, output_dir, material_name=None, width_mm=1000.0, height_mm=1000.0):
    img = PILImage.open(image_path)
    img.load()
    base_filename = os.path.basename(image_path)
    name_no_ext, ext = os.path.splitext(base_filename)
    ext = ext.lower()
    mat_name = material_name or name_no_ext
    r, g, b = skm_compute_avg_color(img)
    if ext in ('.jpg', '.jpeg'):
        texture_filename = base_filename
        save_img = img.convert('RGB')
        fmt = 'JPEG'
    elif ext == '.png':
        texture_filename = base_filename
        save_img = img.convert('RGBA') if 'A' in img.mode else img.convert('RGB')
        fmt = 'PNG'
    else:
        texture_filename = name_no_ext + '.jpg'
        save_img = img.convert('RGB')
        fmt = 'JPEG'
    buf = io.BytesIO()
    if fmt == 'JPEG':
        save_img.save(buf, format='JPEG', quality=92)
    else:
        save_img.save(buf, format='PNG')
    texture_bytes = buf.getvalue()
    thumb_buf = io.BytesIO()
    skm_build_thumbnail(img).save(thumb_buf, format='PNG')
    thumb_bytes = thumb_buf.getvalue()
    doc_xml = skm_build_document_xml(mat_name, texture_filename, width_mm, height_mm, r, g, b)
    docprops_xml = skm_build_document_properties_xml(mat_name)
    refs_xml = skm_build_references_xml()
    skm_path = skm_unique_path(os.path.join(output_dir, skm_sanitize_filename(mat_name) + '.skm'))
    with zipfile.ZipFile(skm_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('document.xml', doc_xml)
        z.writestr('documentProperties.xml', docprops_xml)
        z.writestr('references.xml', refs_xml)
        z.writestr('doc_thumbnail.png', thumb_bytes)
        z.writestr('ref/%s' % skm_texture_internal_name(texture_filename), texture_bytes)
    return skm_path


def skm_convert_skm_to_image(skm_path, output_dir):
    with zipfile.ZipFile(skm_path, 'r') as z:
        names = z.namelist()
        ref_files = [n for n in names if n.startswith('ref/') and not n.endswith('/')]
        if not ref_files:
            raise ValueError('Không tìm thấy ảnh texture (thư mục ref/) trong file .skm này')
        texture_entry = ref_files[0]
        data = z.read(texture_entry)
        original_name = None
        if 'document.xml' in names:
            try:
                doc_content = z.read('document.xml').decode('utf-8', errors='ignore')
                m = re.search(r'file_name="([^"]+)"', doc_content)
                if m:
                    original_name = m.group(1)
            except Exception:
                pass
        base_name = os.path.splitext(os.path.basename(skm_path))[0]
        out_name = original_name or (base_name + os.path.splitext(texture_entry)[1])
        out_path = skm_unique_path(os.path.join(output_dir, skm_sanitize_filename(out_name)))
        with open(out_path, 'wb') as f:
            f.write(data)
    return out_path


def skm_update_thumbnail(skm_path, output_dir=None, overwrite=False, thumb_size=256):
    with zipfile.ZipFile(skm_path, 'r') as zin:
        names = zin.namelist()
        ref_files = [n for n in names if n.startswith('ref/') and not n.endswith('/')]
        if not ref_files:
            raise ValueError('Không tìm thấy ảnh texture (thư mục ref/) trong file .skm này')
        texture_bytes = zin.read(ref_files[0])
        img = PILImage.open(io.BytesIO(texture_bytes))
        img.load()
        thumb_buf = io.BytesIO()
        skm_build_thumbnail(img, size=thumb_size).save(thumb_buf, format='PNG')
        new_thumb_bytes = thumb_buf.getvalue()
        other_entries = [(n, zin.read(n)) for n in names if n != 'doc_thumbnail.png']
    if overwrite:
        out_path = skm_path
    else:
        if not output_dir:
            raise ValueError('Thiếu thư mục lưu (output_dir) khi không ghi đè file gốc')
        out_path = skm_unique_path(os.path.join(output_dir, os.path.basename(skm_path)))
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for name, data in other_entries:
            zout.writestr(name, data)
        zout.writestr('doc_thumbnail.png', new_thumb_bytes)
    return out_path


def wrap_scroll(widget):
    """Bọc 1 màn hình trong khung cuộn — cửa sổ thấp thì cuộn xuống, không ép các ô nhập bị dẹt/đè chữ."""
    sc = QScrollArea()
    sc.setWidgetResizable(True)
    sc.setFrameShape(QFrame.NoFrame)
    sc.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
    sc.setWidget(widget)
    return sc


class DropListWidget(QListWidget):
    """QListWidget nhận kéo-thả file/thư mục (lọc theo phần mở rộng), thay cho tkinterdnd2."""
    def __init__(self, accepted_exts=None, parent=None):
        super().__init__(parent)
        self.accepted_exts = accepted_exts
        self.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.setAcceptDrops(True)
        self.setMinimumHeight(110)
        self.paths = []

    def dragEnterEvent(self, e):
        if e.mimeData().hasUrls():
            e.acceptProposedAction()

    def dragMoveEvent(self, e):
        e.acceptProposedAction()

    def dropEvent(self, e):
        accepted = []
        for url in e.mimeData().urls():
            p = url.toLocalFile()
            if not p:
                continue
            if os.path.isdir(p):
                for root, _dirs, files in os.walk(p):
                    for f in files:
                        fp = os.path.join(root, f)
                        if self.accepted_exts is None or os.path.splitext(fp)[1].lower() in self.accepted_exts:
                            accepted.append(fp)
            elif self.accepted_exts is None or os.path.splitext(p)[1].lower() in self.accepted_exts:
                accepted.append(p)
        self.add_paths(accepted)

    def add_paths(self, paths):
        for p in paths:
            if p not in self.paths:
                self.paths.append(p)
                self.addItem(p)

    def remove_selected(self):
        for it in self.selectedItems():
            i = self.row(it)
            self.takeItem(i)
            del self.paths[i]

    def clear_all(self):
        self.clear()
        self.paths = []


class SkmToTab(QWidget):
    """Ảnh → .skm"""
    logLine = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        lay = QVBoxLayout(self)
        top = QHBoxLayout()
        btnAdd = QPushButton('Thêm ảnh...'); btnAdd.clicked.connect(self.add_images)
        btnDel = QPushButton('Xoá mục chọn'); btnDel.clicked.connect(lambda: self.list.remove_selected())
        btnClr = QPushButton('Xoá tất cả'); btnClr.clicked.connect(lambda: self.list.clear_all())
        top.addWidget(btnAdd); top.addWidget(btnDel); top.addWidget(btnClr); top.addStretch(1)
        lay.addLayout(top)

        self.list = DropListWidget(SKM_SUPPORTED_EXTS)
        lay.addWidget(self.list, 1)

        outRow = QHBoxLayout()
        outRow.addWidget(QLabel('Thư mục lưu file .skm:'))
        self.outDir = QLineEdit()
        outRow.addWidget(self.outDir, 1)
        btnOut = QPushButton('Chọn...'); btnOut.clicked.connect(self.choose_out)
        outRow.addWidget(btnOut)
        lay.addLayout(outRow)

        scaleBox = QGroupBox('Kích thước tấm vật liệu (mm)')
        scaleLay = QGridLayout(scaleBox)
        scaleLay.addWidget(QLabel('Chọn nhanh theo mẫu:'), 0, 0)
        self.preset = QComboBox()
        self.preset.addItems(list(SKM_MM_PRESETS.keys()) + ['Tuỳ chỉnh...'])
        self.preset.setCurrentText(SKM_DEFAULT_PRESET)
        self.preset.currentTextChanged.connect(self.on_preset)
        scaleLay.addWidget(self.preset, 0, 1, 1, 3)
        scaleLay.addWidget(QLabel('Chiều rộng (mm):'), 1, 0)
        self.width_mm = QLineEdit('1000'); scaleLay.addWidget(self.width_mm, 1, 1)
        scaleLay.addWidget(QLabel('Chiều cao (mm):'), 1, 2)
        self.height_mm = QLineEdit('1000'); scaleLay.addWidget(self.height_mm, 1, 3)
        lay.addWidget(scaleBox)

        nameRow = QHBoxLayout()
        nameRow.addWidget(QLabel('Tên vật liệu tuỳ chọn (chỉ dùng khi chọn 1 ảnh, để trống = theo tên file):'))
        lay.addLayout(nameRow)
        self.materialName = QLineEdit()
        lay.addWidget(self.materialName)

        btnRun = QPushButton('CHUYỂN ĐỔI SANG .SKM'); btnRun.setObjectName('primary')
        btnRun.clicked.connect(self.run_convert)
        lay.addWidget(btnRun)

        self.log = QTextEdit(); self.log.setReadOnly(True); self.log.setMinimumHeight(90)
        self.logLine.connect(self.log.append)
        lay.addWidget(self.log, 1)

    def on_preset(self, name):
        if name in SKM_MM_PRESETS:
            w, h = SKM_MM_PRESETS[name]
            self.width_mm.setText(str(w)); self.height_mm.setText(str(h))

    def add_images(self):
        paths, _ = QFileDialog.getOpenFileNames(self, 'Chọn ảnh', '', 'Ảnh (%s)' % ' '.join('*' + e for e in SKM_SUPPORTED_EXTS))
        self.list.add_paths(paths)

    def choose_out(self):
        d = QFileDialog.getExistingDirectory(self, 'Chọn thư mục lưu')
        if d:
            self.outDir.setText(d)

    def run_convert(self):
        if not self.list.paths:
            QMessageBox.warning(self, 'Thiếu ảnh', 'Vui lòng thêm ít nhất 1 ảnh.')
            return
        out_dir = self.outDir.text().strip()
        if not out_dir:
            QMessageBox.warning(self, 'Thiếu thư mục', 'Vui lòng chọn thư mục lưu file .skm.')
            return
        os.makedirs(out_dir, exist_ok=True)
        try:
            w = float(self.width_mm.text()); h = float(self.height_mm.text())
        except ValueError:
            QMessageBox.critical(self, 'Lỗi', 'Chiều rộng / chiều cao phải là số (mm).')
            return
        custom_name = self.materialName.text().strip() or None
        files = list(self.list.paths)

        def worker():
            ok, fail = 0, 0
            for path in files:
                try:
                    name = custom_name if (custom_name and len(files) == 1) else None
                    out = skm_convert_image_to_skm(path, out_dir, material_name=name, width_mm=w, height_mm=h)
                    self.logLine.emit('OK  : %s  ->  %s' % (os.path.basename(path), out)); ok += 1
                except Exception as e:
                    self.logLine.emit('LỖI : %s  ->  %s' % (os.path.basename(path), e)); fail += 1
            self.logLine.emit('--- Hoàn tất: %d thành công, %d lỗi ---' % (ok, fail))
        threading.Thread(target=worker, daemon=True).start()


class SkmFromTab(QWidget):
    """.skm → Ảnh"""
    logLine = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        lay = QVBoxLayout(self)
        top = QHBoxLayout()
        btnAdd = QPushButton('Thêm file .skm...'); btnAdd.clicked.connect(self.add_files)
        btnDel = QPushButton('Xoá mục chọn'); btnDel.clicked.connect(lambda: self.list.remove_selected())
        btnClr = QPushButton('Xoá tất cả'); btnClr.clicked.connect(lambda: self.list.clear_all())
        top.addWidget(btnAdd); top.addWidget(btnDel); top.addWidget(btnClr); top.addStretch(1)
        lay.addLayout(top)

        self.list = DropListWidget(('.skm',))
        lay.addWidget(self.list, 1)

        outRow = QHBoxLayout()
        outRow.addWidget(QLabel('Thư mục lưu ảnh xuất ra:'))
        self.outDir = QLineEdit()
        outRow.addWidget(self.outDir, 1)
        btnOut = QPushButton('Chọn...'); btnOut.clicked.connect(self.choose_out)
        outRow.addWidget(btnOut)
        lay.addLayout(outRow)

        btnRun = QPushButton('TRÍCH XUẤT ẢNH TỪ .SKM'); btnRun.setObjectName('primary')
        btnRun.clicked.connect(self.run_convert)
        lay.addWidget(btnRun)

        self.log = QTextEdit(); self.log.setReadOnly(True); self.log.setMinimumHeight(90)
        self.logLine.connect(self.log.append)
        lay.addWidget(self.log, 1)

    def add_files(self):
        paths, _ = QFileDialog.getOpenFileNames(self, 'Chọn file .skm', '', 'SketchUp Material (*.skm)')
        self.list.add_paths(paths)

    def choose_out(self):
        d = QFileDialog.getExistingDirectory(self, 'Chọn thư mục lưu')
        if d:
            self.outDir.setText(d)

    def run_convert(self):
        if not self.list.paths:
            QMessageBox.warning(self, 'Thiếu file', 'Vui lòng thêm ít nhất 1 file .skm.')
            return
        out_dir = self.outDir.text().strip()
        if not out_dir:
            QMessageBox.warning(self, 'Thiếu thư mục', 'Vui lòng chọn thư mục lưu ảnh.')
            return
        os.makedirs(out_dir, exist_ok=True)
        files = list(self.list.paths)

        def worker():
            ok, fail = 0, 0
            for path in files:
                try:
                    out = skm_convert_skm_to_image(path, out_dir)
                    self.logLine.emit('OK  : %s  ->  %s' % (os.path.basename(path), out)); ok += 1
                except Exception as e:
                    self.logLine.emit('LỖI : %s  ->  %s' % (os.path.basename(path), e)); fail += 1
            self.logLine.emit('--- Hoàn tất: %d thành công, %d lỗi ---' % (ok, fail))
        threading.Thread(target=worker, daemon=True).start()


class SkmThumbTab(QWidget):
    """Cập nhật thumbnail cho .skm có sẵn"""
    logLine = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        lay = QVBoxLayout(self)
        info = QLabel('Tạo lại ảnh thumbnail (bám sát ảnh, không viền trắng) cho các file .skm đã có sẵn — '
                      'lấy từ chính ảnh texture bên trong file, không cần ảnh gốc.')
        info.setWordWrap(True)
        lay.addWidget(info)

        sizeRow = QHBoxLayout()
        sizeRow.addWidget(QLabel('Kích thước Thumbnail (px):'))
        self.thumbSize = QLineEdit('256')
        sizeRow.addWidget(self.thumbSize)
        sizeRow.addStretch(1)
        lay.addLayout(sizeRow)

        top = QHBoxLayout()
        btnAdd = QPushButton('Thêm file .skm...'); btnAdd.clicked.connect(self.add_files)
        btnDel = QPushButton('Xoá mục chọn'); btnDel.clicked.connect(lambda: self.list.remove_selected())
        btnClr = QPushButton('Xoá tất cả'); btnClr.clicked.connect(lambda: self.list.clear_all())
        top.addWidget(btnAdd); top.addWidget(btnDel); top.addWidget(btnClr); top.addStretch(1)
        lay.addLayout(top)

        self.list = DropListWidget(('.skm',))
        lay.addWidget(self.list, 1)

        modeBox = QGroupBox('Cách lưu kết quả')
        modeLay = QGridLayout(modeBox)
        self.radioOverwrite = QRadioButton('Ghi đè trực tiếp lên file .skm gốc')
        self.radioCopy = QRadioButton('Lưu thành file mới sang thư mục khác (an toàn hơn):')
        self.radioOverwrite.setChecked(True)
        grp = QButtonGroup(self); grp.addButton(self.radioOverwrite); grp.addButton(self.radioCopy)
        self.radioOverwrite.toggled.connect(self.on_mode)
        modeLay.addWidget(self.radioOverwrite, 0, 0, 1, 3)
        modeLay.addWidget(self.radioCopy, 1, 0)
        self.outDir3 = QLineEdit(); self.outDir3.setEnabled(False)
        modeLay.addWidget(self.outDir3, 1, 1)
        self.btnOut3 = QPushButton('Chọn...'); self.btnOut3.setEnabled(False); self.btnOut3.clicked.connect(self.choose_out3)
        modeLay.addWidget(self.btnOut3, 1, 2)
        warn = QLabel('Lưu ý: chọn "Ghi đè" sẽ thay đổi trực tiếp file gốc, không thể hoàn tác.')
        warn.setProperty('muted', True)
        modeLay.addWidget(warn, 2, 0, 1, 3)
        lay.addWidget(modeBox)

        btnRun = QPushButton('CẬP NHẬT THUMBNAIL'); btnRun.setObjectName('primary')
        btnRun.clicked.connect(self.run_update)
        lay.addWidget(btnRun)

        self.log = QTextEdit(); self.log.setReadOnly(True); self.log.setMinimumHeight(90)
        self.logLine.connect(self.log.append)
        lay.addWidget(self.log, 1)

    def on_mode(self, checked_overwrite):
        self.outDir3.setEnabled(not checked_overwrite)
        self.btnOut3.setEnabled(not checked_overwrite)

    def add_files(self):
        paths, _ = QFileDialog.getOpenFileNames(self, 'Chọn file .skm', '', 'SketchUp Material (*.skm)')
        self.list.add_paths(paths)

    def choose_out3(self):
        d = QFileDialog.getExistingDirectory(self, 'Chọn thư mục lưu')
        if d:
            self.outDir3.setText(d)

    def run_update(self):
        if not self.list.paths:
            QMessageBox.warning(self, 'Thiếu file', 'Vui lòng thêm ít nhất 1 file .skm.')
            return
        try:
            thumb_size = int(self.thumbSize.text().strip())
            if thumb_size <= 0:
                raise ValueError
        except ValueError:
            QMessageBox.critical(self, 'Lỗi', 'Kích thước thumbnail phải là số nguyên dương lớn hơn 0.')
            return
        overwrite = self.radioOverwrite.isChecked()
        out_dir = None
        if not overwrite:
            out_dir = self.outDir3.text().strip()
            if not out_dir:
                QMessageBox.warning(self, 'Thiếu thư mục', 'Vui lòng chọn thư mục lưu file mới.')
                return
            os.makedirs(out_dir, exist_ok=True)
        else:
            if QMessageBox.question(self, 'Xác nhận ghi đè',
                                    'Bạn sắp GHI ĐÈ trực tiếp lên các file .skm gốc, không thể hoàn tác.\nBạn có chắc chắn muốn tiếp tục?',
                                    QMessageBox.Yes | QMessageBox.No, QMessageBox.No) != QMessageBox.Yes:
                return
        files = list(self.list.paths)

        def worker():
            ok, fail = 0, 0
            for path in files:
                try:
                    out = skm_update_thumbnail(path, output_dir=out_dir, overwrite=overwrite, thumb_size=thumb_size)
                    self.logLine.emit('OK  : %s  ->  %s' % (os.path.basename(path), out)); ok += 1
                except Exception as e:
                    self.logLine.emit('LỖI : %s  ->  %s' % (os.path.basename(path), e)); fail += 1
            self.logLine.emit('--- Hoàn tất: %d thành công, %d lỗi ---' % (ok, fail))
        threading.Thread(target=worker, daemon=True).start()


class SkmConverterTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(28, 24, 28, 24)
        lay.setSpacing(10)
        head = QLabel('Chuyển đổi Ảnh ↔ SketchUp Material (.skm)')
        head.setObjectName('h1')
        lay.addWidget(head)
        inner = QTabWidget()
        inner.tabBar().setExpanding(False)
        inner.tabBar().setElideMode(Qt.ElideNone)
        inner.addTab(wrap_scroll(SkmToTab()), 'Ảnh → SKM (chính)')
        inner.addTab(wrap_scroll(SkmFromTab()), 'SKM → Ảnh')
        inner.addTab(wrap_scroll(SkmThumbTab()), 'Cập nhật Thumbnail SKM')
        lay.addWidget(inner, 1)


# ==============================================================================
# TAB 4 — Lấy màu (Pick Color)
# Port từ Picker Point Color.py (PyQt5 gốc): giữ nguyên toàn bộ logic màu sắc/canvas/xuất ảnh,
# chỉ đổi ColorApp từ QMainWindow thành QWidget để nhúng làm 1 tab, và đổi nơi lưu colors_data.json
# sang chung thư mục dữ liệu của Agent (thay vì QStandardPaths riêng).
# ==============================================================================
import math

CP_DATA_FILE = os.path.join(DATA_DIR, 'colors_data.json')

CP_MASTER_CSS3_COLORS = {
    'Black': (0, 0, 0), 'White': (255, 255, 255), 'Red': (255, 0, 0), 'Lime': (0, 255, 0),
    'Blue': (0, 0, 255), 'Yellow': (255, 255, 0), 'Cyan': (0, 255, 255), 'Aqua': (0, 255, 255),
    'Fuchsia': (255, 0, 255), 'Magenta': (255, 0, 255), 'Silver': (192, 192, 192), 'Gray': (128, 128, 128),
    'Maroon': (128, 0, 0), 'Olive': (128, 128, 0), 'Green': (0, 128, 0), 'Purple': (128, 0, 128),
    'Teal': (0, 128, 128), 'Navy': (0, 0, 128),
    'LightSalmon': (255, 160, 122), 'Salmon': (250, 128, 114), 'DarkSalmon': (233, 150, 122),
    'LightCoral': (240, 128, 128), 'IndianRed': (205, 92, 92), 'Crimson': (220, 20, 60),
    'FireBrick': (178, 34, 34), 'DarkRed': (139, 0, 0), 'Pink': (255, 192, 203),
    'LightPink': (255, 182, 193), 'HotPink': (255, 105, 180), 'DeepPink': (255, 20, 147),
    'MediumVioletRed': (199, 21, 133), 'PaleVioletRed': (219, 112, 147),
    'Coral': (255, 127, 80), 'Tomato': (255, 99, 71), 'OrangeRed': (255, 69, 0),
    'DarkOrange': (255, 140, 0), 'Orange': (255, 165, 0), 'Gold': (255, 215, 0),
    'LightYellow': (255, 255, 224), 'LemonChiffon': (255, 250, 205), 'LightGoldenRodYellow': (250, 250, 210),
    'PapayaWhip': (255, 239, 213), 'Moccasin': (255, 228, 181), 'PeachPuff': (255, 218, 185),
    'PaleGoldenRod': (238, 232, 170), 'Khaki': (240, 230, 140), 'DarkKhaki': (189, 183, 107),
    'LawnGreen': (124, 252, 0), 'Chartreuse': (127, 255, 0), 'LimeGreen': (50, 205, 50),
    'ForestGreen': (34, 139, 34), 'DarkGreen': (0, 100, 0), 'GreenYellow': (173, 255, 47),
    'YellowGreen': (154, 205, 50), 'SpringGreen': (0, 255, 127), 'MediumSpringGreen': (0, 250, 154),
    'LightGreen': (144, 238, 144), 'PaleGreen': (152, 251, 152), 'MediumSeaGreen': (60, 179, 113),
    'SeaGreen': (46, 139, 87), 'DarkOliveGreen': (85, 107, 47), 'OliveDrab': (107, 142, 35),
    'LightCyan': (224, 255, 255), 'Aquamarine': (127, 255, 212), 'MediumAquaMarine': (102, 205, 170),
    'PaleTurquoise': (175, 238, 238), 'Turquoise': (64, 224, 208), 'MediumTurquoise': (72, 209, 204),
    'DarkTurquoise': (0, 206, 209), 'LightSeaGreen': (32, 178, 170), 'CadetBlue': (95, 158, 160),
    'DarkCyan': (0, 139, 139),
    'PowderBlue': (176, 224, 230), 'LightBlue': (173, 216, 230), 'LightSkyBlue': (135, 206, 250),
    'SkyBlue': (135, 206, 235), 'DeepSkyBlue': (0, 191, 255), 'LightSteelBlue': (176, 196, 222),
    'DodgerBlue': (30, 144, 255), 'CornflowerBlue': (100, 149, 237), 'SteelBlue': (70, 130, 180),
    'RoyalBlue': (65, 105, 225), 'MediumBlue': (0, 0, 205), 'DarkBlue': (0, 0, 139),
    'MidnightBlue': (25, 25, 112), 'MediumSlateBlue': (123, 104, 238), 'SlateBlue': (106, 90, 205),
    'DarkSlateBlue': (72, 61, 139),
    'Lavender': (230, 230, 250), 'Thistle': (216, 191, 216), 'Plum': (221, 160, 221),
    'Violet': (238, 130, 238), 'Orchid': (218, 112, 214), 'MediumOrchid': (186, 85, 211),
    'DarkOrchid': (153, 50, 204), 'DarkViolet': (148, 0, 211), 'BlueViolet': (138, 43, 226),
    'Indigo': (75, 0, 130), 'Cornsilk': (255, 248, 220), 'BlanchedAlmond': (255, 235, 205),
    'Bisque': (255, 228, 196), 'NavajoWhite': (255, 222, 173), 'Wheat': (245, 222, 179),
    'BurlyWood': (222, 184, 135), 'Tan': (210, 180, 140), 'RosyBrown': (188, 143, 143),
    'SandyBrown': (244, 164, 96), 'GoldenRod': (218, 165, 32), 'DarkGoldenRod': (184, 134, 11),
    'Peru': (205, 133, 63), 'Chocolate': (210, 105, 30), 'SaddleBrown': (139, 69, 19),
    'Sienna': (160, 82, 45), 'Brown': (165, 42, 42), 'Snow': (255, 250, 250), 'HoneyDew': (240, 255, 240),
    'MintCream': (245, 255, 250), 'Azure': (240, 255, 255), 'AliceBlue': (240, 248, 255),
    'GhostWhite': (248, 248, 255), 'WhiteSmoke': (245, 245, 245), 'SeaShell': (255, 245, 238),
    'Beige': (245, 245, 220), 'OldLace': (253, 245, 230), 'FloralWhite': (255, 250, 240),
    'Ivory': (255, 255, 240), 'AntiqueWhite': (250, 235, 215), 'Linen': (250, 240, 230),
    'LavenderBlush': (255, 240, 245), 'MistyRose': (255, 228, 225), 'DimGray': (105, 105, 105),
    'DarkSlateGray': (47, 79, 79), 'LightSlateGray': (119, 136, 153), 'SlateGray': (112, 128, 144),
    'LightGray': (211, 211, 211), 'Gainsboro': (220, 220, 220)
}

CP_MASTER_FAMILY_MAPPING = {
    'Đen': ['Black'], 'Trắng': ['White', 'Snow', 'HoneyDew', 'MintCream', 'Azure', 'AliceBlue', 'GhostWhite', 'WhiteSmoke', 'SeaShell', 'Beige', 'OldLace', 'FloralWhite', 'Ivory', 'AntiqueWhite', 'Linen', 'LavenderBlush', 'MistyRose'],
    'Xám': ['Gainsboro', 'LightGray', 'Silver', 'DarkGray', 'Gray', 'DimGray', 'LightSlateGray', 'SlateGray', 'DarkSlateGray'],
    'Đỏ': ['Red', 'LightSalmon', 'Salmon', 'DarkSalmon', 'LightCoral', 'IndianRed', 'Crimson', 'FireBrick', 'DarkRed'],
    'Hồng': ['Pink', 'LightPink', 'HotPink', 'DeepPink', 'PaleVioletRed', 'MediumVioletRed'],
    'Cam': ['Coral', 'Tomato', 'OrangeRed', 'DarkOrange', 'Orange'],
    'Vàng': ['Gold', 'Yellow', 'LightYellow', 'LemonChiffon', 'LightGoldenRodYellow', 'PapayaWhip', 'Moccasin', 'PeachPuff', 'PaleGoldenRod', 'Khaki', 'DarkKhaki'],
    'Nâu': ['Cornsilk', 'BlanchedAlmond', 'Bisque', 'NavajoWhite', 'Wheat', 'BurlyWood', 'Tan', 'RosyBrown', 'SandyBrown', 'GoldenRod', 'DarkGoldenRod', 'Peru', 'Chocolate', 'SaddleBrown', 'Sienna', 'Brown', 'Maroon'],
    'Xanh lá': ['LawnGreen', 'Chartreuse', 'LimeGreen', 'Lime', 'ForestGreen', 'Green', 'DarkGreen', 'GreenYellow', 'YellowGreen', 'SpringGreen', 'MediumSpringGreen', 'LightGreen', 'PaleGreen', 'MediumSeaGreen', 'SeaGreen', 'DarkOliveGreen', 'OliveDrab', 'Olive'],
    'Xanh lục': ['LightCyan', 'Cyan', 'Aqua', 'Aquamarine', 'MediumAquaMarine', 'PaleTurquoise', 'Turquoise', 'MediumTurquoise', 'DarkTurquoise', 'LightSeaGreen', 'CadetBlue', 'DarkCyan', 'Teal'],
    'Xanh dương': ['PowderBlue', 'LightBlue', 'LightSkyBlue', 'SkyBlue', 'DeepSkyBlue', 'LightSteelBlue', 'DodgerBlue', 'CornflowerBlue', 'SteelBlue', 'RoyalBlue', 'Blue', 'MediumBlue', 'DarkBlue', 'Navy', 'MidnightBlue', 'MediumSlateBlue', 'SlateBlue', 'DarkSlateBlue'],
    'Tím': ['Lavender', 'Thistle', 'Plum', 'Violet', 'Orchid', 'Fuchsia', 'Magenta', 'MediumOrchid', 'MediumPurple', 'BlueViolet', 'DarkViolet', 'DarkOrchid', 'DarkMagenta', 'Purple', 'Indigo']
}

CP_CSS3_COLORS = {}
CP_FAMILY_MAPPING = {}


def cp_format_color_name(name):
    if not isinstance(name, str):
        return str(name)
    formatted = re.sub(r'(?<!^)(?=[A-Z])', ' ', name)
    return ' '.join(formatted.split())


def cp_auto_detect_family(r, g, b):
    color = QColor(r, g, b)
    h, s, l, _ = color.getHsl()
    h = max(0, h)
    s = int(s * 100 / 255)
    l = int(l * 100 / 255)
    if l < 15:
        return 'Đen'
    if l > 90:
        return 'Trắng'
    if s < 15:
        return 'Xám'
    if h < 15 or h >= 345:
        return 'Đỏ'
    if 15 <= h < 45:
        return 'Nâu' if l < 50 else 'Cam'
    if 45 <= h < 70:
        return 'Vàng'
    if 70 <= h < 165:
        return 'Xanh lá'
    if 165 <= h < 195:
        return 'Xanh lục'
    if 195 <= h < 255:
        return 'Xanh dương'
    if 255 <= h < 345:
        return 'Tím' if h < 315 else 'Hồng'
    return 'Khác'


def cp_init_default_data():
    global CP_CSS3_COLORS, CP_FAMILY_MAPPING
    loaded_data = []
    loaded_names = set()
    if os.path.exists(CP_DATA_FILE):
        try:
            with open(CP_DATA_FILE, 'r', encoding='utf-8') as f:
                loaded_data = json.load(f)
                for item in loaded_data:
                    loaded_names.add(item.get('name', '').lower())
        except Exception:
            pass
    needs_save = False
    for name, (r, g, b) in CP_MASTER_CSS3_COLORS.items():
        formatted_name = cp_format_color_name(name)
        if formatted_name.lower() not in loaded_names:
            color = QColor(r, g, b)
            h, s, l, _ = color.getHsl()
            hex_val = color.name().upper()
            h_norm, s_norm, l_norm = max(0, h), int((s / 255) * 100), int((l / 255) * 100)
            fam = 'Khác'
            for f, names in CP_MASTER_FAMILY_MAPPING.items():
                if name in names:
                    fam = f
                    break
            if fam == 'Khác':
                fam = cp_auto_detect_family(r, g, b)
            loaded_data.append({'group': fam, 'name': formatted_name, 'rgb': '%d, %d, %d' % (r, g, b), 'hex': hex_val, 'hsl': '%d, %d%%, %d%%' % (h_norm, s_norm, l_norm)})
            needs_save = True
    CP_CSS3_COLORS.clear()
    CP_FAMILY_MAPPING.clear()
    for item in loaded_data:
        name = item.get('name', '')
        rgb_str = item.get('rgb', '')
        group = item.get('group', 'Khác')
        if name and rgb_str:
            try:
                parts = rgb_str.replace('(', '').replace(')', '').split(',')
                r, g, b = map(int, parts)
                CP_CSS3_COLORS[name] = (r, g, b)
                if group not in CP_FAMILY_MAPPING:
                    CP_FAMILY_MAPPING[group] = []
                if name not in CP_FAMILY_MAPPING[group]:
                    CP_FAMILY_MAPPING[group].append(name)
            except Exception:
                pass
    if needs_save or not os.path.exists(CP_DATA_FILE):
        with open(CP_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(loaded_data, f, ensure_ascii=False, indent=4)


def cp_get_color_info_data(r, g, b):
    min_dist = float('inf')
    closest_name = ''
    for name, (cr, cg, cb) in CP_CSS3_COLORS.items():
        dist = math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2)
        if dist < min_dist:
            min_dist = dist
            closest_name = name
    family_name = 'Khác'
    for fam, colors in CP_FAMILY_MAPPING.items():
        if closest_name in colors:
            family_name = fam
            break
    if min_dist == 0:
        return closest_name, family_name
    return 'Gần giống %s' % closest_name, cp_auto_detect_family(r, g, b)


cp_init_default_data()


class CpAddColorDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle('Thêm Màu Mới')
        self.resize(350, 250)
        layout = QVBoxLayout(self)
        lbl_info = QLabel('<i>(Điền Tên và 1 trong 3 thông số màu, app sẽ tự nội suy)</i>')
        lbl_info.setStyleSheet('color: #999;')
        layout.addWidget(lbl_info)
        form = QFormLayout()
        self.input_name = QLineEdit()
        self.input_rgb = QLineEdit()
        self.input_hex = QLineEdit()
        self.input_hsl = QLineEdit()
        self.lbl_family_preview = QLabel('<b>Nhóm màu tự động:</b> Chưa xác định')
        form.addRow('Tên màu:', self.input_name)
        form.addRow('RGB:', self.input_rgb)
        form.addRow('HEX:', self.input_hex)
        form.addRow('HSL:', self.input_hsl)
        layout.addLayout(form)
        layout.addWidget(self.lbl_family_preview)
        self.input_rgb.editingFinished.connect(self.on_rgb)
        self.input_hex.editingFinished.connect(self.on_hex)
        self.input_hsl.editingFinished.connect(self.on_hsl)
        btn_layout = QHBoxLayout()
        self.btn_save = QPushButton('Lưu vào danh sách')
        self.btn_save.setObjectName('primary')
        self.btn_save.clicked.connect(self.save_color)
        btn_layout.addWidget(self.btn_save)
        layout.addLayout(btn_layout)
        self.current_qcolor = None
        self.computed_data = None

    def update_fields(self, color):
        if not color.isValid():
            return
        self.current_qcolor = color
        r, g, b = color.red(), color.green(), color.blue()
        h, s, l, _ = color.getHsl()
        h = max(0, h)
        s_pct = int((s / 255) * 100)
        l_pct = int((l / 255) * 100)
        self.input_rgb.blockSignals(True); self.input_hex.blockSignals(True); self.input_hsl.blockSignals(True)
        self.input_rgb.setText('%d, %d, %d' % (r, g, b))
        self.input_hex.setText(color.name().upper())
        self.input_hsl.setText('%d, %d%%, %d%%' % (h, s_pct, l_pct))
        fam = cp_auto_detect_family(r, g, b)
        self.lbl_family_preview.setText('<b>Nhóm màu tự động:</b> %s' % fam)
        self.input_rgb.blockSignals(False); self.input_hex.blockSignals(False); self.input_hsl.blockSignals(False)

    def on_rgb(self):
        try:
            val = self.input_rgb.text().replace('(', '').replace(')', '').strip()
            parts = val.split(',')
            r, g, b = max(0, min(255, int(parts[0]))), max(0, min(255, int(parts[1]))), max(0, min(255, int(parts[2])))
            self.update_fields(QColor(r, g, b))
        except Exception:
            pass

    def on_hex(self):
        hex_val = self.input_hex.text().strip()
        if not hex_val.startswith('#'):
            hex_val = '#' + hex_val
        color = QColor(hex_val)
        if color.isValid():
            self.update_fields(color)

    def on_hsl(self):
        try:
            val = self.input_hsl.text().replace('%', '').replace('°', '').strip()
            parts = val.split(',')
            h, s, l = max(0, min(359, int(parts[0]))), max(0, min(100, int(parts[1]))), max(0, min(100, int(parts[2])))
            self.update_fields(QColor.fromHsl(h, int(s * 255 / 100), int(l * 255 / 100)))
        except Exception:
            pass

    def save_color(self):
        name = self.input_name.text().strip()
        if not name:
            QMessageBox.warning(self, 'Lỗi', 'Vui lòng nhập Tên màu!')
            return
        if not self.current_qcolor:
            QMessageBox.warning(self, 'Lỗi', 'Vui lòng nhập dữ liệu màu hợp lệ!')
            return
        r, g, b = self.current_qcolor.red(), self.current_qcolor.green(), self.current_qcolor.blue()
        fam = cp_auto_detect_family(r, g, b)
        self.computed_data = {
            'group': fam, 'name': cp_format_color_name(name.replace(' ', '') if ' ' not in name else name),
            'rgb': self.input_rgb.text(), 'hex': self.input_hex.text().upper(), 'hsl': self.input_hsl.text()
        }
        self.accept()


class CpColorListDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle('Danh Sách Cấu Hình Màu Sắc')
        self.resize(850, 500)
        self.layout = QVBoxLayout(self)
        search_layout = QHBoxLayout()
        search_label = QLabel('Tìm kiếm:')
        search_label.setStyleSheet('font-weight: bold;')
        self.search_bar = QLineEdit()
        self.search_bar.setPlaceholderText('Nhập tên màu, RGB, HEX hoặc HSL để lọc danh sách...')
        self.search_bar.textChanged.connect(self.filter_table)
        search_layout.addWidget(search_label)
        search_layout.addWidget(self.search_bar)
        self.layout.addLayout(search_layout)
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(['Nhóm màu', 'Tên màu', 'RGB', 'HEX', 'HSL'])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.setSortingEnabled(True)
        self.layout.addWidget(self.table)
        btn_layout = QHBoxLayout()
        self.btn_add = QPushButton('+ Thêm màu'); self.btn_add.clicked.connect(self.add_color)
        btn_layout.addWidget(self.btn_add)
        self.btn_del = QPushButton('- Xóa màu'); self.btn_del.clicked.connect(self.delete_row)
        btn_layout.addWidget(self.btn_del)
        self.btn_import = QPushButton('Nhập Excel'); self.btn_import.clicked.connect(self.import_excel)
        btn_layout.addWidget(self.btn_import)
        self.btn_export = QPushButton('Xuất Excel'); self.btn_export.clicked.connect(self.export_excel)
        btn_layout.addWidget(self.btn_export)
        self.btn_save = QPushButton('Lưu Danh Sách'); self.btn_save.setObjectName('primary'); self.btn_save.clicked.connect(self.manual_save)
        btn_layout.addWidget(self.btn_save)
        self.layout.addLayout(btn_layout)
        self.load_data()

    def filter_table(self, text):
        text = text.lower()
        for row in range(self.table.rowCount()):
            match = False
            for col in range(1, 5):
                item = self.table.item(row, col)
                if item and text in item.text().lower():
                    match = True
                    break
            self.table.setRowHidden(row, not match)

    def load_data(self):
        self.table.setSortingEnabled(False)
        self.table.setRowCount(0)
        try:
            with open(CP_DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.table.setRowCount(len(data))
                for row, item in enumerate(data):
                    self.table.setItem(row, 0, QTableWidgetItem(item.get('group', '')))
                    self.table.setItem(row, 1, QTableWidgetItem(item.get('name', '')))
                    self.table.setItem(row, 2, QTableWidgetItem(item.get('rgb', '')))
                    self.table.setItem(row, 3, QTableWidgetItem(item.get('hex', '')))
                    self.table.setItem(row, 4, QTableWidgetItem(item.get('hsl', '')))
        except FileNotFoundError:
            pass
        self.table.setSortingEnabled(True)

    def add_color(self):
        dialog = CpAddColorDialog(self)
        if dialog.exec_() == QDialog.Accepted and dialog.computed_data:
            data = dialog.computed_data
            match_row = -1
            duplicate_type = ''
            for row in range(self.table.rowCount()):
                name_item = self.table.item(row, 1)
                hex_item = self.table.item(row, 3)
                if name_item and name_item.text().lower() == data['name'].lower():
                    match_row = row; duplicate_type = 'Tên màu'; break
                if hex_item and hex_item.text().lower() == data['hex'].lower():
                    match_row = row; duplicate_type = 'Thông số HEX'; break
            if match_row != -1:
                msg = QMessageBox(self)
                msg.setIcon(QMessageBox.Warning)
                msg.setWindowTitle('Phát hiện trùng lặp')
                msg.setText('Màu bạn muốn thêm bị trùng \'%s\' với một màu đã có trong danh sách.\nBạn muốn xử lý thế nào?' % duplicate_type)
                btn_append = msg.addButton('Bổ sung (Tạo thêm)', QMessageBox.AcceptRole)
                btn_overwrite = msg.addButton('Ghi đè (Cập nhật màu cũ)', QMessageBox.DestructiveRole)
                btn_cancel = msg.addButton('Hủy (Không thêm)', QMessageBox.RejectRole)
                msg.exec_()
                if msg.clickedButton() == btn_cancel:
                    return
                elif msg.clickedButton() == btn_overwrite:
                    self.table.setSortingEnabled(False)
                    self.table.setItem(match_row, 0, QTableWidgetItem(data['group']))
                    self.table.setItem(match_row, 1, QTableWidgetItem(data['name']))
                    self.table.setItem(match_row, 2, QTableWidgetItem(data['rgb']))
                    self.table.setItem(match_row, 3, QTableWidgetItem(data['hex']))
                    self.table.setItem(match_row, 4, QTableWidgetItem(data['hsl']))
                    self.table.setSortingEnabled(True)
                    self.save_data(show_msg=False)
                    return
            self.table.setSortingEnabled(False)
            row = self.table.rowCount()
            self.table.insertRow(row)
            self.table.setItem(row, 0, QTableWidgetItem(data['group']))
            self.table.setItem(row, 1, QTableWidgetItem(data['name']))
            self.table.setItem(row, 2, QTableWidgetItem(data['rgb']))
            self.table.setItem(row, 3, QTableWidgetItem(data['hex']))
            self.table.setItem(row, 4, QTableWidgetItem(data['hsl']))
            self.table.setSortingEnabled(True)
            self.save_data(show_msg=False)

    def delete_row(self):
        current_row = self.table.currentRow()
        if current_row >= 0:
            name_item = self.table.item(current_row, 1)
            name = name_item.text() if name_item else 'Màu này'
            if QMessageBox.question(self, 'Xác nhận xóa', 'Bạn có chắc chắn muốn xóa màu "%s" khỏi danh sách?' % name,
                                    QMessageBox.Yes | QMessageBox.No, QMessageBox.No) == QMessageBox.Yes:
                self.table.removeRow(current_row)
                self.save_data(show_msg=False)

    def manual_save(self):
        self.save_data(show_msg=True)

    def save_data(self, show_msg=True):
        data = []
        global CP_CSS3_COLORS, CP_FAMILY_MAPPING
        CP_CSS3_COLORS.clear()
        CP_FAMILY_MAPPING.clear()
        for row in range(self.table.rowCount()):
            raw_group = self.table.item(row, 0).text() if self.table.item(row, 0) else ''
            raw_name = self.table.item(row, 1).text() if self.table.item(row, 1) else ''
            raw_rgb = self.table.item(row, 2).text() if self.table.item(row, 2) else ''
            raw_hex = self.table.item(row, 3).text() if self.table.item(row, 3) else ''
            raw_hsl = self.table.item(row, 4).text() if self.table.item(row, 4) else ''
            if not raw_name:
                continue
            formatted_name = cp_format_color_name(raw_name.replace(' ', '') if ' ' not in raw_name else raw_name)
            color = QColor()
            if raw_hex:
                hex_val = raw_hex.strip()
                if not hex_val.startswith('#'):
                    hex_val = '#' + hex_val
                color = QColor(hex_val)
            elif raw_rgb:
                try:
                    parts = raw_rgb.replace('(', '').replace(')', '').split(',')
                    if len(parts) == 3:
                        color = QColor(int(parts[0]), int(parts[1]), int(parts[2]))
                except Exception:
                    pass
            elif raw_hsl:
                try:
                    parts = raw_hsl.replace('%', '').replace('°', '').split(',')
                    if len(parts) == 3:
                        color = QColor.fromHsl(int(parts[0]), int(int(parts[1]) * 255 / 100), int(int(parts[2]) * 255 / 100))
                except Exception:
                    pass
            if color.isValid():
                r, g, b = color.red(), color.green(), color.blue()
                h, s, l, _ = color.getHsl()
                h = max(0, h)
                s_pct = int((s / 255) * 100); l_pct = int((l / 255) * 100)
                raw_rgb = '%d, %d, %d' % (r, g, b)
                raw_hex = color.name().upper()
                raw_hsl = '%d, %d%%, %d%%' % (h, s_pct, l_pct)
                raw_group = raw_group if raw_group and raw_group != 'Khác' else cp_auto_detect_family(r, g, b)
                CP_CSS3_COLORS[formatted_name] = (r, g, b)
                if raw_group not in CP_FAMILY_MAPPING:
                    CP_FAMILY_MAPPING[raw_group] = []
                if formatted_name not in CP_FAMILY_MAPPING[raw_group]:
                    CP_FAMILY_MAPPING[raw_group].append(formatted_name)
            data.append({'group': raw_group, 'name': formatted_name, 'rgb': raw_rgb, 'hex': raw_hex, 'hsl': raw_hsl})
        with open(CP_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        if show_msg:
            self.load_data()
            QMessageBox.information(self, 'Thành công', 'Đã lưu và đồng bộ danh sách màu!')

    def import_excel(self):
        import pandas as pd
        file_path, _ = QFileDialog.getOpenFileName(self, 'Mở file Excel', '', 'Excel Files (*.xlsx *.xls)')
        if file_path:
            try:
                self.table.setSortingEnabled(False)
                df = pd.read_excel(file_path)
                for _index, row_data in df.iterrows():
                    group = str(row_data.iloc[0]) if len(row_data) > 0 and pd.notna(row_data.iloc[0]) else ''
                    name = str(row_data.iloc[1]) if len(row_data) > 1 and pd.notna(row_data.iloc[1]) else group
                    rgb = str(row_data.iloc[2]) if len(row_data) > 2 and pd.notna(row_data.iloc[2]) else ''
                    hex_val = str(row_data.iloc[3]) if len(row_data) > 3 and pd.notna(row_data.iloc[3]) else ''
                    hsl = str(row_data.iloc[4]) if len(row_data) > 4 and pd.notna(row_data.iloc[4]) else ''
                    if name and name != 'nan':
                        formatted_name = cp_format_color_name(name)
                        row = self.table.rowCount()
                        self.table.insertRow(row)
                        self.table.setItem(row, 0, QTableWidgetItem(group if group != name else ''))
                        self.table.setItem(row, 1, QTableWidgetItem(formatted_name))
                        self.table.setItem(row, 2, QTableWidgetItem(rgb))
                        self.table.setItem(row, 3, QTableWidgetItem(hex_val))
                        self.table.setItem(row, 4, QTableWidgetItem(hsl))
                self.table.setSortingEnabled(True)
                self.save_data(show_msg=True)
            except Exception as e:
                QMessageBox.warning(self, 'Lỗi', 'Không thể đọc file: %s' % e)

    def export_excel(self):
        import pandas as pd
        file_path, _ = QFileDialog.getSaveFileName(self, 'Lưu file Excel', 'Danh_sach_mau.xlsx', 'Excel Files (*.xlsx)')
        if file_path:
            data = []
            for row in range(self.table.rowCount()):
                g = self.table.item(row, 0).text() if self.table.item(row, 0) else ''
                n = self.table.item(row, 1).text() if self.table.item(row, 1) else ''
                r = self.table.item(row, 2).text() if self.table.item(row, 2) else ''
                hx = self.table.item(row, 3).text() if self.table.item(row, 3) else ''
                hl = self.table.item(row, 4).text() if self.table.item(row, 4) else ''
                h_val, s_val, l_val = 0, 0, 0
                if hl:
                    try:
                        parts = hl.replace('%', '').replace('°', '').split(',')
                        h_val, s_val, l_val = int(parts[0]), int(parts[1]), int(parts[2])
                    except Exception:
                        pass
                data.append({'Nhóm màu': g, 'Tên màu': n, 'RGB': r, 'HEX': hx, 'HSL': hl, '_h': h_val, '_s': s_val, '_l': l_val})
            df = pd.DataFrame(data)
            df.sort_values(by=['Nhóm màu', '_h', '_s', '_l'], inplace=True)
            df.drop(columns=['_h', '_s', '_l'], inplace=True)
            write_excel_with_heading(df, file_path, 'Danh sách màu')
            QMessageBox.information(self, 'Thành công', 'Đã xuất file Excel thành công!')


class CpSnapTextItem(QGraphicsTextItem):
    def __init__(self, key, main_app):
        super().__init__()
        self.key = key
        self.main_app = main_app
        self.setData(Qt.UserRole + 1, key)
        self.setFlag(QGraphicsTextItem.ItemIsMovable)
        self.setFlag(QGraphicsTextItem.ItemIsSelectable)
        self.setFlag(QGraphicsTextItem.ItemSendsGeometryChanges)
        self.setTextInteractionFlags(Qt.NoTextInteraction)

    def mouseDoubleClickEvent(self, event):
        if self.textInteractionFlags() == Qt.NoTextInteraction:
            self.setTextInteractionFlags(Qt.TextEditorInteraction)
            self.setFocus()
            cursor = self.textCursor()
            cursor.select(cursor.Document)
            self.setTextCursor(cursor)
        super().mouseDoubleClickEvent(event)

    def focusOutEvent(self, event):
        self.setTextInteractionFlags(Qt.NoTextInteraction)
        cursor = self.textCursor()
        cursor.clearSelection()
        self.setTextCursor(cursor)
        super().focusOutEvent(event)
        if self.main_app:
            self.main_app.sync_text_from_canvas(self.key, self.toPlainText())

    def itemChange(self, change, value):
        if change == QGraphicsItem.ItemPositionChange and self.scene():
            if getattr(self.main_app.view, '_is_nudging', False):
                return value
            new_pos = value
            rect = self.boundingRect()
            w, h = rect.width(), rect.height()
            center_x = new_pos.x() + w / 2
            center_y = new_pos.y() + h / 2
            snap_x = None
            snap_y = None
            scene_rect = self.scene().sceneRect()
            max_dim = max(scene_rect.width(), scene_rect.height())
            threshold = max(12, int(max_dim * 0.006))
            scene_center_x = scene_rect.width() / 2
            scene_center_y = scene_rect.height() / 2
            if abs(center_x - scene_center_x) < threshold:
                new_pos.setX(scene_center_x - w / 2)
                snap_x = scene_center_x
            if abs(center_y - scene_center_y) < threshold:
                new_pos.setY(scene_center_y - h / 2)
                snap_y = scene_center_y
            for item in self.scene().items():
                if isinstance(item, CpSnapTextItem) and item != self and item.isVisible():
                    other_pos = item.pos()
                    other_rect = item.boundingRect()
                    other_w, other_h = other_rect.width(), other_rect.height()
                    other_left = other_pos.x()
                    other_center_x = other_pos.x() + other_w / 2
                    other_top = other_pos.y()
                    other_center_y = other_pos.y() + other_h / 2
                    if snap_x is None:
                        if abs(new_pos.x() - other_left) < threshold:
                            new_pos.setX(other_left)
                            snap_x = other_left + 1
                        elif abs(center_x - other_center_x) < threshold:
                            new_pos.setX(other_center_x - w / 2)
                            snap_x = other_center_x
                    if snap_y is None:
                        if abs(new_pos.y() - other_top) < threshold:
                            new_pos.setY(other_top)
                            snap_y = other_top
                        elif abs(center_y - other_center_y) < threshold:
                            new_pos.setY(other_center_y - h / 2)
                            snap_y = other_center_y
            self.main_app.show_guide_lines(snap_x, snap_y)
            return new_pos
        return super().itemChange(change, value)

    def mouseReleaseEvent(self, event):
        super().mouseReleaseEvent(event)
        if self.main_app:
            self.main_app.hide_guide_lines()
            self.main_app.update_selected_batch_items()


class CpCanvasView(QGraphicsView):
    item_deleted_signal = pyqtSignal(str)

    def __init__(self, scene):
        super().__init__()
        self.setScene(scene)
        self.setRenderHint(QPainter.Antialiasing)
        self.setRenderHint(QPainter.TextAntialiasing)
        self.setDragMode(QGraphicsView.RubberBandDrag)
        self.setBackgroundBrush(QBrush(QColor(40, 40, 40)))
        self._is_nudging = False
        self.current_key = None
        self.nudge_timer = QTimer(self)
        self.nudge_timer.setInterval(40)
        self.nudge_timer.timeout.connect(self.execute_nudge)
        self.auto_fit = True   # mặc định thu nhỏ vừa khung để thấy trọn ảnh; Ctrl+cuộn chuột = tự zoom, 
        scene.sceneRectChanged.connect(lambda _r: self.fit_all())

    def fit_all(self):
        self.auto_fit = True
        r = self.sceneRect()
        if r.width() > 1 and r.height() > 1 and self.viewport().width() > 20:
            self.fitInView(r.adjusted(-8, -8, 8, 8), Qt.KeepAspectRatio)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        if self.auto_fit:
            self.fit_all()

    def showEvent(self, event):
        super().showEvent(event)
        if self.auto_fit:
            QTimer.singleShot(0, self.fit_all)

    def wheelEvent(self, event):
        if event.modifiers() == Qt.ControlModifier:
            self.auto_fit = False
            zoom_in_factor = 1.15
            zoom_out_factor = 1 / zoom_in_factor
            if event.angleDelta().y() > 0:
                self.scale(zoom_in_factor, zoom_in_factor)
            else:
                self.scale(zoom_out_factor, zoom_out_factor)
        else:
            super().wheelEvent(event)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Delete:
            for item in self.scene().selectedItems():
                key = item.data(Qt.UserRole + 1)
                if key:
                    self.item_deleted_signal.emit(key)
        elif event.key() in (Qt.Key_Up, Qt.Key_Down, Qt.Key_Left, Qt.Key_Right):
            if not event.isAutoRepeat():
                self.current_key = event.key()
                self.nudge_timer.start()
            self.execute_nudge()
        else:
            super().keyPressEvent(event)

    def keyReleaseEvent(self, event):
        if event.key() in (Qt.Key_Up, Qt.Key_Down, Qt.Key_Left, Qt.Key_Right):
            if not event.isAutoRepeat():
                self.nudge_timer.stop()
                self.current_key = None
                if hasattr(self.window(), 'update_selected_batch_items'):
                    self.window().update_selected_batch_items()
        else:
            super().keyReleaseEvent(event)

    def execute_nudge(self):
        if not self.current_key:
            return
        self._is_nudging = True
        scene_rect = self.scene().sceneRect()
        max_dim = max(scene_rect.width(), scene_rect.height())
        step = max(1, int(max_dim * 0.003))
        dx = -step if self.current_key == Qt.Key_Left else (step if self.current_key == Qt.Key_Right else 0)
        dy = -step if self.current_key == Qt.Key_Up else (step if self.current_key == Qt.Key_Down else 0)
        for item in self.scene().selectedItems():
            item.setPos(item.x() + dx, item.y() + dy)
        self._is_nudging = False


class CpScreenPicker(QWidget):
    colorPicked = pyqtSignal(QColor)
    pickerClosed = pyqtSignal()

    def __init__(self, continuous_mode=False, zoom_level=8, mag_size_pct=80):
        super().__init__()
        self.continuous_mode = continuous_mode
        self.zoom_level = zoom_level
        self.mag_size_pct = mag_size_pct
        self.last_picked = ''
        self.mouse_pos = None
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
        self.setMouseTracking(True)
        self.setCursor(Qt.BlankCursor if self.zoom_level > 0 else Qt.CrossCursor)
        screen = QApplication.primaryScreen()
        self.pixmap = screen.grabWindow(0)
        self.setGeometry(screen.geometry())

    def mouseMoveEvent(self, event):
        self.mouse_pos = event.pos()
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.drawPixmap(self.rect(), self.pixmap, self.pixmap.rect())
        if self.continuous_mode:
            painter.setPen(QPen(Qt.white))
            painter.setFont(QFont('Arial', 14, QFont.Bold))
            painter.drawText(20, 40, 'CHẾ ĐỘ TRÍCH MÀU HÀNG LOẠT (BATCH MODE)')
            painter.setFont(QFont('Arial', 12))
            painter.drawText(20, 65, 'Click Trái: Lấy màu thêm vào danh sách')
            painter.drawText(20, 90, 'Click Phải / phím ESC: Thoát và quay về App')
            if self.last_picked:
                painter.setPen(QPen(Qt.green))
                painter.setFont(QFont('Arial', 14, QFont.Bold))
                painter.drawText(20, 130, 'Vừa thêm: %s' % self.last_picked)
        if self.mouse_pos and self.zoom_level > 0:
            mag_size = int(200 * (self.mag_size_pct / 100.0))
            half_size = mag_size // 2
            x_ratio = self.pixmap.width() / self.width()
            y_ratio = self.pixmap.height() / self.height()
            real_x = int(self.mouse_pos.x() * x_ratio)
            real_y = int(self.mouse_pos.y() * y_ratio)
            src_w = max(1, mag_size // self.zoom_level)
            src_h = max(1, mag_size // self.zoom_level)
            src_x = real_x - src_w // 2
            src_y = real_y - src_h // 2
            src_rect = QRect(src_x, src_y, src_w, src_h)
            mag_pixmap = self.pixmap.copy(src_rect).scaled(mag_size, mag_size, Qt.IgnoreAspectRatio, Qt.FastTransformation)
            draw_x = self.mouse_pos.x() - half_size
            draw_y = self.mouse_pos.y() - half_size
            painter.save()
            path = QPainterPath()
            path.addEllipse(draw_x, draw_y, mag_size, mag_size)
            painter.setClipPath(path)
            painter.drawPixmap(draw_x, draw_y, mag_pixmap)
            px_size = self.zoom_level
            cx = self.mouse_pos.x() - (px_size // 2)
            cy = self.mouse_pos.y() - (px_size // 2)
            painter.setPen(QPen(Qt.red, 1 if px_size < 4 else 2))
            painter.drawRect(cx, cy, px_size, px_size)
            painter.restore()
            painter.setPen(QPen(Qt.white, 2))
            painter.drawEllipse(draw_x, draw_y, mag_size, mag_size)
            painter.setPen(QPen(Qt.black, 1))
            painter.drawEllipse(draw_x - 1, draw_y - 1, mag_size + 2, mag_size + 2)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            x_ratio = self.pixmap.width() / self.width()
            y_ratio = self.pixmap.height() / self.height()
            color = QColor(self.pixmap.toImage().pixel(int(event.pos().x() * x_ratio), int(event.pos().y() * y_ratio)))
            self.last_picked = color.name().upper()
            self.colorPicked.emit(color)
            if self.continuous_mode:
                self.update()
            else:
                self.pickerClosed.emit()
                self.close()
        elif event.button() == Qt.RightButton:
            self.pickerClosed.emit()
            self.close()

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.pickerClosed.emit()
            self.close()


class ColorPickerPanel(QWidget):
    """Tab 4 — port từ ColorApp(QMainWindow) gốc sang QWidget để nhúng vào QTabWidget chung."""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.settings = QSettings('HICONIQUE', 'HiconiqueAgent-ColorPicker')
        self.is_restoring_layout = False
        self.custom_texts_counter = 0
        self._last_rgb_str = ''
        self._last_hex_str = ''
        self._last_hsl_str = ''

        main_layout = QHBoxLayout(self)
        main_layout.setContentsMargins(24, 20, 24, 20)
        main_layout.setSpacing(16)

        left_container = QWidget()
        left_layout = QVBoxLayout(left_container)
        left_layout.setContentsMargins(0, 0, 8, 0)
        left_layout.setSpacing(10)

        self.btn_color_list = QPushButton('Danh sách màu')
        self.btn_color_list.setMinimumHeight(40)
        self.btn_color_list.setObjectName('primary')
        self.btn_color_list.clicked.connect(self.open_color_list_dialog)
        left_layout.addWidget(self.btn_color_list)

        top_layout = QVBoxLayout()
        top_bar1 = QHBoxLayout()
        self.btn_pick = QPushButton('Trích xuất màu từ ảnh')
        self.btn_pick.clicked.connect(self.start_picking)
        self.btn_pick.setMinimumHeight(40)
        self.chk_continuous = QCheckBox('Trích hàng loạt')
        top_bar1.addWidget(self.btn_pick, 2)
        top_bar1.addWidget(self.chk_continuous, 1)
        top_bar2 = QHBoxLayout()
        self.combo_zoom = QComboBox()
        self.combo_zoom.addItems(['Không Zoom', 'Zoom 2x', 'Zoom 4x', 'Zoom 8x', 'Zoom 16x'])
        self.combo_zoom.setCurrentIndex(3)
        self.spin_mag_size = QSpinBox()
        self.spin_mag_size.setRange(10, 100)
        self.spin_mag_size.setValue(80)
        self.spin_mag_size.setSuffix(' %')
        top_bar2.addWidget(QLabel('Kính lúp:'))
        top_bar2.addWidget(self.combo_zoom)
        top_bar2.addWidget(QLabel('Cỡ lúp:'))
        top_bar2.addWidget(self.spin_mag_size)
        top_layout.addLayout(top_bar1)
        top_layout.addLayout(top_bar2)
        left_layout.addLayout(top_layout)

        vis_group = QGroupBox('Hiển thị trên Canvas')
        main_vis_layout = QHBoxLayout()
        base_container = QWidget()
        base_layout = QGridLayout(base_container)
        base_layout.setContentsMargins(0, 0, 0, 0)
        self.chk_vis = {}
        self.base_keys = ['Nhóm màu', 'Tên gợi ý', 'RGB', 'HEX', 'HSL', 'Tên file gốc']
        row, col = 0, 0
        for key in self.base_keys:
            chk = QCheckBox(key)
            chk.setChecked(True)
            chk.stateChanged.connect(self.sync_canvas_visibility)
            self.chk_vis[key] = chk
            base_layout.addWidget(chk, row, col)
            col += 1
            if col > 1:
                col = 0
                row += 1
        main_vis_layout.addWidget(base_container, 3)

        right_container = QWidget()
        right_layout = QVBoxLayout(right_container)
        right_layout.setContentsMargins(0, 0, 0, 0)
        self.custom_keys = []
        self.scroll_custom = QScrollArea()
        self.scroll_custom.setWidgetResizable(True)
        self.scroll_custom.setFixedHeight(96)
        self.custom_chk_container = QWidget()
        self.custom_chk_layout = QVBoxLayout(self.custom_chk_container)
        self.custom_chk_layout.setContentsMargins(5, 5, 5, 5)
        self.custom_chk_layout.setSpacing(2)
        self.custom_chk_layout.setAlignment(Qt.AlignTop)
        self.scroll_custom.setWidget(self.custom_chk_container)
        right_layout.addWidget(self.scroll_custom)
        btn_layout = QHBoxLayout()
        btn_add_text = QPushButton('+ Thêm Text'); btn_add_text.clicked.connect(self.add_custom_text_field)
        btn_sub_text = QPushButton('- Xóa Text'); btn_sub_text.clicked.connect(self.remove_custom_text_field)
        btn_layout.addWidget(btn_add_text); btn_layout.addWidget(btn_sub_text)
        right_layout.addLayout(btn_layout)
        main_vis_layout.addWidget(right_container, 2)
        vis_group.setLayout(main_vis_layout)
        left_layout.addWidget(vis_group)

        self.lbl_family = QLabel('<b>Nhóm màu:</b> ')
        self.lbl_name = QLabel('<b>Tên gợi ý:</b> ')
        left_layout.addWidget(self.lbl_family)
        left_layout.addWidget(self.lbl_name)

        edit_layout = QFormLayout()
        edit_layout.setContentsMargins(0, 5, 0, 0)
        edit_layout.setVerticalSpacing(8)
        edit_layout.setFieldGrowthPolicy(QFormLayout.ExpandingFieldsGrow)
        self.input_rgb = QLineEdit(); self.input_hex = QLineEdit(); self.input_hsl = QLineEdit()
        self.input_rgb.editingFinished.connect(self.on_rgb_edited)
        self.input_hex.editingFinished.connect(self.on_hex_edited)
        self.input_hsl.editingFinished.connect(self.on_hsl_edited)
        edit_layout.addRow('RGB (r,g,b):', self.input_rgb)
        edit_layout.addRow('HEX (#):', self.input_hex)
        edit_layout.addRow('HSL:', self.input_hsl)
        self.spin_fontsize = QSpinBox(); self.spin_fontsize.setRange(10, 500); self.spin_fontsize.setValue(40)
        self.spin_fontsize.valueChanged.connect(self.change_font_size)
        edit_layout.addRow('Cỡ chữ:', self.spin_fontsize)
        self.input_filename = QLineEdit('Color')
        self.input_width = QLineEdit('1080')
        self.input_height = QLineEdit('1080')
        self.input_filename.textChanged.connect(self.on_filename_changed)
        self.input_width.editingFinished.connect(self.sync_canvas_size)
        self.input_height.editingFinished.connect(self.sync_canvas_size)
        edit_layout.addRow('Tên file gốc:', self.input_filename)
        edit_layout.addRow('Width (px):', self.input_width)
        edit_layout.addRow('Height (px):', self.input_height)
        left_layout.addLayout(edit_layout)

        batch_group = QGroupBox('Danh sách xuất hàng loạt (Batch)')
        batch_layout = QVBoxLayout()
        self.btn_add_batch = QPushButton('Thêm vào Danh sách (Thủ công)')
        self.btn_add_batch.clicked.connect(self.add_to_batch)
        batch_layout.addWidget(self.btn_add_batch)
        self.lbl_batch_status = QLabel('Tổng số: 0 màu')
        self.lbl_batch_status.setProperty('muted', True)
        batch_layout.addWidget(self.lbl_batch_status)
        self.list_widget = QListWidget()
        self.list_widget.setMinimumHeight(130)
        self.list_widget.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.list_widget.itemClicked.connect(self.preview_from_batch)
        self.list_widget.itemSelectionChanged.connect(self.update_batch_status)
        batch_layout.addWidget(self.list_widget)

        export_opt_group = QGroupBox('Cấu hình Tên File & Định dạng xuất')
        opt_layout = QVBoxLayout()
        row1 = QHBoxLayout()
        self.chk_export_stt = QCheckBox('Thêm STT (01, 02...)'); self.chk_export_stt.setChecked(True)
        row1.addWidget(self.chk_export_stt)
        self.chk_export_prefix = QCheckBox('Tiền tố:')
        self.input_export_prefix = QLineEdit('Export')
        row1.addWidget(self.chk_export_prefix); row1.addWidget(self.input_export_prefix)
        row2 = QHBoxLayout()
        row2.addWidget(QLabel('Định dạng ảnh:'))
        self.combo_export_format = QComboBox()
        self.combo_export_format.addItems(['.png', '.jpg', '.jpeg', '.bmp', '.tiff'])
        row2.addWidget(self.combo_export_format)
        opt_layout.addLayout(row1); opt_layout.addLayout(row2)
        export_opt_group.setLayout(opt_layout)
        batch_layout.addWidget(export_opt_group)

        btn_layout2 = QHBoxLayout()
        self.btn_remove_batch = QPushButton('Xóa mục chọn'); self.btn_remove_batch.clicked.connect(self.remove_from_batch)
        self.btn_export_excel_batch = QPushButton('XUẤT EXCEL'); self.btn_export_excel_batch.clicked.connect(self.export_batch_to_excel)
        self.btn_export_excel_batch.setMinimumHeight(40)
        self.btn_export_batch = QPushButton('XUẤT ẢNH'); self.btn_export_batch.clicked.connect(self.export_batch_images)
        self.btn_export_batch.setMinimumHeight(40); self.btn_export_batch.setObjectName('primary')
        btn_layout2.addWidget(self.btn_remove_batch); btn_layout2.addWidget(self.btn_export_excel_batch); btn_layout2.addWidget(self.btn_export_batch)
        batch_layout.addLayout(btn_layout2)
        batch_group.setLayout(batch_layout)
        left_layout.addWidget(batch_group)

        left_scroll = QScrollArea()
        left_scroll.setWidgetResizable(True)
        left_scroll.setFrameShape(QFrame.NoFrame)
        left_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        left_scroll.setFixedWidth(480)
        left_scroll.setWidget(left_container)
        main_layout.addWidget(left_scroll)

        self.scene = QGraphicsScene()
        self.view = CpCanvasView(self.scene)
        self.scene.selectionChanged.connect(self.on_text_selected)
        self.view.item_deleted_signal.connect(self.on_canvas_item_deleted)
        self.canvas_bg = QGraphicsRectItem()
        self.canvas_bg.setZValue(-1)
        self.canvas_bg.setPen(QPen(Qt.NoPen))
        self.scene.addItem(self.canvas_bg)
        pen_guide = QPen(QColor(255, 0, 255), 1.5, Qt.DashLine)
        self.guide_line_x = QGraphicsLineItem(); self.guide_line_y = QGraphicsLineItem()
        self.guide_line_x.setPen(pen_guide); self.guide_line_y.setPen(pen_guide)
        self.guide_line_x.setZValue(1000); self.guide_line_y.setZValue(1000)
        self.scene.addItem(self.guide_line_x); self.scene.addItem(self.guide_line_y)
        self.guide_line_x.hide(); self.guide_line_y.hide()
        main_layout.addWidget(self.view, 1)

        self.current_color = QColor(255, 255, 255)
        self.canvas_texts = {}
        self.sync_canvas_size()
        self.update_canvas(self.current_color)

    def open_color_list_dialog(self):
        dialog = CpColorListDialog(self)
        dialog.exec_()
        self.update_canvas(self.current_color)

    def add_custom_text_field(self):
        self.custom_texts_counter += 1
        new_key = 'Text mới %d' % self.custom_texts_counter
        self.custom_keys.append(new_key)
        chk = QCheckBox(new_key)
        chk.setChecked(True)
        chk.stateChanged.connect(self.sync_canvas_visibility)
        self.chk_vis[new_key] = chk
        self.custom_chk_layout.addWidget(chk)
        scrollbar = self.scroll_custom.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
        if new_key not in self.canvas_texts:
            text_item = CpSnapTextItem(new_key, self)
            text_item.setPos(50, 100 + len(self.canvas_texts) * 50)
            self.scene.addItem(text_item)
            self.canvas_texts[new_key] = text_item
            r, g, b = self.current_color.red(), self.current_color.green(), self.current_color.blue()
            luminance = (0.299 * r + 0.587 * g + 0.114 * b)
            text_color = QColor(0, 0, 0) if luminance > 128 else QColor(255, 255, 255)
            text_item.setPlainText(new_key)
            text_item.setDefaultTextColor(text_color)
            text_item.setFont(QFont('Arial', self.spin_fontsize.value(), QFont.Bold))
        self.update_selected_batch_items()

    def remove_custom_text_field(self):
        if self.custom_keys:
            key_to_remove = self.custom_keys.pop()
            if key_to_remove in self.chk_vis:
                chk = self.chk_vis.pop(key_to_remove)
                self.custom_chk_layout.removeWidget(chk)
                chk.deleteLater()
            if key_to_remove in self.canvas_texts:
                item = self.canvas_texts.pop(key_to_remove)
                if item.scene():
                    self.scene.removeItem(item)
            self.update_selected_batch_items()

    def sync_text_from_canvas(self, key, new_text):
        if key in self.custom_keys and key in self.chk_vis:
            display_text = new_text.strip().replace('\n', ' ')
            if len(display_text) > 20:
                display_text = display_text[:17] + '...'
            self.chk_vis[key].setText(display_text if display_text else key)
        self.update_selected_batch_items()

    def show_guide_lines(self, x, y):
        scene_rect = self.scene.sceneRect()
        if x is not None:
            self.guide_line_x.setLine(x, scene_rect.top(), x, scene_rect.bottom())
            self.guide_line_x.show()
        else:
            self.guide_line_x.hide()
        if y is not None:
            self.guide_line_y.setLine(scene_rect.left(), y, scene_rect.right(), y)
            self.guide_line_y.show()
        else:
            self.guide_line_y.hide()

    def hide_guide_lines(self):
        self.guide_line_x.hide()
        self.guide_line_y.hide()

    def update_batch_status(self):
        total = self.list_widget.count()
        selected = len(self.list_widget.selectedItems())
        if selected > 0:
            self.lbl_batch_status.setText('Đã chọn: <b>%d</b> / Tổng số: <b>%d</b> màu' % (selected, total))
        else:
            self.lbl_batch_status.setText('Tổng số: <b>%d</b> màu' % total)

    def get_current_layout_state(self):
        vis = {k: chk.isChecked() for k, chk in self.chk_vis.items()}
        pos = {}
        fonts = {}
        custom_texts_content = {}
        for k, text_item in self.canvas_texts.items():
            pos[k] = (text_item.pos().x(), text_item.pos().y())
            fonts[k] = text_item.font().pointSize()
            if k in self.custom_keys or k == 'Tên file gốc':
                custom_texts_content[k] = text_item.toPlainText()
        return {
            'width': int(self.input_width.text() or 1080), 'height': int(self.input_height.text() or 1080),
            'vis': vis, 'pos': pos, 'fonts': fonts, 'custom_contents': custom_texts_content,
            'custom_keys_snapshot': list(self.custom_keys)
        }

    def update_selected_batch_items(self):
        if getattr(self, 'is_restoring_layout', False):
            return
        selected = self.list_widget.selectedItems()
        if not selected:
            return
        state = self.get_current_layout_state()
        for item in selected:
            data = item.data(Qt.UserRole)
            if not isinstance(data, dict):
                continue
            data.update(state)
            item.setData(Qt.UserRole, data)
            old_text = item.text()
            new_text = re.sub(r'_\d+x\d+$', '_%dx%d' % (state['width'], state['height']), old_text)
            if new_text == old_text and not re.search(r'_\d+x\d+$', old_text):
                new_text += '_%dx%d' % (state['width'], state['height'])
            item.setText(new_text)

    def sync_canvas_visibility(self):
        if getattr(self, 'is_restoring_layout', False):
            return
        for key, chk in self.chk_vis.items():
            if key in self.canvas_texts:
                self.canvas_texts[key].setVisible(chk.isChecked())
        self.update_selected_batch_items()

    def on_canvas_item_deleted(self, key):
        if key in self.chk_vis:
            self.chk_vis[key].setChecked(False)

    def on_filename_changed(self):
        if 'Tên file gốc' in self.canvas_texts:
            curr_text = self.canvas_texts['Tên file gốc'].toPlainText()
            if 'Tên file gốc:' in curr_text:
                self.canvas_texts['Tên file gốc'].setPlainText('Tên file gốc: %s' % self.input_filename.text())
            else:
                self.canvas_texts['Tên file gốc'].setPlainText(self.input_filename.text())
        self.update_selected_batch_items()

    def sync_canvas_size(self):
        try:
            w, h = int(self.input_width.text()), int(self.input_height.text())
            self.scene.setSceneRect(0, 0, w, h)
            self.canvas_bg.setRect(0, 0, w, h)
            self.update_selected_batch_items()
        except ValueError:
            pass

    def on_rgb_edited(self):
        if self.input_rgb.text().strip() == self._last_rgb_str:
            return
        try:
            val = self.input_rgb.text().replace('(', '').replace(')', '').strip()
            parts = val.split(',')
            if len(parts) == 3:
                r = max(0, min(255, int(parts[0].strip())))
                g = max(0, min(255, int(parts[1].strip())))
                b = max(0, min(255, int(parts[2].strip())))
                self.update_canvas(QColor(r, g, b))
        except Exception:
            pass

    def on_hex_edited(self):
        hex_val = self.input_hex.text().strip().upper()
        if not hex_val.startswith('#'):
            hex_val = '#' + hex_val
        if hex_val == self._last_hex_str:
            return
        color = QColor(hex_val)
        if color.isValid():
            self.update_canvas(color)

    def on_hsl_edited(self):
        if self.input_hsl.text().strip() == self._last_hsl_str:
            return
        try:
            val = self.input_hsl.text().replace('%', '').replace('°', '').strip()
            parts = val.split(',')
            if len(parts) == 3:
                h = max(0, min(359, int(parts[0].strip())))
                s = max(0, min(100, int(parts[1].strip())))
                l = max(0, min(100, int(parts[2].strip())))
                color = QColor.fromHsl(h, int(s * 255 / 100), int(l * 255 / 100))
                if color.isValid():
                    self.update_canvas(color)
        except Exception:
            pass

    def start_picking(self):
        top = self.window()
        if top:
            top.hide()
        is_continuous = self.chk_continuous.isChecked()
        zoom_text = self.combo_zoom.currentText()
        zoom_val = 0 if zoom_text == 'Không Zoom' else int(zoom_text.replace('Zoom ', '').replace('x', ''))
        mag_size_pct = self.spin_mag_size.value()
        self.picker = CpScreenPicker(continuous_mode=is_continuous, zoom_level=zoom_val, mag_size_pct=mag_size_pct)
        self.picker.colorPicked.connect(self.on_color_picked)
        self.picker.pickerClosed.connect(self.on_picker_closed)
        self.picker.show()

    def on_picker_closed(self):
        top = self.window()
        if top:
            top.show()
        self.update_canvas(self.current_color)

    def on_color_picked(self, color):
        self.current_color = color
        if self.chk_continuous.isChecked():
            self.add_to_batch(explicit_color=color)
        else:
            self.update_canvas(color)

    def update_canvas(self, color, from_restore=False):
        self.current_color = color
        self.canvas_bg.setBrush(QBrush(color))
        r, g, b = color.red(), color.green(), color.blue()
        h, s, l, _ = color.getHsl()
        h = max(0, h)
        hex_code = color.name().upper()
        name, family = cp_get_color_info_data(r, g, b)
        self.lbl_family.setText('<b>Nhóm màu:</b> %s' % family)
        self.lbl_name.setText('<b>Tên gợi ý:</b> %s' % name)
        self._last_rgb_str = '%d, %d, %d' % (r, g, b)
        self._last_hex_str = hex_code
        self._last_hsl_str = '%d, %d%%, %d%%' % (h, int((s / 255) * 100), int((l / 255) * 100))
        self.input_rgb.setText(self._last_rgb_str)
        self.input_hex.setText(self._last_hex_str)
        self.input_hsl.setText(self._last_hsl_str)
        info_dict = {
            'Nhóm màu': family, 'Tên gợi ý': name, 'RGB': self._last_rgb_str, 'HEX': self._last_hex_str,
            'HSL': self._last_hsl_str, 'Tên file gốc': self.input_filename.text()
        }
        luminance = (0.299 * r + 0.587 * g + 0.114 * b)
        text_color = QColor(0, 0, 0) if luminance > 128 else QColor(255, 255, 255)
        y_offset = 100
        for key, value in info_dict.items():
            display_str = ('%s: %s' % (key, value)) if key != 'Tên file gốc' else ('Tên file gốc: %s' % value)
            if key not in self.canvas_texts or self.canvas_texts[key].scene() is None:
                text_item = CpSnapTextItem(key, self)
                text_item.setPos(50, y_offset)
                self.scene.addItem(text_item)
                self.canvas_texts[key] = text_item
                y_offset += (self.spin_fontsize.value() * 2)
            if not from_restore or not self.canvas_texts[key].toPlainText():
                self.canvas_texts[key].setPlainText(display_str)
            self.canvas_texts[key].setDefaultTextColor(text_color)
            if not from_restore:
                self.canvas_texts[key].setFont(QFont('Arial', self.spin_fontsize.value(), QFont.Bold))
        for ck in self.custom_keys:
            if ck not in self.canvas_texts or self.canvas_texts[ck].scene() is None:
                text_item = CpSnapTextItem(ck, self)
                text_item.setPos(50, y_offset)
                self.scene.addItem(text_item)
                self.canvas_texts[ck] = text_item
                text_item.setPlainText(ck)
                y_offset += (self.spin_fontsize.value() * 2)
            self.canvas_texts[ck].setDefaultTextColor(text_color)
            if not from_restore:
                self.canvas_texts[ck].setFont(QFont('Arial', self.spin_fontsize.value(), QFont.Bold))
        if not from_restore:
            self.sync_canvas_visibility()

    def on_text_selected(self):
        items = self.scene.selectedItems()
        if items:
            self.spin_fontsize.setValue(items[0].font().pointSize())

    def change_font_size(self):
        size = self.spin_fontsize.value()
        font = QFont('Arial', size, QFont.Bold)
        for item in self.scene.selectedItems():
            item.setFont(font)
        self.update_selected_batch_items()

    def add_to_batch(self, explicit_color=None):
        color = explicit_color if explicit_color else self.current_color
        hex_code = color.name().upper().replace('#', '')
        base_name = self.input_filename.text().strip() or 'Color'
        w = self.input_width.text() or '1080'
        h = self.input_height.text() or '1080'
        item_text = '%s_%s_%sx%s' % (base_name, hex_code, w, h)
        item = QListWidgetItem(item_text)
        item.setFlags(item.flags() | Qt.ItemIsEditable)
        data = {'color': color, **self.get_current_layout_state()}
        item.setData(Qt.UserRole, data)
        self.list_widget.addItem(item)
        self.update_batch_status()

    def preview_from_batch(self, item):
        data = item.data(Qt.UserRole)
        if data and isinstance(data, dict):
            self.is_restoring_layout = True
            for k in list(self.custom_keys):
                if k in self.chk_vis:
                    chk = self.chk_vis.pop(k)
                    self.custom_chk_layout.removeWidget(chk)
                    chk.deleteLater()
            saved_custom_keys = data.get('custom_keys_snapshot', [])
            self.custom_keys = list(saved_custom_keys)
            custom_contents = data.get('custom_contents', {})
            for k in self.custom_keys:
                display_text = k
                if k in custom_contents:
                    c_text = custom_contents[k].strip().replace('\n', ' ')
                    if c_text:
                        display_text = c_text[:17] + '...' if len(c_text) > 20 else c_text
                chk = QCheckBox(display_text)
                chk.stateChanged.connect(self.sync_canvas_visibility)
                self.chk_vis[k] = chk
                self.custom_chk_layout.addWidget(chk)
            w, h = data.get('width', 1080), data.get('height', 1080)
            self.input_width.setText(str(w))
            self.input_height.setText(str(h))
            self.scene.setSceneRect(0, 0, w, h)
            self.canvas_bg.setRect(0, 0, w, h)
            self.update_canvas(data['color'], from_restore=True)
            vis = data.get('vis', {})
            pos = data.get('pos', {})
            fonts = data.get('fonts', {})
            all_valid_keys = self.base_keys + self.custom_keys
            for k in list(self.canvas_texts.keys()):
                if k not in all_valid_keys:
                    self.scene.removeItem(self.canvas_texts[k])
                    del self.canvas_texts[k]
            for k in all_valid_keys:
                if k not in self.canvas_texts:
                    ti = CpSnapTextItem(k, self)
                    self.scene.addItem(ti)
                    self.canvas_texts[k] = ti
            for k, text_item in self.canvas_texts.items():
                if k in vis and k in self.chk_vis:
                    self.chk_vis[k].setChecked(vis[k])
                    text_item.setVisible(vis[k])
                if k in pos:
                    text_item.setPos(pos[k][0], pos[k][1])
                if k in fonts:
                    text_item.setFont(QFont('Arial', fonts[k], QFont.Bold))
                if k in custom_contents:
                    text_item.setPlainText(custom_contents[k])
            self.is_restoring_layout = False

    def remove_from_batch(self):
        selected_items = self.list_widget.selectedItems()
        if not selected_items:
            return
        for item in selected_items:
            self.list_widget.takeItem(self.list_widget.row(item))
        self.update_batch_status()

    def render_export(self, file_path, width=None, height=None):
        try:
            w = width if width is not None else int(self.input_width.text())
            h = height if height is not None else int(self.input_height.text())
        except Exception:
            return
        image = QImage(w, h, QImage.Format_ARGB32)
        image.fill(Qt.transparent)
        self.hide_guide_lines()
        self.scene.clearSelection()
        painter = QPainter(image)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setRenderHint(QPainter.TextAntialiasing)
        target_rect = QRectF(0, 0, w, h)
        self.scene.render(painter, target_rect, target_rect)
        painter.end()
        image.save(file_path)

    def export_batch_to_excel(self):
        import pandas as pd
        total_items = self.list_widget.count()
        if total_items == 0:
            QMessageBox.warning(self, 'Lỗi', 'Danh sách đang trống!')
            return
        items_to_export = self.list_widget.selectedItems()
        if len(items_to_export) == 0:
            items_to_export = [self.list_widget.item(i) for i in range(total_items)]
        last_dir = self.settings.value('last_dir', '')
        file_path, _ = QFileDialog.getSaveFileName(self, 'Lưu file Excel', os.path.join(last_dir, 'Batch_Colors.xlsx'), 'Excel Files (*.xlsx)')
        if not file_path:
            return
        self.settings.setValue('last_dir', os.path.dirname(file_path))
        data_list = []
        for item in items_to_export:
            data = item.data(Qt.UserRole)
            if data and isinstance(data, dict):
                color = data.get('color')
                if color:
                    r, g, b = color.red(), color.green(), color.blue()
                    h, s, l, _ = color.getHsl()
                    h = max(0, h)
                    hex_code = color.name().upper()
                    name, family = cp_get_color_info_data(r, g, b)
                    s_pct = int((s / 255) * 100); l_pct = int((l / 255) * 100)
                    data_list.append({'Nhóm màu': family, 'Tên màu': name, 'RGB': '%d, %d, %d' % (r, g, b),
                                       'HEX': hex_code, 'HSL': '%d, %d%%, %d%%' % (h, s_pct, l_pct), '_h': h, '_s': s_pct, '_l': l_pct})
        df = pd.DataFrame(data_list)
        if not df.empty:
            df.sort_values(by=['Nhóm màu', '_h', '_s', '_l'], inplace=True)
            df.drop(columns=['_h', '_s', '_l'], inplace=True)
            write_excel_with_heading(df, file_path, 'Danh sách màu')
            QMessageBox.information(self, 'Thành công', 'Đã xuất thành công %d màu ra file Excel!' % len(items_to_export))

    def export_batch_images(self):
        total_items = self.list_widget.count()
        if total_items == 0:
            QMessageBox.warning(self, 'Lỗi', 'Danh sách đang trống!')
            return
        items_to_export = self.list_widget.selectedItems()
        if len(items_to_export) == 0:
            items_to_export = [self.list_widget.item(i) for i in range(total_items)]
        last_dir = self.settings.value('last_dir', '')
        folder_path = QFileDialog.getExistingDirectory(self, 'Chọn thư mục lưu ảnh', last_dir)
        if not folder_path:
            return
        self.settings.setValue('last_dir', folder_path)
        original_color = self.current_color
        original_w = self.input_width.text()
        original_h = self.input_height.text()
        add_stt = self.chk_export_stt.isChecked()
        add_prefix = self.chk_export_prefix.isChecked()
        prefix_str = self.input_export_prefix.text().strip()
        pad_len = len(str(len(items_to_export)))
        ext = self.combo_export_format.currentText()
        for idx, item in enumerate(items_to_export):
            data = item.data(Qt.UserRole)
            base_list_name = item.text()
            if data and isinstance(data, dict):
                self.preview_from_batch(item)
                final_name = base_list_name
                if add_prefix and prefix_str:
                    final_name = '%s_%s' % (prefix_str, final_name)
                if add_stt:
                    final_name = ('%0' + str(pad_len) + 'd_%s') % (idx + 1, final_name)
                f_path = os.path.join(folder_path, final_name + ext)
                self.render_export(f_path, data.get('width'), data.get('height'))
        self.input_width.setText(original_w)
        self.input_height.setText(original_h)
        self.sync_canvas_size()
        self.update_canvas(original_color)
        QMessageBox.information(self, 'Thành công', 'Đã xuất thành công %d ảnh!' % len(items_to_export))


# ==============================================================================
# Cửa sổ chính — 5 tab, khay hệ thống (đóng = ẩn xuống khay, chỉ "Thoát" mới tắt hẳn)
# ==============================================================================
class UpdateCheckThread(QThread):
    done = pyqtSignal(str)
    progress = pyqtSignal(str)

    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg

    def run(self):
        # restart=False: thread chỉ tải + ghi đè file; việc đóng app và mở lại do cửa sổ chính làm (sạch khay, đúng luồng Qt)
        self.done.emit(check_update(self.cfg, progress=self.progress.emit, restart=False))


NAV_ITEMS = [
    ('activity', 'Kiểm soát dữ liệu thao tác'),
    ('cpu', 'Thông số linh kiện máy tính'),
    ('image', 'Convert Ảnh ↔ SKM'),
    ('drop', 'Lấy màu (Pick Color)'),
    ('power', 'Hẹn giờ tắt máy'),
]


def refresh_windows_icon_cache():
    """Báo Windows vẽ lại icon Desktop/Start/Apps & features (icon cache hay giữ logo cũ sau khi đổi icon)."""
    for args in (['ie4uinit.exe', '-ClearIconCache'], ['ie4uinit.exe', '-show']):
        try:
            subprocess.run(args, capture_output=True, timeout=20, creationflags=0x08000000)
        except Exception:
            pass
    try:
        ctypes.windll.shell32.SHChangeNotify(0x08000000, 0, None, None)   # SHCNE_ASSOCCHANGED: làm mới toàn bộ icon
    except Exception:
        pass


class MainWindow(QMainWindow):
    def __init__(self, cfg, start_hidden=False):
        super().__init__()
        self.setWindowTitle('HICONIQUE Agent %s' % VERSION)
        self.setWindowIcon(app_icon())
        self.resize(1240, 800)
        self.setMinimumSize(980, 640)

        self.shared = Shared(cfg)
        self.worker = BackgroundWorker(self.shared)
        self.worker.start()
        self.theme = load_theme()

        central = QWidget()
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # ---- Thanh tiêu đề: logo + tên + phiên bản | trạng thái cập nhật, nút kiểm tra cập nhật, nút sáng/tối ----
        header = QWidget()
        header.setObjectName('header')
        header.setFixedHeight(62)
        hl = QHBoxLayout(header)
        hl.setContentsMargins(18, 0, 16, 0)
        hl.setSpacing(12)
        self.logo = QLabel()
        self.logo.setPixmap(logo_pixmap(36))
        self.logo.setFixedSize(36, 36)
        hl.addWidget(self.logo)
        title = QLabel('HICONIQUE Agent')
        title.setStyleSheet('font-size:16px;font-weight:700;color:%s;' % BRONZE)
        hl.addWidget(title)
        ver = QLabel('v%s' % VERSION)
        ver.setProperty('muted', True)
        hl.addWidget(ver)
        hl.addStretch(1)
        self.lblUpdate = QLabel('')
        self.lblUpdate.setProperty('muted', True)
        hl.addWidget(self.lblUpdate)
        self.btnCheckUpdate = QPushButton(' Kiểm tra cập nhật')
        self.btnCheckUpdate.setCursor(Qt.PointingHandCursor)
        self.btnCheckUpdate.setToolTip('Kiểm tra bản mới — nếu có sẽ tự tải về, ghi đè và mở lại')
        self.btnCheckUpdate.setFixedHeight(38)
        self.btnCheckUpdate.clicked.connect(self.check_update_now)
        hl.addWidget(self.btnCheckUpdate)
        self.btnTheme = QPushButton()
        self.btnTheme.setObjectName('iconbtn')
        self.btnTheme.setFixedSize(38, 38)
        self.btnTheme.setIconSize(QSize(20, 20))
        self.btnTheme.setCursor(Qt.PointingHandCursor)
        self.btnTheme.setToolTip('Chuyển đổi sáng/tối')
        self.btnTheme.clicked.connect(self.toggle_theme)
        hl.addWidget(self.btnTheme)
        root.addWidget(header)

        # ---- Thân: thanh điều hướng bên trái + nội dung (co giãn theo cửa sổ) ----
        body = QHBoxLayout()
        body.setContentsMargins(0, 0, 0, 0)
        body.setSpacing(0)
        sidebar = QWidget()
        sidebar.setObjectName('sidebar')
        sidebar.setFixedWidth(258)
        sl = QVBoxLayout(sidebar)
        sl.setContentsMargins(12, 14, 12, 14)
        sl.setSpacing(4)
        self.navButtons = []
        for i, (icon_name, text) in enumerate(NAV_ITEMS):
            b = QPushButton(' ' + text)
            b.setObjectName('nav')
            b.setCheckable(True)
            b.setCursor(Qt.PointingHandCursor)
            b.setIconSize(QSize(18, 18))
            b.setMinimumHeight(42)
            b.clicked.connect(lambda _checked=False, idx=i: self.select_page(idx))
            sl.addWidget(b)
            self.navButtons.append(b)
        sl.addStretch(1)
        info = QLabel('i')
        info.setAlignment(Qt.AlignCenter)
        info.setFixedSize(24, 24)
        info.setCursor(Qt.WhatsThisCursor)
        info.setToolTip('Đóng cửa sổ (nút X) = ứng dụng chạy nền ở khay hệ thống.\nChuột phải vào icon ở khay hệ thống > Thoát để tắt hẳn.')
        info.setStyleSheet('QLabel{border:1.5px solid %s;border-radius:12px;color:%s;font-weight:700;font-family:Georgia;font-style:italic;font-size:13px;background:transparent;}'
                           'QLabel:hover{color:%s;border-color:%s;}' % (BORDER, MUTED, BRONZE, BRONZE))
        sl.addWidget(info, 0, Qt.AlignLeft | Qt.AlignBottom)
        body.addWidget(sidebar)

        self.stack = QStackedWidget()
        self.stack.addWidget(ActivityTab(self.shared))
        self.stack.addWidget(HardwareTab(self.shared))
        self.stack.addWidget(SkmConverterTab())
        self.stack.addWidget(ColorPickerPanel())
        self.stack.addWidget(ShutdownTab())
        body.addWidget(self.stack, 1)
        root.addLayout(body, 1)
        self.setCentralWidget(central)

        self.select_page(0)
        self._update_theme_button()

        self._build_tray()
        self._build_ipc_server()

        if not start_hidden:
            self.show()

    def select_page(self, idx):
        self.stack.setCurrentIndex(idx)
        for i, b in enumerate(self.navButtons):
            b.setChecked(i == idx)
        self._refresh_icons()

    def _refresh_icons(self):
        c = THEME_COLORS.get(self.theme, THEME_COLORS['dark'])
        for i, b in enumerate(self.navButtons):
            b.setIcon(svg_icon(NAV_ITEMS[i][0], c['bronze'] if b.isChecked() else c['muted'], 18))
        self.btnCheckUpdate.setIcon(svg_icon('refresh', c['muted'], 16))

    def _build_tray(self):
        self.tray = QSystemTrayIcon(app_icon(), self)
        self.tray.setToolTip('HICONIQUE Agent %s — đang chạy nền' % VERSION)
        menu = QMenu()
        act_open = QAction('Mở HICONIQUE Agent', self)
        act_open.triggered.connect(self.bring_to_front)
        menu.addAction(act_open)
        menu.addSeparator()
        act_quit = QAction('Thoát', self)
        act_quit.triggered.connect(self.real_quit)
        menu.addAction(act_quit)
        self.tray.setContextMenu(menu)
        self.tray.activated.connect(self._on_tray_activated)
        self.tray.show()

    def _on_tray_activated(self, reason):
        if reason in (QSystemTrayIcon.DoubleClick, QSystemTrayIcon.Trigger):
            self.bring_to_front()

    def bring_to_front(self):
        self.showNormal()
        self.raise_()
        self.activateWindow()

    def _build_ipc_server(self):
        QLocalServer.removeServer(IPC_SERVER_NAME)
        self.ipc = QLocalServer(self)
        self.ipc.newConnection.connect(self._on_ipc_connection)
        self.ipc.listen(IPC_SERVER_NAME)

    def _on_ipc_connection(self):
        sock = self.ipc.nextPendingConnection()
        if sock:
            sock.waitForReadyRead(200)
            sock.readAll()
            sock.disconnectFromServer()
        self.bring_to_front()

    def closeEvent(self, event: QCloseEvent):
        event.ignore()
        self.hide()
        if not self.settings_notified_hide():
            self.tray.showMessage('HICONIQUE Agent', 'Vẫn chạy nền để ghi nhận dữ liệu. Bấm icon khay hệ thống để mở lại, chuột phải > Thoát để tắt hẳn.',
                                  QSystemTrayIcon.Information, 4000)

    def settings_notified_hide(self):
        flagp = os.path.join(DATA_DIR, 'da-bao-an-xuong-khay')
        if os.path.exists(flagp):
            return True
        try:
            open(flagp, 'w').close()
        except Exception:
            pass
        return False

    def real_quit(self):
        self.worker.stop()
        self.tray.hide()
        QApplication.quit()

    def _update_theme_button(self):
        # Giống web: nền tối hiện mặt trời (vàng đồng), nền sáng hiện mặt trăng (xanh) — icon của chế độ SẼ chuyển sang
        if self.theme == 'dark':
            self.btnTheme.setIcon(svg_icon('sun', SUN_COLOR, 20))
        else:
            self.btnTheme.setIcon(svg_icon('moon', MOON_COLOR, 20))
        self._refresh_icons()

    def toggle_theme(self):
        self.theme = 'light' if self.theme == 'dark' else 'dark'
        QApplication.instance().setStyleSheet(qss_for(self.theme))
        save_theme(self.theme)
        self._update_theme_button()

    def check_update_now(self):
        self.btnCheckUpdate.setEnabled(False)
        self.lblUpdate.setText('Đang kiểm tra…')
        self.updateThread = UpdateCheckThread(self.shared.cfg)
        self.updateThread.progress.connect(self.lblUpdate.setText)
        self.updateThread.done.connect(self.on_update_checked)
        self.updateThread.start()

    def on_update_checked(self, status):
        self.btnCheckUpdate.setEnabled(True)
        now = datetime.now().strftime('%H:%M:%S')
        if status == 'latest':
            self.lblUpdate.setText('Đã kiểm tra %s — đang dùng bản mới nhất' % now)
        elif status == 'not_frozen':
            self.lblUpdate.setText('Chạy từ mã nguồn — không tự cập nhật')
        elif status.startswith('error:'):
            self.lblUpdate.setText('Kiểm tra lúc %s — lỗi mạng, thử lại sau' % now)
            log('Kiểm tra cập nhật (nút thủ công) lỗi:', status[6:])
        elif status in ('bad_url', 'bad_sha'):
            self.lblUpdate.setText('Kiểm tra lúc %s — bản trên máy chủ không hợp lệ, đã hủy' % now)
            QMessageBox.warning(self, 'HICONIQUE Agent', 'Dữ liệu bản cập nhật không hợp lệ (%s) — đã hủy, không cài.' % status)
        elif status.startswith('updated:'):
            self.lblUpdate.setText('Đã cài bản %s — đang khởi động lại…' % status[8:])
            self.btnCheckUpdate.setEnabled(False)
            QTimer.singleShot(1200, self.restart_after_update)

    def restart_after_update(self):
        """File exe đã được ghi đè bản mới — đóng app này sạch sẽ rồi mở lại bằng file mới."""
        self.worker.stop()
        self.tray.hide()
        relaunch_after_exit(sys.executable)
        QTimer.singleShot(300, lambda: os._exit(0))   # thoát cứng: trạng thái ghi nhận đã lưu mỗi lần lấy mẫu


def try_activate_existing_instance():
    sock = QLocalSocket()
    sock.connectToServer(IPC_SERVER_NAME)
    if sock.waitForConnected(300):
        sock.write(b'show')
        sock.flush()
        sock.waitForBytesWritten(300)
        sock.disconnectFromServer()
        return True
    return False


class MembersThread(QThread):
    progress = pyqtSignal(int, int)
    done = pyqtSignal(list, str)

    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg

    def run(self):
        out, err = fetch_members(self.cfg, progress=lambda i, n: self.progress.emit(i, n))
        self.done.emit(out, err)


class InstallDialog(QDialog):
    def __init__(self, cfg, parent=None):
        super().__init__(parent)
        self.cfg = cfg
        self.installed = False
        self.setWindowTitle('Cài đặt HICONIQUE Agent %s' % VERSION)
        self.setWindowIcon(app_icon())
        self.resize(640, 760)
        self.setMinimumSize(560, 640)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(26, 22, 26, 22)
        lay.setSpacing(14)

        hero = QFrame()
        hero.setObjectName('hero')
        hl = QHBoxLayout(hero)
        hl.setContentsMargins(18, 16, 18, 16)
        hl.setSpacing(14)
        logo = QLabel()
        logo.setPixmap(logo_pixmap(60))
        logo.setFixedSize(64, 64)
        hl.addWidget(logo)
        ht = QVBoxLayout()
        ht.setSpacing(2)
        title = QLabel('HICONIQUE Agent')
        title.setStyleSheet('font-size:22px;font-weight:800;color:%s;' % BRONZE)
        ht.addWidget(title)
        sub = QLabel('Cài đặt cho máy tính CÔNG TY  ·  phiên bản %s' % VERSION)
        sub.setProperty('muted', True)
        ht.addWidget(sub)
        sub2 = QLabel('Chạy nền, ghi nhận thời gian dùng ứng dụng trong giờ làm việc (%s) và cấu hình phần cứng máy.' % cfg['workHours'])
        sub2.setProperty('muted', True)
        sub2.setWordWrap(True)
        ht.addWidget(sub2)
        hl.addLayout(ht, 1)
        lay.addWidget(hero)

        cols = QHBoxLayout()
        cols.setSpacing(12)
        for head, color, icon, items in (
                ('Có ghi nhận', '#6FA274', '✓', ['Tên ứng dụng đang dùng', 'Tiêu đề cửa sổ (cửa sổ ẩn danh bị che)', 'Cấu hình CPU / RAM / ổ cứng / pin']),
                ('KHÔNG ghi nhận', '#D07070', '✕', ['Màn hình, ảnh chụp', 'Phím gõ, clipboard', 'Tin nhắn, nội dung tệp, camera, micro'])):
            box = QFrame()
            box.setObjectName('note')
            bl = QVBoxLayout(box)
            bl.setContentsMargins(14, 12, 14, 12)
            bl.setSpacing(4)
            hd = QLabel(head)
            hd.setStyleSheet('font-weight:700;color:%s;' % color)
            bl.addWidget(hd)
            for it in items:
                r = QLabel('<span style="color:%s;font-weight:700;">%s</span>&nbsp; %s' % (color, icon, it))
                r.setWordWrap(True)
                bl.addWidget(r)
            bl.addStretch(1)
            cols.addWidget(box, 1)
        lay.addLayout(cols)

        rd = QLabel('Bạn xem được dữ liệu của mình ngay trong ứng dụng (tab Kiểm soát dữ liệu thao tác) và trên trang Theo dõi hiệu suất của Hub. Dữ liệu lưu trên máy được mã hóa. Gỡ cài đặt bất cứ lúc nào trong Cài đặt Windows › Ứng dụng.')
        rd.setProperty('muted', True)
        rd.setWordWrap(True)
        lay.addWidget(rd)

        pick = QFrame()
        pick.setObjectName('card')
        pl = QVBoxLayout(pick)
        pl.setContentsMargins(16, 14, 16, 14)
        pl.setSpacing(8)
        st1 = QLabel('<b>Bước 1</b> — Chọn tên của bạn')
        pl.addWidget(st1)
        comboRow = QHBoxLayout()
        self.combo = QComboBox()
        self.combo.setEditable(True)
        self.combo.setInsertPolicy(QComboBox.NoInsert)
        self.combo.lineEdit().setPlaceholderText('Chọn tên trong danh sách, hoặc gõ thẳng mã thành viên (VD: NV_XX_010190)')
        comboRow.addWidget(self.combo, 1)
        self.btnReload = QPushButton('Tải lại')
        self.btnReload.setToolTip('Tải lại danh sách thành viên')
        self.btnReload.clicked.connect(self.load_members)
        comboRow.addWidget(self.btnReload)
        pl.addLayout(comboRow)
        self.lblLoad = QLabel('')
        self.lblLoad.setProperty('muted', True)
        self.lblLoad.setWordWrap(True)
        pl.addWidget(self.lblLoad)
        self.loadBar = QProgressBar()
        self.loadBar.setRange(0, 0)
        self.loadBar.setTextVisible(False)
        self.loadBar.setStyleSheet('QProgressBar{min-height:4px;max-height:4px;border:none;border-radius:2px;}QProgressBar::chunk{border-radius:2px;}')
        self.loadBar.setMaximumHeight(4)
        self.loadBar.setMinimumHeight(4)
        self.loadBar.hide()
        pl.addWidget(self.loadBar)
        hint = QLabel('Không thấy tên (hoặc mạng chậm)? Cứ gõ thẳng mã thành viên của bạn (xem sheet NS-Thành viên) rồi bấm Cài đặt.')
        hint.setProperty('muted', True)
        hint.setWordWrap(True)
        pl.addWidget(hint)
        lay.addWidget(pick)

        self.members = {}
        self.membersThread = None
        # hiện ngay danh sách lần trước (nếu có) trong lúc tải bản mới
        cached = load_members_cache()
        if cached:
            self._fill_members(cached)
        QTimer.singleShot(200, self.load_members)

        self.agree = QCheckBox('Tôi đã đọc và đồng ý để công ty ghi nhận như trên trên máy tính công ty này.')
        lay.addWidget(self.agree)

        self.status = QLabel('')
        self.status.setStyleSheet('color:#D07070;')
        self.status.setWordWrap(True)
        lay.addWidget(self.status)

        lay.addStretch(1)
        self.btnInstall = QPushButton('Cài đặt HICONIQUE Agent')
        self.btnInstall.setObjectName('primary')
        self.btnInstall.setMinimumHeight(46)
        self.btnInstall.setStyleSheet('font-size:15px;')
        self.btnInstall.clicked.connect(self.do_install)
        lay.addWidget(self.btnInstall)

    def _fill_members(self, ms):
        typed = self.combo.currentText().strip()
        self.members = {'%s (%s)' % (n, i): i for n, i in ms}
        self.combo.clear()
        self.combo.addItems(list(self.members.keys()))
        self.combo.setCurrentText(typed)   # giữ nguyên chữ người dùng đã gõ dở

    def load_members(self):
        if self.membersThread is not None and self.membersThread.isRunning():
            return
        self.btnReload.setEnabled(False)
        self.loadBar.show()
        self.lblLoad.setStyleSheet('')
        self.lblLoad.setText('Đang tải danh sách thành viên… (mạng chậm có thể mất tới 1–2 phút — bạn có thể gõ mã thành viên ngay)')
        self.membersThread = MembersThread(self.cfg)
        self.membersThread.progress.connect(lambda i, n: self.lblLoad.setText(
            'Đang tải danh sách thành viên… lần %d/%d (mạng chậm có thể mất tới 1–2 phút — bạn có thể gõ mã thành viên ngay)' % (i, n)))
        self.membersThread.done.connect(self.on_members_loaded)
        self.membersThread.start()

    def on_members_loaded(self, ms, err):
        self.btnReload.setEnabled(True)
        self.loadBar.hide()
        if ms:
            self._fill_members(ms)
            self.lblLoad.setStyleSheet('')
            self.lblLoad.setText('Đã tải %d thành viên — bấm vào ô để chọn tên.' % len(ms))
        else:
            self.lblLoad.setStyleSheet('color:#D07070;')
            self.lblLoad.setText('Chưa tải được danh sách (%s). Bấm "Tải lại", hoặc gõ thẳng mã thành viên vào ô rồi bấm Cài đặt.' % (err or 'mạng chậm'))

    def do_install(self):
        sel = self.combo.currentText().strip()
        member = self.members.get(sel) or sel
        if not member:
            self.status.setText('Hãy chọn tên hoặc nhập mã thành viên.')
            return
        if not self.agree.isChecked():
            self.status.setText('Cần tích đồng ý trước khi cài đặt.')
            return
        self.btnInstall.setEnabled(False)
        self.btnInstall.setText('Đang cài đặt…')
        QApplication.processEvents()
        try:
            subprocess.run(['taskkill', '/F', '/FI', 'IMAGENAME eq HiconiqueAgent.exe', '/FI', 'PID ne %d' % os.getpid()],
                           capture_output=True, creationflags=0x08000000)
            time.sleep(1)
            os.makedirs(INSTALL_DIR, exist_ok=True)
            if os.path.abspath(sys.executable).lower() != INSTALL_EXE.lower():
                if os.path.exists(INSTALL_EXE):
                    try:
                        os.replace(INSTALL_EXE, INSTALL_EXE + '.old')
                    except OSError:
                        pass
                shutil.copy2(sys.executable, INSTALL_EXE)
            c = load_config()
            c['memberId'] = member
            save_config(c)
            register_windows()
            create_desktop_shortcut()
            refresh_windows_icon_cache()
            self.installed = True
            QMessageBox.information(self, 'HICONIQUE Agent',
                                    'Cài đặt xong! Đã tạo icon "HICONIQUE Agent" trên Desktop.\n'
                                    'Ứng dụng sẽ mở ngay sau khi bạn bấm OK, và tự khởi động cùng Windows từ lần sau (ẩn xuống khay).')
            self.accept()
        except Exception as e:
            log('Cài đặt lỗi:', e)
            self.status.setText('Lỗi cài đặt: %s' % e)
            self.btnInstall.setEnabled(True)
            self.btnInstall.setText('Cài đặt HICONIQUE Agent')


def do_uninstall():
    if QMessageBox.question(None, 'Gỡ HICONIQUE Agent', 'Gỡ HICONIQUE Agent khỏi máy này và xóa dữ liệu ghi nhận trên máy?',
                            QMessageBox.Yes | QMessageBox.No, QMessageBox.No) != QMessageBox.Yes:
        return
    unregister_windows()
    remove_desktop_shortcut()
    subprocess.run(['taskkill', '/F', '/FI', 'IMAGENAME eq HiconiqueAgent.exe', '/FI', 'PID ne %d' % os.getpid()],
                   capture_output=True, creationflags=0x08000000)
    bat = os.path.join(tempfile.gettempdir(), 'hiconique_uninstall.bat')
    with open(bat, 'w', encoding='utf-8') as f:
        f.write('@echo off\nping -n 4 127.0.0.1 >nul\nrmdir /s /q "%s"\nrmdir /s /q "%s"\ndel "%%~f0"\n' % (INSTALL_DIR, DATA_DIR))
    subprocess.Popen(['cmd', '/c', bat], creationflags=0x08000000 | 0x00000008, close_fds=True)
    QMessageBox.information(None, 'HICONIQUE Agent', 'Đã gỡ cài đặt HICONIQUE Agent.')


def excepthook(exc_type, exc_value, exc_tb):
    msg = ''.join(traceback.format_exception(exc_type, exc_value, exc_tb))
    log('LỖI CHƯA XỬ LÝ:', msg)
    try:
        QMessageBox.critical(None, 'HICONIQUE Agent — Lỗi', 'Đã xảy ra lỗi ngoài dự kiến:\n\n%s' % msg)
    except Exception:
        pass


def main():
    if hasattr(Qt, 'AA_EnableHighDpiScaling'):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    app = QApplication(sys.argv)
    app.setApplicationName('HiconiqueAgent')
    app.setOrganizationName('HICONIQUE')
    app.setStyleSheet(qss_for(load_theme()))
    sys.excepthook = excepthook

    args = sys.argv[1:]
    cfg = load_config()

    if '--uninstall' in args:
        do_uninstall()
        return

    if '--after-update' in args and FROZEN and os.path.abspath(sys.executable).lower() == INSTALL_EXE.lower():
        # Vừa tự cập nhật xong: làm mới thông tin phiên bản trong Cài đặt Windows + icon Desktop (icon có thể đã đổi)
        try:
            register_windows()
            create_desktop_shortcut()
            refresh_windows_icon_cache()
        except Exception as e:
            log('Làm mới đăng ký sau cập nhật lỗi:', e)

    if '--run' in args or ('--once' not in args and FROZEN and os.path.abspath(sys.executable).lower() == INSTALL_EXE.lower()):
        # Khởi động bình thường (Windows tự gọi khi đăng nhập với --run, hoặc bấm icon Desktop/Start)
        if not cfg['memberId']:
            QMessageBox.critical(None, 'HICONIQUE Agent', 'Chưa có mã thành viên. Hãy chạy lại trình cài đặt (HiconiqueAgentSetup.exe).')
            return
        if try_activate_existing_instance():
            return  # đã có bản đang chạy — chỉ đưa cửa sổ đó lên trước rồi thoát
        win = MainWindow(cfg, start_hidden=('--run' in args))
        sys.exit(app.exec_())

    if FROZEN and os.path.abspath(sys.executable).lower() != INSTALL_EXE.lower():
        # File Setup.exe tải về, chạy lần đầu — hiện trình cài đặt
        dlg = InstallDialog(cfg)
        if dlg.exec_() == QDialog.Accepted and dlg.installed:
            spawn_detached([INSTALL_EXE])
        return

    # Chạy trực tiếp mã nguồn khi phát triển (python app.py)
    win = MainWindow(cfg, start_hidden=False)
    sys.exit(app.exec_())


if __name__ == '__main__':
    main()
