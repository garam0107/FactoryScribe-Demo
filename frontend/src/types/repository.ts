export type Repository = {
  id: string
  name: string
  path: string
  status: string
  created_at?: string
  updated_at?: string
  last_indexed_at?: string | null
}

export type RepositoryCreateRequest = {
  name: string
  path: string
}
