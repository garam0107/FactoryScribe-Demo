import homeIcon from '../../assets/icons/home.svg'
import settingsIcon from '../../assets/icons/settings.svg'
import toolsIcon from '../../assets/icons/tools.svg'
import truckIcon from '../../assets/icons/truck.svg'
import typeIcon from '../../assets/icons/type.svg'
import viewsIcon from '../../assets/icons/views.svg'

type NavItem = {
  label: string
  icon: string
  active?: boolean
  disabled?: boolean
}

const navItems: NavItem[] = [
  { label: '메인', icon: homeIcon, active: true },
  { label: '발주', icon: truckIcon },
  { label: '재고 관리', icon: toolsIcon },
  { label: '견적 계산 (도면)', icon: viewsIcon, disabled: true },
  { label: '고급 : 프롬포트 입력', icon: typeIcon, disabled: true },
  { label: '관리자 설정', icon: settingsIcon },
]

export function MainSidebar() {
  return (
    <aside className="sidebar" aria-label="주요 메뉴">
      <nav className="side-nav">
        {navItems.map((item) => (
          <a
            className={[
              'side-link',
              item.active ? 'active' : '',
              item.disabled ? 'disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            href="/"
            key={item.label}
          >
            <img src={item.icon} alt="" />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  )
}
