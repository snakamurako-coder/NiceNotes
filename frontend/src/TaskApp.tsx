import { useCallback, useMemo, useState } from 'react'
import { useLocalTasks, useRemoteTasksPoll } from './hooks/useTasksData'
import { BUCKET_LABEL, groupByBucket } from './lib/taskBuckets'
import { getGasBaseUrl, upsertTaskOnGas } from './api/gas'
import type { TaskRecord } from './types/task'
import { db } from './db'

export function TaskApp() {
  const tasks = useLocalTasks()
  const { baseUrl, remoteQuery, pendingBanner, applyRemoteSnapshot, dismissBanner } =
    useRemoteTasksPoll()
  const [quickTitle, setQuickTitle] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const grouped = useMemo(() => groupByBucket(tasks ?? []), [tasks])

  const onQuickAdd = useCallback(async () => {
    const title = quickTitle.trim()
    if (!title) return
    setErr(null)
    try {
      const payload: Partial<TaskRecord> = {
        area: 'Inbox',
        project: '',
        heading: 'いつでも',
        title,
        notes: '',
        status: 'active',
        startDate: '',
        dueDate: '',
        checkItems: [],
      }
      const url = getGasBaseUrl()
      if (url) {
        const saved = await upsertTaskOnGas(url, {
          action: 'upsert',
          task: payload,
        })
        await db.tasks.put(saved)
      } else {
        const now = new Date().toISOString()
        const local: TaskRecord = {
          id: crypto.randomUUID(),
          area: payload.area ?? 'Inbox',
          project: payload.project ?? '',
          heading: payload.heading ?? 'いつでも',
          title,
          notes: payload.notes ?? '',
          status: 'active',
          startDate: '',
          dueDate: '',
          checkItems: [],
          updatedAt: now,
        }
        await db.tasks.put(local)
      }
      setQuickTitle('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [quickTitle])

  const completeTask = useCallback(
    async (t: TaskRecord) => {
      setErr(null)
      try {
        const url = getGasBaseUrl()
        const next: Partial<TaskRecord> = {
          ...t,
          status: 'completed',
        }
        if (url) {
          const saved = await upsertTaskOnGas(url, {
            action: 'upsert',
            task: next,
            expectedUpdatedAt: t.updatedAt,
          })
          await db.tasks.put(saved)
        } else {
          await db.tasks.put({
            ...t,
            status: 'completed',
            updatedAt: new Date().toISOString(),
          })
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    },
    [],
  )

  return (
    <div className="app">
      <header className="top">
        <h1>NiceNotes Tasks</h1>
        <div className="meta">
          {baseUrl ? (
            <span className="pill ok">GAS: 接続先あり</span>
          ) : (
            <span className="pill warn">GAS URL 未設定（オフラインローカルのみ）</span>
          )}
          {remoteQuery.isFetching && <span className="pill">同期中…</span>}
          {remoteQuery.isError && (
            <span className="pill err">取得エラー（CORS/認証を確認）</span>
          )}
        </div>
      </header>

      {pendingBanner && (
        <div className="banner">
          <span>新しい更新があります（サーバー側と差分）</span>
          <div className="banner-actions">
            <button type="button" onClick={() => void applyRemoteSnapshot()}>
              最新を取り込む
            </button>
            <button type="button" className="ghost" onClick={() => void dismissBanner()}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {err && <div className="error">{err}</div>}

      <section className="capture card">
        <h2>今すぐメモしますか？</h2>
        <div className="row">
          <input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="クイックキャプチャ（タイトル）"
            onKeyDown={(e) => e.key === 'Enter' && void onQuickAdd()}
          />
          <button type="button" onClick={() => void onQuickAdd()}>
            追加
          </button>
        </div>
      </section>

      <div className="grid">
        {(['today', 'scheduled', 'anytime'] as const).map((key) => (
          <section key={key} className="card">
            <h3>
              {BUCKET_LABEL[key]} <small>({grouped[key].length})</small>
            </h3>
            <ul className="list">
              {grouped[key].map((t) => (
                <li key={t.id} className="task-item">
                  <div>
                    <div className="title">{t.title}</div>
                    <div className="sub">
                      {t.area}
                      {t.dueDate ? ` · 期限 ${t.dueDate}` : ''}
                    </div>
                  </div>
                  {t.status === 'active' && (
                    <button type="button" className="small" onClick={() => void completeTask(t)}>
                      完了
                    </button>
                  )}
                </li>
              ))}
              {grouped[key].length === 0 && (
                <li className="muted">（タスクなし）</li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
