import { useEffect, useMemo, useState } from 'react'

import { getRequiredOrders } from '../api/purchaseRecommendations'
import caretDownIcon from '../assets/icons/caret-down.svg'
import searchIcon from '../assets/icons/search.svg'
import type { SortDirection } from '../types/inventory'
import type { RequiredOrderItem } from '../types/purchaseRecommendation'

const PAGE_SIZE = 9

type OrderPageProps = {
  repositoryId: string
}

type OrderTab = 'required' | 'additional' | 'auto'

const orderTabs: { label: string; value: OrderTab }[] = [
  { label: '필요 발주', value: 'required' },
  { label: '추가 발주', value: 'additional' },
  { label: '자동 발주', value: 'auto' },
]

function normalizeText(value: string | number | null | undefined) {
  return value == null ? '' : String(value).trim().toLowerCase()
}

export function OrderPage({ repositoryId }: OrderPageProps) {
  const [activeTab, setActiveTab] = useState<OrderTab>('required')
  const [requiredOrders, setRequiredOrders] = useState<RequiredOrderItem[]>([])
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function loadRequiredOrders() {
      try {
        setIsLoading(true)
        setErrorMessage(null)

        const data = await getRequiredOrders(repositoryId)

        if (!ignore) {
          setRequiredOrders(data)
          setCurrentPage(1)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : '필요 발주 데이터를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    loadRequiredOrders()

    return () => {
      ignore = true
    }
  }, [repositoryId])

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const rows = keyword
      ? requiredOrders.filter((row) =>
          [row.item_name, row.item_code, row.customer_name, row.quotation_no]
            .map(normalizeText)
            .some((value) => value.includes(keyword)),
        )
      : requiredOrders

    return [...rows].sort((a, b) => {
      const result = a.item_name.localeCompare(b.item_name, 'ko-KR')
      return sortDirection === 'asc' ? result : -result
    })
  }, [query, requiredOrders, sortDirection])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE
  const visibleRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE)
  const emptyRowCount =
    visibleRows.length > 0 ? Math.max(0, PAGE_SIZE - visibleRows.length) : 0
  const visibleItemIds = visibleRows.map((row) => row.quotation_item_id)
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

  return (
    <section className="order-page" aria-label="발주">
      <nav className="tabs order-tabs" aria-label="발주 탭">
        {orderTabs.map((tab) => (
          <button
            className={activeTab === tab.value ? 'active' : ''}
            type="button"
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value)
              setCurrentPage(1)
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'required' ? (
        <div className="order-table-section">
          <div className="order-summary-row">
            <h1>공정 내 필요 물품 : {requiredOrders.length}건</h1>
            <div className="order-actions">
              <button className="order-bulk-button" type="button">
                일괄 발주
              </button>
              <button
                className="order-more-button"
                type="button"
                aria-label="발주 더보기"
              >
                ...
              </button>
            </div>
          </div>

          <div className="order-table">
            <div className="order-toolbar">
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
                  placeholder="부품명, 거래처, 운송장 번호 등을 입력해주세요."
                  aria-label="필요 발주 검색"
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setCurrentPage(1)
                  }}
                />
                <img src={searchIcon} alt="" />
              </label>
            </div>

            {isLoading ? (
              <div className="empty-inventory">
                필요 발주 데이터를 불러오는 중입니다.
              </div>
            ) : errorMessage ? (
              <div className="empty-inventory">{errorMessage}</div>
            ) : visibleRows.length === 0 ? (
              <div className="empty-inventory">
                표시할 필요 발주 품목이 없습니다.
              </div>
            ) : (
              <>
                {visibleRows.map((row) => (
                  <article
                    className="order-row"
                    key={`${row.quotation_document_id}-${row.quotation_item_id}`}
                  >
                    <div className="order-row-main">
                      <label className="order-check-button">
                        <input
                          type="checkbox"
                          checked={selectedItemIds.has(row.quotation_item_id)}
                          onChange={() => toggleRow(row.quotation_item_id)}
                          aria-label={`${row.item_name} 선택`}
                        />
                      </label>
                      <span>{row.item_name}</span>
                    </div>
                    <div className="order-row-detail">
                      <span>{row.customer_name || '-'}</span>
                      <i aria-hidden="true" />
                      <span>-</span>
                    </div>
                  </article>
                ))}
                {Array.from({ length: emptyRowCount }).map((_, index) => (
                  <div
                    className="order-empty-row"
                    key={`empty-${index}`}
                    aria-hidden="true"
                  />
                ))}
                <div className="purchase-pagination" aria-label="필요 발주 페이지">
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
      ) : (
        <section className="empty-tab-panel" aria-label={activeTab}>
          {activeTab === 'additional'
            ? '추가 발주 화면은 준비 중입니다.'
            : '자동 발주 화면은 준비 중입니다.'}
        </section>
      )}
    </section>
  )
}
