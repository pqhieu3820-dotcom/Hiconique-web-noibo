"""
Đọc cấu hình phần cứng của máy (chỉ ĐỌC thông tin thiết bị, không đọc file/phần mềm cá nhân) qua PowerShell + CIM.
Không cần quyền quản trị: mục nào cần quyền cao (BitLocker, TPM chi tiết) sẽ không thu thập.
Kết quả: dict {specs:[{type,name,spec,qty}], live:[str], alerts:[str], brand, model, serial, os, bootedAt}.
  - specs: thông số ỔN ĐỊNH (dùng để so sánh thay đổi linh kiện, khớp mẫu linh kiện ở trang Thiết bị)
  - live: thông tin thay đổi theo ngày (dung lượng trống, sức khỏe ổ, % pin, driver...)
  - alerts: cảnh báo cần xử lý (ổ lỗi SMART, ổ đầy >90%, pin chai <60%, Windows chưa kích hoạt...)
"""
import base64
import json
import re
import subprocess
from datetime import datetime

EXTERNAL_BUS = {'USB', 'SD', 'MMC', '1394', 'ISCSI', 'FILE BACKED VIRTUAL', 'VIRTUAL', 'FIBRE CHANNEL', 'SPACES'}

PS = r"""
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function Mon($a) { if ($a) { -join ($a | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) } }
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$bb = Get-CimInstance Win32_BaseBoard
$cpu = @(Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, SocketDesignation, L3CacheSize)
$mem = @(Get-CimInstance Win32_PhysicalMemory | Select-Object Manufacturer, PartNumber, Capacity, Speed, ConfiguredClockSpeed, SMBIOSMemoryType)
$arr = Get-CimInstance Win32_PhysicalMemoryArray | Select-Object -First 1 MemoryDevices, MaxCapacity
$pd = @(Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, MediaType, BusType, Size, HealthStatus, SerialNumber)
# Phân loại từng ổ theo Win32_DiskDrive: ổ USB/ổ rời (InterfaceType USB, PNPDeviceID USBSTOR, MediaType External/Removable) bị loại; kèm danh sách ký tự ổ đĩa thuộc từng ổ vật lý
$dd = @(Get-CimInstance Win32_DiskDrive | ForEach-Object {
  $d = $_
  $usb = ($d.InterfaceType -eq 'USB') -or ("$($d.PNPDeviceID)" -like 'USBSTOR*') -or ("$($d.PNPDeviceID)" -like 'USB\*') -or ("$($d.MediaType)" -match 'External|Removable')
  $letters = @(Get-CimAssociatedInstance -InputObject $d -ResultClassName Win32_DiskPartition | ForEach-Object { Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_LogicalDisk } | ForEach-Object { $_.DeviceID })
  [pscustomobject]@{ Index = $d.Index; Model = $d.Model; Iface = $d.InterfaceType; Media = "$($d.MediaType)"; Usb = [bool]$usb; Letters = $letters }
})
$ld = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID, Size, FreeSpace)
$vr = @{}
Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0*' | ForEach-Object { if ($_.'HardwareInformation.qwMemorySize') { $vr[$_.DriverDesc] = [int64]$_.'HardwareInformation.qwMemorySize' } }
$gpu = @(Get-CimInstance Win32_VideoController | ForEach-Object { [pscustomobject]@{ Name = $_.Name; Vram = $vr[$_.Name]; AdapterRAM = $_.AdapterRAM; Driver = $_.DriverVersion; DriverDate = "$($_.DriverDate)"; W = $_.CurrentHorizontalResolution; H = $_.CurrentVerticalResolution } })
$mon = @(Get-CimInstance -Namespace root\wmi WmiMonitorID | ForEach-Object { [pscustomobject]@{ Manu = (Mon $_.ManufacturerName); Name = (Mon $_.UserFriendlyName); Year = $_.YearOfManufacture } })
$os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, InstallDate, LastBootUpTime
$lic = Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND Name LIKE 'Windows%'" | Select-Object -First 1 LicenseStatus
$bat = @(Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining)
$bs = Get-CimInstance -Namespace root\wmi BatteryStaticData | Select-Object -First 1 DesignedCapacity
$bf = Get-CimInstance -Namespace root\wmi BatteryFullChargedCapacity | Select-Object -First 1 FullChargedCapacity
$sb = $null
$sbv = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State').UEFISecureBootEnabled
if ($null -ne $sbv) { $sb = [bool]$sbv }
$tpm = [bool](Get-PnpDevice -FriendlyName '*Trusted Platform*' | Select-Object -First 1)
$net = @(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and -not $_.Virtual } | Select-Object InterfaceDescription, LinkSpeed, MacAddress)
$av = @(Get-CimInstance -Namespace root\SecurityCenter2 AntiVirusProduct | Select-Object displayName)
$kbd = @(Get-CimInstance Win32_Keyboard | Select-Object Name, Description, Manufacturer)
$mouse = @(Get-CimInstance Win32_PointingDevice | Select-Object Name, Description, Manufacturer, NumberOfButtons, PointingType)
[pscustomobject]@{
  Host = [System.Net.Dns]::GetHostName(); Manu = $cs.Manufacturer; Model = $cs.Model; Serial = $bios.SerialNumber; BiosVer = $bios.SMBIOSBIOSVersion
  BoardManu = $bb.Manufacturer; BoardProduct = $bb.Product; BoardSerial = $bb.SerialNumber
  Cpu = $cpu; Mem = $mem; MemSlots = $arr.MemoryDevices; MemMaxKB = $arr.MaxCapacity; Disks = $pd; DiskDrives = $dd; Logical = $ld; Gpu = $gpu; Mon = $mon
  OsCaption = $os.Caption; OsBuild = $os.BuildNumber; OsInstall = "$($os.InstallDate)"; OsBoot = "$($os.LastBootUpTime)"; LicStatus = $lic.LicenseStatus
  Battery = $bat; BatDesign = $bs.DesignedCapacity; BatFull = $bf.FullChargedCapacity; SecureBoot = $sb; Tpm = $tpm; Net = $net; Av = $av
  Kbd = $kbd; Mouse = $mouse
} | ConvertTo-Json -Depth 5 -Compress
"""

