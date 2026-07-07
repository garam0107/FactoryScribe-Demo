import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

export type InventoryMetric = {
  title: string
  value: string
  percent: number
  tone: 'red' | 'turquoise' | 'mustard' | 'azure'
}

type DashboardSummaryProps = {
  metrics: InventoryMetric[]
}

export function DashboardSummary({ metrics }: DashboardSummaryProps) {
  const { t } = useTranslation('main')

  return (
    <section className="metrics" aria-label={t('dashboard.overallStatus')}>
      {metrics.map((metric) => (
        <article className="metric-card" key={metric.title}>
          <h2>{metric.title}</h2>
          <div
            className={`metric-ring ${metric.tone}`}
            style={{ '--metric-percent': metric.percent } as CSSProperties}
          >
            <span>{metric.value}</span>
          </div>
        </article>
      ))}
    </section>
  )
}
