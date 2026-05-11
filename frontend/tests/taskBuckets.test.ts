import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { bucketForTask } from '../src/lib/taskBuckets'
import type { TaskRecord } from '../src/types/task'

describe('bucketForTask', () => {
  const originalToLocaleDateString = Date.prototype.toLocaleDateString

  beforeEach(() => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
      this: Date,
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      if (locales === 'en-CA') return '2026-05-11'
      return originalToLocaleDateString.call(this, locales as never, options)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('puts overdue active tasks in today', () => {
    const t: TaskRecord = {
      id: '1',
      area: '',
      project: '',
      heading: '',
      title: 'x',
      notes: '',
      status: 'active',
      startDate: '',
      dueDate: '2026-05-01',
      checkItems: [],
      updatedAt: new Date().toISOString(),
    }
    expect(bucketForTask(t)).toBe('today')
  })

  it('puts future due in scheduled', () => {
    const t: TaskRecord = {
      id: '2',
      area: '',
      project: '',
      heading: '',
      title: 'x',
      notes: '',
      status: 'active',
      startDate: '',
      dueDate: '2026-12-31',
      checkItems: [],
      updatedAt: new Date().toISOString(),
    }
    expect(bucketForTask(t)).toBe('scheduled')
  })
})
