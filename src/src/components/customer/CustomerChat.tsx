'use client'

import { useEffect, useState, useRef } from 'react'
import type { Message, Customer, Employer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface CustomerChatProps {
  customer: Customer
  employer: Employer
}

export function CustomerChat({ customer, employer }: CustomerChatProps) {
  const { t } = useTranslation()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (employer?.user_id) {
      initializeChat()
    } else {
      setLoading(false)
    }
  }, [customer, employer])

  useEffect(() => {
    if (conversationId) {
      loadMessages()

      // Subscribe to new messages
      const channel = supabase
        .channel(`conversation-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message])
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const initializeChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      // Find or create DIRECT conversation between customer and employer
      const { data: existingConversations, error: findError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (findError) throw findError

      if (existingConversations && existingConversations.length > 0) {
        // Check if any of these conversations include the employer
        for (const conv of existingConversations) {
          const { data: participants, error: participantsError } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id)

          if (participantsError) continue

          const userIds = participants.map((p) => p.user_id)
          if (userIds.includes(employer.user_id) && userIds.length === 2) {
            // Found existing conversation
            setConversationId(conv.conversation_id)
            setLoading(false)
            return
          }
        }
      }

      // No existing conversation, create a new one
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          type: 'DIRECT',
          created_by: user.id
        })
        .select()
        .single()

      if (createError) throw createError

      // Add both participants
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          {
            conversation_id: newConversation.id,
            user_id: user.id,
            joined_at: new Date().toISOString()
          },
          {
            conversation_id: newConversation.id,
            user_id: employer.user_id,
            joined_at: new Date().toISOString()
          }
        ])

      if (participantsError) throw participantsError

      setConversationId(newConversation.id)
    } catch (error) {
      console.error('Error initializing chat:', error)
      toast.error(t('Failed to initialize chat'))
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!conversationId) return

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])

      // Mark messages as read
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .is('read_at', null)
          .neq('sender_id', user.id)
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUserId || !conversationId || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: newMessage.trim(),
          is_system: false,
          sent_at: new Date().toISOString()
        })

      if (error) throw error
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(t('Failed to send message'))
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return t('Today')
    if (date.toDateString() === yesterday.toDateString()) return t('Yesterday')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const shouldShowDateSeparator = (index: number) => {
    if (index === 0) return true
    const currentDate = new Date(messages[index].sent_at).toDateString()
    const previousDate = new Date(messages[index - 1].sent_at).toDateString()
    return currentDate !== previousDate
  }

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-white/10 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-white/10 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!employer.user_id) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <p className="text-center text-gray-400">{t('Chat Not Available')}</p>
        <p className="text-center text-gray-500 text-sm mt-2">
          {t('Unable to load messaging. Please contact support.')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl flex flex-col h-[calc(100vh-12rem)]">
      <div className="border-b border-white/10 p-4">
        <h3 className="text-lg font-semibold text-white">
          {t('Chat with')} {employer.full_name || t('Employer')}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            {t('No messages yet. Start the conversation!')}
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={message.id}>
              {shouldShowDateSeparator(index) && (
                <div className="flex justify-center my-4">
                  <span className="text-xs text-gray-400 bg-white/10 px-3 py-1 rounded-full">
                    {formatDate(message.sent_at)}
                  </span>
                </div>
              )}

              <div
                className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    message.sender_id === currentUserId
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-gray-200'
                  }`}
                >
                  {message.is_system && (
                    <p className="text-xs opacity-75 mb-1">{t('System Message')}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.sender_id === currentUserId ? 'text-blue-200' : 'text-gray-500'
                    }`}
                  >
                    {formatTime(message.sent_at)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/10 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2 w-full">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('Type a message...')}
            disabled={sending}
            className="flex-1 px-3 py-2 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {sending ? t('Sending...') : t('Send')}
          </button>
        </form>
      </div>
    </div>
  )
}
