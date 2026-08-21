/**
 * Google Sheets Configuration
 * Replace YOUR_SHEET_ID with your Google Sheet ID
 */
const GSHEETS_CONFIG = {
  // ID của Google Sheet (lấy từ URL: docs.google.com/spreadsheets/d/[ID]/edit)
  SPREADSHEET_ID: 'YOUR_SHEET_ID',

  // Tên các tabs trong sheet
  SHEETS: {
    PROJECTS: 'Projects',
    TASKS: 'Tasks',
    MEMBERS: 'Members',
    PROPOSALS: 'Proposals'
  },

  // Link Google Apps Script Web App (sẽ tạo sau)
  API_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL'
};

/**
 * Check if using Google Sheets or localStorage fallback
 */
function isUsingGSheets() {
  return GSHEETS_CONFIG.API_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_URL' &&
         GSHEETS_CONFIG.SPREADSHEET_ID !== 'YOUR_SHEET_ID';
}