DDR = {20: 'DDR', 21: 'DDR2', 24: 'DDR3', 26: 'DDR4', 34: 'DDR5', 29: 'LPDDR3', 30: 'LPDDR4', 35: 'LPDDR5'}
MON_VENDOR = {'DEL': 'Dell', 'SAM': 'Samsung', 'GSM': 'LG', 'ACI': 'ASUS', 'AUS': 'ASUS', 'AOC': 'AOC', 'BNQ': 'BenQ', 'LEN': 'Lenovo',
              'HWP': 'HP', 'PHL': 'Philips', 'VSC': 'ViewSonic', 'MSI': 'MSI', 'GBT': 'Gigabyte', 'ACR': 'Acer', 'IVM': 'Iiyama', 'SNY': 'Sony'}
VIRTUAL_GPU = ('microsoft basic', 'remote', 'virtual', 'displaylink', 'parsec', 'meta virtual')


def _list(x):
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def _gb(b):
    b = float(b or 0)
    g = b / (1024 ** 3)
    return ('%.0f' % g if g >= 10 else '%.1f' % g).replace('.0', '') + 'GB'


def _cim_date(s):
    """'/Date(1699999999999)/' hoặc chuỗi ngày -> dd/mm/yyyy (hoặc '')."""
    try:
        s = str(s or '')
        if 'Date(' in s:
            ms = int(s.split('(')[1].split(')')[0].split('+')[0].split('-')[0])
            return datetime.fromtimestamp(ms / 1000).strftime('%d/%m/%Y')
        m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})', s)   # PowerShell trả mm/dd/yyyy -> dd/mm/yyyy
        if m:
            return '%02d/%02d/%s' % (int(m.group(2)), int(m.group(1)), m.group(3))
        return s[:10]
    except Exception:
        return ''


