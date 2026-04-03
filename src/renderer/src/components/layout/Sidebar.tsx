import React from 'react'
import { Circle, Film, Settings } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

type Page = 'record' | 'history' | 'settings'

const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'record', label: 'Record', icon: <Circle size={16} /> },
  { page: 'history', label: 'History', icon: <Film size={16} /> },
  { page: 'settings', label: 'Settings', icon: <Settings size={16} /> },
]

export function Sidebar() {
  const activePage = useAppStore((s) => s.activePage)
  const setActivePage = useAppStore((s) => s.setActivePage)

  return (
    <nav className="flex flex-col items-center w-14 py-3 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] gap-1 flex-shrink-0">
      {navItems.map(({ page, label, icon }) => (
        <button
          key={page}
          onClick={() => setActivePage(page)}
          title={label}
          className={[
            'no-drag w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
            activePage === page
              ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent)]'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]',
          ].join(' ')}
        >
          {icon}
        </button>
      ))}
    </nav>
  )
}
