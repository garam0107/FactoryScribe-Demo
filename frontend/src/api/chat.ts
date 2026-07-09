import { apiGet, apiPost } from './client'
import type {
  ChatAskRequest,
  ChatAskResponse,
  ChatConversationSummary,
  ChatMessage,
} from '../types/chat'

export function askChat(payload: ChatAskRequest) {
  return apiPost<ChatAskResponse, ChatAskRequest>('/chat/ask', payload)
}

export function getConversations(repositoryId: string) {
  return apiGet<ChatConversationSummary[]>(
    `/chat/conversations?repository_id=${repositoryId}`,
  )
}

export function getConversationMessages(
  repositoryId: string,
  conversationId: string,
) {
  return apiGet<ChatMessage[]>(
    `/chat/conversations/${conversationId}/messages?repository_id=${repositoryId}`,
  )
}
