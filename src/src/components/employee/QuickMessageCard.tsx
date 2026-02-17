'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/types/database'
import { Send, Check, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

export function QuickMessageCard() {
  const { t } = useTranslation()
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [recentMessages, setRecentMessages] = useState<Message[]>([])
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadConversation()
    return () => { isMountedRef.current = false }
  }, [])

  // Subscribe to realtime messages once we have a conversationId
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`quick-msg-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (!isMountedRef.current) return
          const newMsg = payload.new as Message
          setRecentMessages(prev => [...prev, newMsg].slice(-3))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  const loadConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      // Find direct conversation with employer
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          conversation_participants!inner(user_id)
        `)
        .eq('type', 'DIRECT')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Find conversation where current user is participant
      const myConversation = data?.find(conv =>
        conv.conversation_participants?.some((p: { user_id: string }) => p.user_id === user.id)
      )

      if (myConversation) {
        setConversationId(myConversation.id)
        // Fetch last 3 messages
        loadRecentMessages(myConversation.id)
      } else {
        // Create conversation if it doesn't exist
        await createEmployerConversation(user.id)
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    }
  }

  const loadRecentMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('sent_at', { ascending: false })
        .limit(3)

      if (error) throw error
      if (isMountedRef.current && data) {
        // Reverse so oldest is first (display order)
        setRecentMessages(data.reverse())
      }
    } catch (error) {
      console.error('Error loading recent messages:', error)
    }
  }

  const createEmployerConversation = async (userId: string) => {
    try {
      // Get employer user_id via the employee's created_by relationship
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('created_by, employer:employers!employees_created_by_fkey(user_id)')
        .eq('user_id', userId)
        .single()

      const employerArr = employee?.employer as unknown as { user_id: string }[] | null
      const employer = employerArr?.[0] ?? null
      if (empError || !employer?.user_id) {
        console.warn('No employer found for this employee')
        return
      }

      const employerUserId = employer.user_id

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'DIRECT',
          created_by: userId
        })
        .select()
        .single()

      if (convError) throw convError

      // Add participants
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: userId },
          { conversation_id: conversation.id, user_id: employerUserId }
        ])

      if (participantsError) throw participantsError

      setConversationId(conversation.id)
    } catch (error) {
      console.error('Error creating conversation:', error)
    }
  }

  const handleSend = async () => {
    if (!message.trim() || !conversationId || !currentUserId || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: message.trim(),
          is_system: false,
          sent_at: new Date().toISOString()
        })

      if (error) throw error

      setMessage('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(t('Failed to send message'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Recent messages preview */}
      {recentMessages.length > 0 && (
        <div className="space-y-2 mb-2">
          {recentMessages.map((msg) => {
            const isMe = msg.sender_id === currentUserId
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-2 text-sm ${
                    isMe
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-white/10 text-gray-300'
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View Full Chat link */}
      {conversationId && (
        <button
          onClick={() => router.push('/employee/messages')}
          className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {t('View Full Chat')}
        </button>
      )}

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('Type a quick message to your boss...')}
        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 resize-none min-h-[80px]"
        disabled={sending || !conversationId}
      />
      <div className="flex items-center justify-between">
        {sent ? (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check className="w-4 h-4" />
            {t('Message sent!')}
          </div>
        ) : (
          <div></div>
        )}
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sending || !conversationId}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          {sending ? (
            t('Sending...')
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {t('Send')}
            </>
          )}
        </Button>
      </div>
      {!conversationId && (
        <p className="text-xs text-amber-400">
          {t('Chat not available. Contact your administrator.')}
        </p>
      )}
    </div>
  )
}

// Export with alias for drawer usage
export { QuickMessageCard as QuickMessageContent }
