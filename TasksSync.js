'use strict';

/**
 * External sync: Google Tasks (Advanced Service "Tasks") + CalendarApp.
 * Failures are non-fatal: callers merge into partial `sync` results.
 */

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
 * @returns {string} task list id
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
      // ignore missing
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
 * After sheet is authoritative, push to Google Tasks + Calendar.
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
 * Remove linked Google Task + Calendar event for task id (best-effort).
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
