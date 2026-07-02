import { type CSSProperties, useEffect, useMemo, useState } from 'react'

import { getInventoryDashboard, getInventoryItems } from '../api/inventory'
import blackSearchIcon from '../assets/icons/black_search.svg'
import homeIcon from '../assets/icons/home.svg'
import logomarkIcon from '../assets/icons/logomark.svg'
import plusIcon from '../assets/icons/plus.svg'
import searchIcon from '../assets/icons/search.svg'
import settingsIcon from '../assets/icons/settings.svg'
import toolsIcon from '../assets/icons/tools.svg'
import truckIcon from '../assets/icons/truck.svg'
import typeIcon from '../assets/icons/type.svg'
import viewsIcon from '../assets/icons/views.svg'
import {
  DashboardSummary,
  type InventoryMetric,
} from '../components/dashboard/DashboardSummary'
import { DashboardInventoryTable } from '../components/dashboard/DashboardInventoryTable'
import { DashboardInventoryToolbar } from '../components/dashboard/DashboardInventoryToolbar'
import { PriceChangeGraph } from '../components/dashboard/PriceChangeGraph'
import type {
  InventoryDashboard,
  InventoryItem,
  SortDirection,
} from '../types/inventory'

type NavItem = {
  label: string
  icon: string
  active?: boolean
}

const REPOSITORY_ID = 'repo_0c61123ac8be'
const FIGMA_FRAME_WIDTH = 1440
const PAGE_SIZE = 10

const navItems: NavItem[] = [
  { label: '메인', icon: homeIcon, active: true },
  { label: '발주', icon: truckIcon },
  { label: '재고 관리', icon: toolsIcon },
  { label: '견적 계산 (도면)', icon: viewsIcon },
  { label: '고급 : 프롬포트 입력', icon: typeIcon },
  { label: '관리자 설정', icon: settingsIcon },
]

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

export function MainPage() {
  const [appScale, setAppScale] = useState(1)
  const [dashboard, setDashboard] = useState<InventoryDashboard | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [activePriceIndex, setActivePriceIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const updateScale = () => {
      setAppScale(window.innerWidth / FIGMA_FRAME_WIDTH)
    }

    updateScale()
    window.addEventListener('resize', updateScale)

    return () => {
      window.removeEventListener('resize', updateScale)
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadInventory() {
      try {
        setIsLoading(true)
        setErrorMessage(null)

        const [dashboardData, itemData] = await Promise.all([
          getInventoryDashboard(REPOSITORY_ID),
          getInventoryItems(REPOSITORY_ID),
        ])

        if (!ignore) {
          setDashboard(dashboardData)
          setItems(itemData)
          setVisibleCount(PAGE_SIZE)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : '재고 데이터를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    loadInventory()

    return () => {
      ignore = true
    }
  }, [])

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
      title: '재고 잔여량',
      value: formatPercent(dashboard?.inventory_remaining_rate),
      percent: clampPercent(dashboard?.inventory_remaining_rate),
      tone: 'red',
    },
    {
      title: '부품가격 상승률',
      value: formatPercent(dashboard?.average_price_increase_rate),
      percent: clampPercent(dashboard?.average_price_increase_rate),
      tone: 'turquoise',
    },
    { title: '생산품 실거래량', value: '0', percent: 0, tone: 'mustard' },
    { title: '배송 중인 발주', value: '0', percent: 0, tone: 'turquoise' },
  ]

  return (
    <main
      className="app-shell"
      style={{ '--app-scale': appScale } as CSSProperties}
    >
      <header className="topbar">
        <a className="brand" href="/" aria-label="FAUTORY 홈">
          <img src={logomarkIcon} alt="" />
          <span>FAUTORY</span>
        </a>
        <button className="icon-button" type="button" aria-label="검색">
          <img src={blackSearchIcon} alt="" />
        </button>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="주요 메뉴">
          <nav className="side-nav">
            {navItems.map((item) => (
              <a
                className={item.active ? 'side-link active' : 'side-link'}
                href="/"
                key={item.label}
              >
                <img src={item.icon} alt="" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        </aside>

        <section className="content" aria-label="메인 대시보드">
          <div className="company-row">
            <h1>SI E&amp;C Vietnam Co., Ltd.</h1>
          </div>

          <section className="assistant-panel" aria-label="질문 입력">
            <div className="greeting">
              <p className="hello">안녕하세요. 김OO님.</p>
              <p className="prompt">무엇을 도와드릴까요?</p>
            </div>

            <label className="query-box">
              <img src={plusIcon} alt="" />
              <input
                aria-label="질문 입력"
                placeholder="무엇이든 물어보세요."
                type="text"
              />
              <button type="button" aria-label="질문 검색">
                <img src={searchIcon} alt="" />
              </button>
            </label>
          </section>

          <nav className="tabs" aria-label="대시보드 탭">
            <button className="active" type="button">
              전체 현황
            </button>
            <button type="button">이번 달 발주</button>
            <button type="button">예상 소모도</button>
          </nav>

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
                setSortDirection((current) =>
                  current === 'asc' ? 'desc' : 'asc',
                )
                setVisibleCount(PAGE_SIZE)
              }}
              onShowMore={() => {
                setVisibleCount((current) => current + PAGE_SIZE)
              }}
            />
          </section>

          <section className="graphs-section" aria-label="데이터 그래프">
            <h2>데이터 그래프</h2>
            <div className="graph-grid">
              <PriceChangeGraph item={activePriceItem} />
              <article className="graph-card">
                <div className="graph-header">
                  <h3>월별 소모품 사용량 / 출납 실거래량</h3>
                  <span aria-hidden="true">›</span>
                </div>
                <div className="zero-graph">0</div>
              </article>
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}
