'use client'

import Link from 'next/link'
import { User } from 'lucide-react'

interface DashboardHeaderProps {
  employeeName?: string | null
}

export function DashboardHeader({ employeeName }: DashboardHeaderProps) {
  // Get first name only
  const firstName = employeeName?.split(' ')[0] || ''

  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-40 bg-gradient-to-b from-black/90 via-gray-900/80 to-transparent backdrop-blur-xl border-b border-white/10">
      <div className="flex items-center justify-end h-full px-4 max-w-screen-xl mx-auto">
        <Link
          href="/employee/profile"
          className="flex items-center gap-3 px-3 py-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-200 active:scale-95"
        >
          {firstName && (
            <span className="text-white font-semibold text-sm">{firstName}</span>
          )}
          <User className="w-5 h-5 text-white" />
        </Link>
      </div>
    </header>
  )
}
