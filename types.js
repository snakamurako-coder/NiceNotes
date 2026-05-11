/**
 * @fileoverview JSDoc typedefs for Things-clone Tasks API (GAS ⇔ React).
 * Keep in sync with docs/TASK_SCHEMA.md and frontend/src/types/task.ts
 */

/**
 * @typedef {Object} CheckItem
 * @property {string} id
 * @property {string} text
 * @property {boolean} isDone
 */

/**
 * @typedef {Object} TaskRecord
 * @property {string} id UUID
 * @property {string} area
 * @property {string} project
 * @property {string} heading
 * @property {string} title
 * @property {string} notes
 * @property {'active'|'completed'|'canceled'} status
 * @property {string} startDate YYYY-MM-DD or ""
 * @property {string} dueDate YYYY-MM-DD or ""
 * @property {CheckItem[]} checkItems
 * @property {string} updatedAt ISO8601 UTC
 */

/**
 * @typedef {Object} UpsertRequest
 * @property {'upsert'} action
 * @property {Omit<TaskRecord, 'id'|'updatedAt'> & { id?: string }} task
 * @property {string} [expectedUpdatedAt] for optimistic locking
 */

/**
 * @typedef {Object} DeleteRequest
 * @property {'delete'} action
 * @property {string} id
 * @property {string} [expectedUpdatedAt]
 */

/**
 * @typedef {UpsertRequest|DeleteRequest|{action?:string}} PostBody
 */

/**
 * @typedef {Object} SyncPartResult
 * @property {boolean} ok
 * @property {string} [error]
 */

/**
 * @typedef {Object} UpsertSuccessResponse
 * @property {true} ok
 * @property {TaskRecord} task
 * @property {{ tasksApi: SyncPartResult, calendar: SyncPartResult }} [sync]
 */

/**
 * @typedef {Object} ErrorResponse
 * @property {false} ok
 * @property {string} error FORBIDDEN | CONFLICT | VALIDATION | SERVER
 * @property {string} [message]
 * @property {TaskRecord} [task]
 */

/**
 * @typedef {Object} ListResponse
 * @property {true} ok
 * @property {TaskRecord[]} tasks
 */
