'use client'

import { useEffect, useState, useRef } from 'react'
import type { Customer, Message } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { UserCircle, MessageSquare, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface CustomerWithChat extends Customer {
  conversationId?: string
  lastMessage?: Message | null
  unreadCount?: number
}

interface CustomerChatListProps {
  onSelectConversation: (conversationId: string) => void
}

export function CustomerChatList({ onSelectConversation }: CustomerChatListProps) {
  const { t } = useTranslation()
  const [customers, setCustomers] = useState<CustomerWithChat[]>([])
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get employer record
      const { data: employer, error: empError } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (empError) throw empError

      // Get all customers belonging to this employer
      const { data: customerData, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('created_by', employer.id)
        .eq('status', 'ACTIVE')
        .order('full_name', { ascending: true })

      if (custError) throw custError
      if (!customerData || customerData.length === 0) {
        setCustomers([])
        setLoading(false)
        return
      }

      // Get employer's participations to find existing conversations with customers
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      const myConvIds = myParticipations?.map(p => p.conversation_id) || []

      // Build customer list with chat info
      const enriched: CustomerWithChat[] = []

      for (const cust of customerData) {
        const item: CustomerWithChat = { ...cust }

        if (!cust.user_id) {
          enriched.push(item)
          continue
        }

        // Check if there's an existing DIRECT conversation with this customer
        if (myConvIds.length > 0) {
          const { data: sharedConvs } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', cust.user_id)
            .in('conversation_id', myConvIds)

          if (sharedConvs && sharedConvs.length > 0) {
            // Verify it's a DIRECT conversation with only 2 participants
            for (const sc of sharedConvs) {
              const { data: conv } = await supabase
                .from('conversations')
                .select('id, type')
                .eq('id', sc.conversation_id)
                .eq('type', 'DIRECT')
                .maybeSingle()

              if (conv) {
                const { data: participants } = await supabase
                  .from('conversation_participants')
                  .select('user_id')
                  .eq('conversation_id', conv.id)

                if (participants && participants.length === 2) {
                  item.conversationId = conv.id

                  // Get last message
                  const { data: lastMsg } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', conv.id)
                    .order('sent_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                  item.lastMessage = lastMsg

                  // Get unread count
                  const { count } = await supabase
                    .from('messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('conversation_id', conv.id)
                    .is('read_at', null)
                    .neq('sender_id', user.id)

                  item.unreadCount = count || 0
                  break
                }
              }
            }
          }
        }

        enriched.push(item)
      }

      // Sort: customers with unread messages first, then by name
      enriched.sort((a, b) => {
        if ((a.unreadCount || 0) > 0 && (b.unreadCount || 0) === 0) return -1
        if ((a.unreadCount || 0) === 0 && (b.unreadCount || 0) > 0) return 1
        return a.full_name.localeCompare(b.full_name)
      })

      setCustomers(enriched)
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error(t('Failed to load data'))
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCustomer = async (customer: CustomerWithChat) => {
    if (!customer.user_id) {
      toast.info(t('Customer needs to register to chat'))
      return
    }

    if (customer.conversationId) {
      onSelectConversation(customer.conversationId)
      return
    }

    // Create a new conversation
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'DIRECT',
          created_by: user.id,
        })
        .select()
        .single()

      if (convError) throw convError

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id, joined_at: new Date().toISOString() },
          { conversation_id: newConv.id, user_id: customer.user_id, joined_at: new Date().toISOString() },
        ])

      if (partError) throw partError

      onSelectConversation(newConv.id)
    } catch (error) {
      console.error('Error creating conversation:', error)
      toast.error(t('Failed to start conversation'))
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t('Just now')
    if (diffMins < 60) return `${diffMins}m ${t('ago')}`
    if (diffHours < 24) return `${diffHours}h ${t('ago')}`
    if (diffDays < 7) return `${diffDays}d ${t('ago')}`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-4 animate-pulse border border-white/10">
            <div className="h-4 bg-white/10 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-white/10 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
        <p className="text-gray-400">{t('No customers yet')}</p>
        <p className="text-sm text-gray-500 mt-1">
          {t('Customers will appear here once added')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {customers.map((customer) => (
        <div
          key={customer.id}
          className={`bg-white/5 rounded-xl border border-white/10 p-4 transition-colors ${
            customer.user_id
              ? 'cursor-pointer hover:bg-white/[0.07]'
              : 'opacity-60'
          }`}
          onClick={() => handleSelectCustomer(customer)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                customer.user_id ? 'bg-green-500/20' : 'bg-gray-500/20'
              }`}>
                {customer.user_id ? (
                  <UserCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <UserX className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-white truncate">
                    {customer.full_name}
                  </h3>
                  {(customer.unreadCount || 0) > 0 && (
                    <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs">
                      {customer.unreadCount}
                    </Badge>
                  )}
                </div>

                {!customer.user_id ? (
                  <p className="text-xs text-gray-500">
                    {t('Customer needs to register to chat')}
                  </p>
                ) : customer.lastMessage ? (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400 line-clamp-1">
                      {customer.lastMessage.content}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTimestamp(customer.lastMessage.sent_at)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {t('No messages yet')}
                  </p>
                )}
              </div>
            </div>

            {customer.user_id && (
              <MessageSquare className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
