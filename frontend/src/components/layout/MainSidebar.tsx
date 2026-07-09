import { useTranslation } from 'react-i18next'

import bookmarkIcon from '../../assets/icons/bookmark.svg'
import checkIcon from '../../assets/icons/check.svg'
import homeIcon from '../../assets/icons/home.svg'
import loaderIcon from '../../assets/icons/loader.svg'
import settingsIcon from '../../assets/icons/settings.svg'
import toolsIcon from '../../assets/icons/tools.svg'
import truckIcon from '../../assets/icons/truck.svg'
import typeIcon from '../../assets/icons/type.svg'
import viewsIcon from '../../assets/icons/views.svg'
import type { ChatConversationSummary } from '../../types/chat'

type NavItem = {
  value: AppSection
  labelKey: string
  icon: string
  disabled?: boolean
}

export type AppSection =
  | 'main'
  | 'orders'
  | 'inventory'
  | 'quote'
  | 'prompt'
  | 'admin'

const navItems: NavItem[] = [
  { value: 'main', labelKey: 'nav.main', icon: homeIcon },
  { value: 'orders', labelKey: 'nav.orders', icon: truckIcon },
  { value: 'inventory', labelKey: 'nav.inventoryManagement', icon: toolsIcon },
  { value: 'quote', labelKey: 'nav.quotationCalculationDrawing', icon: viewsIcon },
  { value: 'prompt', labelKey: 'nav.advancedPromptInput', icon: typeIcon },
  { value: 'admin', labelKey: 'nav.adminSettings', icon: settingsIcon },
]

type MainSidebarProps = {
  activeSection: AppSection
  onSectionChange: (section: AppSection) => void
  promptConversations: ChatConversationSummary[]
  activePromptConversationId: string | null
  onPromptConversationSelect: (conversationId: string) => void
}

export function MainSidebar({
  activeSection,
  onSectionChange,
  promptConversations,
  activePromptConversationId,
  onPromptConversationSelect,
}: MainSidebarProps) {
  const { t } = useTranslation('sidebar')

  return (
    <aside className="sidebar" aria-label="주요 메뉴">
      <nav className="side-nav">
        {navItems.map((item) => (
          <button
            className={[
              'side-link',
              activeSection === item.value ? 'active' : '',
              item.disabled ? 'disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            type="button"
            key={item.value}
            disabled={item.disabled}
            onClick={() => onSectionChange(item.value)}
          >
            <img src={item.icon} alt="" />
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>
      {activeSection === 'prompt' ? (
        <section className="sidebar-history" aria-label="대화 히스토리">
          <div className="sidebar-history-header">
            <img src={bookmarkIcon} alt="" />
            <strong>대화 히스토리</strong>
          </div>
          {promptConversations.map((conversation) => {
            const isActive = activePromptConversationId === conversation.id

            return (
              <button
                key={conversation.id}
                className={['sidebar-history-item', isActive ? 'active' : '']
                  .filter(Boolean)
                  .join(' ')}
                type="button"
                onClick={() => onPromptConversationSelect(conversation.id)}
              >
                <img src={isActive ? loaderIcon : checkIcon} alt="" />
                <span>{conversation.title}</span>
              </button>
            )
          })}
        </section>
      ) : null}
    </aside>
  )
}
