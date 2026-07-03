import { type CSSProperties, useEffect, useState } from 'react'

import { getInventoryDashboard, getInventoryItems } from '../api/inventory'
import blackSearchIcon from '../assets/icons/black_search.svg'
import logomarkIcon from '../assets/icons/logomark.svg'
import plusIcon from '../assets/icons/plus.svg'
import searchIcon from '../assets/icons/search.svg'
import {
  DashboardTabs,
  type MainDashboardTab,
} from '../components/dashboard/DashboardTabs'
import { ForecastPanel } from '../components/dashboard/ForecastPanel'
import { MonthlyPurchaseOrdersPanel } from '../components/dashboard/MonthlyPurchaseOrdersPanel'
import { OverviewPanel } from '../components/dashboard/OverviewPanel'
import { MainSidebar } from '../components/layout/MainSidebar'
import type { InventoryDashboard, InventoryItem } from '../types/inventory'

const REPOSITORY_ID = 'repo_0c61123ac8be'
const FIGMA_FRAME_WIDTH = 1440

export function MainPage() {
  const [activeTab, setActiveTab] = useState<MainDashboardTab>('overview')
  const [appScale, setAppScale] = useState(1)
  const [dashboard, setDashboard] = useState<InventoryDashboard | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
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
        <MainSidebar />

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

          <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === 'overview' ? (
            <OverviewPanel
              dashboard={dashboard}
              items={items}
              isLoading={isLoading}
              errorMessage={errorMessage}
            />
          ) : null}

          {activeTab === 'purchaseOrders' ? (
            <MonthlyPurchaseOrdersPanel repositoryId={REPOSITORY_ID} />
          ) : null}

          {activeTab === 'forecast' ? (
            <ForecastPanel
              items={items}
              isLoading={isLoading}
              errorMessage={errorMessage}
            />
          ) : null}
        </section>
      </div>
    </main>
  )
}
