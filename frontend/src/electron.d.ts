interface ElectronDirectory {
  name: string
  path: string
}

interface ElectronSaveFilePayload {
  defaultFileName: string
  bytes: Uint8Array
}

interface ElectronSaveFileResult {
  saved: boolean
  filePath?: string
}

interface Window {
  electronAPI?: {
    selectDirectory: () => Promise<ElectronDirectory | null>
    saveFile: (payload: ElectronSaveFilePayload) => Promise<ElectronSaveFileResult>
  }
}
