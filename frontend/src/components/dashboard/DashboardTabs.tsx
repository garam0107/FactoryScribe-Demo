export type MainDashboardTab = 'overview' | 'purchaseOrders' | 'forecast'

type DashboardTabsProps = {
  activeTab: MainDashboardTab
  onTabChange: (tab: MainDashboardTab) => void
}

const tabs: { label: string; value: MainDashboardTab }[] = [
  { label: '전체 현황', value: 'overview' },
  { label: '이번 달 발주', value: 'purchaseOrders' },
  { label: '예상 소모도', value: 'forecast' },
]

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  return (
    <nav className="tabs" aria-label="대시보드 탭">
      {tabs.map((tab) => (
        <button
          className={activeTab === tab.value ? 'active' : ''}
          type="button"
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
