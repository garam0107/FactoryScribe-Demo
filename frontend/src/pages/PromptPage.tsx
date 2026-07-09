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
            <div className="directory-stage" aria-hidden="true" />
          )}
        </div>

        {activeTab === 'prompt' ? (
          <label className="query-box prompt-query-box">
            <img src={plusIcon} alt="" />
            <input
              aria-label="프롬프트 입력"
              placeholder="궁금하신 것을 물어보세요."
              type="text"
            />
            <button type="button" aria-label="프롬프트 전송">
              <img src={searchIcon} alt="" />
            </button>
          </label>
        ) : null}
      </div>
    </section>
  )
}
