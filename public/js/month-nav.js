/**
 * HiconiqueMonthNav — cụm điều hướng tháng dùng chung: mũi tên trái/phải,
 * nhãn "Tháng X Năm YYYY" (bấm mở bảng chọn nhanh 12 tháng + điều hướng
 * năm), nút "Hôm nay", và lăn chuột để đổi tháng — đồng bộ với Gantt/
 * Timeline/Lịch chấm công. Dùng để thay các <input type="month"> gốc
 * (finance/commission/payslip — tiếng Anh, không lăn chuột được).
 *
 * mount(inputEl) ẩn input gốc và chèn UI mới ngay trước nó, đồng bộ 2
 * chiều qua inputEl.value ("YYYY-MM") + sự kiện 'change' trên chính input
 * đó — code cũ đọc/ghi monthInput.value và monthInput.addEventListener(
 * 'change', ...) không cần sửa gì thêm.
 */
var HiconiqueMonthNav = (function () {
  'use strict';

  var MONTH_NAMES = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
  var uid = 0;

  function pad2(n) { return String(n).padStart(2, '0'); }

  // opts.max: 'YYYY-MM' (hoặc hàm trả về) = tháng muộn nhất được chọn — mũi tên, lăn chuột, bảng chọn nhanh và "Hôm nay" đều bị chặn ở mốc này.
  function mount(inputEl, opts) {
    opts = opts || {};
    if (!inputEl || inputEl.dataset.hqMounted) return null;
    inputEl.dataset.hqMounted = '1';
    uid++;
    var idPrefix = 'hqMonthNav' + uid;

    function maxKey() { var m = typeof opts.max === 'function' ? opts.max() : opts.max; return /^\d{4}-\d{2}$/.test(m || '') ? m : ''; }
    function keyOf(y, m) { return y + '-' + pad2(m); }
    function over(y, m) { var mk = maxKey(); return !!mk && keyOf(y, m) > mk; }
    var seed = inputEl.value ? new Date(inputEl.value + '-01') : new Date();
    var state = { year: seed.getFullYear(), month: seed.getMonth() + 1 };
    if (over(state.year, state.month)) { var mk0 = maxKey().split('-'); state.year = Number(mk0[0]); state.month = Number(mk0[1]); }
    var pickerYear = state.year;

    inputEl.style.display = 'none';
    var wrap = document.createElement('div');
    wrap.className = 'hq-month-nav';
    wrap.innerHTML =
      '<button type="button" class="hq-month-nav-btn" id="' + idPrefix + 'Prev" aria-label="Tháng trước">&larr;</button>' +
      '<div class="timeline-month-picker" id="' + idPrefix + 'Picker">' +
        '<button type="button" class="timeline-title-btn" id="' + idPrefix + 'LabelBtn">' +
          '<span id="' + idPrefix + 'Label"></span>' +
        '</button>' +
        '<div class="timeline-month-panel" id="' + idPrefix + 'Panel" hidden>' +
          '<div class="timeline-year-nav">' +
            '<button type="button" id="' + idPrefix + 'YearPrev" aria-label="Năm trước">&larr;</button>' +
            '<span id="' + idPrefix + 'YearLabel"></span>' +
            '<button type="button" id="' + idPrefix + 'YearNext" aria-label="Năm sau">&rarr;</button>' +
          '</div>' +
          '<div class="timeline-month-grid" id="' + idPrefix + 'Grid"></div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="hq-month-nav-btn" id="' + idPrefix + 'Next" aria-label="Tháng sau">&rarr;</button>' +
      '<button type="button" class="hq-month-nav-today" id="' + idPrefix + 'Today">Hôm nay</button>';
    inputEl.parentNode.insertBefore(wrap, inputEl);

    var labelEl = wrap.querySelector('#' + idPrefix + 'Label');
    var picker = wrap.querySelector('#' + idPrefix + 'Picker');
    var btn = wrap.querySelector('#' + idPrefix + 'LabelBtn');
    var panel = wrap.querySelector('#' + idPrefix + 'Panel');
    var yearLabelEl = wrap.querySelector('#' + idPrefix + 'YearLabel');
    var grid = wrap.querySelector('#' + idPrefix + 'Grid');

    function commit(silent) {
      inputEl.value = state.year + '-' + pad2(state.month);
      labelEl.textContent = 'Tháng ' + state.month + ' Năm ' + state.year;
      if (!silent) inputEl.dispatchEvent(new Event('change'));
    }

    function setMonth(y, m, silent) {
      if (over(y, m)) { var mk = maxKey().split('-'); y = Number(mk[0]); m = Number(mk[1]); }
      state.year = y;
      state.month = m;
      commit(silent);
    }

    wrap.querySelector('#' + idPrefix + 'Prev').addEventListener('click', function () {
      state.month--;
      if (state.month < 1) { state.month = 12; state.year--; }
      commit();
    });
    wrap.querySelector('#' + idPrefix + 'Next').addEventListener('click', function () {
      var y = state.year, m = state.month + 1; if (m > 12) { m = 1; y++; }
      if (over(y, m)) return;
      state.year = y; state.month = m;
      commit();
    });
    wrap.querySelector('#' + idPrefix + 'Today').addEventListener('click', function () {
      var t = new Date();
      setMonth(t.getFullYear(), t.getMonth() + 1);
    });
    // Lăn chuột đổi tháng CHỈ ở cụm mũi tên + nhãn tháng (không tác động các nút khác như Xuất Docx nằm cùng hàng)
    function onWheel(e) {
      e.preventDefault();
      if (e.deltaY > 0) {
        var y = state.year, m = state.month + 1; if (m > 12) { m = 1; y++; }
        if (over(y, m)) return;
        state.year = y; state.month = m;
      } else {
        state.month--;
        if (state.month < 1) { state.month = 12; state.year--; }
      }
      commit();
    }
    ['Prev', 'Picker', 'Next'].forEach(function (k) { wrap.querySelector('#' + idPrefix + k).addEventListener('wheel', onWheel, { passive: false }); });

    function renderGrid() {
      yearLabelEl.textContent = pickerYear;
      grid.innerHTML = MONTH_NAMES.map(function (label, i) {
        var isCurrent = pickerYear === state.year && i + 1 === state.month, dis = over(pickerYear, i + 1);
        return '<button type="button" class="timeline-month-cell' + (isCurrent ? ' active' : '') + '" data-month="' + i + '"' + (dis ? ' disabled style="opacity:.35;cursor:not-allowed"' : '') + '>' + label + '</button>';
      }).join('');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      pickerYear = state.year;
      renderGrid();
      panel.hidden = !panel.hidden;
      picker.classList.toggle('open', !panel.hidden);
    });
    wrap.querySelector('#' + idPrefix + 'YearPrev').addEventListener('click', function (e) {
      e.stopPropagation();
      pickerYear--;
      renderGrid();
    });
    wrap.querySelector('#' + idPrefix + 'YearNext').addEventListener('click', function (e) {
      e.stopPropagation();
      if (maxKey() && pickerYear + 1 > Number(maxKey().slice(0, 4))) return;
      pickerYear++;
      renderGrid();
    });
    grid.addEventListener('click', function (e) {
      var cell = e.target.closest('.timeline-month-cell');
      if (!cell || cell.disabled) return;
      setMonth(pickerYear, parseInt(cell.dataset.month, 10) + 1);
      panel.hidden = true;
      picker.classList.remove('open');
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) { panel.hidden = true; picker.classList.remove('open'); }
    });

    commit(true);
    return { setMonth: setMonth };
  }

  return { mount: mount };
})();
