export type RequiredOrderItem = {
  quotation_item_id: string
  quotation_document_id: string
  quotation_no: string
  item_code: string
  item_name: string
  customer_name: string | null
  unit_price: number | null
  delivery_deadline: string | null
}
