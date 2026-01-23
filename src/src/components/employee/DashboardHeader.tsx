'use client'

import Link from 'next/link'
import { User } from 'lucide-react'

export function DashboardHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-40 bg-gradient-to-b from-black/90 via-gray-900/80 to-transparent backdrop-blur-xl border-b border-white/10">
      <div className="flex items-center justify-between h-full px-4 max-w-screen-xl mx-auto">
        <h1 className="text-lg font-bold text-white">Dashboard</h1>

        <Link
          href="/employee/profile"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-200 active:scale-95"
        >
          <User className="w-5 h-5 text-white" />
        </Link>
      </div>
    </header>
  )
}
