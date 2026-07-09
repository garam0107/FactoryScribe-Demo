import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation('main')

  return (
    <div className="inventory-page-table">
      <div className="order-toolbar inventory-page-toolbar">
        <button
          className="sort-button order-sort-button"
          type="button"
          onClick={onToggleSort}
        >
          <span>{t('dashboard.sortByName')}</span>
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
            <article className="inventory-page-row" key={item.id}>
              <div className="inventory-page-row-main">
                <span className="inventory-row-name">{item.item_name}</span>
                {item.is_shortage ? (
                  <span className="shortage-badge">
                    <span className="shortage-dot" />
                    {t('dashboard.shortage')}
                  </span>
                ) : (
                  <span className="shortage-badge shortage-badge-placeholder" aria-hidden="true" />
                )}
              </div>
              <div className="inventory-page-row-detail">
                <span className="inventory-detail-primary">{formatCurrency(item.current_unit_price)}</span>
                <i aria-hidden="true" />
                <span className="inventory-detail-secondary">
                  {t('dashboard.remainingQuantity')} : {formatStock(item)}
                </span>
              </div>
            </article>
          ))}
          {canShowMore ? (
            <button
              className="show-more-button"
              type="button"
              aria-label={t('dashboard.viewMore')}
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
