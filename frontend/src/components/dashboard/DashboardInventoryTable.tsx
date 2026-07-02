import caretDownIcon from '../../assets/icons/caret-down.svg'
import chevronDownIcon from '../../assets/icons/chevron-down.svg'
import type { InventoryItem, SortDirection } from '../../types/inventory'

type DashboardInventoryTableProps = {
  items: InventoryItem[]
  sortDirection: SortDirection
  isLoading: boolean
  errorMessage: string | null
  canShowMore: boolean
  onToggleSort: () => void
  onShowMore: () => void
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '0 KRW'
  }

  return `${Math.round(value).toLocaleString('ko-KR')} KRW`
}

function formatStock(item: InventoryItem) {
  const stock = Number(item.current_stock.toFixed(3))
  return `${stock.toLocaleString('ko-KR')}${item.unit ? ` ${item.unit}` : ''}`
}

export function DashboardInventoryTable({
  items,
  sortDirection,
  isLoading,
  errorMessage,
  canShowMore,
  onToggleSort,
  onShowMore,
}: DashboardInventoryTableProps) {
  return (
    <div className="inventory-list">
      <div className="inventory-list-header">
        <button className="sort-button" type="button" onClick={onToggleSort}>
          <span>이름순</span>
          <img
            className={sortDirection === 'desc' ? 'rotate' : ''}
            src={caretDownIcon}
            alt=""
          />
        </button>
      </div>

      {isLoading ? (
        <div className="empty-inventory">재고 데이터를 불러오는 중입니다.</div>
      ) : errorMessage ? (
        <div className="empty-inventory">{errorMessage}</div>
      ) : items.length === 0 ? (
        <div className="empty-inventory">표시할 재고 데이터가 없습니다.</div>
      ) : (
        <>
          {items.map((item) => (
            <article className="inventory-row" key={item.id}>
              <div className="item-main">
                <span className="item-name">{item.item_name}</span>
                {item.is_shortage ? (
                  <span className="shortage-badge">
                    <span className="shortage-dot" />
                    부족
                  </span>
                ) : null}
              </div>
              <div className="item-detail">
                <span>{formatCurrency(item.current_unit_price)}</span>
                <span>잔여 수량 : {formatStock(item)}</span>
              </div>
            </article>
          ))}
          {canShowMore ? (
            <button
              className="show-more-button"
              type="button"
              aria-label="재고 10개 더 보기"
              onClick={onShowMore}
            >
              <img src={chevronDownIcon} alt="" />
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}
