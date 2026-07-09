import { useState } from 'react'

import plusIcon from '../assets/icons/plus.svg'
import searchIcon from '../assets/icons/search.svg'

type PromptTab = 'prompt' | 'directory'

export function PromptPage() {
  const [activeTab, setActiveTab] = useState<PromptTab>('prompt')

  return (
    <section className="prompt-page" aria-label="고급 프롬프트 입력">
      <div className="prompt-main-panel">
        <nav className="tabs prompt-tabs" aria-label="프롬프트 탭">
          <button
            className={activeTab === 'prompt' ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab('prompt')}
          >
            프롬프트 입력
          </button>
          <button
            className={activeTab === 'directory' ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab('directory')}
          >
            디렉토리 설정
          </button>
        </nav>

        <div className="prompt-stage">
          {activeTab === 'prompt' ? (
            <div className="prompt-empty-state">
              디렉토리를 설정 후 아래에 원하는 작업을 입력해주세요.
            </div>
          ) : (
            <div className="directory-stage">
              <div className="directory-card">
                <span className="directory-label">문서 저장소 경로</span>
                <div className="directory-field">
                  <span>연결할 디렉토리를 선택해주세요.</span>
                  <button type="button">선택</button>
                </div>
              </div>
              <div className="directory-card">
                <span className="directory-label">출력 저장 경로</span>
                <div className="directory-field">
                  <span>결과 파일이 저장될 위치를 설정해주세요.</span>
                  <button type="button">선택</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <label className="query-box prompt-query-box">
          <img src={plusIcon} alt="" />
          <input
            aria-label="프롬프트 입력"
            placeholder="현재 부족 재고 일괄 주문해줘."
            type="text"
          />
          <button type="button" aria-label="프롬프트 전송">
            <img src={searchIcon} alt="" />
          </button>
        </label>
      </div>
    </section>
  )
}
