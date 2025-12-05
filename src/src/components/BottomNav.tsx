'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Briefcase,
  Users,
  Calendar,
  MessageSquare,
  Settings,
  ShoppingBag,
  User,
  Star
} from 'lucide-react'

// User profile types
type UserProfile = 'EMPLOYER' | 'EMPLOYEE' | 'CUSTOMER'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface BottomNavProps {
  profile: UserProfile
}

// Navigation items for each profile
const navigationConfig: Record<UserProfile, NavItem[]> = {
  EMPLOYER: [
    { label: 'Jobs', href: '/employer/jobs', icon: Briefcase },
    { label: 'Users', href: '/employer/users', icon: Users },
    { label: 'Schedule', href: '/employer/schedule', icon: Calendar },
    { label: 'Messages', href: '/employer/messages', icon: MessageSquare },
    { label: 'Settings', href: '/employer/settings', icon: Settings },
  ],
  EMPLOYEE: [
    { label: 'Marketplace', href: '/employee/marketplace', icon: ShoppingBag },
    { label: 'My Jobs', href: '/employee/jobs', icon: Briefcase },
    { label: 'Schedule', href: '/employee/schedule', icon: Calendar },
    { label: 'Messages', href: '/employee/messages', icon: MessageSquare },
    { label: 'Profile', href: '/employee/profile', icon: User },
  ],
  CUSTOMER: [
    { label: 'Reviews', href: '/customer/reviews', icon: Star },
    { label: 'My Jobs', href: '/customer/jobs', icon: Briefcase },
    { label: 'Messages', href: '/customer/messages', icon: MessageSquare },
  ],
}

export function BottomNav({ profile }: BottomNavProps) {
  const pathname = usePathname()
  const navItems = navigationConfig[profile]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border/50 safe-area-bottom z-50">
      <div className="flex justify-around items-center h-16 max-w-screen-xl mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center
                flex-1 h-full gap-1
                transition-all duration-200 ease-out
                active:scale-95 active:opacity-70
                ${isActive
                  ? 'text-accent'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              <Icon
                className={`
                  w-6 h-6 transition-transform duration-200
                  ${isActive ? 'stroke-[2.5] scale-105' : 'stroke-[1.5]'}
                `}
              />
              <span className={`
                text-[10px] tracking-wide
                ${isActive ? 'font-semibold' : 'font-medium'}
              `}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
