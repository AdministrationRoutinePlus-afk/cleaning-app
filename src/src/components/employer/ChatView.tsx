'use client'

import { useEffect, useState, useRef } from 'react'
import type { Message } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send } from 'lucide-react'
import { toast } from 'sonner'

interface ChatViewProps {
  conversationId: string
  onBack: () => void
}

export function ChatView({ conversationId, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadMessages()
    getCurrentUser()

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
          setMessages(prev => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)
  }

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])

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
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUserId || sending) return

    setSending(true)
    const messageContent = newMessage.trim()

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: messageContent,
          is_system: false,
          sent_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error sending message:', error)
        toast.error(`Failed to send: ${error.message}`)
        return
      }

      setNewMessage('')

      if (data) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev
          return [...prev, data]
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
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

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
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
      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
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

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-gray-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h3 className="text-lg font-semibold text-white">Chat</h3>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={message.id}>
              {shouldShowDateSeparator(index) && (
                <div className="flex justify-center my-4">
                  <span className="text-xs text-gray-500 bg-white/10 px-3 py-1 rounded-full">
                    {formatDate(message.sent_at)}
                  </span>
                </div>
              )}

              <div
                className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-xl px-4 py-2 ${
                    message.sender_id === currentUserId
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-gray-200'
                  }`}
                >
                  {message.is_system && (
                    <p className="text-xs opacity-75 mb-1">System Message</p>
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

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2 w-full">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-gray-500"
          />
          <Button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
