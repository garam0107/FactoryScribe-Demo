type DashboardInventoryToolbarProps = {
  totalItems: number
  shortageItems: number
}

export function DashboardInventoryToolbar({
  totalItems,
  shortageItems,
}: DashboardInventoryToolbarProps) {
  return (
    <div className="inventory-heading">
      <h2>
        현재 재고 : <strong>{totalItems}가지</strong>
        <span>부족 재고 : {shortageItems}가지</span>
      </h2>
    </div>
  )
}
