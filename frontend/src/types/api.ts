export type ApiResponse<T> = {
  success: boolean
  message: string | null
  data: T
}
