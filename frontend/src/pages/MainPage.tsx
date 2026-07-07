import { type CSSProperties, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { LanguageSelector } from '../components/layout/LanguageSelector'
import { MainSidebar, type AppSection } from '../components/layout/MainSidebar'
import type { InventoryDashboard, InventoryItem } from '../types/inventory'
import {
  InventoryManagementPage,
  type InventoryTab,
} from './InventoryManagementPage'
import { OrderPage, type OrderTab } from './OrderPage'

const REPOSITORY_ID = 'repo_0c61123ac8be'
const FIGMA_FRAME_WIDTH = 1440
const SECTIONS: AppSection[] = [
  'main',
  'orders',
  'inventory',
  'quote',
  'prompt',
  'admin',
]

type SearchResultItem = {
  labelKey: string
  section: AppSection
  keywords: string[]
  mainTab?: MainDashboardTab
  orderTab?: OrderTab
  inventoryTab?: InventoryTab
}

type SearchResultGroup = {
  titleKey: string
  section: AppSection
  keywords: string[]
  mainTab?: MainDashboardTab
  orderTab?: OrderTab
  inventoryTab?: InventoryTab
  items: SearchResultItem[]
}

const SEARCH_RESULT_GROUPS: SearchResultGroup[] = [
  {
    titleKey: 'search.sections.main',
    section: 'main',
    mainTab: 'overview',
    keywords: ['메인', 'main', 'dashboard'],
    items: [
      {
        labelKey: 'search.items.overallStatus',
        section: 'main',
        mainTab: 'overview',
        keywords: ['전체 현황', '메인', 'overview', 'status'],
      },
      {
        labelKey: 'search.items.monthlyOrders',
        section: 'main',
        mainTab: 'purchaseOrders',
        keywords: ['이번 달 발주', '발주', 'purchase orders'],
      },
      {
        labelKey: 'search.items.expectedConsumption',
        section: 'main',
        mainTab: 'forecast',
        keywords: ['예상 소모도', '소모도', 'forecast', 'consumption'],
      },
    ],
  },
  {
    titleKey: 'search.sections.orders',
    section: 'orders',
    orderTab: 'required',
    keywords: ['발주', '주문', 'orders', 'order', 'purchase'],
    items: [
      {
        labelKey: 'search.items.requiredOrders',
        section: 'orders',
        orderTab: 'required',
        keywords: ['필요 발주', '발주', 'required orders'],
      },
      {
        labelKey: 'search.items.additionalOrders',
        section: 'orders',
        orderTab: 'additional',
        keywords: ['추가 발주', '발주', 'additional orders'],
      },
      {
        labelKey: 'search.items.autoOrders',
        section: 'orders',
        orderTab: 'auto',
        keywords: ['자동 발주', '발주', 'auto orders'],
      },
    ],
  },
  {
    titleKey: 'search.sections.inventory',
    section: 'inventory',
    inventoryTab: 'total',
    keywords: ['재고', '재고 관리', 'inventory', 'stock'],
    items: [
      {
        labelKey: 'search.items.totalInventory',
        section: 'inventory',
        inventoryTab: 'total',
        keywords: ['재고', '총 재고', '총 재고 현황', 'inventory', 'stock'],
      },
      {
        labelKey: 'search.items.lowStock',
        section: 'inventory',
        inventoryTab: 'shortage',
        keywords: ['재고', '부족 재고', '부족', 'low stock', 'shortage'],
      },
      {
        labelKey: 'search.items.quoteComparison',
        section: 'inventory',
        inventoryTab: 'comparison',
        keywords: ['견적서', '비교', '견적서 비교', 'quote'],
      },
    ],
  },
]

const SIDEBAR_LABEL_KEYS: Record<AppSection, string> = {
  main: 'nav.main',
  orders: 'nav.orders',
  inventory: 'nav.inventoryManagement',
  quote: 'nav.quotationCalculationDrawing',
  prompt: 'nav.advancedPromptInput',
  admin: 'nav.adminSettings',
}

function getSectionFromHash(): AppSection {
  const hashSection = window.location.hash.replace('#', '') as AppSection
  return SECTIONS.includes(hashSection) ? hashSection : 'main'
}

export function MainPage() {
  const { t } = useTranslation('main')
  const { t: tSidebar } = useTranslation('sidebar')
  const [activeSection, setActiveSection] =
    useState<AppSection>(getSectionFromHash)
  const [activeTab, setActiveTab] = useState<MainDashboardTab>('overview')
  const [activeOrderTab, setActiveOrderTab] = useState<OrderTab>('required')
  const [activeInventoryTab, setActiveInventoryTab] =
    useState<InventoryTab>('total')
  const [appScale, setAppScale] = useState(1)
  const [dashboard, setDashboard] = useState<InventoryDashboard | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
    const syncSectionFromHash = () => {
      setActiveSection(getSectionFromHash())
    }

    window.addEventListener('hashchange', syncSectionFromHash)

    return () => {
      window.removeEventListener('hashchange', syncSectionFromHash)
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [activeSection])

  useEffect(() => {
    if (!isSearchOpen) {
      return undefined
    }

    const closeSearchOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false)
      }
    }

    window.addEventListener('keydown', closeSearchOnEscape)

    return () => {
      window.removeEventListener('keydown', closeSearchOnEscape)
    }
  }, [isSearchOpen])

  const changeSection = (section: AppSection) => {
    setActiveSection(section)
    if (window.location.hash !== `#${section}`) {
      window.location.hash = section
    }
  }

  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const searchResultGroups = normalizedSearchQuery
    ? SEARCH_RESULT_GROUPS.map((group) => {
        const groupTitle = t(group.titleKey)
        const sidebarLabel = tSidebar(SIDEBAR_LABEL_KEYS[group.section])
        const groupMatches = [
          groupTitle,
          sidebarLabel,
          ...group.keywords,
        ].some((keyword) =>
          keyword.toLowerCase().includes(normalizedSearchQuery),
        )
        const matchedItems = group.items.filter((item) =>
          [t(item.labelKey), ...item.keywords].some((keyword) =>
            keyword.toLowerCase().includes(normalizedSearchQuery),
          ),
        )

        if (!groupMatches && matchedItems.length === 0) {
          return null
        }

        return {
          ...group,
          items: groupMatches ? group.items : matchedItems,
        }
      }).filter((group): group is SearchResultGroup => group !== null)
    : []

  const moveToSearchResult = (target: SearchResultGroup | SearchResultItem) => {
    if (target.mainTab) {
      setActiveTab(target.mainTab)
    }

    if (target.orderTab) {
      setActiveOrderTab(target.orderTab)
    }

    if (target.inventoryTab) {
      setActiveInventoryTab(target.inventoryTab)
    }

    changeSection(target.section)
    setIsSearchOpen(false)
    setSearchQuery('')
  }

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
        <div className="topbar-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="검색"
            aria-expanded={isSearchOpen}
            onClick={() => setIsSearchOpen(true)}
          >
            <img src={blackSearchIcon} alt="" />
          </button>
          <LanguageSelector />
        </div>
      </header>

      {isSearchOpen ? (
        <div
          className="global-search-overlay"
          role="presentation"
          onMouseDown={() => setIsSearchOpen(false)}
        >
          <div
            className="global-search-panel"
            role="search"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <label className="global-search-field">
              <img src={blackSearchIcon} alt="" />
              <input
                autoFocus
                aria-label={t('search.placeholder')}
                placeholder={t('search.placeholder')}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const firstResult = searchResultGroups[0]?.items[0]

                    if (firstResult) {
                      moveToSearchResult(firstResult)
                    }
                  }
                }}
              />
            </label>

            {normalizedSearchQuery ? (
              searchResultGroups.length > 0 ? (
                <div className="global-search-results">
                  {searchResultGroups.map((group) => (
                    <section
                      className="global-search-result-group"
                      key={group.titleKey}
                    >
                      <button
                        className="global-search-result-title"
                        type="button"
                        onClick={() => moveToSearchResult(group)}
                      >
                        {t(group.titleKey)}
                      </button>
                      <div className="global-search-result-list">
                        {group.items.map((item) => (
                          <button
                            className="global-search-result-item"
                            key={item.labelKey}
                            type="button"
                            onClick={() => moveToSearchResult(item)}
                          >
                            {t(item.labelKey)}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="global-search-empty">{t('search.empty')}</div>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="workspace">
        <MainSidebar
          activeSection={activeSection}
          onSectionChange={changeSection}
        />

        <section
          className="content"
          aria-label={
            activeSection === 'orders'
              ? '발주'
              : activeSection === 'inventory'
                ? '재고 관리'
                : '메인 대시보드'
          }
        >
          <div className="company-row">
            <h1>SI E&amp;C Vietnam Co., Ltd.</h1>
          </div>

          {activeSection === 'orders' ? (
            <OrderPage
              repositoryId={REPOSITORY_ID}
              activeTab={activeOrderTab}
              onTabChange={setActiveOrderTab}
            />
          ) : activeSection === 'inventory' ? (
            <InventoryManagementPage
              repositoryId={REPOSITORY_ID}
              dashboard={dashboard}
              items={items}
              isLoading={isLoading}
              errorMessage={errorMessage}
              activeTab={activeInventoryTab}
              onTabChange={setActiveInventoryTab}
            />
          ) : (
            <>
              <section className="assistant-panel" aria-label="질문 입력">
                <div className="greeting">
                  <p className="hello">{t('chat.greeting')}</p>
                  <p className="prompt">{t('chat.help')}</p>
                </div>

                <label className="query-box">
                  <img src={plusIcon} alt="" />
                  <input
                    aria-label="질문 입력"
                    placeholder={t('chat.searchPlaceholder')}
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
            </>
          )}
        </section>
      </div>
    </main>
  )
}
