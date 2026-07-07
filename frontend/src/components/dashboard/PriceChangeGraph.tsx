import { useTranslation } from 'react-i18next'

import type { InventoryItem } from '../../types/inventory'

type PriceChangeGraphProps = {
  item: InventoryItem | null
}

const CHART_WIDTH = 436
const CHART_HEIGHT = 160
const CHART_PADDING = {
  top: 0,
  right: 1,
  bottom: 20,
  left: 48,
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '0'
  }

  return Math.round(value).toLocaleString('ko-KR')
}

function formatChangeRate(item: InventoryItem) {
  if (item.price_change_rate != null && !Number.isNaN(item.price_change_rate)) {
    return item.price_change_rate * 100
  }

  if (!item.previous_unit_price || item.current_unit_price == null) {
    return 0
  }

  return (
    ((item.current_unit_price - item.previous_unit_price) /
      item.previous_unit_price) *
    100
  )
}

function buildYAxis(previousPrice: number, currentPrice: number) {
  const maxPrice = Math.max(previousPrice, currentPrice)
  const minPrice = Math.min(previousPrice, currentPrice)
  const range = Math.max(1, maxPrice - minPrice)
  const paddedMin = Math.max(0, minPrice - range * 0.7)
  const paddedMax = maxPrice + range * 0.7
  const roughStep = (paddedMax - paddedMin) / 4
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, roughStep)))
  const step = Math.ceil(roughStep / magnitude) * magnitude
  const axisMin = Math.max(0, Math.floor(paddedMin / step) * step)
  const axisMax = Math.ceil(paddedMax / step) * step

  const ticks = [
    axisMax,
    axisMax - step,
    axisMax - step * 2,
    axisMax - step * 3,
    axisMin,
  ]

  return Array.from(new Set(ticks.filter((tick) => tick >= axisMin)))
}

function yPosition(value: number, minValue: number, maxValue: number) {
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
  if (maxValue === minValue) {
    return CHART_PADDING.top + plotHeight / 2
  }

  return (
    CHART_PADDING.top +
    ((maxValue - value) / (maxValue - minValue)) * plotHeight
  )
}

function buildSparklinePoints(previousPrice: number, currentPrice: number) {
  const delta = currentPrice - previousPrice
  const anchors = [
    0, -0.12, -0.18, 0.38, 0.72, 0.82, 0.2, 0.2, 0.32, 0.28, 0.45, 0.32,
    0.46, 0.24, 0.34, 0.2, 0.16, 1,
  ]

  return anchors.map((anchor, index) => ({
    x:
      CHART_PADDING.left +
      ((CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right) * index) /
        (anchors.length - 1),
    value: previousPrice + delta * anchor,
  }))
}

export function PriceChangeGraph({ item }: PriceChangeGraphProps) {
  const { t } = useTranslation('main')

  if (!item || item.current_unit_price == null || item.previous_unit_price == null) {
    return (
      <article className="price-graph-card">
        <div className="price-card-body">
          <div className="price-card-header">
            <h3>{t('dashboard.recentSupplierPartPriceChanges')}</h3>
            <span aria-hidden="true">...</span>
          </div>
        </div>
        <div className="empty-price-graph">표시할 가격 데이터가 없습니다.</div>
      </article>
    )
  }

  const previousPrice = item.previous_unit_price
  const currentPrice = item.current_unit_price
  const yAxis = buildYAxis(previousPrice, currentPrice)
  const minAxis = Math.min(...yAxis)
  const maxAxis = Math.max(...yAxis)
  const points = buildSparklinePoints(previousPrice, currentPrice)
  const path = points
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L'
      return `${command} ${point.x} ${yPosition(point.value, minAxis, maxAxis)}`
    })
    .join(' ')
  const areaPath = `${path} L ${CHART_WIDTH - CHART_PADDING.right} ${
    CHART_HEIGHT - CHART_PADDING.bottom
  } L ${CHART_PADDING.left} ${CHART_HEIGHT - CHART_PADDING.bottom} Z`
  const changeRate = formatChangeRate(item)
  const isIncrease = changeRate >= 0
  const changeText = `${isIncrease ? '+' : ''}${changeRate.toFixed(1)}%`
  const supplier = item.supplier || '(주) 한솔'

  return (
    <article className="price-graph-card">
      <div className="price-card-body">
        <div className="price-card-header">
          <h3>{t('dashboard.recentSupplierPartPriceChanges')}</h3>
          <span aria-hidden="true">...</span>
        </div>

        <div className="price-card-detail">
          <div className="price-card-meta">
            <span>{supplier}</span>
            <i aria-hidden="true" />
            <span>{item.item_name}</span>
          </div>

          <div className="price-card-value-row">
            <strong>{formatCurrency(currentPrice)} KRW</strong>
            <span className={isIncrease ? 'increase' : 'decrease'}>
              {t('dashboard.priceChangeText', {
                rate: changeText,
                direction: t(
                  isIncrease
                    ? 'dashboard.priceIncrease'
                    : 'dashboard.priceDecrease',
                ),
              })}
            </span>
          </div>
        </div>
      </div>

      <div
        className="price-chart"
        aria-label={t('dashboard.priceChangeAria', {
          itemName: item.item_name,
        })}
      >
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-hidden="true"
        >
          {yAxis.map((tick) => {
            const y = yPosition(tick, minAxis, maxAxis)
            return (
              <g key={tick}>
                <text className="axis-label" x="40" y={y + 4}>
                  {formatCurrency(tick)}
                </text>
                <line
                  className="grid-line"
                  x1={CHART_PADDING.left}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y1={y}
                  y2={y}
                />
              </g>
            )
          })}
          <path className="price-area" d={areaPath} />
          <path
            className={isIncrease ? 'price-line increase' : 'price-line decrease'}
            d={path}
          />
          <text className="month-label start" x={CHART_PADDING.left} y={CHART_HEIGHT - 2}>
            June
          </text>
          <text
            className="month-label end"
            x={CHART_WIDTH - CHART_PADDING.right}
            y={CHART_HEIGHT - 2}
          >
            July
          </text>
        </svg>
      </div>
    </article>
  )
}
