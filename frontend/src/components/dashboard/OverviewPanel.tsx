import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DashboardInventoryTable } from './DashboardInventoryTable'
import { DashboardInventoryToolbar } from './DashboardInventoryToolbar'
import { DashboardSummary, type InventoryMetric } from './DashboardSummary'
import { PriceChangeGraph } from './PriceChangeGraph'
import type {
  InventoryDashboard,
  InventoryItem,
  SortDirection,
} from '../../types/inventory'

const PAGE_SIZE = 10

type OverviewPanelProps = {
  dashboard: InventoryDashboard | null
  items: InventoryItem[]
  isLoading: boolean
  errorMessage: string | null
}

function clampPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, value))
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '0%'
  }

  return `${Number(value.toFixed(1))}%`
}

export function OverviewPanel({
  dashboard,
  items,
  isLoading,
  errorMessage,
}: OverviewPanelProps) {
  const { t } = useTranslation('main')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [activePriceIndex, setActivePriceIndex] = useState(0)

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.is_shortage !== b.is_shortage) {
        return a.is_shortage ? -1 : 1
      }

      const result = a.item_name.localeCompare(b.item_name, 'ko-KR')
      return sortDirection === 'asc' ? result : -result
    })
  }, [items, sortDirection])

  const priceChangeItems = useMemo(() => {
    return items
      .filter(
        (item) =>
          item.current_unit_price != null &&
          item.previous_unit_price != null &&
          item.previous_unit_price > 0,
      )
      .sort((a, b) => {
        const aRate = a.price_change_rate ?? 0
        const bRate = b.price_change_rate ?? 0
        return Math.abs(bRate) - Math.abs(aRate)
      })
  }, [items])

  useEffect(() => {
    if (priceChangeItems.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActivePriceIndex((current) => (current + 1) % priceChangeItems.length)
    }, 5000)

    return () => {
      window.clearInterval(timer)
    }
  }, [priceChangeItems.length])

  const visibleItems = sortedItems.slice(0, visibleCount)
  const canShowMore = visibleCount < sortedItems.length
  const totalItems = items.length || dashboard?.total_items || 0
  const shortageItems =
    dashboard?.shortage_items ?? items.filter((item) => item.is_shortage).length
  const safeActivePriceIndex =
    priceChangeItems.length > 0 ? activePriceIndex % priceChangeItems.length : 0
  const activePriceItem =
    priceChangeItems.length > 0
      ? priceChangeItems[safeActivePriceIndex]
      : null

  const metrics: InventoryMetric[] = [
    {
      title: t('dashboard.remainingInventory'),
      value: formatPercent(dashboard?.inventory_remaining_rate),
      percent: clampPercent(dashboard?.inventory_remaining_rate),
      tone: 'red',
    },
    {
      title: t('dashboard.partPriceIncreaseRate'),
      value: formatPercent(dashboard?.average_price_increase_rate),
      percent: clampPercent(dashboard?.average_price_increase_rate),
      tone: 'turquoise',
    },
    {
      title: t('dashboard.actualProductTransactionVolume'),
      value: '0',
      percent: 0,
      tone: 'mustard',
    },
    {
      title: t('dashboard.ordersInTransit'),
      value: '0',
      percent: 0,
      tone: 'turquoise',
    },
  ]

  return (
    <>
      <DashboardSummary metrics={metrics} />

      <section className="inventory-section" aria-label="현재 재고">
        <DashboardInventoryToolbar
          totalItems={totalItems}
          shortageItems={shortageItems}
        />
        <DashboardInventoryTable
          items={visibleItems}
          sortDirection={sortDirection}
          isLoading={isLoading}
          errorMessage={errorMessage}
          canShowMore={canShowMore}
          onToggleSort={() => {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
            setVisibleCount(PAGE_SIZE)
          }}
          onShowMore={() => {
            setVisibleCount((current) => current + PAGE_SIZE)
          }}
        />
      </section>

      <section className="graphs-section" aria-label="데이터 그래프">
        <h2>{t('dashboard.dataGraph')}</h2>
        <div className="graph-grid">
          <PriceChangeGraph item={activePriceItem} />
          <article className="graph-card">
            <div className="graph-header">
              <h3>{t('dashboard.monthlyConsumableUsageActualTransactions')}</h3>
              <span aria-hidden="true">...</span>
            </div>
            <div className="zero-graph">0</div>
          </article>
        </div>
      </section>
    </>
  )
}
