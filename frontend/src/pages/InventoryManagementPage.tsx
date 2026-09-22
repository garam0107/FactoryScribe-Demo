import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
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
  activeTab?: InventoryTab
  onTabChange?: (tab: InventoryTab) => void
}

export type InventoryTab = 'total' | 'shortage' | 'comparison'
type PreviewFileKind = 'image' | 'pdf' | 'xlsx' | 'unknown'

type InventoryPreviewFile = {
  id: string
  name: string
  kind: PreviewFileKind
  objectUrl: string | null
  rows: string[][]
}

const PAGE_SIZE = 9

const inventoryTabs: { value: InventoryTab; labelKey: string }[] = [
  { value: 'total', labelKey: 'inventory.totalInventoryStatus' },
  { value: 'shortage', labelKey: 'inventory.lowStock' },
  { value: 'comparison', labelKey: 'quotation.comparison' },
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

function formatRemainingStock(item: InventoryItem, defaultUnit: string) {
  const quantity = item.current_remaining_quantity ?? item.current_stock
  return `${Math.round(quantity).toLocaleString('ko-KR')}${item.unit?.trim() || defaultUnit}`
}

function formatShortagePrice(unitPrice: number | null) {
  return `${Math.round(unitPrice ?? 0).toLocaleString('ko-KR')} KRW /ea`
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
  activeTab: controlledActiveTab,
  onTabChange,
}: InventoryManagementPageProps) {
  const { t } = useTranslation('inventory')
  const [internalActiveTab, setInternalActiveTab] =
    useState<InventoryTab>('total')
  const activeTab = controlledActiveTab ?? internalActiveTab
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
              : t('status.shortageQuotationsLoadError'),
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
  }, [activeTab, hasAttemptedShortageQuotations, repositoryId, t])

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
          : t('preview.createError'),
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
    if (controlledActiveTab == null) {
      setInternalActiveTab(tab)
    }

    onTabChange?.(tab)
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
    <div className="purchase-pagination" aria-label={t('accessibility.inventoryPages')}>
      <button
        type="button"
        aria-label={t('accessibility.firstPage')}
        disabled={safeCurrentPage === 1}
        onClick={() => changePage(1)}
      >
        «
      </button>
      <button
        type="button"
        aria-label={t('accessibility.previousPage')}
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
        aria-label={t('accessibility.nextPage')}
        disabled={safeCurrentPage === pageCount}
        onClick={() =>
          changePageWithUpdater((page) => Math.min(pageCount, page + 1))
        }
      >
        ›
      </button>
      <button
        type="button"
        aria-label={t('accessibility.lastPage')}
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
        <span>{t('preview.noSheetData')}</span>
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
          <span>{t('preview.pdfUnavailable')}</span>
        </object>
      )
    }

    if (file.kind === 'xlsx') {
      return renderSpreadsheetPreview(file, variant)
    }

    return <span className="inventory-add-unsupported">{t('preview.unsupported')}</span>
  }

  return (
    <>
    <section className="inventory-management-page" aria-label={t('accessibility.inventoryManagement')}>
      <div className="inventory-page-header">
        <nav className="inventory-page-tabs" aria-label={t('accessibility.inventoryTabs')}>
          {inventoryTabs.map((tab) => (
            <button
              className={activeTab === tab.value ? 'active' : ''}
              type="button"
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      <div className="inventory-table-section">
        {activeTab === 'shortage' ? (
          <>
            <div className="inventory-summary-row inventory-shortage-summary">
              <h2 className="inventory-shortage-title">
                <span>{t('inventory.lowStockCount', { count: shortageItems })}</span>
                <strong>{t('inventory.usedInNextQuotation')}</strong>
              </h2>

              <div className="inventory-page-actions">
                <button
                  className="inventory-add-button"
                  type="button"
                  onClick={() => setIsInventoryAddModalOpen(true)}
                >
                  {t('inventory.addInventory')}
                </button>
                <button
                  className="inventory-more-button"
                  type="button"
                  aria-label={t('accessibility.moreInventoryOptions')}
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
                    aria-label={t('accessibility.selectCurrentPage')}
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
                  <span>{t('inventory.sortByName')}</span>
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
                    placeholder={t('quotation.searchPlaceholder')}
                    aria-label={t('accessibility.shortageQuotationSearch')}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      changePage(1)
                    }}
                  />
                  <img src={searchIcon} alt="" />
                </label>
              </div>

              {isShortageLoading ? (
                <div className="empty-inventory">{t('status.loadingShortageQuotations')}</div>
              ) : shortageErrorMessage ? (
                <div className="empty-inventory">{shortageErrorMessage}</div>
              ) : visibleRows.length === 0 ? (
                <div className="empty-inventory">{t('status.noShortageQuotations')}</div>
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
                                aria-label={t('accessibility.selectItem', { itemName: quotationTitle })}
                              />
                            </label>
                            <span className="inventory-shortage-card-name inventory-row-name">
                              {quotationTitle}
                            </span>
                            {isDueWithinWeek(document) ? (
                              <span className="due-soon-badge">
                                <span className="due-soon-dot" />
                                {t('quotation.dueSoon')}
                              </span>
                            ) : (
                              <span className="due-soon-badge due-soon-badge-placeholder" aria-hidden="true" />
                            )}
                          </div>

                          <div className="inventory-shortage-card-detail">
                            <span className="inventory-detail-primary">{document.recipient_company_name || '-'}</span>
                            <i aria-hidden="true" />
                            <span className="inventory-detail-secondary">{dueText}</span>
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
                              {t('quotation.shortageDescriptionStart')} <strong>{t('quotation.shortageDescriptionEmphasis')}</strong>{t('quotation.shortageDescriptionEnd')}
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
                                    <span className="inventory-row-name">{item.item_name}</span>
                                  </div>
                                  <div className="inventory-shortage-item-detail">
                                    <span className="inventory-detail-primary">{formatShortagePrice(item.unit_price)}</span>
                                    <i aria-hidden="true" />
                                    <span className="inventory-detail-secondary">{t('inventory.remainingQuantityWithCount', { count: Math.round(item.current_stock) })}</span>
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
            <div className="empty-inventory">{t('quotation.comparisonPreparing')}</div>
          </div>
        ) : (
          <>
            <div className="inventory-summary-row">
              <h2>
                {t('inventory.currentInventoryCount', { count: totalItems })}
                <span>{t('inventory.lowStockCount', { count: shortageItems })}</span>
              </h2>

              <div className="inventory-page-actions">
                <button
                  className="inventory-add-button"
                  type="button"
                  onClick={() => setIsInventoryAddModalOpen(true)}
                >
                  {t('inventory.addInventory')}
                </button>
                <button
                  className="inventory-more-button"
                  type="button"
                  aria-label={t('accessibility.moreInventoryOptions')}
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
                    aria-label={t('accessibility.selectCurrentPage')}
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
                  <span>{t('inventory.sortByName')}</span>
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
                    placeholder={t('inventory.inventorySearchPlaceholder')}
                    aria-label={t('accessibility.inventorySearch')}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      changePage(1)
                    }}
                  />
                  <img src={searchIcon} alt="" />
                </label>
              </div>

              {isLoading ? (
                <div className="empty-inventory">{t('status.loadingInventory')}</div>
              ) : errorMessage ? (
                <div className="empty-inventory">{errorMessage}</div>
              ) : visibleRows.length === 0 ? (
                <div className="empty-inventory">{t('status.noInventory')}</div>
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
                            aria-label={t('accessibility.selectItem', { itemName: item.item_name })}
                          />
                        </label>
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
                        <span className="inventory-detail-primary">{formatPrice(item)}</span>
                        <i aria-hidden="true" />
                        <span className="inventory-detail-secondary">{t('inventory.remainingQuantity')}: {formatRemainingStock(item, t('units.each'))}</span>
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
              aria-label={t('inventory.addInventory')}
            >
              <div className="inventory-add-heading">
                <p className="bulk-order-description">{t('inventory.addInventory')}</p>
              </div>

              <div
                className={`inventory-add-content${
                  activePreviewFile ? ' has-files' : ''
                }`}
              >
                {activePreviewFile ? (
                  <div className="inventory-add-preview-zone">
                    <div className="inventory-add-preview-toolbar">
                      <span>{t('preview.selectedCount', { count: inventoryPreviewFiles.length })}</span>
                      <div className="inventory-add-file-actions">
                        <button type="button" onClick={deleteActivePreviewFile}>
                          {t('preview.deleteCurrentStatement')}
                        </button>
                        <button type="button" onClick={resetPreviewFiles}>
                          {t('preview.reset')}
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
                            <small>{t('preview.addFile')}</small>
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
                    <span>{t('preview.attachStatement')}</span>
                  </label>
                )}

                <div className="inventory-add-preview">
                  <div className="inventory-add-quote-row">
                    <span>{t('preview.inventoryList')} :</span>
                    <button
                      className="inventory-add-more-button"
                      type="button"
                      aria-label={t('accessibility.moreQuotationOptions')}
                    >
                      ...
                    </button>
                  </div>

                  <strong className="inventory-add-bom-title">{t('preview.statementDetails')}</strong>

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
                                  aria-label={t('accessibility.selectItem', { itemName: file.name })}
                                />
                              </label>
                              <span>{file.name}</span>
                            </div>
                            <div className="inventory-add-document-detail">
                              <span>{file.kind.toUpperCase()}</span>
                              <i aria-hidden="true" />
                              <span>{file.id === activePreviewFile.id ? t('preview.currentlyViewing') : '-'}</span>
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
                  {t('actions.cancel')}
                </button>
                <button
                  className="bulk-order-submit"
                  type="button"
                  onClick={closeInventoryAddModal}
                >
                  {t('inventory.addInventory')}
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
