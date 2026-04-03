import { useEffect, useCallback } from 'react'
import { useAppStore } from '../store/appStore'

export function useSources() {
  const {
    sources,
    selectedSourceIds,
    loadingSources,
    audioInputDevices,
    setSources,
    setLoadingSources,
    setAudioInputDevices,
    toggleSource,
    setSelectedSources,
  } = useAppStore()

  const refreshSources = useCallback(async () => {
    setLoadingSources(true)
    try {
      const srcs = await window.electronAPI.getSources()
      setSources(srcs)
    } finally {
      setLoadingSources(false)
    }
  }, [])

  const refreshAudioDevices = useCallback(async () => {
    try {
      // Request permission first (may show OS permission dialog)
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()))
    } catch { /* permission denied */ }
    const devices = await navigator.mediaDevices.enumerateDevices()
    const inputs = devices.filter((d) => d.kind === 'audioinput')
    setAudioInputDevices(inputs)
  }, [])

  useEffect(() => {
    refreshSources()
    refreshAudioDevices()
  }, [])

  const selectedSources = sources.filter((s) => selectedSourceIds.has(s.id))

  return {
    sources,
    selectedSources,
    selectedSourceIds,
    loadingSources,
    audioInputDevices,
    toggleSource,
    setSelectedSources,
    refreshSources,
    refreshAudioDevices,
  }
}
