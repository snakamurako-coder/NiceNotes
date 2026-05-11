/**
 * @fileoverview NiceNotes GAS — single file deploy bundle.
 * Tasks JSON API, AllowList, Sheets I/O, Google Tasks + Calendar sync, legacy PDF UI.
 * Companion: index.html (HtmlService). Manifest: appsscript.json (unchanged).
 *
 * @see docs/TASK_SCHEMA.md for API / column contract.
 */
'use strict';

// --- Config & spreadsheet -------------------------------------------------
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

// --- AllowList ------------------------------------------------------------
/**
 * @param {string} sheetName
 * @returns {string[]}
 */
function readAllowListEmails_(sheetName) {
  var ss = openMasterSpreadsheet_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    throw new Error('AllowList sheet not found: ' + sheetName);
  }
  var last = sh.getLastRow();
  if (last < 1) return [];

  var col = sh
    .getRange(1, ALLOWLIST_EMAIL_COL, last, ALLOWLIST_EMAIL_COL)
    .getValues();
  var out = [];
  for (var i = 0; i < col.length; i++) {
    var raw = col[i][0];
    if (raw === '' || raw === null || raw === undefined) continue;
    var s = String(raw).trim().toLowerCase();
    if (!s || s === 'email') continue;
    out.push(s);
  }
  return out;
}

/**
 * @returns {boolean}
 */
function isEmailAllowed_() {
  var cfg = getTasksConfig_();
  if (cfg.skipAllowlist) return true;

  var email =
    Session.getActiveUser().getEmail() ||
    Session.getEffectiveUser().getEmail();
  if (!email) return false;

  var list = readAllowListEmails_(cfg.allowListSheetName);
  var normalized = email.trim().toLowerCase();
  return list.indexOf(normalized) !== -1;
}

/**
 * @returns {{ ok: boolean, email: string, message?: string }}
 */
function checkAllowlistOr403_() {
  var cfg = getTasksConfig_();
  if (cfg.skipAllowlist) {
    return {
      ok: true,
      email:
        Session.getActiveUser().getEmail() ||
        Session.getEffectiveUser().getEmail() ||
        '',
    };
  }

  var email = Session.getActiveUser().getEmail();
  if (!email) {
    return {
      ok: false,
      email: '',
      message: 'Active user email is empty. Open the web app while signed in.',
    };
  }

  var allowed = false;
  try {
    allowed = isEmailAllowed_();
  } catch (err) {
    return { ok: false, email: email, message: String(err) };
  }

  if (!allowed) {
    return {
      ok: false,
      email: email,
      message: 'Email is not on the allow list.',
    };
  }
  return { ok: true, email: email };
}

// --- Tasks sheet I/O ------------------------------------------------------
/**
 * @param {any[]} row
 * @returns {TaskRecord}
 */
function rowToTask_(row) {
  var checkRaw = row[TASK_COL.CHECK_ITEMS - 1];
  return {
    id: String(row[TASK_COL.ID - 1] || ''),
    area: String(row[TASK_COL.AREA - 1] || ''),
    project: String(row[TASK_COL.PROJECT - 1] || ''),
    heading: String(row[TASK_COL.HEADING - 1] || ''),
    title: String(row[TASK_COL.TITLE - 1] || ''),
    notes: String(row[TASK_COL.NOTES - 1] || ''),
    status: normalizeStatus_(row[TASK_COL.STATUS - 1]),
    startDate: formatMaybeDate_(row[TASK_COL.START_DATE - 1]),
    dueDate: formatMaybeDate_(row[TASK_COL.DUE_DATE - 1]),
    checkItems: parseCheckItemsCell_(checkRaw),
    updatedAt: normalizeUpdatedAt_(row[TASK_COL.UPDATED_AT - 1]),
  };
}

/**
 * @param {*} v
 * @returns {'active'|'completed'|'canceled'}
 */
