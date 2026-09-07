/**
 * Google Sheets Configuration - HICONIQUE Task Manager
 * Sheet đã publish đầy đủ
 */
const GSHEETS_CONFIG = {
  // Google Apps Script API URL (for write operations)
  API_URL: 'https://script.google.com/macros/s/AKfycbzgg0dfNgDTFgcTGlNvF2IHLUusK6YuBk1pot9SrbYi5B9al-H2nmmMlKLz5CpDlLY/exec',

  // Published CSV URLs (for read operations)
  DATA_URLS: {
    PROJECTS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZdO-5j-EN4Yk7SMR_pSU8vmwentJ8n2jkKoHKz66o2sRNU9kgQK3dmt-Ac-0aBe0Doqd1Q9B_jWP5/pub?output=csv&gid=0',
    TASKS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZdO-5j-EN4Yk7SMR_pSU8vmwentJ8n2jkKoHKz66o2sRNU9kgQK3dmt-Ac-0aBe0Doqd1Q9B_jWP5/pub?output=csv&gid=2088597336',
    MEMBERS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZdO-5j-EN4Yk7SMR_pSU8vmwentJ8n2jkKoHKz66o2sRNU9kgQK3dmt-Ac-0aBe0Doqd1Q9B_jWP5/pub?output=csv&gid=1872059656',
    PROPOSALS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZdO-5j-EN4Yk7SMR_pSU8vmwentJ8n2jkKoHKz66o2sRNU9kgQK3dmt-Ac-0aBe0Doqd1Q9B_jWP5/pub?output=csv&gid=141206186',
    TIMESHEET: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZdO-5j-EN4Yk7SMR_pSU8vmwentJ8n2jkKoHKz66o2sRNU9kgQK3dmt-Ac-0aBe0Doqd1Q9B_jWP5/pub?output=csv&gid=430888240'
  },

  // Bật chế độ Google Sheets
  USE_GSHEETS: true
};
