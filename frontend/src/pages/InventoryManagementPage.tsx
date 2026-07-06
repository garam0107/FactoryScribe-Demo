import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'

import {
  getShortageQuotations,
} from '../api/inventory'
import caretDownIcon from '../assets/icons/caret-down.svg'
import chevronDownIcon from '../assets/icons/chevron-down.svg'
import filePlusIcon from '../assets/icons/file-plus.svg'
import searchIcon from '../assets/icons/search.svg'
import type {
  InventoryDashboard,
  InventoryItem,
  ShortageQuotationDocument,
  SortDirection,
} from '../types/inventory'

type InventoryManagementPageProps = {
  repositoryId: string
  dashboard: InventoryDashboard | null
  items: InventoryItem[]
  isLoading: boolean
  errorMessage: string | null
}

type InventoryTab = 'total' | 'shortage' | 'comparison'
type PreviewFileKind = 'image' | 'pdf' | 'xlsx' | 'unknown'

type InventoryPreviewFile = {
  id: string
  name: string
  kind: PreviewFileKind
  objectUrl: string | null
  rows: string[][]
}

const PAGE_SIZE = 9

const inventoryTabs: { value: InventoryTab; label: string }[] = [
  { value: 'total', label: '총 재고 현황' },
  { value: 'shortage', label: '부족 재고' },
  { value: 'comparison', label: '견적서 비교' },
]

function normalizeText(value: string | number | null | undefined) {
  return value == null ? '' : String(value).trim().toLowerCase()
}

function getPreviewFileKind(file: File): PreviewFileKind {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (file.type.startsWith('image/')) {
    return 'image'
  }

  if (file.type === 'application/pdf' || extension === 'pdf') {
    return 'pdf'
  }

  if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
    return 'xlsx'
  }

  return 'unknown'
}

async function createInventoryPreviewFile(file: File): Promise<InventoryPreviewFile> {
  const kind = getPreviewFileKind(file)
  const id = `${file.name}-${file.lastModified}-${file.size}-${crypto.randomUUID()}`

  if (kind === 'image' || kind === 'pdf') {
    return {
      id,
      name: file.name,
      kind,
      objectUrl: URL.createObjectURL(file),
      rows: [],
    }
  }

  if (kind === 'xlsx') {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : null
    const rawRows = worksheet
      ? XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
          header: 1,
          raw: false,
          blankrows: false,
        })
      : []
    const rows = rawRows
      .map((row) => row.slice(0, 8).map((cell) => String(cell ?? '')))
      .filter((row) => row.some((cell) => cell.trim()))
      .slice(0, 18)

    return {
      id,
      name: file.name,
      kind,
      objectUrl: null,
      rows,
    }
  }

  return {
    id,
    name: file.name,
    kind,
    objectUrl: null,
    rows: [],
  }
}

function formatPrice(item: InventoryItem) {
  const price = item.current_unit_price ?? 0
  return `${Math.round(price).toLocaleString('ko-KR')} KRW${item.unit ? ` /${item.unit}` : ''}`
}

function formatRemainingStock(item: InventoryItem) {
  const quantity = item.current_remaining_quantity ?? item.current_stock
  return `${Math.round(quantity).toLocaleString('ko-KR')}${item.unit?.trim() || '개'}`
}

function formatShortagePrice(unitPrice: number | null) {
  return `${Math.round(unitPrice ?? 0).toLocaleString('ko-KR')} KRW /ea`
}

function formatShortageStock(currentStock: number) {
  return `잔여 수량 : ${Math.round(currentStock).toLocaleString('ko-KR')}개`
}

function formatQuotationDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return value.replaceAll('-', '.')
}

function stripExtension(value: string) {
  return value.replace(/\.[^.]+$/, '')
}

function getQuotationTitle(document: ShortageQuotationDocument) {
  return (
    document.project_name?.trim() ||
    (document.source_filename ? stripExtension(document.source_filename) : '') ||
    document.quotation_no
  )
}

