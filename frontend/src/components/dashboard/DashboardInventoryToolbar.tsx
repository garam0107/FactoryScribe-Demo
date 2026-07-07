import { useTranslation } from 'react-i18next'

type DashboardInventoryToolbarProps = {
  totalItems: number
  shortageItems: number
}

export function DashboardInventoryToolbar({
  totalItems,
  shortageItems,
}: DashboardInventoryToolbarProps) {
  const { t } = useTranslation('main')

  return (
    <div className="inventory-heading">
      <h2>
        {t('dashboard.currentInventory')} :{' '}
        <strong>
          {totalItems}
          {t('dashboard.items')}
        </strong>
        <span>
          {t('dashboard.lowStock')} : {shortageItems}
          {t('dashboard.items')}
        </span>
      </h2>
    </div>
  )
}
