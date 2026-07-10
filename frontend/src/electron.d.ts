interface ElectronDirectory {
  name: string
  path: string
}

interface Window {
  electronAPI?: {
    selectDirectory: () => Promise<ElectronDirectory | null>
  }
}
