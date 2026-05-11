import Dexie, { type Table } from 'dexie'
import type { TaskRecord } from '../types/task'

export interface MetaKV {
  key: string
  value: string
}

export class TaskAppDB extends Dexie {
  tasks!: Table<TaskRecord, string>
  meta!: Table<MetaKV, string>

  constructor() {
    super('nice-notes-task-app')
    this.version(1).stores({
      tasks: 'id, status, dueDate, updatedAt',
      meta: 'key',
    })
  }
}

export const db = new TaskAppDB()
