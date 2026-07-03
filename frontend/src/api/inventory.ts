import { apiGet } from './client'
import type { InventoryDashboard, InventoryItem } from '../types/inventory'

export function getInventoryDashboard(repositoryId: string) {
  return apiGet<InventoryDashboard>(
    `/inventory/repositories/${repositoryId}/dashboard`,
  )
}

export function getInventoryItems(
  repositoryId: string,
  options?: { shortageOnly?: boolean },
) {
  const params = new URLSearchParams()
  if (options?.shortageOnly) {
    params.set('shortage_only', 'true')
  }

  const query = params.toString()
  return apiGet<InventoryItem[]>(
    `/inventory/repositories/${repositoryId}/items${query ? `?${query}` : ''}`,
  )
}
