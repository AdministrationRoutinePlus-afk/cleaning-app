'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface DashboardDrawerProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string | number
  badgeColor?: 'green' | 'blue' | 'amber' | 'red'
}

export function DashboardDrawer({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
  badgeColor = 'blue'
}: DashboardDrawerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const badgeColors = {
    green: 'bg-green-500/20 text-green-400',
    blue: 'bg-blue-500/20 text-blue-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-red-500/20 text-red-400'
  }

  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-purple-400">
            {icon}
          </div>
          <span className="text-lg font-semibold text-white">{title}</span>
          {badge !== undefined && (
            <span className={`text-sm px-3 py-1 rounded-full ${badgeColors[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-6 h-6 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-5 pt-0 border-t border-white/10">
          {children}
        </div>
      </div>
    </div>
  )
}
