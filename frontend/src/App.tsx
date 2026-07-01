import './App.css'

import { type CSSProperties, useEffect, useState } from 'react'

import blackSearchIcon from './assets/icons/black_search.svg'
import homeIcon from './assets/icons/home.svg'
import logomarkIcon from './assets/icons/logomark.svg'
import plusIcon from './assets/icons/plus.svg'
import searchIcon from './assets/icons/search.svg'
import settingsIcon from './assets/icons/settings.svg'
import toolsIcon from './assets/icons/tools.svg'
import truckIcon from './assets/icons/truck.svg'
import typeIcon from './assets/icons/type.svg'
import viewsIcon from './assets/icons/views.svg'

type NavItem = {
  label: string
  icon: string
  active?: boolean
}

type Metric = {
  title: string
  value: string
  percent: number
  tone: 'red' | 'turquoise' | 'mustard' | 'azure'
}

const navItems: NavItem[] = [
  { label: '메인', icon: homeIcon, active: true },
  { label: '발주', icon: truckIcon },
  { label: '재고 관리', icon: toolsIcon },
  { label: '견적 계산 (도면)', icon: viewsIcon },
  { label: '고급 : 프롬포트 입력', icon: typeIcon },
  { label: '관리자 설정', icon: settingsIcon },
]

const metrics: Metric[] = [
  { title: '재고 잔여량', value: '0', percent: 0, tone: 'red' },
  { title: '부품가격 상승률', value: '0', percent: 0, tone: 'turquoise' },
  { title: '생산품 실거래량', value: '0', percent: 0, tone: 'mustard' },
  { title: '배송 중인 발주', value: '0', percent: 0, tone: 'turquoise' },
]

const graphTitles = [
  '납품업체 최근 부품 가격 변화',
  '월별 소모품 사용량 / 출납 실거래량',
]

const FIGMA_FRAME_WIDTH = 1440

function App() {
  const [appScale, setAppScale] = useState(1)

  useEffect(() => {
    const updateScale = () => {
      setAppScale(window.innerWidth / FIGMA_FRAME_WIDTH)
    }

    updateScale()
    window.addEventListener('resize', updateScale)

    return () => {
      window.removeEventListener('resize', updateScale)
    }
  }, [])

  return (
    <main
      className="app-shell"
      style={{ '--app-scale': appScale } as CSSProperties}
    >
      <header className="topbar">
        <a className="brand" href="/" aria-label="FAUTORY 홈">
          <img src={logomarkIcon} alt="" />
          <span>FAUTORY</span>
        </a>
        <button className="icon-button" type="button" aria-label="검색">
          <img src={blackSearchIcon} alt="" />
        </button>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="주요 메뉴">
          <nav className="side-nav">
            {navItems.map((item) => (
              <a
                className={item.active ? 'side-link active' : 'side-link'}
                href="/"
                key={item.label}
              >
                <img src={item.icon} alt="" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        </aside>

        <section className="content" aria-label="메인 대시보드">
          <div className="company-row">
            <h1>SI E&amp;C Vietnam Co., Ltd.</h1>
            <span className="caret" aria-hidden="true" />
          </div>

          <section className="assistant-panel" aria-label="질문 입력">
            <div className="greeting">
              <p className="hello">안녕하세요. 김OO님.</p>
              <p className="prompt">무엇을 도와드릴까요?</p>
            </div>

            <label className="query-box">
              <img src={plusIcon} alt="" />
              <input
                aria-label="질문 입력"
                placeholder="현재 부족 재고 일괄 주문해줘."
                type="text"
              />
              <button type="button" aria-label="질문 검색">
                <img src={searchIcon} alt="" />
              </button>
            </label>
          </section>

          <nav className="tabs" aria-label="대시보드 탭">
            <button className="active" type="button">
              전체 현황
            </button>
            <button type="button">이번 달 발주</button>
            <button type="button">예상 소모도</button>
          </nav>

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

          <section className="inventory-section" aria-label="현재 재고">
            <h2>
              현재 재고 : <strong>0가지</strong>
              <span>부족 재고 : 0가지</span>
            </h2>
            <div className="empty-inventory">표시할 재고 데이터가 없습니다.</div>
          </section>

          <section className="graphs-section" aria-label="데이터 그래프">
            <h2>데이터 그래프</h2>
            <div className="graph-grid">
              {graphTitles.map((title) => (
                <article className="graph-card" key={title}>
                  <div className="graph-header">
                    <h3>{title}</h3>
                    <span aria-hidden="true">›</span>
                  </div>
                  <div className="zero-graph">0</div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}

export default App
