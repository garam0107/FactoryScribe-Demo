export type InventoryDashboard = {
  repository_id: string
  total_items: number
  total_current_stock: number
  total_target_stock: number
  inventory_remaining_rate: number | null
  average_price_increase_rate: number | null
  shortage_items: number
}

export type InventoryItem = {
  id: string
  item_code: string
  item_name: string
  unit: string | null
  current_stock: number
  target_stock: number | null
  current_unit_price: number | null
  is_shortage: boolean
}

export type SortDirection = 'asc' | 'desc'
