import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { askChat, getConversationMessages, getConversations } from '../api/chat'
import { getInventoryDashboard, getInventoryItems } from '../api/inventory'
import {
  createRepository,
  deleteRepository,
  getRepositories,
} from '../api/repositories'
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
import type {
  ChatConversationSummary,
  ChatMessage,
} from '../types/chat'
import type { InventoryDashboard, InventoryItem } from '../types/inventory'
import type { Repository } from '../types/repository'
import {
  InventoryManagementPage,
  type InventoryTab,
} from './InventoryManagementPage'
import { OrderPage, type OrderTab } from './OrderPage'
import { PromptPage, type PromptTab } from './PromptPage'
import {
  QuotationDrawingPage,
  type QuoteDrawingTab,
} from './QuotationDrawingPage'

const REPOSITORY_ID = 'repo_ed87dd4ba0f8'
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
  quoteTab?: QuoteDrawingTab
  promptTab?: PromptTab
}

type SearchResultGroup = {
  titleKey: string
  section: AppSection
  keywords: string[]
  mainTab?: MainDashboardTab
  orderTab?: OrderTab
  inventoryTab?: InventoryTab
  quoteTab?: QuoteDrawingTab
  promptTab?: PromptTab
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
        keywords: ['예상 소모량', '소모량', 'forecast', 'consumption'],
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
  {
    titleKey: 'search.sections.quote',
    section: 'quote',
    quoteTab: 'bom',
    keywords: [
      '견적 계산',
      '도면',
      '견적 계산 도면',
      'quote calculation',
      'drawing',
    ],
    items: [
      {
        labelKey: 'search.items.bomGeneration',
        section: 'quote',
        quoteTab: 'bom',
        keywords: ['견적 계산', 'bom', 'bom 생성', 'bill of materials'],
      },
      {
        labelKey: 'search.items.threeDDrawingGeneration',
        section: 'quote',
        quoteTab: 'bom',
        keywords: ['도면', '3d', '3d 도면', '3d 도면 생성', '3d drawing'],
      },
    ],
  },
  {
    titleKey: 'search.sections.prompt',
    section: 'prompt',
    promptTab: 'prompt',
    keywords: [
      '고급',
      '프롬프트',
      '프롬프트 입력',
      'advanced',
      'prompt input',
    ],
    items: [
      {
        labelKey: 'search.items.promptInput',
        section: 'prompt',
        promptTab: 'prompt',
        keywords: ['고급', '프롬프트', '프롬프트 입력', 'advanced', 'prompt'],
      },
      {
        labelKey: 'search.items.directorySettings',
        section: 'prompt',
        promptTab: 'directory',
        keywords: ['디렉토리', '디렉토리 설정', '폴더 설정', 'directory', 'folder'],
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

function createLocalMessage(
  id: string,
  role: ChatMessage['role'],
  content: string,
  conversationId = 'local',
): ChatMessage {
  return {
    id,
    conversation_id: conversationId,
    role,
    content,
    created_at: new Date().toISOString(),
  }
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
  const [activeQuoteTab, setActiveQuoteTab] =
    useState<QuoteDrawingTab>('bom')
  const [activePromptTab, setActivePromptTab] = useState<PromptTab>('prompt')
  const [dashboard, setDashboard] = useState<InventoryDashboard | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [promptConversations, setPromptConversations] = useState<
    ChatConversationSummary[]
  >([])
  const [activePromptConversationId, setActivePromptConversationId] =
    useState<string | null>(null)
  const [promptMessages, setPromptMessages] = useState<ChatMessage[]>([])
  const [promptDraft, setPromptDraft] = useState('')
  const [mainChatDraft, setMainChatDraft] = useState('')
  const [isPromptMessagesLoading, setIsPromptMessagesLoading] = useState(false)
  const [isPromptSending, setIsPromptSending] = useState(false)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false)

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

  useEffect(() => {
    if (activeSection !== 'prompt') {
      return undefined
    }

    let ignore = false

    async function loadPromptConversations() {
      try {
        setIsDirectoryLoading(true)

        const [conversations, repositoryList] = await Promise.all([
          getConversations(REPOSITORY_ID),
          getRepositories(),
        ])

        if (!ignore) {
          setPromptConversations(conversations)
          setRepositories(repositoryList)
        }
      } catch {
        if (!ignore) {
          setPromptConversations([])
          setRepositories([])
        }
      } finally {
        if (!ignore) {
          setIsDirectoryLoading(false)
        }
      }
    }

    loadPromptConversations()

    return () => {
      ignore = true
    }
  }, [activeSection])

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

    if (target.quoteTab) {
      setActiveQuoteTab(target.quoteTab)
    }

    if (target.promptTab) {
      setActivePromptTab(target.promptTab)
    }

    changeSection(target.section)
    setIsSearchOpen(false)
    setSearchQuery('')
  }

  const handlePromptConversationSelect = async (conversationId: string) => {
    setActivePromptConversationId(conversationId)
    setIsPromptMessagesLoading(true)

    try {
      const messages = await getConversationMessages(REPOSITORY_ID, conversationId)
      setPromptMessages(messages)
    } catch {
      setPromptMessages([
        createLocalMessage(
          `load-error-${Date.now()}`,
          'assistant',
          '대화 내용을 불러오지 못했습니다.',
          conversationId,
        ),
      ])
    } finally {
      setIsPromptMessagesLoading(false)
    }
  }

  const sendPromptMessage = async (
    message: string,
    conversationId: string | null,
  ) => {
    if (!message || isPromptSending) {
      return
    }

    const timestamp = Date.now()
    const userMessage = createLocalMessage(
      `user-${timestamp}`,
      'user',
      message,
      conversationId ?? 'pending',
    )

    const hadActiveConversation = conversationId !== null
    const pendingConversationId =
      conversationId ?? `pending-${timestamp}`

    setPromptMessages((current) => [...current, userMessage])
    setPromptDraft('')
    setIsPromptSending(true)

    if (!hadActiveConversation) {
      const pendingConversation: ChatConversationSummary = {
        id: pendingConversationId,
        repository_id: REPOSITORY_ID,
        title: message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setActivePromptConversationId(pendingConversationId)
      setPromptConversations((current) => [pendingConversation, ...current])
    }

    try {
      const response = await askChat({
        repository_id: REPOSITORY_ID,
        conversation_id: conversationId,
        message,
      })

      setPromptMessages((current) => [
        ...current,
        createLocalMessage(
          `assistant-${Date.now()}`,
          'assistant',
          response.answer,
          response.conversation_id,
        ),
      ])
      setActivePromptConversationId(response.conversation_id)

      const conversations = await getConversations(REPOSITORY_ID)
      setPromptConversations(conversations)
    } catch (error) {
      if (!hadActiveConversation) {
        setActivePromptConversationId(null)
        setPromptConversations((current) =>
          current.filter((conversation) => conversation.id !== pendingConversationId),
        )
      }

      setPromptMessages((current) => [
        ...current,
        createLocalMessage(
          `assistant-error-${Date.now()}`,
          'assistant',
          error instanceof Error
            ? '응답을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
            : '응답을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
          hadActiveConversation
            ? conversationId ?? 'pending'
            : 'pending',
        ),
      ])
    } finally {
      setIsPromptSending(false)
    }
  }

  const handlePromptSend = () => {
    const message = promptDraft.trim()

    if (!message) {
      return
    }

    void sendPromptMessage(message, activePromptConversationId)
  }

  const handleMainChatSubmit = () => {
    const message = mainChatDraft.trim()

    if (!message || isPromptSending) {
      return
    }

    setMainChatDraft('')
    setActivePromptTab('prompt')
    setActivePromptConversationId(null)
    setPromptMessages([])
    changeSection('prompt')
    void sendPromptMessage(message, null)
  }

  const handleAddDirectory = async (payload: {
    name: string
    path: string
  }) => {
    try {
      await createRepository(payload)

      const repositoryList = await getRepositories()
      setRepositories(repositoryList)
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : '저장소를 등록하지 못했습니다.',
      )
    }
  }

  const handleRemoveDirectory = async (repositoryId: string) => {
    const target = repositories.find((repository) => repository.id === repositoryId)

    if (!target) {
      return
    }

    const confirmed = window.confirm(
      `${target.name} 저장소를 삭제하시겠습니까?`,
    )

    if (!confirmed) {
      return
    }

    try {
      await deleteRepository(repositoryId)
      const repositoryList = await getRepositories()
      setRepositories(repositoryList)
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : '저장소를 삭제하지 못했습니다.',
      )
    }
  }

  return (
    <main className="app-shell">
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
          promptConversations={promptConversations}
          activePromptConversationId={activePromptConversationId}
          onPromptConversationSelect={handlePromptConversationSelect}
        />

        <section
          className="content"
          aria-label={
            activeSection === 'orders'
              ? '발주'
              : activeSection === 'inventory'
                ? '재고 관리'
                : activeSection === 'prompt'
                  ? '고급 프롬프트 입력'
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
          ) : activeSection === 'prompt' ? (
            <PromptPage
              activeTab={activePromptTab}
              onTabChange={setActivePromptTab}
              draft={promptDraft}
              isSending={isPromptSending}
              isLoadingMessages={isPromptMessagesLoading}
              messages={promptMessages}
              repositories={repositories}
              isDirectoryLoading={isDirectoryLoading}
              onDraftChange={setPromptDraft}
              onSend={handlePromptSend}
              onAddDirectory={handleAddDirectory}
              onRemoveDirectory={handleRemoveDirectory}
            />
            ) : activeSection === 'quote' ? (
                <QuotationDrawingPage
                  activeTab={activeQuoteTab}
                  onTabChange={setActiveQuoteTab}
                />
          ) : activeSection === 'admin' ? (
            <div className="empty-page" aria-label="관리자 설정">
              {/* 관리자 설정 화면은 아직 준비 중 */}
            </div>
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
                    placeholder={t('chat.askAnything')}
                    type="text"
                    value={mainChatDraft}
                    onChange={(event) => setMainChatDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                        event.preventDefault()
                        handleMainChatSubmit()
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label="질문 검색"
                    onClick={handleMainChatSubmit}
                  >
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
