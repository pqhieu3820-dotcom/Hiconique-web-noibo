/**
 * Google Sheets Configuration - HICONIQUE Task Manager
 * Sheet đã publish đầy đủ
 */
const GSHEETS_CONFIG = {
  // Google Apps Script Web App URL — dùng cho CẢ đọc lẫn ghi.
  // (Trước đây đọc qua CSV publish-to-web, nhưng sau khi đổi tên cột Sheet
  //  sang tiếng Việt thì CSV trả header tiếng Việt làm hỏng toàn bộ web —
  //  giờ mọi thao tác đọc/ghi đều qua Apps Script để được dịch VI↔EN, xem
  //  FIELD_MAP/VALUE_MAP trong gsheets-api-v2.js.)
  API_URL: 'https://script.google.com/macros/s/AKfycbzgg0dfNgDTFgcTGlNvF2IHLUusK6YuBk1pot9SrbYi5B9al-H2nmmMlKLz5CpDlLY/exec',

  // Bật chế độ Google Sheets
  USE_GSHEETS: true
};
