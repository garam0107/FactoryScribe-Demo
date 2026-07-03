import { apiGet } from './client'
import type { RequiredOrderItem } from '../types/purchaseRecommendation'

export function getRequiredOrders(repositoryId: string) {
  return apiGet<RequiredOrderItem[]>(
    `/purchase-recommendations/repositories/${repositoryId}/required-orders`,
  )
}