def collect(send_serials=True):
    enc = base64.b64encode(PS.encode('utf-16-le')).decode('ascii')
    p = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc],
                       capture_output=True, timeout=120, creationflags=0x08000000)
    out = p.stdout.decode('utf-8', errors='replace').strip()
    d = json.loads(out[out.index('{'):])
    specs, live, alerts = [], [], []

    def add(t, name, spec='', qty='1'):
        specs.append({'type': t, 'name': (name or '').strip(), 'spec': (spec or '').strip(), 'qty': str(qty)})

    for c in _list(d.get('Cpu')):
        cores, thr = c.get('NumberOfCores'), c.get('NumberOfLogicalProcessors')
        bits = ['%s nhân %s luồng' % (cores, thr) if cores else '', '%.1fGHz' % (float(c.get('MaxClockSpeed') or 0) / 1000) if c.get('MaxClockSpeed') else '',
                c.get('SocketDesignation') or '', 'L3 %dMB' % round(float(c['L3CacheSize']) / 1024) if c.get('L3CacheSize') else '']
        add('CPU', ' '.join((c.get('Name') or '').split()), ', '.join(b for b in bits if b))

    board = ' '.join(x for x in (d.get('BoardManu'), d.get('BoardProduct')) if x)
    slots = d.get('MemSlots')
    bspec = []
    if slots:
        bspec.append('%s/%s khe RAM đã dùng' % (len(_list(d.get('Mem'))), slots))
    if d.get('MemMaxKB'):
        bspec.append('tối đa %s' % _gb(float(d['MemMaxKB']) * 1024))
    add('Mainboard', board, ', '.join(bspec) + ((' · BIOS ' + d['BiosVer']) if d.get('BiosVer') else ''))

    ram = {}
    for m in _list(d.get('Mem')):
        typ = DDR.get(m.get('SMBIOSMemoryType'), '')
        speed = m.get('ConfiguredClockSpeed') or m.get('Speed')
        key = (' '.join(x for x in ((m.get('Manufacturer') or '').strip(), (m.get('PartNumber') or '').strip()) if x and x != 'Unknown'),
               ' '.join(x for x in (typ, ('%sMHz' % speed) if speed else '', _gb(m.get('Capacity'))) if x))
        ram[key] = ram.get(key, 0) + 1
    for (name, spec), q in ram.items():
        add('RAM', name, spec, q)

    # Chỉ ổ cứng gắn TRONG máy: bỏ ổ USB/ổ rời/thẻ nhớ/ổ ảo (VHD)/ổ mạng — dựa cả BusType của Get-PhysicalDisk lẫn
    # phân loại Win32_DiskDrive (theo số ổ), và chỉ giữ các phân vùng thuộc ổ trong máy.
    drives = _list(d.get('DiskDrives'))
    external_idx = set(str(x.get('Index')) for x in drives if x.get('Usb'))
    internal_letters = set()
    for x in drives:
        if not x.get('Usb'):
            internal_letters.update(str(v).upper() for v in _list(x.get('Letters')))
    physical = _list(d.get('Disks'))
    for k in physical:
        bus = str(k.get('BusType') or '')
        media = str(k.get('MediaType') or '')
        if bus.upper() in EXTERNAL_BUS or str(k.get('DeviceId')) in external_idx:
            continue
        is_ssd = media == 'SSD' or bus.upper() == 'NVME' or media == 'SCM'
        add('SSD' if is_ssd else 'HDD', k.get('FriendlyName'), ' '.join(x for x in (_gb(k.get('Size')), bus if bus and bus != 'Unknown' else '') if x))
        hs = str(k.get('HealthStatus') or '')
        live.append('Ổ %s: %s' % (k.get('FriendlyName'), hs or 'không rõ'))
        if hs and hs.lower() not in ('healthy', '0'):
            alerts.append('Ổ cứng %s báo sức khỏe: %s' % (k.get('FriendlyName'), hs))

    logical = _list(d.get('Logical'))
    parts = []
    for l in logical:
        size, free = float(l.get('Size') or 0), float(l.get('FreeSpace') or 0)
        if size <= 0:
            continue
        if internal_letters and str(l.get('DeviceID')).upper() not in internal_letters:
            continue   # phân vùng của ổ USB/ổ rời
        parts.append('%s %s' % (l['DeviceID'], _gb(size)))
        live.append('%s trống %s/%s' % (l['DeviceID'], _gb(free), _gb(size)))
        if (size - free) / size > 0.9:
            alerts.append('Ổ %s đầy %d%% (trống %s)' % (l['DeviceID'], round((size - free) / size * 100), _gb(free)))
    if parts:
        add('Phân vùng ổ đĩa', '', ' · '.join(parts))

    for g in _list(d.get('Gpu')):
        n = (g.get('Name') or '').strip()
        if not n or any(v in n.lower() for v in VIRTUAL_GPU):
            continue
        vram = g.get('Vram') or (g.get('AdapterRAM') if (g.get('AdapterRAM') or 0) > 0 else 0)
        add('VGA / Card đồ họa', n, ('VRAM ' + _gb(vram)) if vram else '')
        if g.get('Driver'):
            live.append('Driver %s: %s (%s)' % (n, g['Driver'], _cim_date(g.get('DriverDate'))))

    res = ''
    for g in _list(d.get('Gpu')):
        if g.get('W') and g.get('H'):
            res = '%sx%s' % (g['W'], g['H'])
            break
    for m in _list(d.get('Mon')):
        vendor = MON_VENDOR.get(m.get('Manu'), m.get('Manu') or '')
        mname = m.get('Name') or ''
        name = mname if mname.lower().startswith(vendor.lower()) else ' '.join(x for x in (vendor, mname) if x)
        if name:
            add('Màn hình', name, ' · '.join(x for x in (res, ('SX %s' % m['Year']) if m.get('Year') else '') if x))

    add('Hệ điều hành', d.get('OsCaption'), ('cài ' + _cim_date(d.get('OsInstall'))) if d.get('OsInstall') else '')
    live.append('Windows build %s%s' % (d.get('OsBuild') or '?', ' · đã kích hoạt' if d.get('LicStatus') == 1 else ''))
    if d.get('LicStatus') is not None and d.get('LicStatus') != 1:
        alerts.append('Windows chưa được kích hoạt bản quyền')

    bat = _list(d.get('Battery'))
    if bat:
        design, full = d.get('BatDesign'), d.get('BatFull')
        if design and full:
            pct = round(float(full) / float(design) * 100)
            add('Pin laptop', '', 'Thiết kế %s mWh' % design)
            live.append('Pin: dung lượng hiện tại %s%% so với thiết kế' % pct)
            if pct < 60:
                alerts.append('Pin chai còn %d%% dung lượng thiết kế' % pct)
        else:
            add('Pin laptop', '', '')

    sec = ['TPM: %s' % ('có' if d.get('Tpm') else 'không thấy'),
           'Secure Boot: %s' % ('bật' if d.get('SecureBoot') is True else 'tắt' if d.get('SecureBoot') is False else 'không rõ')]
    add('Bảo mật', '', ' · '.join(sec))
    if d.get('SecureBoot') is False:
        alerts.append('Secure Boot đang tắt')

    nets = _list(d.get('Net'))
    if nets:
        add('Card mạng / Wifi', ' / '.join(n.get('InterfaceDescription') or '' for n in nets[:2]),
            ' · '.join(x for x in ([(nets[0].get('LinkSpeed') or '')] + ([nets[0].get('MacAddress')] if send_serials and nets[0].get('MacAddress') else [])) if x))
    av = [a.get('displayName') for a in _list(d.get('Av')) if a.get('displayName')]
    if av:
        add('Diệt virus', ', '.join(sorted(set(av))), '')

    # Bàn phím / chuột: Windows chỉ báo tên thiết bị HID (thường chung chung, không phải tên hãng thật) và
    # HAY liệt kê TRÙNG cùng 1 thiết bị vật lý thành nhiều dòng driver khác nhau (đặc thù driver stack của
    # Windows) — nên KHÔNG dùng số lần lặp làm số lượng thật (dễ báo sai, ví dụ 1 bàn phím thành "5 cái"),
    # chỉ liệt kê từng tên riêng biệt đã thấy, số lượng luôn để 1.
    def _hid_name(dev, generic_prefix):
        manu = (dev.get('Manufacturer') or '').strip()
        if manu.lower().startswith('(standard'):
            manu = ''
        name = (dev.get('Name') or dev.get('Description') or '').strip()
        full = ' '.join(x for x in (manu, name) if x)
        return full if full and 'remote' not in full.lower() and 'terminal' not in full.lower() else ''

    seen_kbd = []
    for k in _list(d.get('Kbd')):
        name = _hid_name(k, '')
        if name and name not in seen_kbd:
            seen_kbd.append(name)
    for name in seen_kbd:
        add('Bàn phím', name, '', 1)

    ptype_names = {2: '', 3: 'Track ball', 4: 'Track point', 5: 'Glide point', 6: 'Touchpad', 7: 'Cảm ứng'}
    seen_mouse = []
    for m in _list(d.get('Mouse')):
        name = _hid_name(m, '')
        if not name:
            continue
        spec = ptype_names.get(m.get('PointingType'), '')
        if m.get('NumberOfButtons'):
            spec = (spec + (' · ' if spec else '') + '%s nút' % m['NumberOfButtons'])
        key = (name, spec)
        if key not in seen_mouse:
            seen_mouse.append(key)
    for name, spec in seen_mouse:
        add('Chuột', name, spec, 1)

    boot = d.get('OsBoot') or ''
    return {
        'hostname': d.get('Host') or '', 'brand': d.get('Manu') or '', 'model': d.get('Model') or '',
        'serial': (d.get('Serial') or '') if send_serials else '', 'os': d.get('OsCaption') or '',
        'specs': specs, 'live': live, 'alerts': alerts, 'bootedAt': _cim_date(boot),
    }


if __name__ == '__main__':
    print(json.dumps(collect(), ensure_ascii=False, indent=2))
