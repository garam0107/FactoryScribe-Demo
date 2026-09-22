import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { getInventoryItems } from '../api/inventory'
import { getRequiredOrders } from '../api/purchaseRecommendations'
import caretDownIcon from '../assets/icons/caret-down.svg'
import searchIcon from '../assets/icons/search.svg'
import type { InventoryItem, SortDirection } from '../types/inventory'
import type { RequiredOrderItem } from '../types/purchaseRecommendation'

const PAGE_SIZE = 9

type OrderPageProps = {
  repositoryId: string
  activeTab?: OrderTab
  onTabChange?: (tab: OrderTab) => void
}

export type OrderTab = 'required' | 'additional' | 'auto'

type OrderRow = {
  id: string
  itemName: string
  itemCode?: string | null
  partnerName: string | null
  trackingNo: string | null
  estimatedCost: number
  searchSource?: Array<string | number | null | undefined>
}

type AutoOrderDraft = {
  inventoryId: string
  itemName: string
  supplierName: string
  unitLabel: string
  unitPrice: string
  contactName: string
  contactValue: string
  maxLeadTime: string
  autoJudgementEnabled: boolean
  minimumQuantity: string
  autoOrderQuantity: string
  useRecentUnitPrice: boolean
  designatedUnitPrice: string
}

const orderTabs: { labelKey: string; value: OrderTab }[] = [
  { labelKey: 'inventory.requiredOrders', value: 'required' },
  { labelKey: 'inventory.additionalOrders', value: 'additional' },
  { labelKey: 'inventory.autoOrder', value: 'auto' },
]

const additionalOrderRowDefinitions = [
  {
    id: 'additional-cleaning-cloth',
    itemNameKey: 'demoItems.cleaningCloth',
    itemCode: 'ADD-WIPER-001',
    partnerNameKey: 'demoSuppliers.siteConsumables',
    trackingNo: '-',
    estimatedCost: 185000,
  },
  {
    id: 'additional-cable-tie',
    itemNameKey: 'demoItems.cableTie',
    itemCode: 'ADD-TIE-200',
    partnerNameKey: 'demoSuppliers.industrialMaterials',
    trackingNo: '-',
    estimatedCost: 96000,
  },
  {
    id: 'additional-nitrile-glove',
    itemNameKey: 'demoItems.nitrileGloves',
    itemCode: 'ADD-GLOVE-L',
    partnerNameKey: 'demoSuppliers.vietnamSafety',
    trackingNo: '-',
    estimatedCost: 132000,
  },
  {
    id: 'additional-mask',
    itemNameKey: 'demoItems.dustMask',
    itemCode: 'ADD-MASK-01',
    partnerNameKey: 'demoSuppliers.safeLine',
    trackingNo: '-',
    estimatedCost: 218000,
  },
  {
    id: 'additional-label',
    itemNameKey: 'demoItems.processLabel',
    itemCode: 'ADD-LABEL-01',
    partnerNameKey: 'demoSuppliers.labelTech',
    trackingNo: '-',
    estimatedCost: 74000,
  },
  {
    id: 'additional-tape',
    itemNameKey: 'demoItems.insulationTape',
    itemCode: 'ADD-TAPE-01',
    partnerNameKey: 'demoSuppliers.techSupply',
    trackingNo: '-',
    estimatedCost: 58000,
  },
  {
    id: 'additional-marker',
    itemNameKey: 'demoItems.permanentMarker',
    itemCode: 'ADD-MARKER-01',
    partnerNameKey: 'demoSuppliers.officeFactory',
    trackingNo: '-',
    estimatedCost: 41000,
  },
  {
    id: 'additional-pallet-wrap',
    itemNameKey: 'demoItems.palletWrap',
    itemCode: 'ADD-WRAP-01',
    partnerNameKey: 'demoSuppliers.globalPack',
    trackingNo: '-',
    estimatedCost: 266000,
  },
  {
    id: 'additional-cleaner',
    itemNameKey: 'demoItems.partsCleaner',
    itemCode: 'ADD-CLEANER-01',
    partnerNameKey: 'demoSuppliers.chemicalLine',
    trackingNo: '-',
    estimatedCost: 305000,
  },
  {
    id: 'additional-desiccant',
    itemNameKey: 'demoItems.desiccant',
    itemCode: 'ADD-DESICCANT-50',
    partnerNameKey: 'demoSuppliers.packagingHub',
    trackingNo: '-',
    estimatedCost: 89000,
  },
]

