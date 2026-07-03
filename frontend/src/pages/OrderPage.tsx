import { useEffect, useMemo, useState } from 'react'

import { getInventoryItems } from '../api/inventory'
import { getRequiredOrders } from '../api/purchaseRecommendations'
import caretDownIcon from '../assets/icons/caret-down.svg'
import searchIcon from '../assets/icons/search.svg'
import type { InventoryItem, SortDirection } from '../types/inventory'
import type { RequiredOrderItem } from '../types/purchaseRecommendation'

const PAGE_SIZE = 9

type OrderPageProps = {
  repositoryId: string
}

type OrderTab = 'required' | 'additional' | 'auto'

type OrderRow = {
  id: string
  itemName: string
  itemCode?: string | null
  partnerName: string | null
  trackingNo: string | null
  searchSource?: Array<string | number | null | undefined>
}

const orderTabs: { label: string; value: OrderTab }[] = [
  { label: '필요 발주', value: 'required' },
  { label: '추가 발주', value: 'additional' },
  { label: '자동 발주', value: 'auto' },
]

const additionalOrderRows: OrderRow[] = [
  {
    id: 'additional-cleaning-cloth',
    itemName: '극세사 작업용 와이퍼',
    itemCode: 'ADD-WIPER-001',
    partnerName: '(주) 현장소모품',
    trackingNo: '-',
  },
  {
    id: 'additional-cable-tie',
    itemName: '케이블 타이 200mm',
    itemCode: 'ADD-TIE-200',
    partnerName: '(주) 산업자재몰',
    trackingNo: '-',
  },
  {
    id: 'additional-nitrile-glove',
    itemName: '니트릴 장갑 L',
    itemCode: 'ADD-GLOVE-L',
    partnerName: 'Vietnam Safety Co.',
    trackingNo: '-',
  },
  {
    id: 'additional-mask',
    itemName: '방진 마스크',
    itemCode: 'ADD-MASK-01',
    partnerName: '(주) 세이프라인',
    trackingNo: '-',
  },
  {
    id: 'additional-label',
    itemName: '공정 식별 라벨',
    itemCode: 'ADD-LABEL-01',
    partnerName: '(주) 라벨테크',
    trackingNo: '-',
  },
  {
    id: 'additional-tape',
    itemName: '절연 테이프',
    itemCode: 'ADD-TAPE-01',
    partnerName: 'Tech Supply VN',
    trackingNo: '-',
  },
  {
    id: 'additional-marker',
    itemName: '유성 마킹펜',
    itemCode: 'ADD-MARKER-01',
    partnerName: '(주) 오피스팩토리',
    trackingNo: '-',
  },
  {
    id: 'additional-pallet-wrap',
    itemName: '팔레트 랩 필름',
    itemCode: 'ADD-WRAP-01',
    partnerName: 'Global Pack Co.',
    trackingNo: '-',
  },
  {
    id: 'additional-cleaner',
    itemName: '부품 세척제',
    itemCode: 'ADD-CLEANER-01',
    partnerName: '(주) 케미컬라인',
    trackingNo: '-',
  },
  {
    id: 'additional-desiccant',
    itemName: '제습제 50g',
    itemCode: 'ADD-DESICCANT-50',
    partnerName: '(주) 패키징허브',
    trackingNo: '-',
  },
]

function normalizeText(value: string | number | null | undefined) {
  return value == null ? '' : String(value).trim().toLowerCase()
}

function toRequiredOrderRow(item: RequiredOrderItem): OrderRow {
  return {
    id: item.quotation_item_id,
    itemName: item.item_name,
    itemCode: item.item_code,
    partnerName: item.customer_name,
    trackingNo: '-',
    searchSource: [item.quotation_no],
  }
}

function toAutoOrderRow(item: InventoryItem): OrderRow {
  return {
    id: item.id,
    itemName: item.item_name,
    itemCode: item.item_code,
    partnerName: item.supplier || '거래처 미지정',
    trackingNo: '-',
    searchSource: [item.category, item.stock_status, item.current_stock],
  }
}

function getTabTitle(activeTab: OrderTab, count: number) {
  if (activeTab === 'additional') {
    return `공정 외 추가 물품 : ${count}건`
  }

  if (activeTab === 'auto') {
    return `자동 발주 필요 물품 : ${count}건`
  }

  return `공정 내 필요 물품 : ${count}건`
}

function getPrimaryButtonLabel(activeTab: OrderTab) {
  return activeTab === 'auto' ? '자동 발주 등록' : '일괄 발주'
}

