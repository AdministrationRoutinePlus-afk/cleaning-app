'use client'

import { useEffect, useState } from 'react'
import type { Conversation, ConversationParticipant, Message } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ConversationWithDetails extends Conversation {
  conversation_participants: ConversationParticipant[]
  messages: Message[]
}

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void
}

export function ConversationList({ onSelectConversation }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // First get conversation IDs where user is a participant
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (partError) {
        console.error('Error loading participations:', partError)
        setConversations([])
        return
      }

      if (!participations || participations.length === 0) {
        // No conversations yet - this is normal
        setConversations([])
        return
      }

      const conversationIds = participations.map(p => p.conversation_id)

      // Now fetch the full conversation details
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants(user_id),
          messages(*)
        `)
        .eq('type', 'DIRECT')
        .in('id', conversationIds)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading conversations:', error)
        setConversations([])
        return
      }

      setConversations((data as ConversationWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading conversations:', error)
      setConversations([])
    } finally {
      setLoading(false)
    }
  }

  const getLastMessage = (conv: ConversationWithDetails) => {
    if (!conv.messages || conv.messages.length === 0) return null
    return conv.messages.sort((a, b) =>
      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    )[0]
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const hasUnreadMessages = (conv: ConversationWithDetails) => {
    if (!conv.messages) return false
    return conv.messages.some(m => !m.read_at && m.sender_id !== conv.created_by)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No conversations yet</p>
        <p className="text-sm text-gray-400 mt-1">Messages will appear here when you start chatting</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {conversations.map(conv => {
        const lastMessage = getLastMessage(conv)
        const unread = hasUnreadMessages(conv)

        return (
          <Card
            key={conv.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectConversation(conv.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {conv.conversation_participants.length > 0
                        ? 'Employee Chat'
                        : 'Direct Message'}
                    </h3>
                    {unread && (
                      <Badge variant="default" className="text-xs">New</Badge>
                    )}
                  </div>

                  {lastMessage && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {lastMessage.content}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTimestamp(lastMessage.sent_at)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
