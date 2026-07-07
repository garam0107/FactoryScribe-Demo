import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getPurchaseOrders } from '../../api/businessDocuments'
import caretDownIcon from '../../assets/icons/caret-down.svg'
import chevronDownIcon from '../../assets/icons/chevron-down.svg'
import searchIcon from '../../assets/icons/search.svg'
import type {
  PurchaseOrderDocument,
  PurchaseOrderItem,
} from '../../types/businessDocument'
import type { SortDirection } from '../../types/inventory'

const PAGE_SIZE = 9

type MonthlyPurchaseOrdersPanelProps = {
  repositoryId: string
}

type PurchaseOrderRow = PurchaseOrderItem & {
  purchase_order_no: string
  recipient_company_name: string | null
}

function getCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export function MonthlyPurchaseOrdersPanel({
  repositoryId,
}: MonthlyPurchaseOrdersPanelProps) {
  const { t } = useTranslation('main')
  const [documents, setDocuments] = useState<PurchaseOrderDocument[]>([])
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const currentMonth = useMemo(() => getCurrentMonth(), [])

  useEffect(() => {
    let ignore = false

    async function loadPurchaseOrders() {
      try {
        setIsLoading(true)
        setErrorMessage(null)

        const data = await getPurchaseOrders(repositoryId, currentMonth)

        if (!ignore) {
          setDocuments(data)
          setCurrentPage(1)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : '발주서 데이터를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    loadPurchaseOrders()

    return () => {
      ignore = true
    }
  }, [currentMonth, repositoryId])

  const rows = useMemo<PurchaseOrderRow[]>(() => {
    return documents.flatMap((document) =>
      document.items.map((item) => ({
        ...item,
        purchase_order_no: document.purchase_order_no,
        recipient_company_name: document.recipient_company_name,
      })),
    )
  }, [documents])

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? rows.filter((row) => {
          return [
            row.item_name,
            row.item_code,
            row.purchase_order_no,
            row.recipient_company_name,
          ]
            .map(normalizeText)
            .some((value) => value.includes(keyword))
        })
      : rows

    return [...filtered].sort((a, b) => {
      const result = a.item_name.localeCompare(b.item_name, 'ko-KR')
      return sortDirection === 'asc' ? result : -result
    })
  }, [query, rows, sortDirection])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE
  const visibleRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE)
  const emptyRowCount =
    visibleRows.length > 0 ? Math.max(0, PAGE_SIZE - visibleRows.length) : 0
  const summaryEnd = t('dashboard.monthlyOrdersSummaryEnd')

  return (
    <section
      className="purchase-orders-panel"
      aria-label={t('dashboard.monthlyOrders')}
    >
      <div className="purchase-orders-summary">
        <p>{t('dashboard.monthlyOrdersSummaryStart')}</p>
        <p>
          {t('dashboard.monthlyOrdersSummaryTotal', {
            total: documents.length,
          })}
        </p>
        <strong>
          {t('dashboard.monthlyOrdersSummaryShipping', { shipping: '-' })}
        </strong>
        {summaryEnd ? <p>{summaryEnd}</p> : null}
      </div>

      <div className="purchase-orders-table">
        <div className="purchase-orders-toolbar">
          <button
            className="sort-button purchase-sort-button"
            type="button"
            onClick={() => {
              setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
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

          <label className="purchase-search">
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
          <div className="empty-inventory">발주서 데이터를 불러오는 중입니다.</div>
        ) : errorMessage ? (
          <div className="empty-inventory">{errorMessage}</div>
        ) : visibleRows.length === 0 ? (
          <div className="empty-inventory">표시할 이번 달 발주 데이터가 없습니다.</div>
        ) : (
          <>
            {visibleRows.map((row) => (
              <article className="purchase-order-row" key={row.id}>
                <div className="purchase-order-main">
                  <span>{row.item_name}</span>
                </div>
                <div className="purchase-order-detail">
                  <span>{row.recipient_company_name || '-'}</span>
                  <i aria-hidden="true" />
                  <span>-</span>
                  <img src={chevronDownIcon} alt="" />
                </div>
              </article>
            ))}
            {Array.from({ length: emptyRowCount }).map((_, index) => (
              <div
                className="purchase-order-empty-row"
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
                &laquo;
              </button>
              <button
                type="button"
                aria-label="이전 페이지"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                &lsaquo;
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
                &rsaquo;
              </button>
              <button
                type="button"
                aria-label="마지막 페이지"
                disabled={safeCurrentPage === pageCount}
                onClick={() => setCurrentPage(pageCount)}
              >
                &raquo;
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
