/* HiconiqueTrash — nút "Thùng rác" + cửa sổ danh sách mục đã xoá cho từng hạng mục tiền (đơn hàng, giao dịch, công nợ, phiếu lương, hoa hồng).
   Gắn tự động vào mọi phần tử <span class="hq-trash-slot" data-kind="orders|financeEntries|receivables|payslips|commissions|bsSnapshots">.
   Dữ liệu: TaskManager.getTrash/trashRestore/trashPurge (task-data.js). Mục nằm trong thùng rác 60 ngày rồi tự xoá hẳn trên Google Sheet.
   Sau khi khôi phục/xoá hẳn gọi window dispatch 'hiconique:data-refreshed' để trang vẽ lại. */
(function () {
  'use strict';
  var TM = window.TaskManager;
  if (!TM || !TM.getTrash) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function user() {
    var s = (window.Auth && Auth.getCurrentUser) ? Auth.getCurrentUser() : null;
    if (!s) return null;
    var f = TM.getMember ? TM.getMember(s.id) : null;
    return f ? Object.assign({}, s, f) : s;
  }
  function vnDate(iso) { var d = new Date(iso); if (isNaN(d)) return String(iso || '').slice(0, 10); var p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function notifyRefresh() { try { window.dispatchEvent(new CustomEvent('hiconique:data-refreshed')); } catch (e) { /* bỏ qua */ } }

  // Nút thùng rác gọn: chỉ icon vuông 32px (có chú thích khi rê chuột); có mục trong thùng thì hiện chấm số nhỏ ở góc. Nút "Xoá hẳn tất cả" trong hộp thoại vẫn dùng kiểu chữ.
  var CSS = '.hq-trash-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:32px;height:32px;padding:0 9px;border-radius:9px;border:1px solid var(--color-border);background:transparent;color:var(--color-text-muted);font-family:inherit;font-size:.75rem;font-weight:600;line-height:1;cursor:pointer;white-space:nowrap;transition:border-color .15s,color .15s}' +
    '.hq-trash-btn[data-icon]{width:32px;padding:0}.hq-trash-btn:hover{border-color:var(--color-bronze);color:var(--color-bronze)}.hq-trash-btn svg{width:15px;height:15px;flex:none}' +
    '.hq-trash-btn .n{position:absolute;top:-7px;right:-7px;min-width:16px;height:16px;box-sizing:border-box;padding:0 4px;display:flex;align-items:center;justify-content:center;background:var(--color-bronze);color:#0B0D10;border-radius:999px;font-size:.625rem;font-weight:700;line-height:1;border:2px solid var(--color-surface)}' +
    '.hq-tr-ov{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;overflow:auto}' +
    '.hq-tr-box{background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;width:100%;max-width:820px;color:var(--color-text)}' +
    '.hq-tr-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 22px;border-bottom:1px solid var(--color-border)}.hq-tr-head h3{margin:0;font-size:1.0625rem}.hq-tr-head p{margin:4px 0 0;font-size:.75rem;color:var(--color-text-muted);line-height:1.5}' +
    '.hq-tr-x{border:none;background:transparent;color:var(--color-text-muted);font-size:1.5rem;line-height:1;cursor:pointer}' +
    '.hq-tr-row{display:grid;grid-template-columns:1fr auto;gap:6px 16px;padding:14px 22px;border-bottom:1px solid var(--color-border);align-items:center}.hq-tr-row:last-child{border-bottom:none}' +
    '.hq-tr-t{font-weight:600;font-size:.875rem;line-height:1.4}.hq-tr-s{font-size:.75rem;color:var(--color-text-muted);margin-top:3px;line-height:1.5}.hq-tr-s b{color:var(--color-text)}' +
    '.hq-tr-m{font-family:"JetBrains Mono",monospace;font-weight:700;color:var(--color-bronze);text-align:right;white-space:nowrap}' +
    '.hq-tr-act{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}.hq-tr-act button{padding:6px 14px;border-radius:8px;border:1px solid var(--color-border);background:transparent;color:var(--color-text);font:600 .75rem inherit;font-family:inherit;cursor:pointer}' +
    '.hq-tr-act .ok{background:var(--color-bronze);border-color:var(--color-bronze);color:#0B0D10}.hq-tr-act .bad{border-color:#C75B5B;color:#C75B5B}' +
    '.hq-tr-left{display:inline-block;padding:1px 8px;border-radius:999px;border:1px solid var(--color-border);font-size:.6875rem}.hq-tr-left.low{border-color:#C75B5B;color:#C75B5B}' +
    '.hq-tr-empty{padding:40px 22px;text-align:center;color:var(--color-text-muted);font-size:.875rem}.hq-tr-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:14px 22px;border-top:1px solid var(--color-border);background:var(--color-bg);border-radius:0 0 16px 16px;font-size:.75rem;color:var(--color-text-muted)}';
  function ensureCss() { if (document.getElementById('hqTrashCss')) return; var s = document.createElement('style'); s.id = 'hqTrashCss'; s.textContent = CSS; document.head.appendChild(s); }
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';

  function open(kind, title) {
    ensureCss();
    var u = user(); if (!u) return;
    try { TM.purgeExpiredTrash(u); } catch (e) { /* bỏ qua */ }
    var ov = document.createElement('div'); ov.className = 'hq-tr-ov';
    function close() { ov.remove(); notifyRefresh(); }
    function draw() {
      var list = TM.getTrash(kind, u);
      ov.innerHTML = '<div class="hq-tr-box"><div class="hq-tr-head"><div><h3>🗑 Thùng rác — ' + esc(title || TM.TRASH_LABELS[kind]) + '</h3><p>Mục đã xoá được giữ <b>' + TM.TRASH_DAYS + ' ngày</b> rồi tự xoá hẳn trên Google Sheet. Có thể <b>khôi phục</b> hoặc <b>xoá hẳn</b> ngay (không hoàn tác được).</p></div><button class="hq-tr-x" type="button" aria-label="Đóng">×</button></div>' +
        (list.length ? list.map(function (r) {
          return '<div class="hq-tr-row" data-id="' + esc(r.id) + '"><div><div class="hq-tr-t">' + esc(r.title) + '</div><div class="hq-tr-s">' + (r.sub ? esc(r.sub) + ' · ' : '') + 'Xoá bởi <b>' + esc(r.deletedByName || '—') + '</b> lúc ' + vnDate(r.deletedAt) + ' · <span class="hq-tr-left' + (r.daysLeft <= 7 ? ' low' : '') + '">còn ' + r.daysLeft + ' ngày</span></div></div>' +
            '<div class="hq-tr-m">' + esc(r.money || '') + '</div><div class="hq-tr-act"><button class="ok" data-act="restore" type="button">Khôi phục</button><button class="bad" data-act="purge" type="button">Xoá hẳn</button></div></div>';
        }).join('') : '<div class="hq-tr-empty">Thùng rác trống.</div>') +
        '<div class="hq-tr-foot"><span>' + list.length + ' mục</span>' + (list.length ? '<button class="hq-trash-btn" data-act="purgeall" type="button" style="border-color:#C75B5B;color:#C75B5B">Xoá hẳn tất cả</button>' : '') + '</div></div>';
      ov.querySelector('.hq-tr-x').addEventListener('click', close);
    }
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { close(); return; }
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act'), row = b.closest('.hq-tr-row'), id = row && row.getAttribute('data-id');
      if (act === 'restore') { TM.trashRestore(kind, id, u); draw(); notifyRefresh(); }
      else if (act === 'purge') { if (confirm('Xoá HẲN mục này khỏi Google Sheet? Không hoàn tác được.')) { TM.trashPurge(kind, id, u); draw(); notifyRefresh(); } }
      else if (act === 'purgeall') { var l = TM.getTrash(kind, u); if (l.length && confirm('Xoá HẲN ' + l.length + ' mục trong thùng rác khỏi Google Sheet? Không hoàn tác được.')) { l.forEach(function (r) { TM.trashPurge(kind, r.id, u); }); draw(); notifyRefresh(); } }
    });
    document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', esc_); if (ov.parentNode) close(); } });
    document.body.appendChild(ov); draw();
  }

  function mount(slot) {
    if (slot.getAttribute('data-mounted')) return;
    slot.setAttribute('data-mounted', '1');
    var kind = slot.getAttribute('data-kind'), title = slot.getAttribute('data-title') || '';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'hq-trash-btn'; btn.setAttribute('data-icon', '1'); btn.setAttribute('aria-label', 'Thùng rác'); btn.title = 'Thùng rác — xem / khôi phục mục đã xoá (giữ 60 ngày)';
    btn.addEventListener('click', function (e) { e.stopPropagation(); open(kind, title); });
    slot.appendChild(btn); slot._btn = btn; slot._kind = kind;
    paint(slot);
  }
  function paint(slot) {
    var u = user(); if (!u || !slot._btn) return;
    var n = 0; try { n = TM.trashCount(slot._kind, u); } catch (e) { n = 0; }
    var h = ICON + (n ? '<span class="n">' + (n > 99 ? '99+' : n) + '</span>' : '');
    if (slot._h !== h) { slot._h = h; slot._btn.innerHTML = h; }   // chỉ ghi khi đổi → MutationObserver không tự kích hoạt vòng lặp
  }
  function scan() { ensureCss(); Array.prototype.forEach.call(document.querySelectorAll('.hq-trash-slot'), function (s) { if (!s.getAttribute('data-mounted')) mount(s); else paint(s); }); }

  var timer = null;
  function later() { clearTimeout(timer); timer = setTimeout(scan, 150); }
  window.addEventListener('hiconique:data-refreshed', later);
  document.addEventListener('DOMContentLoaded', function () { scan(); try { new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* bỏ qua */ } });
  if (document.readyState !== 'loading') { scan(); try { new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* bỏ qua */ } }
  window.HiconiqueTrash = { open: open, scan: scan };
})();
