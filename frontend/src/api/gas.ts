import type {
  DeleteRequestBody,
  GetTasksResponse,
  TaskRecord,
  UpsertRequestBody,
} from '../types/task'

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export function getGasBaseUrl(): string | undefined {
  const u = import.meta.env.VITE_GAS_WEB_APP_URL as string | undefined
  return u ? trimTrailingSlash(u) : undefined
}

export async function fetchTasksFromGas(baseUrl: string): Promise<TaskRecord[]> {
  const res = await fetch(`${baseUrl}?mode=tasks`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`GET tasks failed: ${res.status}`)
  }
  const data = (await res.json()) as GetTasksResponse
  if (!data.ok) {
    throw new Error(data.message || data.error || 'GET tasks error')
  }
  return data.tasks
}

export async function upsertTaskOnGas(
  baseUrl: string,
  body: UpsertRequestBody,
): Promise<TaskRecord> {
  const res = await fetch(baseUrl, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`POST upsert failed: ${res.status}`)
  }
  const data = (await res.json()) as { ok: boolean; task?: TaskRecord; message?: string; error?: string }
  if (!data.ok || !data.task) {
    throw new Error(data.message || data.error || 'POST upsert error')
  }
  return data.task
}

export async function deleteTaskOnGas(
  baseUrl: string,
  body: DeleteRequestBody,
): Promise<void> {
  const res = await fetch(baseUrl, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST delete failed: ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.message || data.error || 'POST delete error')
}
