import { useTranslation } from 'react-i18next'

export type MainDashboardTab = 'overview' | 'purchaseOrders' | 'forecast'

type DashboardTabsProps = {
  activeTab: MainDashboardTab
  onTabChange: (tab: MainDashboardTab) => void
}

const tabs: { labelKey: string; value: MainDashboardTab }[] = [
  { labelKey: 'dashboard.overallStatus', value: 'overview' },
  { labelKey: 'dashboard.monthlyOrders', value: 'purchaseOrders' },
  { labelKey: 'dashboard.expectedConsumption', value: 'forecast' },
]

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  const { t } = useTranslation('main')

  return (
    <nav className="tabs" aria-label="대시보드 탭">
      {tabs.map((tab) => (
        <button
          className={activeTab === tab.value ? 'active' : ''}
          type="button"
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </nav>
  )
}
