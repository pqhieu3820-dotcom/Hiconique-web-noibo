/**
 * HiconiqueMoney — định dạng ô nhập tiền (VNĐ) với dấu chấm ngăn cách hàng
 * nghìn NGAY KHI GÕ (2026-09-21, theo yêu cầu người dùng — QUY TẮC CỐ ĐỊNH
 * áp dụng cho MỌI ô nhập tiền tạo mới từ giờ trở đi, xem GHI_CHU_DU_AN.md).
 * Gõ "90000000" tự hiện "90.000.000" ngay lúc gõ, không phải đợi submit mới
 * format — nhìn ra ngay số tiền lớn cỡ nào thay vì phải đếm số 0.
 *
 * Input PHẢI là type="text" (không phải type="number" — trình duyệt chặn
 * ký tự "." không phải phân cách thập phân trong input number), dùng
 * inputmode="numeric" để bàn phím điện thoại vẫn hiện đúng bàn phím số.
 * Giá trị THẬT (không dấu chấm) lấy qua HiconiqueMoney.parse(input.value)
 * lúc lưu — KHÔNG dùng parseFloat/Number trực tiếp trên input.value nữa vì
 * chuỗi đã có dấu chấm sẽ bị đọc sai (VD "90.000.000" qua Number() ra 90).
 */
var HiconiqueMoney = (function () {
  'use strict';

  // "90000000" hoặc "90.000.000" (gõ dở) -> "90.000.000". Chỉ giữ lại chữ
  // số, bỏ hết ký tự khác (dấu chấm cũ, chữ, khoảng trắng) rồi chèn lại dấu
  // chấm mỗi 3 số từ phải sang — không dùng toLocaleString() vì cần chạy
  // được ngay lúc đang gõ dở (input event), không phải lúc mất focus.
  function format(value) {
    var digits = String(value == null ? '' : value).replace(/\D/g, '');
    digits = digits.replace(/^0+(?=\d)/, ''); // bỏ số 0 thừa ở đầu (VD "0900" gõ nhầm)
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // "90.000.000" -> 90000000 (Number) — dùng lúc đọc value để lưu/tính toán.
  function parse(formatted) {
    var digits = String(formatted == null ? '' : formatted).replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }

  // Gắn live-format vào 1 input — an toàn gọi nhiều lần (tự bỏ qua nếu đã
  // gắn rồi, giống quy ước dataset-flag đã dùng ở các hàm bind*() khác
  // trong dự án, VD HiconiqueMonthNav.mount()).
  function bind(input) {
    if (!input || input.dataset.hqMoneyBound) return;
    input.dataset.hqMoneyBound = '1';
    input.type = 'text';
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    if (input.value) input.value = format(input.value);

    input.addEventListener('input', function () {
      var caret = input.selectionStart == null ? input.value.length : input.selectionStart;
      // Đếm số CHỮ SỐ (không tính dấu chấm) đứng trước con trỏ TRƯỚC khi
      // format lại — dùng để đặt con trỏ về đúng chỗ sau khi dấu chấm bị
      // chèn/xoá làm lệch vị trí (gõ chính giữa 1 số dài vẫn không bị nhảy
      // con trỏ về cuối như set lại value thông thường).
      var digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
      var formatted = format(input.value);
      input.value = formatted;
      var pos = 0, seen = 0;
      while (pos < formatted.length && seen < digitsBeforeCaret) {
        if (formatted[pos] !== '.') seen++;
        pos++;
      }
      input.setSelectionRange(pos, pos);
    });
  }

  // Gắn cho MỌI input có [data-money-input] trong 1 vùng (mặc định cả
  // document) — tiện gọi 1 lần sau khi render xong 1 form/modal thay vì
  // phải gọi bind() tay từng ô.
  function bindAll(root) {
    (root || document).querySelectorAll('[data-money-input]').forEach(bind);
  }

  return { format: format, parse: parse, bind: bind, bindAll: bindAll };
})();
