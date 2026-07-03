import { useMemo, useState } from 'react'

import caretDownIcon from '../assets/icons/caret-down.svg'
import searchIcon from '../assets/icons/search.svg'
import type { InventoryDashboard, InventoryItem, SortDirection } from '../types/inventory'

type InventoryManagementPageProps = {
  dashboard: InventoryDashboard | null
  items: InventoryItem[]
  isLoading: boolean
  errorMessage: string | null
}

type InventoryTab = 'total' | 'shortage' | 'comparison'

const PAGE_SIZE = 9

const inventoryTabs: { value: InventoryTab; label: string }[] = [
  { value: 'total', label: '총 재고 현황' },
  { value: 'shortage', label: '부족 재고' },
  { value: 'comparison', label: '출하 견적서 비교' },
]

function normalizeText(value: string | number | null | undefined) {
  return value == null ? '' : String(value).trim().toLowerCase()
}

function formatPrice(item: InventoryItem) {
  const price = item.current_unit_price ?? 0
  return `${Math.round(price).toLocaleString('ko-KR')} KRW${item.unit ? ` /${item.unit}` : ''}`
}

function formatRemainingStock(item: InventoryItem) {
  const quantity = item.current_remaining_quantity ?? item.current_stock
  return `${Math.round(quantity).toLocaleString('ko-KR')}${item.unit ?? '개'}`
}

function compareInventoryItems(
  a: InventoryItem,
  b: InventoryItem,
  direction: SortDirection,
) {
  if (a.is_shortage !== b.is_shortage) {
    return a.is_shortage ? -1 : 1
  }

  const result = a.item_name.localeCompare(b.item_name, 'ko-KR')
  return direction === 'asc' ? result : -result
}

export function InventoryManagementPage({
  dashboard,
  items,
  isLoading,
  errorMessage,
}: InventoryManagementPageProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>('total')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(),
  )

  const totalItems = dashboard?.total_items ?? items.length
  const shortageItems =
    dashboard?.shortage_items ?? items.filter((item) => item.is_shortage).length

  const filteredItems = useMemo(() => {
    if (activeTab === 'comparison') {
      return []
    }

    const keyword = query.trim().toLowerCase()
    const sourceItems =
      activeTab === 'shortage' ? items.filter((item) => item.is_shortage) : items

    const searchedItems = keyword
      ? sourceItems.filter((item) =>
          [
            item.item_name,
            item.item_code,
            item.supplier,
            item.category,
            item.stock_status,
          ]
            .map(normalizeText)
            .some((value) => value.includes(keyword)),
        )
      : sourceItems

    return [...searchedItems].sort((a, b) =>
      compareInventoryItems(a, b, sortDirection),
    )
  }, [activeTab, items, query, sortDirection])

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE
  const visibleItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE)
  const emptyRowCount =
    visibleItems.length > 0 ? Math.max(0, PAGE_SIZE - visibleItems.length) : 0
  const visibleItemIds = visibleItems.map((item) => item.id)
  const allVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.every((itemId) => selectedItemIds.has(itemId))

  const toggleVisibleRows = () => {
    setSelectedItemIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (allVisibleSelected) {
        visibleItemIds.forEach((itemId) => nextIds.delete(itemId))
      } else {
        visibleItemIds.forEach((itemId) => nextIds.add(itemId))
      }

      return nextIds
    })
  }

  const toggleRow = (itemId: string) => {
    setSelectedItemIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(itemId)) {
        nextIds.delete(itemId)
      } else {
        nextIds.add(itemId)
      }

      return nextIds
    })
  }

  const handleTabChange = (tab: InventoryTab) => {
    setActiveTab(tab)
    setCurrentPage(1)
    setQuery('')
  }

  return (
    <section className="inventory-management-page" aria-label="재고 관리">
      <div className="inventory-page-header">
        <nav className="inventory-page-tabs" aria-label="재고 관리 탭">
          {inventoryTabs.map((tab) => (
            <button
              className={activeTab === tab.value ? 'active' : ''}
              type="button"
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="inventory-table-section">
        <div className="inventory-summary-row">
          <h2>
            현재 재고 : {totalItems} 가지
            <span>부족 재고 : {shortageItems}가지</span>
          </h2>

          <div className="inventory-page-actions">
            <button className="inventory-add-button" type="button">
              재고 추가
            </button>
            <button
              className="inventory-more-button"
              type="button"
              aria-label="재고 관리 더보기"
            >
              ...
            </button>
          </div>
        </div>

        <div className="inventory-page-table">
          <div className="order-toolbar inventory-page-toolbar">
            <label className="order-check-button">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleVisibleRows}
                aria-label="현재 페이지 전체 선택"
              />
            </label>
            <button
              className="sort-button order-sort-button"
              type="button"
              onClick={() => {
                setSortDirection((current) =>
                  current === 'asc' ? 'desc' : 'asc',
                )
                setCurrentPage(1)
              }}
            >
              <span>이름 순</span>
              <img
                className={sortDirection === 'desc' ? 'rotate' : ''}
                src={caretDownIcon}
                alt=""
              />
            </button>
            <label className="order-search">
              <input
                type="search"
                value={query}
                placeholder="재고명, 거래처명 등을 입력해주세요."
                aria-label="재고 검색"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setCurrentPage(1)
                }}
              />
              <img src={searchIcon} alt="" />
            </label>
          </div>

          {activeTab === 'comparison' ? (
            <div className="empty-inventory">출하 견적서 비교 화면은 준비 중입니다.</div>
          ) : isLoading ? (
            <div className="empty-inventory">재고 데이터를 불러오는 중입니다.</div>
          ) : errorMessage ? (
            <div className="empty-inventory">{errorMessage}</div>
          ) : visibleItems.length === 0 ? (
            <div className="empty-inventory">표시할 재고 데이터가 없습니다.</div>
          ) : (
            <>
              {visibleItems.map((item) => (
                <article className="inventory-page-row" key={item.id}>
                  <div className="inventory-page-row-main">
                    <label className="order-check-button">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleRow(item.id)}
                        aria-label={`${item.item_name} 선택`}
                      />
                    </label>
                    <span>{item.item_name}</span>
                    {item.is_shortage ? (
                      <span className="shortage-badge">
                        <span className="shortage-dot" />
                        부족
                      </span>
                    ) : null}
                  </div>
                  <div className="inventory-page-row-detail">
                    <span>{formatPrice(item)}</span>
                    <i aria-hidden="true" />
                    <span>잔여 수량 : {formatRemainingStock(item)}</span>
                  </div>
                </article>
              ))}
              {Array.from({ length: emptyRowCount }).map((_, index) => (
                <div
                  className="inventory-page-empty-row"
                  key={`inventory-empty-${index}`}
                  aria-hidden="true"
                />
              ))}
              <div className="purchase-pagination" aria-label="재고 페이지">
                <button
                  type="button"
                  aria-label="첫 페이지"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  «
                </button>
                <button
                  type="button"
                  aria-label="이전 페이지"
                  disabled={safeCurrentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }).map((_, index) => {
                  const page = index + 1
                  return (
                    <button
                      className={page === safeCurrentPage ? 'active' : ''}
                      type="button"
                      key={page}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  type="button"
                  aria-label="다음 페이지"
                  disabled={safeCurrentPage === pageCount}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(pageCount, page + 1))
                  }
                >
                  ›
                </button>
                <button
                  type="button"
                  aria-label="마지막 페이지"
                  disabled={safeCurrentPage === pageCount}
                  onClick={() => setCurrentPage(pageCount)}
                >
                  »
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