function normalizeStatus_(v) {
  var s = String(v || 'active').toLowerCase();
  if (s === 'completed' || s === 'canceled' || s === 'cancelled') {
    return s === 'cancelled' ? 'canceled' : /** @type {'completed'|'canceled'} */ (s);
  }
  return 'active';
}

/**
 * @param {*} v
 * @returns {string}
 */
function formatMaybeDate_(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

/**
 * @param {*} raw
 * @returns {string}
 */
function normalizeUpdatedAt_(raw) {
  if (raw instanceof Date) {
    return raw.toISOString();
  }
  var s = String(raw || '').trim();
  if (!s) return new Date().toISOString();
  var d = new Date(s);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/**
 * @param {*} raw
 * @returns {CheckItem[]}
 */
function parseCheckItemsCell_(raw) {
  if (raw === '' || raw === null || raw === undefined) return [];
  var str = String(raw).trim();
  if (!str) return [];
  try {
    var parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(function (x) {
      return {
        id: String(x.id || Utilities.getUuid()),
        text: String(x.text || ''),
        isDone: Boolean(x.isDone),
      };
    });
  } catch (e) {
    return [];
  }
}

/**
 * @param {TaskRecord} task
 * @returns {string[]}
 */
function taskToRowValues_(task) {
  return [
    task.id,
    task.area,
    task.project,
    task.heading,
    task.title,
    task.notes,
    task.status,
    task.startDate || '',
    task.dueDate || '',
    JSON.stringify(task.checkItems || []),
    task.updatedAt,
  ];
}

/**
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateMasterSheet_(sheetName) {
  var ss = openMasterSpreadsheet_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, TASK_HEADER_ROW.length).setValues([TASK_HEADER_ROW]);
  }
  return sh;
}

/**
 * @returns {TaskRecord[]}
 */
function loadAllTasks_() {
  var cfg = getTasksConfig_();
  var sh = getOrCreateMasterSheet_(cfg.masterSheetName);
  var last = sh.getLastRow();
  if (last < 2) return [];

  var numCols = TASK_HEADER_ROW.length;
  var range = sh.getRange(2, 1, last, numCols);
  var values = range.getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[TASK_COL.ID - 1]) continue;
    out.push(rowToTask_(row));
  }
  return out;
}

/**
 * @param {string} id
 * @returns {{ rowIndex: number, task: TaskRecord }|null}
 */
function findTaskRowById_(id) {
  var cfg = getTasksConfig_();
  var sh = getOrCreateMasterSheet_(cfg.masterSheetName);
  var last = sh.getLastRow();
  if (last < 2) return null;

  var idCol = sh.getRange(2, TASK_COL.ID, last, TASK_COL.ID).getValues();
  for (var i = 0; i < idCol.length; i++) {
    if (String(idCol[i][0]) === String(id)) {
      var rowIndex = i + 2;
      var row = sh
        .getRange(rowIndex, 1, rowIndex, TASK_HEADER_ROW.length)
        .getValues()[0];
      return { rowIndex: rowIndex, task: rowToTask_(row) };
    }
  }
  return null;
}

/**
 * @param {TaskRecord} task
 * @returns {TaskRecord}
 */
function appendTask_(task) {
  var sh = getOrCreateMasterSheet_(getTasksConfig_().masterSheetName);
  var row = taskToRowValues_(task);
  sh.appendRow(row);
  return task;
}

/**
 * @param {number} rowIndex
 * @param {TaskRecord} task
 * @returns {TaskRecord}
 */
function updateTaskRow_(rowIndex, task) {
  var sh = getOrCreateMasterSheet_(getTasksConfig_().masterSheetName);
  var row = taskToRowValues_(task);
  sh.getRange(rowIndex, 1, rowIndex, row.length).setValues([row]);
  return task;
}

/**
 * @param {number} rowIndex
 */
function deleteTaskRow_(rowIndex) {
  var sh = getOrCreateMasterSheet_(getTasksConfig_().masterSheetName);
  sh.deleteRow(rowIndex);
}

