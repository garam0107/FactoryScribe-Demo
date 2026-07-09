import { apiDelete, apiGet, apiPost } from './client'
import type {
  Repository,
  RepositoryCreateRequest,
} from '../types/repository'

export function getRepositories() {
  return apiGet<Repository[]>('/repositories')
}

export function createRepository(payload: RepositoryCreateRequest) {
  return apiPost<Repository, RepositoryCreateRequest>('/repositories', payload)
}

export function deleteRepository(repositoryId: string) {
  return apiDelete<{ id: string; deleted: boolean }>(
    `/repositories/${repositoryId}`,
  )
}
