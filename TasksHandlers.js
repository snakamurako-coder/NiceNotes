'use strict';

/**
 * HTTP handlers for JSON API (doGet mode=tasks, doPost actions).
 */

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
