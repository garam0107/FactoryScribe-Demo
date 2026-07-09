import { useRef, useState, type ChangeEvent } from 'react'

import minusCircleIcon from '../assets/icons/minus-circle.svg'
import plusCircleIcon from '../assets/icons/plus-circle.svg'
import plusIcon from '../assets/icons/plus.svg'
import searchIcon from '../assets/icons/search.svg'
import type { ChatMessage } from '../types/chat'
import type { Repository } from '../types/repository'

type PromptTab = 'prompt' | 'directory'

type DirectoryCreatePayload = {
  name: string
  path: string
}

type PromptPageProps = {
  draft: string
  isSending: boolean
  isLoadingMessages: boolean
  messages: ChatMessage[]
  repositories: Repository[]
  isDirectoryLoading: boolean
  onDraftChange: (draft: string) => void
  onSend: () => void
  onAddDirectory: (payload: DirectoryCreatePayload) => void
  onRemoveDirectory: (repositoryId: string) => void
}

type BrowserFileWithPath = File & {
  path?: string
  webkitRelativePath?: string
}

const DIRECTORY_META = [
  { scope: '공통', capacity: '24.7 TB', shared: '317명 공유' },
  { scope: '팀', capacity: '19.2 TB', shared: '317명 공유' },
  { scope: '팀', capacity: '195 GB', shared: '317명 공유' },
  { scope: '팀', capacity: '278 GB', shared: '317명 공유' },
  { scope: '팀', capacity: '13.5 MB', shared: '317명 공유' },
  { scope: '팀', capacity: '27.4 MB', shared: '317명 공유' },
  { scope: '프로젝트', capacity: '12.8 MB', shared: '317명 공유' },
  { scope: '프로젝트', capacity: '2.4 MB', shared: '317명 공유' },
]

export function PromptPage({
  draft,
  isSending,
  isLoadingMessages,
  messages,
  repositories,
  isDirectoryLoading,
  onDraftChange,
  onSend,
  onAddDirectory,
  onRemoveDirectory,
}: PromptPageProps) {
  const [activeTab, setActiveTab] = useState<PromptTab>('prompt')
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(
    null,
  )
  const directoryInputRef = useRef<HTMLInputElement | null>(null)

  const showMessages = messages.length > 0 || isSending || isLoadingMessages

  const handleDirectoryPick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files

    if (!files || files.length === 0) {
      return
    }

    const firstFile = files[0] as BrowserFileWithPath
    const topLevelName =
      firstFile.webkitRelativePath?.split('/')[0] || firstFile.name
    const fullPath = firstFile.path

    if (!fullPath) {
      window.alert(
        '현재 브라우저에서는 폴더의 실제 경로를 가져올 수 없습니다. Electron 환경에서 다시 시도해주세요.',
      )
      event.target.value = ''
      return
    }

    const normalizedPath = fullPath.slice(
      0,
      Math.max(0, fullPath.length - firstFile.name.length - 1),
    )

    onAddDirectory({
      name: topLevelName,
      path: normalizedPath,
    })

    event.target.value = ''
  }

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
            <section className="directory-stage" aria-label="현재 디렉토리">
              <input
                ref={directoryInputRef}
                className="directory-picker-input"
                type="file"
                multiple
                onChange={handleDirectoryPick}
                {...({ webkitdirectory: '' } as Record<string, string>)}
              />

              <div className="directory-layout">
                <div className="directory-panel">
                  <div className="directory-stage-header">
                    <h2>현재 디렉토리</h2>
                  </div>

                  {isDirectoryLoading ? (
                    <div className="directory-empty-state">
                      저장소를 불러오는 중입니다.
                    </div>
                  ) : repositories.length > 0 ? (
                    <div className="directory-table">
                      <div className="directory-list">
                        {repositories.map((repository, index) => {
                          const meta =
                            DIRECTORY_META[index % DIRECTORY_META.length]
                          const isSelected =
                            selectedDirectoryId === repository.id

                          return (
                            <button
                              className={[
                                'directory-row',
                                isSelected ? 'selected' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              key={repository.id}
                              type="button"
                              onClick={() => setSelectedDirectoryId(repository.id)}
                            >
                              <span className="directory-name">{repository.name}</span>
                              <div className="directory-meta">
                                <span className="directory-scope">{meta.scope}</span>
                                <span
                                  className="directory-meta-separator"
                                  aria-hidden="true"
                                />
                                <span className="directory-capacity">
                                  {meta.capacity}
                                </span>
                                <span
                                  className="directory-meta-separator"
                                  aria-hidden="true"
                                />
                                <span className="directory-shared">
                                  {meta.shared}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="directory-empty-state">
                      등록된 저장소가 없습니다.
                    </div>
                  )}
                </div>

                <div className="directory-icon-rail" aria-label="디렉토리 작업">
                  <button
                    className="directory-icon-button"
                    type="button"
                    aria-label="저장소 등록"
                    onClick={() => directoryInputRef.current?.click()}
                  >
                    <img src={plusCircleIcon} alt="" />
                  </button>
                  <button
                    className="directory-icon-button remove"
                    type="button"
                    aria-label="저장소 삭제"
                    onClick={() => {
                      if (!selectedDirectoryId) {
                        window.alert('삭제하실 항목을 선택해주세요')
                        return
                      }

                      onRemoveDirectory(selectedDirectoryId)
                      setSelectedDirectoryId(null)
                    }}
                  >
                    <img src={minusCircleIcon} alt="" />
                  </button>
                </div>

                <div className="directory-spacer" aria-hidden="true" />
              </div>
            </section>
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
