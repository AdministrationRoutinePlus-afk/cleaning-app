'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)
  const supabase = createClient()

  // Use dark theme styling for EMPLOYEE profile
  const isDarkTheme = profile === 'EMPLOYEE'

  // Check for unread messages for employee profile
  useEffect(() => {
    if (profile !== 'EMPLOYEE') return

    const checkUnreadMessages = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get employee ID
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (!employee) return

        // Check for unread messages in conversations
        const { data: conversations } = await supabase
          .from('conversations')
          .select(`
            id,
            conversation_participants!inner(user_id),
            messages!inner(id, read_at)
          `)
          .eq('conversation_participants.user_id', user.id)
          .is('messages.read_at', null)

        // Check for unread job messages
        const { data: jobMessages } = await supabase
          .from('schedule_messages')
          .select('id')
          .eq('employee_id', employee.id)
          .is('read_at', null)

        const hasUnread = !!(conversations && conversations.length > 0) || !!(jobMessages && jobMessages.length > 0)
        setHasUnreadMessages(hasUnread)
      } catch (error) {
        console.error('Error checking unread messages:', error)
      }
    }

    checkUnreadMessages()

    // Set up realtime subscription for messages
    const channel = supabase
      .channel('unread-messages-check')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          checkUnreadMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_messages'
        },
        () => {
          checkUnreadMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, pathname])

  return (
    <nav className={`fixed bottom-0 left-0 right-0 safe-area-bottom z-50 ${
      isDarkTheme
        ? 'bg-gradient-to-t from-black via-gray-900 to-gray-800/95 backdrop-blur-xl border-t border-white/10'
        : 'bg-card/80 backdrop-blur-xl border-t border-border/50'
    }`}>
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
                transition-all duration-300 ease-out
                active:scale-90
                relative
                ${isDarkTheme
                  ? isActive
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                  : isActive
                    ? 'text-accent'
                    : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {/* Active indicator for dark theme */}
              {isDarkTheme && isActive && (
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-b-full" />
              )}

              {/* Icon with glow effect when active */}
              <div className={`relative ${isDarkTheme && isActive ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''}`}>
                <Icon
                  className={`
                    transition-all duration-300
                    ${isActive ? 'w-7 h-7 stroke-[2.5]' : 'w-6 h-6 stroke-[1.5]'}
                  `}
                />
                {/* Red dot for unread messages on Messages tab */}
                {item.label === 'Messages' && hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-gray-900"></span>
                )}
              </div>

              <span className={`
                text-[10px] tracking-wide transition-all duration-300
                ${isActive ? 'font-bold' : 'font-medium'}
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
