'use client'

import { useTranslation } from '@/lib/i18n/useTranslation'

interface Tab {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: number
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onChange: (key: string) => void
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs border whitespace-nowrap transition-all ${
              isActive
                ? 'bg-white/20 text-white border-white/30 font-bold'
                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {t(tab.label)}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
