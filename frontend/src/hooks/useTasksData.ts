import type { TaskRecord } from '../types/task'
import { getGasBaseUrl, fetchTasksFromGas } from '../api/gas'
import { db } from '../db'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'

const META_PENDING_REFRESH = 'pendingRemoteRefresh'

export function useRemoteTasksPoll() {
  const baseUrl = getGasBaseUrl()
  const queryClient = useQueryClient()
  const [pendingBanner, setPendingBanner] = useState(false)

  const q = useQuery({
    queryKey: ['gasTasks', baseUrl],
    enabled: Boolean(baseUrl),
    queryFn: async () => {
      if (!baseUrl) throw new Error('No GAS URL')
      return fetchTasksFromGas(baseUrl)
    },
    staleTime: 15_000,
  })

  const checkShouldFlag = useCallback(async (remote: TaskRecord[]) => {
    const local = await db.tasks.toArray()
    /** First boot: hydrate local cache from server without nagging */
    if (local.length === 0 && remote.length > 0) {
      await db.tasks.bulkPut(remote)
      setPendingBanner(false)
      return
    }

    const map = new Map(local.map((t) => [t.id, t]))
    let need = false
    if (local.length !== remote.length) need = true
    for (const r of remote) {
      const l = map.get(r.id)
      if (!l || l.updatedAt !== r.updatedAt) {
        need = true
        break
      }
    }
    if (need) {
      await db.meta.put({ key: META_PENDING_REFRESH, value: '1' })
      setPendingBanner(true)
    }
  }, [])

  useEffect(() => {
    if (q.data) void checkShouldFlag(q.data)
  }, [q.data, checkShouldFlag])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const row = await db.meta.get(META_PENDING_REFRESH)
      if (!cancelled && row) setPendingBanner(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const applyRemoteSnapshot = useCallback(async () => {
    if (!q.data) return
    await db.transaction('rw', db.tasks, db.meta, async () => {
      await db.tasks.clear()
      await db.tasks.bulkPut(q.data)
      await db.meta.delete(META_PENDING_REFRESH)
    })
    setPendingBanner(false)
    await queryClient.invalidateQueries({ queryKey: ['gasTasks'] })
  }, [q.data, queryClient])

  const dismissBanner = useCallback(async () => {
    await db.meta.delete(META_PENDING_REFRESH)
    setPendingBanner(false)
  }, [])

  return {
    baseUrl,
    remoteQuery: q,
    pendingBanner,
    applyRemoteSnapshot,
    dismissBanner,
  }
}

export function useLocalTasks() {
  return useLiveQuery(() => db.tasks.orderBy('updatedAt').reverse().toArray(), [])
}
