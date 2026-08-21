/**
 * Google Sheets Configuration - HICONIQUE Task Manager
 */
const GSHEETS_CONFIG = {
  // ID của Google Sheet
  SPREADSHEET_ID: '1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY',

  // Tên các tabs trong sheet
  SHEETS: {
    PROJECTS: 'Projects',
    TASKS: 'Tasks',
    MEMBERS: 'Members',
    PROPOSALS: 'Proposals'
  },

  // CSV export URLs (dùng để đọc dữ liệu trực tiếp)
  // Cách lấy: File > Share > Publish to web > CSV
  CSV_URLS: {
    PROJECTS: 'https://docs.google.com/spreadsheets/d/1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY/gviz/tq?tqx=out:csv&sheet=Projects',
    TASKS: 'https://docs.google.com/spreadsheets/d/1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY/gviz/tq?tqx=out:csv&sheet=Tasks',
    MEMBERS: 'https://docs.google.com/spreadsheets/d/1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY/gviz/tq?tqx=out:csv&sheet=Members',
    PROPOSALS: 'https://docs.google.com/spreadsheets/d/1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY/gviz/tq?tqx=out:csv&sheet=Proposals'
  },

  // Sử dụng localStorage hay Google Sheets
  USE_GSHEETS: false  // Hiện tại dùng localStorage
};

/**
 * Check if using Google Sheets
 */
function isUsingGSheets() {
  return GSHEETS_CONFIG.USE_GSHEETS;
}
