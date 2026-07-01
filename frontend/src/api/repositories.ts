import { apiGet } from './client'
import type { Repository } from '../types/repository'

export function getRepositories() {
  return apiGet<Repository[]>('/repositories')
}
