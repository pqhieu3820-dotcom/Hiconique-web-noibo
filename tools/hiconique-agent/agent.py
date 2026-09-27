"""
HICONIQUE Agent — ghi nhận ứng dụng đang dùng trên MÁY TÍNH CÔNG TY (công khai, nhân viên đã được thông báo).

Ghi gì: tên ứng dụng + tiêu đề cửa sổ đang mở phía trước, cộng dồn theo phút, chỉ trong giờ làm việc.
KHÔNG ghi: chụp màn hình, phím gõ, nội dung file/tin nhắn, clipboard, camera, micro.
Toàn bộ dữ liệu của mình nằm ở %LOCALAPPDATA%\\HiconiqueAgent\\hoat-dong-hom-nay.txt (đọc được) và trang
"Theo dõi hiệu suất" trên Hub. Chỉ dùng thư viện chuẩn của Python (Windows), không cần cài thêm gì.

Chạy:  pythonw agent.py        (nền, không cửa sổ)      |    python agent.py --once   (thử 1 lần, in ra màn hình)
"""
import ctypes
import json
import os
import re
import socket
import sys
import time
import urllib.parse
import urllib.request
from ctypes import wintypes
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.environ.get('LOCALAPPDATA', BASE), 'HiconiqueAgent')
os.makedirs(DATA_DIR, exist_ok=True)

DEFAULTS = {
    'apiUrl': 'https://script.google.com/macros/s/AKfycbzgg0dfNgDTFgcTGlNvF2IHLUusK6YuBk1pot9SrbYi5B9al-H2nmmMlKLz5CpDlLY/exec',
    'memberId': '',              # BẮT BUỘC: mã thành viên trên Hub của người dùng máy này
    'sampleSeconds': 15,         # tần suất kiểm tra cửa sổ đang mở
    'flushMinutes': 5,           # tần suất gửi lên Sheet
    'idleSeconds': 120,          # không chuột/phím quá lâu này thì tính "không thao tác", không ghi ứng dụng
    'workHours': '07:30-18:00',  # ngoài khung giờ này không ghi gì
    'workDays': [0, 1, 2, 3, 4, 5],  # 0=Thứ 2 ... 6=Chủ nhật
    'sendTitles': True,          # false = chỉ gửi tên ứng dụng, không gửi tiêu đề cửa sổ
    'topTitles': 5,              # số tiêu đề nhiều nhất giữ lại cho mỗi ứng dụng
}


def load_config():
    cfg = dict(DEFAULTS)
    p = os.path.join(BASE, 'config.json')
    if os.path.exists(p):
        with open(p, encoding='utf-8-sig') as f:
            cfg.update(json.load(f))
    return cfg


# ---------------- Windows API (ctypes) ----------------
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
kernel32.GetTickCount.restype = wintypes.DWORD


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


def notify(title, text):
    try:
        ctypes.windll.user32.MessageBoxW(0, text, title, 0x40 | 0x40000)  # ICONINFORMATION | TOPMOST
    except Exception:
        pass


# ---------------- Logic ----------------
PRIVATE_RE = re.compile(r'inprivate|incognito|ẩn danh|private browsing|mật khẩu|password', re.I)
SKIP_APPS = {'LockApp', 'LogonUI', 'ScreenClippingHost'}


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


def slug(s):
    return re.sub(r'[^A-Za-z0-9]+', '_', s).strip('_')[:40] or 'app'


def state_path(day):
    return os.path.join(DATA_DIR, 'state-%s.json' % day)


def load_state(day):
    try:
        with open(state_path(day), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'apps': {}, 'idleSec': 0}


def save_state(day, st):
    with open(state_path(day), 'w', encoding='utf-8') as f:
        json.dump(st, f, ensure_ascii=False)
    # Bản đọc được cho chính nhân viên
    lines = ['HICONIQUE Agent — ghi nhận ngày %s (cập nhật %s)' % (day, datetime.now().strftime('%H:%M')), '']
    for app, v in sorted(st['apps'].items(), key=lambda kv: -kv[1]['sec']):
        lines.append('%-28s %4d phút' % (app, round(v['sec'] / 60)))
        for t, s in sorted(v['titles'].items(), key=lambda kv: -kv[1])[:5]:
            lines.append('    - %s (%d phút)' % (t, round(s / 60)))
    lines.append('')
    lines.append('Không thao tác: %d phút' % round(st.get('idleSec', 0) / 60))
    with open(os.path.join(DATA_DIR, 'hoat-dong-hom-nay.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def flush(cfg, day, st):
    device = socket.gethostname()
    rows = []
    for app, v in st['apps'].items():
        if v['sec'] < 30:
            continue
        top = sorted(v['titles'].items(), key=lambda kv: -kv[1])[:cfg['topTitles']]
        rows.append({
            'id': 'app_%s_%s_%s_%s' % (cfg['memberId'], day, slug(device), slug(app)),
            'memberId': cfg['memberId'], 'date': day, 'device': device, 'app': app,
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
        print('Gửi thất bại, sẽ thử lại:', e)
        return False


def main():
    cfg = load_config()
    once = '--once' in sys.argv
    if not cfg['memberId']:
        notify('HICONIQUE Agent', 'Chưa cấu hình memberId trong config.json (xem README.md).')
        return
    day = datetime.now().strftime('%Y-%m-%d')
    st = load_state(day)
    if not once and not os.path.exists(os.path.join(DATA_DIR, 'da-thong-bao-' + day)):
        notify('HICONIQUE Agent',
               'HICONIQUE Agent đang chạy trên máy công ty này, trong giờ làm việc (%s).\n\n'
               'Ghi nhận: tên ứng dụng và tiêu đề cửa sổ đang dùng.\n'
               'KHÔNG ghi: màn hình, phím gõ, nội dung tin nhắn/tệp.\n\n'
               'Xem dữ liệu của bạn: %s\\hoat-dong-hom-nay.txt' % (cfg['workHours'], DATA_DIR))
        open(os.path.join(DATA_DIR, 'da-thong-bao-' + day), 'w').close()
    last_flush = time.time()
    step = cfg['sampleSeconds']
    while True:
        now = datetime.now()
        d = now.strftime('%Y-%m-%d')
        if d != day:            # sang ngày mới
            flush(cfg, day, st)
            day, st = d, load_state(d)
        if in_work_time(cfg, now):
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
                        if len(v['titles']) > 30:   # giữ file gọn: bỏ tiêu đề ít nhất
                            for k in sorted(v['titles'], key=v['titles'].get)[:10]:
                                del v['titles'][k]
            save_state(day, st)
            if once:
                print(open(os.path.join(DATA_DIR, 'hoat-dong-hom-nay.txt'), encoding='utf-8').read())
        elif once:
            print('Ngoài giờ làm việc theo cấu hình, không ghi gì.')
        if once:
            return
        if time.time() - last_flush >= cfg['flushMinutes'] * 60:
            if flush(cfg, day, st):
                last_flush = time.time()
            else:
                last_flush = time.time() - cfg['flushMinutes'] * 60 + 60  # thử lại sau ~1 phút
        time.sleep(step)


if __name__ == '__main__':
    main()
