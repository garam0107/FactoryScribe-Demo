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
  category: string | null
  supplier: string | null
  unit: string | null
  current_stock: number
  target_stock: number | null
  previous_year_usage_quantity: number | null
  current_remaining_quantity: number | null
  current_year_expected_quantity: number | null
  current_unit_price: number | null
  previous_unit_price: number | null
  price_change_rate: number | null
  stock_status: string | null
  is_shortage: boolean
}

export type SortDirection = 'asc' | 'desc'
