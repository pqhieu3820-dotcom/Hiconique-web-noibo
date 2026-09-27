"""
HICONIQUE Agent — ứng dụng Windows (1 file .exe): tự cài, chạy nền, tự cập nhật, gỡ như ứng dụng bình thường.
Công khai với nhân viên: hiện thông báo khi cài/khởi động, dữ liệu của chính mình đọc được ở
%LOCALAPPDATA%\\HiconiqueAgent\\hoat-dong-hom-nay.txt. Chỉ cài trên máy công ty, có sự đồng ý của người dùng.

Ghi gì: tên ứng dụng + tiêu đề cửa sổ đang mở phía trước, cộng dồn theo phút, chỉ trong giờ làm việc.
KHÔNG ghi: chụp màn hình, phím gõ, nội dung file/tin nhắn, clipboard, camera, micro.

Chế độ (cùng 1 file exe):
  HiconiqueAgent.exe               chưa cài -> mở trình cài đặt | đã cài -> chạy nền
  HiconiqueAgent.exe --run         chạy nền (Windows tự gọi khi đăng nhập)
  HiconiqueAgent.exe --uninstall   gỡ cài đặt (mục "Apps & features" của Windows cũng gọi lệnh này)
  python agent.py --once           (khi phát triển) ghi 1 lần và in ra màn hình
"""
import ctypes
import hashlib
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
import urllib.parse
import urllib.request
from ctypes import wintypes
from datetime import datetime

VERSION = '1.0.0'
APP_NAME = 'HiconiqueAgent'
FROZEN = getattr(sys, 'frozen', False)
BASE = os.path.dirname(os.path.abspath(sys.executable if FROZEN else __file__))
LOCAL = os.environ.get('LOCALAPPDATA', BASE)
DATA_DIR = os.path.join(LOCAL, 'HiconiqueAgent')                       # cấu hình + nhật ký + dữ liệu trong ngày
INSTALL_DIR = os.path.join(LOCAL, 'Programs', 'HiconiqueAgent')        # nơi đặt file exe đã cài
INSTALL_EXE = os.path.join(INSTALL_DIR, 'HiconiqueAgent.exe')
RUN_KEY = r'Software\Microsoft\Windows\CurrentVersion\Run'
UNINSTALL_KEY = r'Software\Microsoft\Windows\CurrentVersion\Uninstall\HiconiqueAgent'
os.makedirs(DATA_DIR, exist_ok=True)

SITE = 'https://hiconique-web-noibo.pqhieu3820.workers.dev/'
DEFAULTS = {
    'apiUrl': 'https://script.google.com/macros/s/AKfycbzgg0dfNgDTFgcTGlNvF2IHLUusK6YuBk1pot9SrbYi5B9al-H2nmmMlKLz5CpDlLY/exec',
    'memberId': '',              # mã thành viên trên Hub của người dùng máy này (trình cài đặt điền sẵn)
    'sampleSeconds': 15,         # tần suất kiểm tra cửa sổ đang mở
    'flushMinutes': 5,           # tần suất gửi lên Sheet
    'idleSeconds': 120,          # không chuột/phím quá lâu này thì tính "không thao tác", không ghi ứng dụng
    'workHours': '07:30-18:00',  # ngoài khung giờ này không ghi gì
    'workDays': [0, 1, 2, 3, 4, 5],  # 0=Thứ 2 ... 6=Chủ nhật
    'sendTitles': True,          # false = chỉ gửi tên ứng dụng, không gửi tiêu đề cửa sổ
    'topTitles': 5,              # số tiêu đề nhiều nhất giữ lại cho mỗi ứng dụng
    'updateUrl': SITE + 'agent/latest.json',   # {"version","url","sha256"}; chỉ nhận file tải từ SITE (https)
    'updateCheckHours': 6,
}


def log(*a):
    try:
        p = os.path.join(DATA_DIR, 'agent.log')
        if os.path.exists(p) and os.path.getsize(p) > 200000:
            os.replace(p, p + '.old')
        with open(p, 'a', encoding='utf-8') as f:
            f.write('%s %s\n' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), ' '.join(str(x) for x in a)))
        if not FROZEN:
            print(*a)
    except Exception:
        pass


def load_config():
    cfg = dict(DEFAULTS)
    for p in (os.path.join(BASE, 'config.json'), os.path.join(DATA_DIR, 'config.json')):
        if os.path.exists(p):
            try:
                with open(p, encoding='utf-8-sig') as f:
                    cfg.update(json.load(f))
            except Exception as e:
                log('config lỗi', p, e)
    return cfg


