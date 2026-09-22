import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import minusCircleIcon from '../assets/icons/minus-circle.svg'
import plusCircleIcon from '../assets/icons/plus-circle.svg'
import plusIcon from '../assets/icons/plus.svg'
import searchIcon from '../assets/icons/search.svg'
import type { ChatMessage } from '../types/chat'
import type { Repository } from '../types/repository'

export type PromptTab = 'prompt' | 'directory'

type DirectoryCreatePayload = {
  name: string
  path: string
}

type PromptPageProps = {
  activeTab: PromptTab
  onTabChange: (tab: PromptTab) => void
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

const DIRECTORY_META = [
  { scope: 'common', capacity: '50.36 MB', sharedCount: 0 },
  { scope: 'team', capacity: '19.2 TB', sharedCount: 317 },
  { scope: 'team', capacity: '195 GB', sharedCount: 317 },
  { scope: 'team', capacity: '278 GB', sharedCount: 317 },
  { scope: 'team', capacity: '13.5 MB', sharedCount: 317 },
  { scope: 'team', capacity: '27.4 MB', sharedCount: 317 },
  { scope: 'project', capacity: '12.8 MB', sharedCount: 317 },
  { scope: 'project', capacity: '2.4 MB', sharedCount: 317 },
]

export function PromptPage({
  activeTab,
  onTabChange,
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
  const { t } = useTranslation('main')
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(
    null,
  )
  const showMessages = messages.length > 0 || isSending || isLoadingMessages

  const handleAddDirectoryFromElectron = async () => {
    if (!window.electronAPI) {
      window.alert(t('prompt.electronOnly'))
      return
    }

    try {
      const directory = await window.electronAPI.selectDirectory()

      if (directory) {
        onAddDirectory(directory)
      }
    } catch {
      window.alert(t('prompt.directoryPickerError'))
    }
  }

  return (
    <section className="prompt-page" aria-label={t('prompt.pageLabel')}>
      <div className="prompt-main-panel">
        <nav className="tabs prompt-tabs" aria-label={t('prompt.tabsLabel')}>
          <button
            className={activeTab === 'prompt' ? 'active' : ''}
            type="button"
            onClick={() => onTabChange('prompt')}
          >
            {t('search.items.promptInput')}
          </button>
          <button
            className={activeTab === 'directory' ? 'active' : ''}
            type="button"
            onClick={() => onTabChange('directory')}
          >
            {t('search.items.directorySettings')}
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
                      <div className="chat-loading-bubble" aria-label={t('prompt.generatingResponse')}>
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
                {t('prompt.emptyState')}
              </div>
            )
          ) : (
            <section className="directory-stage" aria-label={t('prompt.currentDirectory')}>
              <div className="directory-layout">
                <div className="directory-panel">
                  <div className="directory-stage-header">
                    <h2>{t('prompt.currentDirectory')}</h2>
                  </div>

                  {isDirectoryLoading ? (
                    <div className="directory-empty-state">
                      {t('prompt.loadingRepositories')}
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
                                <span className="directory-scope">{t(`prompt.scope.${meta.scope}`)}</span>
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
                                  {t('prompt.sharedBy', { count: meta.sharedCount })}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="directory-empty-state">
                      {t('prompt.noRepositories')}
                    </div>
                  )}
                </div>

                <div className="directory-icon-rail" aria-label={t('prompt.directoryActions')}>
                  <button
                    className="directory-icon-button"
                    type="button"
                    aria-label={t('prompt.addRepository')}
                    onClick={handleAddDirectoryFromElectron}
                  >
                    <img src={plusCircleIcon} alt="" />
                  </button>
                  <button
                    className="directory-icon-button remove"
                    type="button"
                    aria-label={t('prompt.removeRepository')}
                    onClick={() => {
                      if (!selectedDirectoryId) {
                        window.alert(t('prompt.selectRepositoryToRemove'))
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
              aria-label={t('search.items.promptInput')}
              placeholder={t('prompt.inputPlaceholder')}
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
            <button type="button" aria-label={t('prompt.send')} onClick={onSend}>
              <img src={searchIcon} alt="" />
            </button>
          </label>
        ) : null}
      </div>
    </section>
  )
}
