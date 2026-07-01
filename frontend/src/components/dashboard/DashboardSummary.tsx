import type { CSSProperties } from 'react'

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
  return (
    <section className="metrics" aria-label="전체 현황">
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
