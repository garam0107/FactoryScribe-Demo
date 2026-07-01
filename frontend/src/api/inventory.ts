import { apiGet } from './client'
import type { InventoryDashboard, InventoryItem } from '../types/inventory'

export function getInventoryDashboard(repositoryId: string) {
  return apiGet<InventoryDashboard>(
    `/inventory/repositories/${repositoryId}/dashboard`,
  )
}

export function getInventoryItems(repositoryId: string) {
  return apiGet<InventoryItem[]>(`/inventory/repositories/${repositoryId}/items`)
}