/**
 * @param {Omit<TaskRecord, 'id'|'updatedAt'> & { id?: string }} partial
 * @param {string} id
 * @returns {TaskRecord}
 */
function normalizeIncomingTask_(partial, id) {
  var now = new Date().toISOString();
  return {
    id: id,
    area: String(partial.area != null ? partial.area : ''),
    project: String(partial.project != null ? partial.project : ''),
    heading: String(partial.heading != null ? partial.heading : ''),
    title:
      String(partial.title != null ? partial.title : '').trim() || '(no title)',
    notes: String(partial.notes != null ? partial.notes : ''),
    status: normalizeStatus_(partial.status),
    startDate: formatMaybeDate_(partial.startDate),
    dueDate: formatMaybeDate_(partial.dueDate),
    checkItems: Array.isArray(partial.checkItems)
      ? partial.checkItems.map(function (c) {
          return {
            id: String(c.id || Utilities.getUuid()),
            text: String(c.text || ''),
            isDone: Boolean(c.isDone),
          };
        })
      : [],
    updatedAt: now,
  };
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isSameInstant_(a, b) {
  return new Date(a).getTime() === new Date(b).getTime();
}

// --- Google Tasks + Calendar sync ----------------------------------------
/**
 * @param {string} taskId
 * @returns {string}
 */
function userPropsKeyGTask_(taskId) {
  return 'GTASK_' + taskId;
}

/**
 * @param {string} taskId
 * @returns {string}
 */
function userPropsKeyGCal_(taskId) {
  return 'GCAL_' + taskId;
}

/**
 * @returns {string}
 */
function getTaskListId_() {
  if (typeof Tasks === 'undefined') {
    throw new Error(
      'Advanced Google service "Tasks API" is not enabled for this project.'
    );
  }
  var cache = CacheService.getUserCache();
  var cached = cache.get('taskapp_tasklist_id');
  if (cached) return cached;

  var res = Tasks.Tasklists.list();
  var items = (res && res.items) || [];
  var id = '';
  for (var i = 0; i < items.length; i++) {
    var t = items[i].title || '';
    if (t === 'My Tasks' || t === 'マイタスク' || t === 'タスク') {
      id = items[i].id;
      break;
    }
  }
  if (!id && items.length) id = items[0].id;
  if (!id) throw new Error('No Google Task lists available.');
  cache.put('taskapp_tasklist_id', id, 21600);
  return id;
}

/**
 * @param {string} ymd
 * @returns {Date}
 */
function parseLocalDateFromYyyyMmDd_(ymd) {
  var p = String(ymd).split('-');
  var y = parseInt(p[0], 10);
  var m = parseInt(p[1], 10);
  var d = parseInt(p[2], 10);
  return new Date(y, m - 1, d);
}

/**
 * @param {TaskRecord} task
 * @returns {Object}
 */
function buildTasksApiResource_(task) {
  var r = {
    title: task.title,
    notes: task.notes || '',
  };
  if (task.status === 'completed') {
    r.status = 'completed';
  } else if (task.status === 'canceled') {
    r.title = '[Canceled] ' + task.title;
    r.status = 'needsAction';
  } else {
    r.status = 'needsAction';
  }
  if (task.dueDate) {
    r.due = task.dueDate + 'T00:00:00.000Z';
  }
  return r;
}

/**
 * @param {TaskRecord} task
 * @returns {SyncPartResult}
 */
function upsertGoogleTask_(task) {
  if (typeof Tasks === 'undefined') {
    return {
      ok: false,
      error: 'Tasks API not enabled (Advanced services).',
    };
  }

  var listId = getTaskListId_();
  var props = PropertiesService.getUserProperties();
  var key = userPropsKeyGTask_(task.id);
  var existingId = props.getProperty(key);
  var resource = buildTasksApiResource_(task);

  if (task.status === 'canceled') {
    if (existingId) {
      try {
        Tasks.Tasks.remove(listId, existingId);
      } catch (e) {
        return { ok: false, error: String(e) };
      }
      props.deleteProperty(key);
    }
    return { ok: true };
  }

  if (existingId) {
    Tasks.Tasks.patch(resource, listId, existingId);
  } else {
    var inserted = Tasks.Tasks.insert(resource, listId);
    if (inserted && inserted.id) props.setProperty(key, inserted.id);
  }
  return { ok: true };
}

/**
 * @param {TaskRecord} task
 * @returns {SyncPartResult}
 */
function upsertCalendarEvent_(task) {
  var props = PropertiesService.getUserProperties();
  var key = userPropsKeyGCal_(task.id);
  var existingId = props.getProperty(key);
  var cal = CalendarApp.getDefaultCalendar();

  if (existingId) {
    try {
      var oldEv = cal.getEventById(existingId);
      if (oldEv) oldEv.deleteEvent();
    } catch (e0) {
      // ignore
    }
    props.deleteProperty(key);
  }

  if (task.status !== 'active' || !task.dueDate) {
    return { ok: true };
  }

  var d = parseLocalDateFromYyyyMmDd_(task.dueDate);
  var ev = cal.createAllDayEvent(task.title, d);
  if (task.notes) {
    try {
      ev.setDescription(task.notes);
    } catch (descErr) {
      // non-fatal
    }
  }
  props.setProperty(key, ev.getId());
  return { ok: true };
}

/**
 * @param {TaskRecord} task
 * @returns {{ tasksApi: SyncPartResult, calendar: SyncPartResult }}
 */
function syncTaskToGoogleServices_(task) {
  var tasksApi = /** @type {SyncPartResult} */ ({ ok: true });
  var calendar = /** @type {SyncPartResult} */ ({ ok: true });

  try {
    tasksApi = upsertGoogleTask_(task);
  } catch (e) {
    tasksApi = { ok: false, error: String(e) };
  }

  try {
    calendar = upsertCalendarEvent_(task);
  } catch (e2) {
    calendar = { ok: false, error: String(e2) };
  }

  return { tasksApi: tasksApi, calendar: calendar };
}

/**
 * @param {string} taskId
 * @returns {{ tasksApi: SyncPartResult, calendar: SyncPartResult }}
 */
function purgeGoogleLinksForTaskId_(taskId) {
  var tasksApi = /** @type {SyncPartResult} */ ({ ok: true });
  var calendar = /** @type {SyncPartResult} */ ({ ok: true });
  var props = PropertiesService.getUserProperties();

  var gTaskKey = userPropsKeyGTask_(taskId);
  var gCalKey = userPropsKeyGCal_(taskId);

  if (typeof Tasks !== 'undefined') {
    try {
      var gid = props.getProperty(gTaskKey);
      if (gid) {
        var listId = getTaskListId_();
        Tasks.Tasks.remove(listId, gid);
      }
    } catch (e) {
      tasksApi = { ok: false, error: String(e) };
    }
  }
  props.deleteProperty(gTaskKey);

  try {
    var eid = props.getProperty(gCalKey);
    if (eid) {
      var ev = CalendarApp.getDefaultCalendar().getEventById(eid);
      if (ev) ev.deleteEvent();
    }
  } catch (e2) {
    calendar = { ok: false, error: String(e2) };
  }
  props.deleteProperty(gCalKey);

  return { tasksApi: tasksApi, calendar: calendar };
}

// --- HTTP handlers --------------------------------------------------------
/**
 * @param {*} obj
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function handleTasksGet_() {
  var gate = checkAllowlistOr403_();
  if (!gate.ok) {
    return jsonOutput_({
      ok: false,
      error: 'FORBIDDEN',
      message: gate.message || 'Forbidden',
    });
  }
  try {
    var tasks = loadAllTasks_();
    return jsonOutput_({ ok: true, tasks: tasks });
  } catch (e) {
    return jsonOutput_({
      ok: false,
      error: 'SERVER',
      message: String(e),
    });
  }
}

/**
 * @param {UpsertRequest} body
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function handleTasksUpsert_(body) {
  var gate = checkAllowlistOr403_();
  if (!gate.ok) {
    return jsonOutput_({
      ok: false,
      error: 'FORBIDDEN',
      message: gate.message || 'Forbidden',
    });
  }

  if (!body || !body.task) {
    return jsonOutput_({
      ok: false,
      error: 'VALIDATION',
      message: 'task is required',
    });
  }

  var taskPayload = body.task;
  var id = taskPayload.id && String(taskPayload.id).trim();
  var expected = body.expectedUpdatedAt;

  var saved;

  if (id) {
    var found = findTaskRowById_(id);
    if (!found) {
      return jsonOutput_({
        ok: false,
        error: 'VALIDATION',
        message: 'Unknown task id: ' + id,
      });
    }
    if (expected && !isSameInstant_(String(expected), found.task.updatedAt)) {
      return jsonOutput_({
        ok: false,
        error: 'CONFLICT',
        message: 'updatedAt mismatch (expected client timestamp vs server).',
        task: found.task,
      });
    }
    saved = normalizeIncomingTask_(taskPayload, id);
    updateTaskRow_(found.rowIndex, saved);
  } else {
    var newId = Utilities.getUuid();
    saved = normalizeIncomingTask_(taskPayload, newId);
    appendTask_(saved);
  }

  var sync = syncTaskToGoogleServices_(saved);
  return jsonOutput_({
    ok: true,
    task: saved,
    sync: sync,
  });
}

/**
 * @param {DeleteRequest} body
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function handleTasksDelete_(body) {
  var gate = checkAllowlistOr403_();
  if (!gate.ok) {
    return jsonOutput_({
      ok: false,
      error: 'FORBIDDEN',
      message: gate.message || 'Forbidden',
    });
  }

  if (!body || !body.id) {
    return jsonOutput_({
      ok: false,
      error: 'VALIDATION',
      message: 'id is required',
    });
  }

  var sid = String(body.id);
  var found = findTaskRowById_(sid);
  if (!found) {
    return jsonOutput_({
      ok: false,
      error: 'VALIDATION',
      message: 'Unknown task id: ' + sid,
    });
  }

  if (
    body.expectedUpdatedAt &&
    !isSameInstant_(String(body.expectedUpdatedAt), found.task.updatedAt)
  ) {
    return jsonOutput_({
      ok: false,
      error: 'CONFLICT',
      message: 'updatedAt mismatch.',
      task: found.task,
    });
  }

  var sync = purgeGoogleLinksForTaskId_(sid);
  deleteTaskRow_(found.rowIndex);
  return jsonOutput_({
    ok: true,
    id: sid,
    sync: sync,
  });
}

/**
 * @param {PostBody} body
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function handleTasksPost_(body) {
  var action = body && body.action;
  if (action === 'upsert') return handleTasksUpsert_(/** @type {UpsertRequest} */ (body));
  if (action === 'delete') return handleTasksDelete_(/** @type {DeleteRequest} */ (body));
  return jsonOutput_({
    ok: false,
    error: 'VALIDATION',
    message: 'Unknown or missing action. Use upsert | delete.',
  });
}

