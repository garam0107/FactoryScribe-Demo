import homeIcon from '../../assets/icons/home.svg'
import settingsIcon from '../../assets/icons/settings.svg'
import toolsIcon from '../../assets/icons/tools.svg'
import truckIcon from '../../assets/icons/truck.svg'
import typeIcon from '../../assets/icons/type.svg'
import viewsIcon from '../../assets/icons/views.svg'

type NavItem = {
  value: AppSection
  label: string
  icon: string
  disabled?: boolean
}

export type AppSection = 'main' | 'orders' | 'inventory' | 'quote' | 'prompt' | 'admin'

const navItems: NavItem[] = [
  { value: 'main', label: '메인', icon: homeIcon },
  { value: 'orders', label: '발주', icon: truckIcon },
  { value: 'inventory', label: '재고 관리', icon: toolsIcon },
  { value: 'quote', label: '견적 계산 (도면)', icon: viewsIcon },
  { value: 'prompt', label: '고급 : 프롬포트 입력', icon: typeIcon },
  { value: 'admin', label: '관리자 설정', icon: settingsIcon },
]

type MainSidebarProps = {
  activeSection: AppSection
  onSectionChange: (section: AppSection) => void
}

export function MainSidebar({
  activeSection,
  onSectionChange,
}: MainSidebarProps) {
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
            key={item.label}
            disabled={item.disabled}
            onClick={() => onSectionChange(item.value)}
          >
            <img src={item.icon} alt="" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
