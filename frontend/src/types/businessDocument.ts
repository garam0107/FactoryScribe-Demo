export type PurchaseOrderItem = {
  id: string
  purchase_order_document_id: string
  repository_id: string
  item_code: string
  item_name: string
  spec: string | null
  unit: string | null
  quantity: number
  requested_delivery_date: string | null
  unit_price: number | null
  status_text: string | null
  note: string | null
  source_row: number | null
  created_at: string
  updated_at: string
}

export type PurchaseOrderDocument = {
  id: string
  repository_id: string
  purchase_order_no: string
  order_date: string | null
  recipient_company_name: string | null
  issuer_company_name: string | null
  project_name: string | null
  issuer_contact_name: string | null
  issuer_contact_text: string | null
  source_filename: string | null
  source_sheet_name: string | null
  created_at: string
  updated_at: string
  items: PurchaseOrderItem[]
}