// --- Entry (Web app) + legacy PDF UI -------------------------------------
/**
 * @param {Object} [e]
 * @returns {GoogleAppsScript.HTML.HtmlOutput|GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  var mode = e && e.parameter && e.parameter.mode;
  if (mode === 'tasks') {
    return handleTasksGet_();
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
    )
    .setTitle('Universal Document Workspace');
}

/**
 * @param {Object} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: 'VALIDATION',
      message: 'Invalid JSON body',
    });
  }
  return handleTasksPost_(body);
}

function getFileList(mode) {
  try {
    var props = PropertiesService.getScriptProperties();
    var folderId =
      mode === 'single'
        ? props.getProperty('SINGLE_FOLDER_ID')
        : props.getProperty('SEAMLESS_FOLDER_ID');

    if (!folderId)
      return {
        error: 'プロパティに ' + mode + ' フォルダのIDがありません。',
      };

    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var list = [];

    while (files.hasNext()) {
      var file = files.next();
      var mime = file.getMimeType();
      if (
        mime === MimeType.PDF ||
        mime === MimeType.JPEG ||
        mime === MimeType.PNG
      ) {
        list.push({ id: file.getId(), name: file.getName() });
      }
    }
    return list;
  } catch (err) {
    return { error: err.toString() };
  }
}

function getFileData(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    return Utilities.base64Encode(file.getBlob().getBytes());
  } catch (err) {
    return { error: err.toString() };
  }
}

function saveAnnotation(fileName, jsonData) {
  try {
    var folder = DriveApp.getRootFolder();
    var targetName = fileName + '_rev.json';
    var files = folder.getFilesByName(targetName);
    if (files.hasNext()) {
      files.next().setContent(jsonData);
    } else {
      folder.createFile(targetName, jsonData, MimeType.PLAIN_TEXT);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function loadAnnotation(fileName) {
  try {
    var files = DriveApp.getRootFolder().getFilesByName(fileName + '_rev.json');
    if (files.hasNext())
      return { success: true, data: files.next().getBlob().getDataAsString() };
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function recognizeSentence(allStrokes) {
  var url =
    'https://www.google.com.hk/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8';
  var payload = {
    options: 'enable_pre_space',
    requests: [
      {
        writing_guide: { writing_area_width: 1000, writing_area_height: 1000 },
        ink: allStrokes,
        language: 'ja',
      },
    ],
  };

  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
    });
    var result = JSON.parse(response.getContentText());
    if (result[0] === 'SUCCESS') {
      return result[1][0][1][0];
    }
  } catch (err) {
    return '認識エラー';
  }
}

// --- Optional: run in editor (Tests → runTaskAppUnitTests) ---------------
/**
 * @returns {string[]}
 */