function getEmptyMessage(activeTab: OrderTab) {
  if (activeTab === 'additional') {
    return '표시할 추가 발주 품목이 없습니다.'
  }

  if (activeTab === 'auto') {
    return '표시할 자동 발주 품목이 없습니다.'
  }

  return '표시할 필요 발주 품목이 없습니다.'
}

export function OrderPage({ repositoryId }: OrderPageProps) {
  const [activeTab, setActiveTab] = useState<OrderTab>('required')
  const [requiredOrders, setRequiredOrders] = useState<RequiredOrderItem[]>([])
  const [autoOrders, setAutoOrders] = useState<InventoryItem[]>([])
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [isRequiredLoading, setIsRequiredLoading] = useState(true)
  const [isAutoLoading, setIsAutoLoading] = useState(true)
  const [requiredErrorMessage, setRequiredErrorMessage] = useState<string | null>(
    null,
  )
  const [autoErrorMessage, setAutoErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function loadOrderData() {
      try {
        setIsRequiredLoading(true)
        setRequiredErrorMessage(null)
        const data = await getRequiredOrders(repositoryId)

        if (!ignore) {
          setRequiredOrders(data)
        }
      } catch (error) {
        if (!ignore) {
          setRequiredErrorMessage(
            error instanceof Error
              ? error.message
              : '필요 발주 데이터를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!ignore) {
          setIsRequiredLoading(false)
        }
      }

      try {
        setIsAutoLoading(true)
        setAutoErrorMessage(null)
        const data = await getInventoryItems(repositoryId, {
          shortageOnly: true,
        })

        if (!ignore) {
          setAutoOrders(data)
        }
      } catch (error) {
        if (!ignore) {
          setAutoErrorMessage(
            error instanceof Error
              ? error.message
              : '자동 발주 데이터를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!ignore) {
          setIsAutoLoading(false)
        }
      }
    }

    loadOrderData()

    return () => {
      ignore = true
    }
  }, [repositoryId])

  const activeRows = useMemo<OrderRow[]>(() => {
    if (activeTab === 'additional') {
      return additionalOrderRows
    }

    if (activeTab === 'auto') {
      return autoOrders.map(toAutoOrderRow)
    }

    return requiredOrders.map(toRequiredOrderRow)
  }, [activeTab, autoOrders, requiredOrders])

  const isLoading =
    (activeTab === 'required' && isRequiredLoading) ||
    (activeTab === 'auto' && isAutoLoading)
  const errorMessage =
    activeTab === 'required'
      ? requiredErrorMessage
      : activeTab === 'auto'
        ? autoErrorMessage
        : null

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const rows = keyword
      ? activeRows.filter((row) =>
          [
            row.itemName,
            row.itemCode,
            row.partnerName,
            row.trackingNo,
            ...(row.searchSource ?? []),
          ]
            .map(normalizeText)
            .some((value) => value.includes(keyword)),
        )
      : activeRows

    return [...rows].sort((a, b) => {
      const result = a.itemName.localeCompare(b.itemName, 'ko-KR')
      return sortDirection === 'asc' ? result : -result
    })
  }, [activeRows, query, sortDirection])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE
  const visibleRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE)
  const emptyRowCount =
    visibleRows.length > 0 ? Math.max(0, PAGE_SIZE - visibleRows.length) : 0
  const visibleItemIds = visibleRows.map((row) => row.id)
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
              setQuery('')
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="order-table-section">
        <div className="order-summary-row">
          <h1>{getTabTitle(activeTab, activeRows.length)}</h1>
          <div className="order-actions">
            <button className="order-bulk-button" type="button">
              {getPrimaryButtonLabel(activeTab)}
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
                aria-label="발주 검색"
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
              발주 데이터를 불러오는 중입니다.
            </div>
          ) : errorMessage ? (
            <div className="empty-inventory">{errorMessage}</div>
          ) : visibleRows.length === 0 ? (
            <div className="empty-inventory">{getEmptyMessage(activeTab)}</div>
          ) : (
            <>
              {visibleRows.map((row) => (
                <article className="order-row" key={row.id}>
                  <div className="order-row-main">
                    <label className="order-check-button">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`${row.itemName} 선택`}
                      />
                    </label>
                    <span>{row.itemName}</span>
                  </div>
                  <div className="order-row-detail">
                    <span>{row.partnerName || '-'}</span>
                    <i aria-hidden="true" />
                    <span>{row.trackingNo || '-'}</span>
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
              <div className="purchase-pagination" aria-label="발주 페이지">
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
