import { apiGet } from './client'
import type { PurchaseOrderDocument } from '../types/businessDocument'

export function getPurchaseOrders(repositoryId: string, month?: string) {
  const params = new URLSearchParams()
  if (month) {
    params.set('month', month)
  }

  const query = params.toString()
  return apiGet<PurchaseOrderDocument[]>(
    `/business-documents/repositories/${repositoryId}/purchase-orders${query ? `?${query}` : ''}`,
  )
}
