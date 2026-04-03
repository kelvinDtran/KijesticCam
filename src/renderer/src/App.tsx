import React from 'react'
import { useAppStore } from './store/appStore'
import { Titlebar } from './components/layout/Titlebar'
import { Sidebar } from './components/layout/Sidebar'
import { RecordingPanel } from './components/recording/RecordingPanel'
import { HistoryPage } from './components/history/HistoryPage'
import { SettingsPage } from './components/settings/SettingsPage'

export default function App() {
  const activePage = useAppStore((s) => s.activePage)

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-[var(--color-bg-primary)]">
          {activePage === 'record' && <RecordingPanel />}
          {activePage === 'history' && <HistoryPage />}
          {activePage === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  )
}