function runTaskAppUnitTests() {
  var out = [];

  try {
    var row = [
      'uuid-1',
      'A',
      'P',
      'H',
      'Title',
      'Note',
      'active',
      '2026-05-10',
      '2026-05-12',
      JSON.stringify([{ id: 'c1', text: 'x', isDone: false }]),
      '2026-05-11T10:00:00.000Z',
    ];
    var tr = rowToTask_(row);
    if (tr.id !== 'uuid-1') throw new Error('id parse');
    if (tr.checkItems.length !== 1) throw new Error('checkItems parse');
    if (tr.dueDate !== '2026-05-12') throw new Error('dueDate');
    out.push('rowToTask_: ok');
  } catch (e) {
    out.push('rowToTask_: FAIL ' + e);
  }

  try {
    var t2 = normalizeIncomingTask_(
      {
        title: ' Hello ',
        status: 'completed',
        checkItems: [],
      },
      'new-id'
    );
    if (t2.title !== 'Hello') throw new Error('trim');
    if (t2.status !== 'completed') throw new Error('status');
    out.push('normalizeIncomingTask_: ok');
  } catch (e2) {
    out.push('normalizeIncomingTask_: FAIL ' + e2);
  }

  try {
    if (!isSameInstant_('2026-05-11T10:00:00.000Z', '2026-05-11T10:00:00.000Z')) throw new Error('same instant');
    if (isSameInstant_('2026-05-11T10:00:00.000Z', '2026-05-11T10:00:01.000Z')) throw new Error('diff instant');
    out.push('isSameInstant_: ok');
  } catch (e3) {
    out.push('isSameInstant_: FAIL ' + e3);
  }

  Logger.log(out.join('\n'));
  return out;
}
