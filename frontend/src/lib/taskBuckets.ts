import type { TaskRecord } from '../types/task'
import { todayYmd } from './dates'

export type BucketKey = 'today' | 'scheduled' | 'anytime'

export const BUCKET_LABEL: Record<BucketKey, string> = {
  today: '今日',
  scheduled: '予定',
  anytime: 'いつでも',
}

/**
 * Rough Things-like grouping: today (due today or start today), scheduled (future due), anytime (no due).
 */
export function bucketForTask(t: TaskRecord): BucketKey {
  if (t.status !== 'active') return 'anytime'
  const today = todayYmd()
  if (t.dueDate && t.dueDate < today) return 'today'
  if (t.dueDate === today || t.startDate === today) return 'today'
  if (t.dueDate) {
    return t.dueDate > today ? 'scheduled' : 'anytime'
  }
  return 'anytime'
}

export function groupByBucket(tasks: TaskRecord[]): Record<BucketKey, TaskRecord[]> {
  const out: Record<BucketKey, TaskRecord[]> = {
    today: [],
    scheduled: [],
    anytime: [],
  }
  for (const t of tasks) {
    out[bucketForTask(t)].push(t)
  }
  return out
}