function normalizeText(value: string | number | null | undefined) {
  return value == null ? '' : String(value).trim().toLowerCase()
}

function getAutoOrderGap(item: InventoryItem) {
  if (item.target_stock == null) {
    return 0
  }

  return item.target_stock - item.current_stock
}

function getUnitLabel(item: InventoryItem) {
  return item.unit?.trim() || 'pcs'
}

function createAutoOrderDraft(item: InventoryItem): AutoOrderDraft {
  const shortageGap = getAutoOrderGap(item)
  const unitPrice = item.current_unit_price ?? 0

  return {
    inventoryId: item.id,
    itemName: item.item_name,
    supplierName: item.supplier || '-',
    unitLabel: getUnitLabel(item),
    unitPrice: String(unitPrice),
    contactName: '',
    contactValue: '',
    maxLeadTime: '',
    autoJudgementEnabled: false,
    minimumQuantity: String(shortageGap),
    autoOrderQuantity: String(shortageGap),
    useRecentUnitPrice: false,
    designatedUnitPrice: String(unitPrice),
  }
}

function parseNumberInput(value: string) {
  const parsed = Number(value.replaceAll(',', '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function toDigitsOnly(value: string) {
  return value.replaceAll(/\D/g, '')
}

function toRequiredOrderRow(item: RequiredOrderItem): OrderRow {
  return {
    id: item.quotation_item_id,
    itemName: item.item_name,
    itemCode: item.item_code,
    partnerName: item.customer_name,
    trackingNo: '-',
    estimatedCost: item.unit_price ?? 0,
    searchSource: [item.quotation_no],
  }
}

function toAutoOrderRow(item: InventoryItem, unspecifiedPartner: string): OrderRow {
  return {
    id: item.id,
    itemName: item.item_name,
    itemCode: item.item_code,
    partnerName: item.supplier || unspecifiedPartner,
    trackingNo: '-',
    estimatedCost: item.current_unit_price ?? 0,
    searchSource: [item.category, item.stock_status, item.current_stock],
  }
}

function formatCurrency(value: number, currencyLabel: string) {
  return `${Math.round(value).toLocaleString()} ${currencyLabel}`
}

export function OrderPage({
  repositoryId,
  activeTab: controlledActiveTab,
  onTabChange,
}: OrderPageProps) {
  const { t } = useTranslation('orders')
  const [internalActiveTab, setInternalActiveTab] =
    useState<OrderTab>('required')
  const activeTab = controlledActiveTab ?? internalActiveTab
  const getTabTitle = (tab: OrderTab, count: number) =>
    t(
      tab === 'additional'
        ? 'inventory.additionalItemsOutsideProcessCount'
        : tab === 'auto'
          ? 'inventory.itemsRequiringAutoOrderCount'
          : 'inventory.requiredItemsInProcessCount',
      { count },
    )
  const getPrimaryButtonLabel = (tab: OrderTab) =>
    t(tab === 'auto' ? 'inventory.registerAutoOrder' : 'inventory.bulkOrder')
  const getEmptyMessage = (tab: OrderTab) =>
    t(
      tab === 'additional'
        ? 'status.noAdditionalOrders'
        : tab === 'auto'
          ? 'status.noAutoOrders'
          : 'status.noRequiredOrders',
    )
  const [requiredOrders, setRequiredOrders] = useState<RequiredOrderItem[]>([])
  const [autoOrders, setAutoOrders] = useState<InventoryItem[]>([])
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [bulkModalRows, setBulkModalRows] = useState<OrderRow[]>([])
  const [autoOrderDraft, setAutoOrderDraft] = useState<AutoOrderDraft | null>(
    null,
  )
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [isAutoOrderModalOpen, setIsAutoOrderModalOpen] = useState(false)
  const [isRequiredLoading, setIsRequiredLoading] = useState(true)
  const [isAutoLoading, setIsAutoLoading] = useState(true)
  const [requiredErrorMessage, setRequiredErrorMessage] = useState<string | null>(
    null,
  )
  const [autoErrorMessage, setAutoErrorMessage] = useState<string | null>(null)
  const additionalOrderRows = useMemo<OrderRow[]>(
    () =>
      additionalOrderRowDefinitions.map((row) => ({
        id: row.id,
        itemName: t(row.itemNameKey),
        itemCode: row.itemCode,
        partnerName: t(row.partnerNameKey),
        trackingNo: row.trackingNo,
        estimatedCost: row.estimatedCost,
      })),
    [t],
  )
  
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
              : t('status.requiredOrdersLoadError'),
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
              : t('status.autoOrdersLoadError'),
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
  }, [repositoryId, t])

  useEffect(() => {
    if (!isBulkModalOpen && !isAutoOrderModalOpen) {
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
  }, [isAutoOrderModalOpen, isBulkModalOpen])

  const activeRows = useMemo<OrderRow[]>(() => {
    if (activeTab === 'additional') {
      return additionalOrderRows
    }

    if (activeTab === 'auto') {
      return autoOrders.map((item) =>
        toAutoOrderRow(item, t('inventory.partnerUnspecified')),
      )
    }

    return requiredOrders.map(toRequiredOrderRow)
  }, [activeTab, additionalOrderRows, autoOrders, requiredOrders, t])

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
  const modalRows = useMemo(() => {
    return activeRows.filter((row) => selectedItemIds.has(row.id))
  }, [activeRows, selectedItemIds])
  const selectedAutoItems = useMemo(
    () => autoOrders.filter((item) => selectedItemIds.has(item.id)),
    [autoOrders, selectedItemIds],
  )
  const modalEstimatedCost = bulkModalRows
  .filter((row) => selectedItemIds.has(row.id))
  .reduce((total, row) => total + row.estimatedCost, 0)
  const autoOrderEstimatedCost = autoOrderDraft
    ? parseNumberInput(autoOrderDraft.autoOrderQuantity) *
      parseNumberInput(autoOrderDraft.designatedUnitPrice)
    : 0

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

  const handleTabChange = (tab: OrderTab) => {
    if (controlledActiveTab == null) {
      setInternalActiveTab(tab)
    }

    onTabChange?.(tab)
    setCurrentPage(1)
    setQuery('')
  }

  return (
    <section className="order-page" aria-label={t('accessibility.orders')}>
      <nav className="tabs order-tabs" aria-label={t('accessibility.orderTabs')}>
        {orderTabs.map((tab) => (
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

      <div className="order-table-section">
        <div className="order-summary-row">
          <h1>{getTabTitle(activeTab, activeRows.length)}</h1>
          <div className="order-actions">
            <button
              className="order-bulk-button"
              type="button"
              onClick={() => {
                if (activeTab === 'auto') {
                  if (selectedAutoItems.length === 0) {
                    window.alert(t('alerts.selectAutoOrderItem'))
                    return
                  }

                  if (selectedAutoItems.length > 1) {
                    window.alert(
                      t('alerts.onlyOneAutoOrderItem'),
                    )
                    return
                  }

                  setAutoOrderDraft(createAutoOrderDraft(selectedAutoItems[0]))
                  setIsAutoOrderModalOpen(true)
                  return
                }
                if (modalRows.length === 0) {
                  window.alert(t('alerts.selectOrderItems'))
                  return
                }
                setBulkModalRows(modalRows)
                setIsBulkModalOpen(true)
              }}
            >
              {getPrimaryButtonLabel(activeTab)}
            </button>
            <button
              className="order-more-button"
              type="button"
              aria-label={t('accessibility.moreOrders')}
            >
              ...
            </button>
          </div>
        </div>

        <div className="order-table">
          <div className="order-toolbar">
            {activeTab === 'auto' ? (
              <span className="order-toolbar-spacer" aria-hidden="true" />
            ) : (
              <label className="order-check-button">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleVisibleRows}
                  aria-label={t('accessibility.selectCurrentPage')}
                />
              </label>
            )}
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
                placeholder={t('chat.searchPlaceholder')}
                aria-label={t('accessibility.orderSearch')}
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
              {t('status.loadingOrders')}
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
                        aria-label={t('accessibility.selectItem', { itemName: row.itemName })}
                      />
                    </label>
                    <span className="order-row-name">{row.itemName}</span>
                  </div>
                  <div className="order-row-detail">
                    <span className="order-detail-primary">{row.partnerName || '-'}</span>
                    <i aria-hidden="true" />
                    <span className="order-detail-secondary">{row.trackingNo || '-'}</span>
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
              <div className="purchase-pagination" aria-label={t('accessibility.orderPages')}>
                <button
                  type="button"
                  aria-label={t('accessibility.firstPage')}
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  «
                </button>
                <button
                  type="button"
                  aria-label={t('accessibility.previousPage')}
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
                  aria-label={t('accessibility.nextPage')}
                  disabled={safeCurrentPage === pageCount}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(pageCount, page + 1))
                  }
                >
                  ›
                </button>
                <button
                  type="button"
                  aria-label={t('accessibility.lastPage')}
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
      {isBulkModalOpen && activeTab !== 'auto' ? createPortal(
        <div className="bulk-order-backdrop" role="presentation">
          <section
            className="bulk-order-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('inventory.bulkOrder')}
          >
            <p className="bulk-order-description">{t('bulk.description')}</p>
            <div className="bulk-order-table">
              <div className="bulk-order-row-list">
                {bulkModalRows.map((row) => (
                    <article className="bulk-order-row" key={row.id}>
                      <div className="bulk-order-row-main">
                        <label className="order-check-button">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.has(row.id)}
                            onChange={() => toggleRow(row.id)}
                            aria-label={t('accessibility.selectItem', { itemName: row.itemName })}
                          />
                        </label>
                        <span>{row.itemName}</span>
                      </div>
                      <div className="bulk-order-row-detail">
                        <span>{row.partnerName || '-'}</span>
                        <i aria-hidden="true" />
                        <span>{row.trackingNo || '-'}</span>
                      </div>
                    </article>
                  ))}
              </div>

              <div className="bulk-order-cost">
                <span>{t('bulk.estimatedCost')}</span>
                <strong>: {formatCurrency(modalEstimatedCost, t('units.currency'))}</strong>
              </div>
            </div>

            <div className="bulk-order-actions">
              <button
                className="bulk-order-cancel"
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
              >
                {t('actions.cancel')}
              </button>
              <button className="bulk-order-submit" type="button">
                {t('actions.submitOrder')}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
      {isAutoOrderModalOpen && autoOrderDraft ? createPortal(
        <div className="bulk-order-backdrop" role="presentation">
          <section
            className="bulk-order-modal auto-order-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('inventory.registerAutoOrder')}
          >
            <p className="bulk-order-description">{t('inventory.registerAutoOrder')}</p>
            <div className="bulk-order-table auto-order-table">
              <div className="auto-order-grid">
                <div className="auto-order-column">
                  <label className="auto-order-field">
                    <span>{t('autoOrder.partName')}</span>
                    <input
                      type="text"
                      value={autoOrderDraft.itemName}
                      onChange={(event) =>
                        setAutoOrderDraft((current) =>
                          current
                            ? { ...current, itemName: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className="auto-order-field">
                    <span>{t('autoOrder.supplier')}</span>
                    <input
                      type="text"
                      value={autoOrderDraft.supplierName}
                      onChange={(event) =>
                        setAutoOrderDraft((current) =>
                          current
                            ? { ...current, supplierName: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className="auto-order-field">
                    <span>{t('autoOrder.unitPrice')}</span>
                    <div className="auto-order-inline-input">
                      <input
                        type="text"
                        value={autoOrderDraft.unitPrice}
                        onChange={(event) =>
                          setAutoOrderDraft((current) =>
                            current
                              ? { ...current, unitPrice: event.target.value }
                              : current,
                          )
                        }
                      />
                      <em>KRW/{autoOrderDraft.unitLabel}</em>
                    </div>
                  </label>
                  <label className="auto-order-field">
                    <span>{t('autoOrder.contactPerson')}</span>
                    <input
                      type="text"
                      value={autoOrderDraft.contactName}
                      onChange={(event) =>
                        setAutoOrderDraft((current) =>
                          current
                            ? { ...current, contactName: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className="auto-order-field">
                    <span>{t('autoOrder.contact')}</span>
                    <input
                      type="text"
                      value={autoOrderDraft.contactValue}
                      onChange={(event) =>
                        setAutoOrderDraft((current) =>
                          current
                            ? { ...current, contactValue: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className="auto-order-field auto-order-divider">
                    <span>{t('autoOrder.maxLeadTime')}</span>
                    <div className="auto-order-inline-input">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={autoOrderDraft.maxLeadTime}
                        onChange={(event) =>
                          setAutoOrderDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  maxLeadTime: toDigitsOnly(event.target.value),
                                }
                              : current,
                          )
                        }
                      />
                      <em>{t('units.days')}</em>
                    </div>
                  </label>
                </div>

                <div className="auto-order-column">
                  <div className="auto-order-field">
                    <span>{t('autoOrder.automaticDecision')}</span>
                    <button
                      className="auto-order-toggle"
                      type="button"
                      aria-pressed={false}
                      disabled
                    >
                      <span />
                    </button>
                  </div>
                  <label className="auto-order-field">
                    <span>{t('autoOrder.minimumPartQuantity')}</span>
                    <div className="auto-order-inline-input">
                      <input
                        type="text"
                        value={autoOrderDraft.minimumQuantity}
                        disabled
                      />
                      <em>{autoOrderDraft.unitLabel}</em>
                    </div>
                  </label>
                  <label className="auto-order-field">
                    <span>{t('autoOrder.autoOrderQuantity')}</span>
                    <div className="auto-order-inline-input">
                      <input
                        type="text"
                        value={autoOrderDraft.autoOrderQuantity}
                        onChange={(event) =>
                          setAutoOrderDraft((current) =>
                            current
                              ? { ...current, autoOrderQuantity: event.target.value }
                              : current,
                          )
                        }
                      />
                      <em>{autoOrderDraft.unitLabel}</em>
                    </div>
                  </label>
                  <div className="auto-order-field">
                    <span>{t('autoOrder.useRecentUnitPrice')}</span>
                    <button
                      className={`auto-order-toggle${autoOrderDraft.useRecentUnitPrice ? ' active' : ''}`}
                      type="button"
                      aria-pressed={autoOrderDraft.useRecentUnitPrice}
                      onClick={() =>
                        setAutoOrderDraft((current) => {
                          if (!current) {
                            return current
                          }

                          const nextValue = !current.useRecentUnitPrice
                          return {
                            ...current,
                            useRecentUnitPrice: nextValue,
                            designatedUnitPrice: nextValue
                              ? current.unitPrice
                              : current.designatedUnitPrice,
                          }
                        })
                      }
                    >
                      <span />
                    </button>
                  </div>
                  <label className="auto-order-field">
                    <span>{t('autoOrder.designatedUnitPrice')}</span>
                    <div className="auto-order-inline-input">
                      <input
                        type="text"
                        value={autoOrderDraft.designatedUnitPrice}
                        disabled={autoOrderDraft.useRecentUnitPrice}
                        onChange={(event) =>
                          setAutoOrderDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  designatedUnitPrice: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                      <em>KRW/{autoOrderDraft.unitLabel}</em>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bulk-order-cost">
                <span>{t('bulk.estimatedCost')}</span>
                <strong>: {formatCurrency(autoOrderEstimatedCost, t('units.currency'))}</strong>
              </div>
            </div>

            <div className="bulk-order-actions">
              <button
                className="bulk-order-cancel"
                type="button"
                onClick={() => setIsAutoOrderModalOpen(false)}
              >
                {t('actions.cancel')}
              </button>
              <button className="bulk-order-submit" type="button">
                {t('actions.submitOrder')}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </section>
  )
}
