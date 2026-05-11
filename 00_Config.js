/**
 * Task master sheet column indices (A=1 … K=11) and script configuration.
 * File prefix `00_` keeps load order predictable in Apps Script.
 */

/** @type {Object<string, number>} */
var TASK_COL = {
  ID: 1,
  AREA: 2,
  PROJECT: 3,
  HEADING: 4,
  TITLE: 5,
  NOTES: 6,
  STATUS: 7,
  START_DATE: 8,
  DUE_DATE: 9,
  CHECK_ITEMS: 10,
  UPDATED_AT: 11,
};

/** AllowList sheet: column A = email */
var ALLOWLIST_EMAIL_COL = 1;

/** @type {string[]} */
var TASK_HEADER_ROW = [
  'id',
  'area',
  'project',
  'heading',
  'title',
  'notes',
  'status',
  'startDate',
  'dueDate',
  'checkItems',
  'updatedAt',
];

/** Script property keys (Project Settings → Script properties) */
var PROP_MASTER_SPREADSHEET_ID = 'TASK_APP_MASTER_SPREADSHEET_ID';
var PROP_MASTER_SHEET_NAME = 'TASK_APP_MASTER_SHEET_NAME';
var PROP_ALLOWLIST_SHEET_NAME = 'TASK_APP_ALLOWLIST_SHEET_NAME';
var PROP_SKIP_ALLOWLIST = 'TASK_APP_SKIP_ALLOWLIST';

/**
 * @returns {{ masterSpreadsheetId: string, masterSheetName: string, allowListSheetName: string, skipAllowlist: boolean }}
 */
function getTasksConfig_() {
  var sp = PropertiesService.getScriptProperties();
  var masterSpreadsheetId = sp.getProperty(PROP_MASTER_SPREADSHEET_ID) || '';
  var masterSheetName = sp.getProperty(PROP_MASTER_SHEET_NAME) || 'Tasks';
  var allowListSheetName =
    sp.getProperty(PROP_ALLOWLIST_SHEET_NAME) || 'AllowList';
  var skipAllowlist =
    (sp.getProperty(PROP_SKIP_ALLOWLIST) || '').toLowerCase() === 'true';
  return {
    masterSpreadsheetId: masterSpreadsheetId,
    masterSheetName: masterSheetName,
    allowListSheetName: allowListSheetName,
    skipAllowlist: skipAllowlist,
  };
}

/**
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function openMasterSpreadsheet_() {
  var cfg = getTasksConfig_();
  if (!cfg.masterSpreadsheetId) {
    throw new Error(
      'Script property TASK_APP_MASTER_SPREADSHEET_ID is not set.'
    );
  }
  return SpreadsheetApp.openById(cfg.masterSpreadsheetId);
}
