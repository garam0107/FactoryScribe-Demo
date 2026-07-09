export type ChatAskRequest = {
  repository_id: string
  conversation_id?: string | null
  message: string
}

export type ChatConversationSummary = {
  id: string
  repository_id: string | null
  title: string
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type ChatAskResponse = {
  conversation_id: string
  answer: string
  sources: Array<Record<string, unknown>>
}