def save_config(cfg):
    keep = {k: cfg[k] for k in ('memberId', 'workHours', 'workDays', 'sendTitles') if k in cfg}
    with open(os.path.join(DATA_DIR, 'config.json'), 'w', encoding='utf-8') as f:
        json.dump(keep, f, ensure_ascii=False, indent=2)


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
kernel32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
kernel32.CreateMutexW.restype = wintypes.HANDLE


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


def msgbox(title, text, flags=0x40):
    """flags: 0x40 info | 0x24 hỏi Có/Không (trả 6 = Có) | 0x10 lỗi; luôn hiện trên cùng."""
    try:
        return ctypes.windll.user32.MessageBoxW(0, text, title, flags | 0x40000)
    except Exception:
        return 0


def spawn_detached(args):
    env = dict(os.environ)
    env['PYINSTALLER_RESET_ENVIRONMENT'] = '1'  # để bản exe mới không dùng lại thư mục tạm của bản cũ
    subprocess.Popen(args, env=env, close_fds=True, creationflags=0x00000008 | 0x00000200)  # DETACHED | NEW_GROUP


def single_instance(wait=0):
    """Chỉ cho 1 bản agent chạy cùng lúc. wait = số giây chờ bản cũ thoát (khi tự cập nhật)."""
    end = time.time() + wait
    while True:
        h = kernel32.CreateMutexW(None, False, 'Local\\HiconiqueAgentMutex')
        if ctypes.get_last_error() != 183:  # ERROR_ALREADY_EXISTS
            return h
        if h:
            kernel32.CloseHandle(h)
        if time.time() >= end:
            return None
        time.sleep(0.5)


