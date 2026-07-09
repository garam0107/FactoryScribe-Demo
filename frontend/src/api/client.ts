import type { ApiResponse } from '../types/api'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  const body = (await response.json()) as ApiResponse<T>

  if (!body.success) {
    throw new Error(body.message ?? 'API request failed')
  }

  return body.data
}

export async function apiPost<T, B>(path: string, payload: B): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  const body = (await response.json()) as ApiResponse<T>

  if (!body.success) {
    throw new Error(body.message ?? 'API request failed')
  }

  return body.data
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  const body = (await response.json()) as ApiResponse<T>

  if (!body.success) {
    throw new Error(body.message ?? 'API request failed')
  }

  return body.data
}
