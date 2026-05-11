'use strict';

/**
 * Read/write Tasks flat sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh
 * @param {any[]} row 0-based row array length >= 11
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
 * @returns {string} YYYY-MM-DD or ""
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
 * @returns {string} ISO 8601 UTC
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
    return parsed
      .map(function (x) {
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
 * @returns {{ rowIndex: number, task: TaskRecord }|null} rowIndex 1-based sheet row
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
  var cfg = getTasksConfig_();
  var sh = getOrCreateMasterSheet_(cfg.masterSheetName);
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
  var cfg = getTasksConfig_();
  var sh = getOrCreateMasterSheet_(cfg.masterSheetName);
  var row = taskToRowValues_(task);
  sh.getRange(rowIndex, 1, rowIndex, row.length).setValues([row]);
  return task;
}

/**
 * @param {number} rowIndex
 */
function deleteTaskRow_(rowIndex) {
  var sh =
    getOrCreateMasterSheet_(getTasksConfig_().masterSheetName);
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
    title: String(partial.title != null ? partial.title : '').trim() || '(no title)',
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
 * @param {string} a ISO
 * @param {string} b ISO
 * @returns {boolean}
 */
function isSameInstant_(a, b) {
  return new Date(a).getTime() === new Date(b).getTime();
}
