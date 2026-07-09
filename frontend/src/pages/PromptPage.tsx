import { useState } from 'react'

import plusIcon from '../assets/icons/plus.svg'
import searchIcon from '../assets/icons/search.svg'
import type { ChatMessage } from '../types/chat'

type PromptTab = 'prompt' | 'directory'

type PromptPageProps = {
  draft: string
  isSending: boolean
  isLoadingMessages: boolean
  messages: ChatMessage[]
  onDraftChange: (draft: string) => void
  onSend: () => void
}

export function PromptPage({
  draft,
  isSending,
  isLoadingMessages,
  messages,
  onDraftChange,
  onSend,
}: PromptPageProps) {
  const [activeTab, setActiveTab] = useState<PromptTab>('prompt')

  const showMessages = messages.length > 0 || isSending || isLoadingMessages

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
            showMessages ? (
              <div className="prompt-chat-thread">
                <div className="prompt-chat-thread-inner">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-bubble-row ${message.role === 'user' ? 'user' : 'assistant'}`}
                    >
                      <div className={`chat-bubble ${message.role}`}>
                        <p>{message.content}</p>
                      </div>
                    </div>
                  ))}

                  {(isSending || isLoadingMessages) && (
                    <div className="chat-bubble-row assistant">
                      <div className="chat-loading-bubble" aria-label="응답 생성 중">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="prompt-empty-state">
                질문을 입력하면 여기에서 대화를 이어갈 수 있습니다.
              </div>
            )
          ) : (
            <div className="directory-stage" aria-hidden="true" />
          )}
        </div>

        {activeTab === 'prompt' ? (
          <label className="query-box prompt-query-box">
            <img src={plusIcon} alt="" />
            <input
              aria-label="프롬프트 입력"
              placeholder="궁금하신 것을 물어보세요"
              type="text"
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  onSend()
                }
              }}
            />
            <button type="button" aria-label="프롬프트 전송" onClick={onSend}>
              <img src={searchIcon} alt="" />
            </button>
          </label>
        ) : null}
      </div>
    </section>
  )
}