# ---------------- Ghi nhận ứng dụng ----------------
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
    lines = ['HICONIQUE Agent %s — ghi nhận ngày %s (cập nhật %s)' % (VERSION, day, datetime.now().strftime('%H:%M')), '']
    for app, v in sorted(st['apps'].items(), key=lambda kv: -kv[1]['sec']):
        lines.append('%-28s %4d phút' % (app, round(v['sec'] / 60)))
        for t, s in sorted(v['titles'].items(), key=lambda kv: -kv[1])[:5]:
            lines.append('    - %s (%d phút)' % (t, round(s / 60)))
    lines.append('')
    lines.append('Không thao tác: %d phút' % round(st.get('idleSec', 0) / 60))
    with open(os.path.join(DATA_DIR, 'hoat-dong-hom-nay.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


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
        log('Gửi thất bại, sẽ thử lại:', e)
        return False


# ---------------- Tự cập nhật ----------------
def vtuple(v):
    return tuple(int(x) for x in re.findall(r'\d+', str(v))[:4])


def check_update(cfg):
    """Tải latest.json; nếu có bản mới thì tải, kiểm SHA-256, thay file exe rồi chạy lại. Chỉ chạy khi đã đóng gói (.exe)."""
    if not FROZEN:
        return
    try:
        with urllib.request.urlopen(cfg['updateUrl'], timeout=30) as r:
            info = json.loads(r.read().decode('utf-8'))
        if vtuple(info['version']) <= vtuple(VERSION):
            return
        url = info['url']
        if not url.startswith(SITE):       # chỉ tải từ máy chủ Hub của công ty
            log('Bỏ qua bản cập nhật: URL lạ', url)
            return
        tmp = os.path.join(DATA_DIR, 'update.exe')
        h = hashlib.sha256()
        with urllib.request.urlopen(url, timeout=300) as r, open(tmp, 'wb') as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                h.update(chunk)
                f.write(chunk)
        if h.hexdigest().lower() != str(info['sha256']).lower():
            log('Bản cập nhật sai mã SHA-256, hủy')
            os.remove(tmp)
            return
        exe = sys.executable
        old = exe + '.old'
        if os.path.exists(old):
            os.remove(old)
        os.replace(exe, old)               # Windows cho đổi tên file exe đang chạy
        shutil.copy2(tmp, exe)
        os.remove(tmp)
        log('Đã cập nhật', VERSION, '->', info['version'], '- khởi động lại')
        spawn_detached([exe, '--run', '--after-update'])
        os._exit(0)
    except Exception as e:
        log('Kiểm tra cập nhật lỗi:', e)


# ---------------- Vòng lặp chạy nền ----------------
def run_agent(after_update=False):
    cfg = load_config()
    if not cfg['memberId']:
        msgbox('HICONIQUE Agent', 'Chưa có mã thành viên. Hãy chạy lại trình cài đặt (HiconiqueAgentSetup.exe).', 0x10)
        return
    if not single_instance(wait=15 if after_update else 0):
        return
    try:
        old = sys.executable + '.old'
        if FROZEN and os.path.exists(old):
            os.remove(old)
    except Exception:
        pass
    once = '--once' in sys.argv
    day = datetime.now().strftime('%Y-%m-%d')
    st = load_state(day)
    cleanup_old_days()
    if not once and not os.path.exists(os.path.join(DATA_DIR, 'da-thong-bao-' + day)):
        open(os.path.join(DATA_DIR, 'da-thong-bao-' + day), 'w').close()
        threading.Thread(target=msgbox, args=('HICONIQUE Agent',
            'HICONIQUE Agent đang chạy trên máy công ty này, trong giờ làm việc (%s).\n\n'
            'Ghi nhận: tên ứng dụng và tiêu đề cửa sổ đang dùng.\n'
            'KHÔNG ghi: màn hình, phím gõ, nội dung tin nhắn/tệp.\n\n'
            'Xem dữ liệu của bạn: %s\\hoat-dong-hom-nay.txt\n'
            'Gỡ cài đặt: Cài đặt Windows > Ứng dụng > HICONIQUE Agent.' % (cfg['workHours'], DATA_DIR)), daemon=True).start()
    last_flush = time.time()
    last_update = 0 if not after_update else time.time()
    step = cfg['sampleSeconds']
    while True:
        now = datetime.now()
        d = now.strftime('%Y-%m-%d')
        if d != day:            # sang ngày mới
            flush(cfg, day, st)
            day, st = d, load_state(d)
            cleanup_old_days()
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
        if time.time() - last_update >= cfg['updateCheckHours'] * 3600:
            last_update = time.time()
            check_update(cfg)
        time.sleep(step)


# ---------------- Cài đặt / gỡ cài đặt ----------------
def register_windows():
    import winreg
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
        winreg.SetValueEx(k, APP_NAME, 0, winreg.REG_SZ, '"%s" --run' % INSTALL_EXE)
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY) as k:
        for name, val in (('DisplayName', 'HICONIQUE Agent'), ('DisplayVersion', VERSION), ('Publisher', 'HICONIQUE'),
                          ('InstallLocation', INSTALL_DIR), ('DisplayIcon', INSTALL_EXE),
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


def fetch_members(cfg):
    try:
        with urllib.request.urlopen(cfg['apiUrl'] + '?action=getMembers', timeout=25) as r:
            items = json.loads(r.read().decode('utf-8'))
        out = []
        for m in items:
            if m.get('id') and m.get('name') and m.get('visible', True) is not False:
                out.append((str(m['name']), str(m['id'])))
        return sorted(out)
    except Exception as e:
        log('Không tải được danh sách thành viên:', e)
        return []


def install_ui():
    import tkinter as tk
    from tkinter import ttk
    cfg = load_config()
    root = tk.Tk()
    root.title('Cài đặt HICONIQUE Agent %s' % VERSION)
    root.geometry('520x470')
    root.resizable(False, False)
    pad = {'padx': 18, 'anchor': 'w'}
    tk.Label(root, text='HICONIQUE Agent', font=('Segoe UI', 15, 'bold')).pack(pady=(16, 2), **pad)
    tk.Label(root, justify='left', wraplength=480, font=('Segoe UI', 9), text=(
        'Ứng dụng chạy nền trên máy tính CÔNG TY, ghi nhận thời gian sử dụng ứng dụng trong giờ làm việc để công ty hỗ trợ phân bổ công việc.\n\n'
        'Có ghi: tên ứng dụng và tiêu đề cửa sổ đang mở (cửa sổ ẩn danh bị che), chỉ trong giờ làm việc (%s).\n'
        'KHÔNG ghi: màn hình, phím gõ, nội dung tin nhắn/tệp, clipboard, camera, micro.\n\n'
        'Bạn đọc được dữ liệu của mình tại: %s\\hoat-dong-hom-nay.txt. Gỡ cài đặt bất cứ lúc nào trong Cài đặt Windows > Ứng dụng.'
        % (cfg['workHours'], DATA_DIR))).pack(**pad)
    tk.Label(root, text='Chọn tên của bạn:', font=('Segoe UI', 10, 'bold')).pack(pady=(14, 2), **pad)
    combo = ttk.Combobox(root, width=52, state='normal')
    combo.pack(padx=18, anchor='w')
    combo.set('Đang tải danh sách…')
    hint = tk.Label(root, text='Nếu không thấy tên, hãy nhập mã thành viên (xem sheet NS-Thành viên).', font=('Segoe UI', 8), fg='#666')
    hint.pack(**pad)
    members = {}

    def load():
        ms = fetch_members(cfg)
        members.update({'%s (%s)' % (n, i): i for n, i in ms})
        combo['values'] = list(members.keys())
        combo.set('')
    root.after(200, load)

    agree = tk.BooleanVar(value=False)
    tk.Checkbutton(root, variable=agree, wraplength=470, justify='left', font=('Segoe UI', 9),
                   text='Tôi đã đọc và đồng ý để công ty ghi nhận như trên trên máy tính công ty này.').pack(pady=(14, 6), **pad)
    status = tk.Label(root, text='', fg='#B00020', font=('Segoe UI', 9))
    status.pack(**pad)

    def do_install():
        sel = combo.get().strip()
        member = members.get(sel) or sel
        if not member or member.startswith('Đang tải'):
            status.config(text='Hãy chọn tên hoặc nhập mã thành viên.')
            return
        if not agree.get():
            status.config(text='Cần tích đồng ý trước khi cài đặt.')
            return
        btn.config(state='disabled')
        try:
            subprocess.run(['taskkill', '/F', '/FI', 'IMAGENAME eq HiconiqueAgent.exe', '/FI', 'PID ne %d' % os.getpid(), '/FI', 'PID ne %d' % os.getppid()],
                           capture_output=True, creationflags=0x08000000)  # đóng bản cũ (nếu cài đè)
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
            spawn_detached([INSTALL_EXE, '--run'])
            msgbox('HICONIQUE Agent', 'Cài đặt xong. HICONIQUE Agent đang chạy nền và sẽ tự khởi động cùng Windows, tự cập nhật.\n\n'
                   'Gỡ cài đặt: Cài đặt Windows > Ứng dụng > HICONIQUE Agent.')
            root.destroy()
        except Exception as e:
            log('Cài đặt lỗi:', e)
            status.config(text='Lỗi cài đặt: %s' % e)
            btn.config(state='normal')

    btn = tk.Button(root, text='Cài đặt', width=16, height=2, bg='#B08D57', fg='white', font=('Segoe UI', 10, 'bold'), command=do_install)
    btn.pack(pady=8)
    root.mainloop()


def uninstall():
    if msgbox('Gỡ HICONIQUE Agent', 'Gỡ HICONIQUE Agent khỏi máy này và xóa dữ liệu ghi nhận trên máy?', 0x24) != 6:
        return
    unregister_windows()
    subprocess.run(['taskkill', '/F', '/FI', 'IMAGENAME eq HiconiqueAgent.exe', '/FI', 'PID ne %d' % os.getpid(), '/FI', 'PID ne %d' % os.getppid()],
                   capture_output=True, creationflags=0x08000000)
    bat = os.path.join(tempfile.gettempdir(), 'hiconique_uninstall.bat')
    with open(bat, 'w', encoding='utf-8') as f:
        f.write('@echo off\nping -n 4 127.0.0.1 >nul\nrmdir /s /q "%s"\nrmdir /s /q "%s"\ndel "%%~f0"\n' % (INSTALL_DIR, DATA_DIR))
    subprocess.Popen(['cmd', '/c', bat], creationflags=0x08000000 | 0x00000008, close_fds=True)
    msgbox('HICONIQUE Agent', 'Đã gỡ cài đặt HICONIQUE Agent.')


def main():
    args = sys.argv[1:]
    if '--uninstall' in args:
        uninstall()
    elif '--run' in args or '--once' in args:
        run_agent(after_update='--after-update' in args)
    elif FROZEN and os.path.abspath(sys.executable).lower() == INSTALL_EXE.lower():
        run_agent()
    elif FROZEN:
        install_ui()
    else:
        run_agent()  # chạy trực tiếp từ mã nguồn khi phát triển (cần config.json)


if __name__ == '__main__':
    main()
