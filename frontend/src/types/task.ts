export type TaskStatus = 'active' | 'completed' | 'canceled'

export interface CheckItem {
  id: string
  text: string
  isDone: boolean
}

export interface TaskRecord {
  id: string
  area: string
  project: string
  heading: string
  title: string
  notes: string
  status: TaskStatus
  /** YYYY-MM-DD or "" */
  startDate: string
  /** YYYY-MM-DD or "" */
  dueDate: string
  checkItems: CheckItem[]
  /** ISO8601 UTC */
  updatedAt: string
}

export interface ListResponse {
  ok: true
  tasks: TaskRecord[]
}

export interface ForbidResponse {
  ok: false
  error: 'FORBIDDEN' | 'CONFLICT' | 'VALIDATION' | 'SERVER'
  message?: string
  task?: TaskRecord
}

export type GetTasksResponse = ListResponse | ForbidResponse

export interface UpsertRequestBody {
  action: 'upsert'
  task: Partial<TaskRecord>
  expectedUpdatedAt?: string
}

export interface DeleteRequestBody {
  action: 'delete'
  id: string
  expectedUpdatedAt?: string
}
