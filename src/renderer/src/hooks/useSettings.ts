import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

export function useSettings() {
  const { settings, setSettings, setLoadingSettings, setHardware } = useAppStore()

  useEffect(() => {
    async function load() {
      setLoadingSettings(true)
      try {
        const s = await window.electronAPI.getSettings()
        setSettings(s)
        // Kick off hardware detection
        const hw = await window.electronAPI.detectHardware()
        setHardware(hw)
      } finally {
        setLoadingSettings(false)
      }
    }
    load()
  }, [])

  async function updateSettings(partial: Parameters<typeof setSettings>[0]) {
    setSettings(partial)  // optimistic update
    await window.electronAPI.setSettings(partial)
  }

  async function chooseOutputDir() {
    const dir = await window.electronAPI.chooseOutputDir()
    if (dir) {
      setSettings({ outputDir: dir })
    }
    return dir
  }

  return { settings, updateSettings, chooseOutputDir }
}