function getQuotationDueText(document: ShortageQuotationDocument) {
  return document.delivery_terms?.trim() || formatQuotationDate(document.quotation_date)
}

function parseDateText(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const match = value.match(/(\d{4})[.\-년\s]+(\d{1,2})[.\-월\s]+(\d{1,2})/)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(date.getTime()) ? null : date
}

function isDueWithinWeek(document: ShortageQuotationDocument) {
  const dueDate = parseDateText(document.delivery_terms)
  if (!dueDate) {
    return false
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)

  const daysLeft = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  return daysLeft >= 0 && daysLeft <= 7
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

function compareShortageQuotations(
  a: ShortageQuotationDocument,
  b: ShortageQuotationDocument,
  direction: SortDirection,
) {
  const result = getQuotationTitle(a).localeCompare(getQuotationTitle(b), 'ko-KR')
  return direction === 'asc' ? result : -result
}

export function InventoryManagementPage({
  repositoryId,
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
  const [shortageQuotations, setShortageQuotations] = useState<
    ShortageQuotationDocument[]
  >([])
  const [hasAttemptedShortageQuotations, setHasAttemptedShortageQuotations] =
    useState(false)
  const [isShortageLoading, setIsShortageLoading] = useState(false)
  const [shortageErrorMessage, setShortageErrorMessage] = useState<string | null>(
    null,
  )
  const [isInventoryAddModalOpen, setIsInventoryAddModalOpen] = useState(false)
  const [inventoryPreviewFiles, setInventoryPreviewFiles] = useState<
    InventoryPreviewFile[]
  >([])
  const [activePreviewFileId, setActivePreviewFileId] = useState<string | null>(
    null,
  )
  const [selectedPreviewFileIds, setSelectedPreviewFileIds] = useState<
    Set<string>
  >(() => new Set())
  const [expandedQuotationId, setExpandedQuotationId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (
      activeTab !== 'shortage' ||
      hasAttemptedShortageQuotations
    ) {
      return
    }

    let ignore = false

    async function loadShortageQuotations() {
      try {
        setIsShortageLoading(true)
        setShortageErrorMessage(null)
        const data = await getShortageQuotations(repositoryId)

        if (!ignore) {
          setShortageQuotations(data)
        }
      } catch (error) {
        if (!ignore) {
          setShortageErrorMessage(
            error instanceof Error
              ? error.message
              : '부족 재고 연관 견적서를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!ignore) {
          setHasAttemptedShortageQuotations(true)
          setIsShortageLoading(false)
        }
      }
    }

    loadShortageQuotations()

    return () => {
      ignore = true
    }
  }, [activeTab, hasAttemptedShortageQuotations, repositoryId])

  useEffect(() => {
    if (!isInventoryAddModalOpen) {
      return
    }

    const scrollY = window.scrollY
    const { body, documentElement } = document
    const previousBodyOverflow = body.style.overflow
    const previousBodyPosition = body.style.position
    const previousBodyTop = body.style.top
    const previousBodyLeft = body.style.left
    const previousBodyRight = body.style.right
    const previousBodyWidth = body.style.width
    const previousHtmlOverflow = documentElement.style.overflow

    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    documentElement.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousBodyOverflow
      body.style.position = previousBodyPosition
      body.style.top = previousBodyTop
      body.style.left = previousBodyLeft
      body.style.right = previousBodyRight
      body.style.width = previousBodyWidth
      documentElement.style.overflow = previousHtmlOverflow
      window.scrollTo(0, scrollY)
    }
  }, [isInventoryAddModalOpen])

  const totalItems = dashboard?.total_items ?? items.length
  const shortageItems =
    dashboard?.shortage_items ?? items.filter((item) => item.is_shortage).length

  const filteredItems = useMemo(() => {
    if (activeTab !== 'total' && activeTab !== 'shortage') {
      return []
    }

    if (activeTab === 'shortage') {
      return []
    }

    const keyword = query.trim().toLowerCase()
    const searchedItems = keyword
      ? items.filter((item) =>
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
      : items

    return [...searchedItems].sort((a, b) =>
      compareInventoryItems(a, b, sortDirection),
    )
  }, [activeTab, items, query, sortDirection])

  const filteredShortageQuotations = useMemo(() => {
    if (activeTab !== 'shortage') {
      return []
    }

    const keyword = query.trim().toLowerCase()
    const searchedQuotations = keyword
      ? shortageQuotations.filter((document) =>
          [
            document.quotation_no,
            document.recipient_company_name,
            document.quotation_date,
            document.project_name,
            document.delivery_terms,
            document.source_filename,
            ...document.shortage_items.flatMap((item) => [item.item_name, item.item_code]),
          ]
            .map(normalizeText)
            .some((value) => value.includes(keyword)),
        )
      : shortageQuotations

    return [...searchedQuotations].sort((a, b) =>
      compareShortageQuotations(a, b, sortDirection),
    )
  }, [activeTab, query, shortageQuotations, sortDirection])

  const activeRows = activeTab === 'shortage' ? filteredShortageQuotations : filteredItems
  const pageCount = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE
  const visibleRows = activeRows.slice(startIndex, startIndex + PAGE_SIZE)
  const emptyRowCount =
    visibleRows.length > 0 ? Math.max(0, PAGE_SIZE - visibleRows.length) : 0
  const visibleItemIds = visibleRows.map((row) =>
    'quotation_document_id' in row ? row.quotation_document_id : row.id,
  )
  const allVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.every((itemId) => selectedItemIds.has(itemId))
  const activePreviewFile =
    inventoryPreviewFiles.find((file) => file.id === activePreviewFileId) ??
    inventoryPreviewFiles[0] ??
    null

  const revokePreviewFiles = (files: InventoryPreviewFile[]) => {
    files.forEach((file) => {
      if (file.objectUrl) {
        URL.revokeObjectURL(file.objectUrl)
      }
    })
  }

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

  const handleInventoryFileChange = async (event: {
    currentTarget: HTMLInputElement
  }) => {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])

    if (files.length === 0) {
      return
    }

    try {
      const previews = await Promise.all(files.map(createInventoryPreviewFile))
      setInventoryPreviewFiles((currentFiles) => [...currentFiles, ...previews])
      setSelectedPreviewFileIds((currentIds) => {
        const nextIds = new Set(currentIds)
        previews.forEach((preview) => nextIds.add(preview.id))
        return nextIds
      })
      setActivePreviewFileId((currentId) => currentId ?? previews[0]?.id ?? null)
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : '파일 미리보기를 생성하지 못했습니다.',
      )
    } finally {
      input.value = ''
    }
  }

  const deleteActivePreviewFile = () => {
    if (!activePreviewFile) {
      return
    }

    const nextFiles = inventoryPreviewFiles.filter(
      (file) => file.id !== activePreviewFile.id,
    )
    revokePreviewFiles([activePreviewFile])
    setInventoryPreviewFiles(nextFiles)
    setSelectedPreviewFileIds((currentIds) => {
      const nextIds = new Set(currentIds)
      nextIds.delete(activePreviewFile.id)
      return nextIds
    })
    setActivePreviewFileId(nextFiles[0]?.id ?? null)
  }

  const resetPreviewFiles = () => {
    revokePreviewFiles(inventoryPreviewFiles)
    setInventoryPreviewFiles([])
    setSelectedPreviewFileIds(new Set())
    setActivePreviewFileId(null)
  }

  const togglePreviewFileSelection = (fileId: string) => {
    setSelectedPreviewFileIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(fileId)) {
        nextIds.delete(fileId)
      } else {
        nextIds.add(fileId)
      }

      return nextIds
    })
  }

  const closeInventoryAddModal = () => {
    resetPreviewFiles()
    setIsInventoryAddModalOpen(false)
  }

  const handleTabChange = (tab: InventoryTab) => {
    setActiveTab(tab)
    setCurrentPage(1)
    setQuery('')
    setSelectedItemIds(new Set())

    if (tab === 'shortage' && !hasAttemptedShortageQuotations) {
      setShortageErrorMessage(null)
    }
  }

  const changePage = (page: number) => {
    setCurrentPage(page)
    setSelectedItemIds(new Set())
  }

  const changePageWithUpdater = (updater: (page: number) => number) => {
    setCurrentPage(updater)
    setSelectedItemIds(new Set())
  }

  const renderPagination = () => (
    <div className="purchase-pagination" aria-label="재고 페이지">
      <button
        type="button"
        aria-label="첫 페이지"
        disabled={safeCurrentPage === 1}
        onClick={() => changePage(1)}
      >
        «
      </button>
      <button
        type="button"
        aria-label="이전 페이지"
        disabled={safeCurrentPage === 1}
        onClick={() => changePageWithUpdater((page) => Math.max(1, page - 1))}
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
            onClick={() => changePage(page)}
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
          changePageWithUpdater((page) => Math.min(pageCount, page + 1))
        }
      >
        ›
      </button>
      <button
        type="button"
        aria-label="마지막 페이지"
        disabled={safeCurrentPage === pageCount}
        onClick={() => changePage(pageCount)}
      >
        »
      </button>
    </div>
  )

  const renderSpreadsheetPreview = (
    file: InventoryPreviewFile,
    variant: 'large' | 'thumbnail',
  ) => (
    <div className={`inventory-add-sheet-preview ${variant}`}>
      {file.rows.length > 0 ? (
        <table>
          <tbody>
            {file.rows.map((row, rowIndex) => (
              <tr key={`${file.id}-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${file.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <span>표시할 시트 데이터가 없습니다.</span>
      )}
    </div>
  )

  const renderPreviewFile = (
    file: InventoryPreviewFile,
    variant: 'large' | 'thumbnail',
  ) => {
    if (file.kind === 'image' && file.objectUrl) {
      return <img src={file.objectUrl} alt={file.name} />
    }

    if (file.kind === 'pdf' && file.objectUrl) {
      return (
        <object data={file.objectUrl} type="application/pdf" aria-label={file.name}>
          <span>PDF 미리보기를 표시할 수 없습니다.</span>
        </object>
      )
    }

    if (file.kind === 'xlsx') {
      return renderSpreadsheetPreview(file, variant)
    }

    return <span className="inventory-add-unsupported">미리보기 불가</span>
  }

  return (
    <>
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
        {activeTab === 'shortage' ? (
          <>
            <div className="inventory-summary-row inventory-shortage-summary">
              <h2 className="inventory-shortage-title">
                <span>부족 재고 : {shortageItems}가지</span>
                <strong>는 다음 견적서에 사용 됩니다.</strong>
              </h2>

              <div className="inventory-page-actions">
                <button
                  className="inventory-add-button"
                  type="button"
                  onClick={() => setIsInventoryAddModalOpen(true)}
                >
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
                    changePage(1)
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
                    placeholder="품목명, 거래처명, 납기일자 등을 입력해주세요."
                    aria-label="부족 재고 견적서 검색"
                    onChange={(event) => {
                      setQuery(event.target.value)
                      changePage(1)
                    }}
                  />
                  <img src={searchIcon} alt="" />
                </label>
              </div>

              {isShortageLoading ? (
                <div className="empty-inventory">부족 재고 견적서를 불러오는 중입니다.</div>
              ) : shortageErrorMessage ? (
                <div className="empty-inventory">{shortageErrorMessage}</div>
              ) : visibleRows.length === 0 ? (
                <div className="empty-inventory">표시할 부족 재고 견적서가 없습니다.</div>
              ) : (
                <>
                  {(visibleRows as ShortageQuotationDocument[]).map((document) => {
                    const isExpanded =
                      expandedQuotationId === document.quotation_document_id
                    const quotationTitle = getQuotationTitle(document)
                    const dueText = getQuotationDueText(document)

                    return (
                      <article className="inventory-shortage-card" key={document.quotation_document_id}>
                        <button
                          className="inventory-shortage-card-header"
                          type="button"
                          onClick={() =>
                            setExpandedQuotationId((current) =>
                              current === document.quotation_document_id
                                ? null
                                : document.quotation_document_id,
                            )
                          }
                        >
                          <div className="inventory-shortage-card-main">
                            <label
                              className="order-check-button"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedItemIds.has(document.quotation_document_id)}
                                onChange={() =>
                                  toggleRow(document.quotation_document_id)
                                }
                                aria-label={`${quotationTitle} 선택`}
                              />
                            </label>
                            <span className="inventory-shortage-card-name">
                              {quotationTitle}
                            </span>
                            {isDueWithinWeek(document) ? (
                              <span className="due-soon-badge">
                                <span className="due-soon-dot" />
                                납기 임박
                              </span>
                            ) : null}
                          </div>

                          <div className="inventory-shortage-card-detail">
                            <span>{document.recipient_company_name || '-'}</span>
                            <i aria-hidden="true" />
                            <span>{dueText}</span>
                            <img
                              className={isExpanded ? 'expanded' : ''}
                              src={chevronDownIcon}
                              alt=""
                            />
                          </div>
                        </button>

                        {isExpanded ? (
                          <div className="inventory-shortage-panel">
                            <p className="inventory-shortage-panel-title">
                              해당 견적서에 <strong>필요하지만 부족한 재고</strong> 입니다.
                            </p>

                            <div className="inventory-shortage-item-list">
                              {document.shortage_items.map((item) => (
                                <div className="inventory-shortage-item-row" key={item.quotation_item_id}>
                                  <div className="inventory-shortage-item-main">
                                    <label className="order-check-button inventory-shortage-subcheck">
                                      <input
                                        type="checkbox"
                                        checked={false}
                                        readOnly
                                        aria-hidden="true"
                                        tabIndex={-1}
                                      />
                                    </label>
                                    <span>{item.item_name}</span>
                                  </div>
                                  <div className="inventory-shortage-item-detail">
                                    <span>{formatShortagePrice(item.unit_price)}</span>
                                    <i aria-hidden="true" />
                                    <span>{formatShortageStock(item.current_stock)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}

                  {Array.from({ length: emptyRowCount }).map((_, index) => (
                    <div
                      className="inventory-page-empty-row"
                      key={`inventory-shortage-empty-${index}`}
                      aria-hidden="true"
                    />
                  ))}

                  {renderPagination()}
                </>
              )}
            </div>
          </>
        ) : activeTab === 'comparison' ? (
          <div className="inventory-page-table">
            <div className="empty-inventory">견적서 비교 화면은 준비 중입니다.</div>
          </div>
        ) : (
          <>
            <div className="inventory-summary-row">
              <h2>
                현재 재고 : {totalItems} 가지
                <span>부족 재고 : {shortageItems}가지</span>
              </h2>

              <div className="inventory-page-actions">
                <button
                  className="inventory-add-button"
                  type="button"
                  onClick={() => setIsInventoryAddModalOpen(true)}
                >
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
                    changePage(1)
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
                    placeholder="재고명 거래처명을 입력해주세요."
                    aria-label="재고 검색"
                    onChange={(event) => {
                      setQuery(event.target.value)
                      changePage(1)
                    }}
                  />
                  <img src={searchIcon} alt="" />
                </label>
              </div>

              {isLoading ? (
                <div className="empty-inventory">재고 데이터를 불러오는 중입니다.</div>
              ) : errorMessage ? (
                <div className="empty-inventory">{errorMessage}</div>
              ) : visibleRows.length === 0 ? (
                <div className="empty-inventory">표시할 재고 데이터가 없습니다.</div>
              ) : (
                <>
                  {(visibleRows as InventoryItem[]).map((item) => (
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
                  {renderPagination()}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </section>
    {isInventoryAddModalOpen
      ? createPortal(
          <div className="bulk-order-backdrop" role="presentation">
            <section
              className="bulk-order-modal inventory-add-modal"
              role="dialog"
              aria-modal="true"
              aria-label="재고 추가"
            >
              <div className="inventory-add-heading">
                <p className="bulk-order-description">재고 추가</p>
              </div>

              <div
                className={`inventory-add-content${
                  activePreviewFile ? ' has-files' : ''
                }`}
              >
                {activePreviewFile ? (
                  <div className="inventory-add-preview-zone">
                    <div className="inventory-add-preview-toolbar">
                      <span>총 {inventoryPreviewFiles.length}건 선택됨</span>
                      <div className="inventory-add-file-actions">
                        <button type="button" onClick={deleteActivePreviewFile}>
                          현재 명세서 삭제
                        </button>
                        <button type="button" onClick={resetPreviewFiles}>
                          초기화
                        </button>
                      </div>
                    </div>

                    <div className="inventory-add-preview-body">
                      <div className="inventory-add-main-preview">
                        {renderPreviewFile(activePreviewFile, 'large')}
                      </div>

                      <aside className="inventory-add-file-sidebar">
                        <div className="inventory-add-file-list">
                          {inventoryPreviewFiles.map((file) => (
                            <button
                              className={
                                file.id === activePreviewFile.id ? 'active' : ''
                              }
                              type="button"
                              key={file.id}
                              onClick={() => setActivePreviewFileId(file.id)}
                              title={file.name}
                            >
                              {renderPreviewFile(file, 'thumbnail')}
                            </button>
                          ))}

                          <label className="inventory-add-file-plus">
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv,.pdf,image/*"
                              multiple
                              onChange={handleInventoryFileChange}
                            />
                            <span>+</span>
                            <small>파일 추가</small>
                          </label>
                        </div>
                      </aside>
                    </div>
                  </div>
                ) : (
                  <label className="inventory-add-attachment">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,.pdf,image/*"
                      multiple
                      onChange={handleInventoryFileChange}
                    />
                    <img src={filePlusIcon} alt="" />
                    <span>여기에 거래명세서 첨부</span>
                  </label>
                )}

                <div className="inventory-add-preview">
                  <div className="inventory-add-quote-row">
                    <span>재고 목록 :</span>
                    <button
                      className="inventory-add-more-button"
                      type="button"
                      aria-label="견적서 더보기"
                    >
                      ...
                    </button>
                  </div>

                  <strong className="inventory-add-bom-title">거래명세서 상세 정보</strong>

                  <div className="inventory-add-bom-list">
                    {inventoryPreviewFiles.length > 0 ? (
                      <>
                        {inventoryPreviewFiles.map((file) => (
                          <div className="inventory-add-document-row" key={file.id}>
                            <div className="inventory-add-document-main">
                              <label className="order-check-button">
                                <input
                                  type="checkbox"
                                  checked={selectedPreviewFileIds.has(file.id)}
                                  onChange={() => togglePreviewFileSelection(file.id)}
                                  aria-label={`${file.name} 선택`}
                                />
                              </label>
                              <span>{file.name}</span>
                            </div>
                            <div className="inventory-add-document-detail">
                              <span>{file.kind.toUpperCase()}</span>
                              <i aria-hidden="true" />
                              <span>{file.id === activePreviewFile.id ? '현재 보기' : '-'}</span>
                            </div>
                          </div>
                        ))}
                        {Array.from({
                          length: Math.max(0, 12 - inventoryPreviewFiles.length),
                        }).map((_, index) => (
                          <div
                            className="inventory-add-bom-row"
                            key={`inventory-add-empty-${index}`}
                            aria-hidden="true"
                          />
                        ))}
                      </>
                    ) : (
                      Array.from({ length: 12 }).map((_, index) => (
                        <div className="inventory-add-bom-row" key={index} />
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="inventory-add-actions">
                <button
                  className="bulk-order-cancel"
                  type="button"
                  onClick={closeInventoryAddModal}
                >
                  취소
                </button>
                <button
                  className="bulk-order-submit"
                  type="button"
                  onClick={closeInventoryAddModal}
                >
                  재고 추가
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null}
    </>
  )
}
