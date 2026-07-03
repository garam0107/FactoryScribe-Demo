import { useEffect, useState } from 'react'

import type { InventoryItem } from '../../types/inventory'

type ForecastPanelProps = {
  items: InventoryItem[]
  isLoading: boolean
  errorMessage: string | null
}

type ForecastCategory = '원자재' | '부자재' | '소모품' | '포장재'

const FORECAST_CATEGORIES: ForecastCategory[] = [
  '원자재',
  '부자재',
  '소모품',
  '포장재',
]

const CATEGORY_ALIASES: Record<string, ForecastCategory> = {
  원자재: '원자재',
  원재료: '원자재',
  부자재: '부자재',
  소모품: '소모품',
  포장재: '포장재',
}

function normalizeCategory(category: string | null): ForecastCategory | null {
  if (!category) {
    return null
  }

  const compactCategory = category.replace(/\s/g, '')
  return CATEGORY_ALIASES[compactCategory] ?? null
}

function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '-'
  }

  return Math.round(value).toLocaleString('ko-KR')
}

function formatPrice(value: number | null | undefined, unit: string | null) {
  if (value == null || Number.isNaN(value)) {
    return '-'
  }

  const unitLabel = unit ? `/${unit}` : ''
  return `${Math.round(value).toLocaleString('ko-KR')} KRW${unitLabel}`
}

function getPriceChangeRate(item: InventoryItem) {
  if (item.price_change_rate != null && !Number.isNaN(item.price_change_rate)) {
    return item.price_change_rate * 100
  }

  if (!item.previous_unit_price || item.current_unit_price == null) {
    return null
  }

  return (
    ((item.current_unit_price - item.previous_unit_price) /
      item.previous_unit_price) *
    100
  )
}

function formatPriceChange(item: InventoryItem) {
  const changeRate = getPriceChangeRate(item)

  if (changeRate == null) {
    return {
      className: 'neutral',
      text: '전월 대비 가격 변화 없음',
    }
  }

  const isIncrease = changeRate >= 0
  const signedRate = `${isIncrease ? '+' : ''}${changeRate.toFixed(1)}%`

  return {
    className: isIncrease ? 'increase' : 'decrease',
    text: `전월 대비 ${signedRate} 가격 ${isIncrease ? '상승' : '하락'}`,
  }
}

function groupItemsByCategory(items: InventoryItem[]) {
  return items.reduce<Record<ForecastCategory, InventoryItem[]>>(
    (groups, item) => {
      const category = normalizeCategory(item.category)

      if (category) {
        groups[category].push(item)
      }

      return groups
    },
    {
      원자재: [],
      부자재: [],
      소모품: [],
      포장재: [],
    },
  )
}

function getAdditionalNeeded(item: InventoryItem) {
  const remainingQuantity = item.current_remaining_quantity ?? item.current_stock
  const expectedQuantity = item.current_year_expected_quantity

  if (expectedQuantity == null || remainingQuantity == null) {
    return 0
  }

  return Math.max(0, expectedQuantity - remainingQuantity)
}

function getMostNeededCategory(
  groupedItems: Record<ForecastCategory, InventoryItem[]>,
) {
  return FORECAST_CATEGORIES.reduce<{
    category: ForecastCategory
    quantity: number
  }>(
    (maxCategory, category) => {
      const categoryQuantity = groupedItems[category].reduce(
        (total, item) => total + getAdditionalNeeded(item),
        0,
      )

      if (categoryQuantity > maxCategory.quantity) {
        return {
          category,
          quantity: categoryQuantity,
        }
      }

      return maxCategory
    },
    {
      category: FORECAST_CATEGORIES[0],
      quantity: 0,
    },
  )
}

function ForecastCard({
  category,
  item,
}: {
  category: ForecastCategory
  item: InventoryItem | null
}) {
  if (!item) {
    return (
      <article className="forecast-card">
        <header className="forecast-card-header">
          <h3>{category}</h3>
          <div className="forecast-more">
            <span>더 보기</span>
            <span aria-hidden="true">›</span>
          </div>
        </header>

        <div className="forecast-empty">
          표시할 {category} 데이터가 없습니다.
        </div>
      </article>
    )
  }

  const previousYearUsage = item.previous_year_usage_quantity
  const remainingQuantity =
    item.current_remaining_quantity ?? item.current_stock ?? null
  const expectedQuantity = item.current_year_expected_quantity
  const additionalNeeded = getAdditionalNeeded(item)
  const priceChange = formatPriceChange(item)

  return (
    <article className="forecast-card">
      <header className="forecast-card-header">
        <h3>{category}</h3>
        <div className="forecast-more">
          <span>더 보기</span>
          <span aria-hidden="true">›</span>
        </div>
      </header>

      <div className="forecast-product">
        <div className="forecast-meta">
          <span>{item.supplier || '공급사 미지정'}</span>
          <i aria-hidden="true" />
          <span>{item.item_name}</span>
        </div>

        <strong>{formatPrice(item.current_unit_price, item.unit)}</strong>

        <p className={`forecast-change ${priceChange.className}`}>
          {priceChange.text}
        </p>
      </div>

      <div className="forecast-quantity-box">
        <dl className="forecast-quantities">
          <div>
            <dt>전년도 사용 수량</dt>
            <dd className="muted">{formatNumber(previousYearUsage)} 개</dd>
          </div>
          <div>
            <dt>현 시점 잔여 수량</dt>
            <dd>{formatNumber(remainingQuantity)} 개</dd>
          </div>
          <div>
            <dt>금년도 예상 사용 수량</dt>
            <dd>{formatNumber(expectedQuantity)} 개</dd>
          </div>
        </dl>

        <div className="forecast-divider" />

        <div className="forecast-needed">
          <span>추가 필요</span>
          <strong>{formatNumber(additionalNeeded)} 개</strong>
        </div>
      </div>
    </article>
  )
}

export function ForecastPanel({
  items,
  isLoading,
  errorMessage,
}: ForecastPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const groupedItems = groupItemsByCategory(items)
  const mostNeededCategory = getMostNeededCategory(groupedItems)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => currentIndex + 1)
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  if (isLoading) {
    return (
      <section className="forecast-panel" aria-label="예상 소모도">
        <div className="forecast-status">예상 소모도 데이터를 불러오는 중입니다.</div>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="forecast-panel" aria-label="예상 소모도">
        <div className="forecast-status">{errorMessage}</div>
      </section>
    )
  }

  return (
    <section className="forecast-panel" aria-label="예상 소모도">
      <div className="forecast-headline">
        <p>금년 예상 소모도 분석 결과,</p>
        <strong>{mostNeededCategory.category}</strong>
        <p>가 가장 부족할 것으로 예상됩니다.</p>
      </div>

      <div className="forecast-grid">
        {FORECAST_CATEGORIES.map((category) => {
          const categoryItems = groupedItems[category]
          const item =
            categoryItems.length > 0
              ? categoryItems[activeIndex % categoryItems.length]
              : null

          return (
            <ForecastCard key={category} category={category} item={item} />
          )
        })}
      </div>
    </section>
  )
}
