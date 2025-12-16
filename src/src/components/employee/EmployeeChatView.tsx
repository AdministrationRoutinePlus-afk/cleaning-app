'use client'

import { useEffect, useState, useRef } from 'react'
import type { Message } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'

interface EmployeeChatViewProps {
  conversationId: string
  onBack?: () => void
  title?: string
  readOnly?: boolean
}

export function EmployeeChatView({ conversationId, onBack, title = 'Chat', readOnly = false }: EmployeeChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAnnouncement, setIsAnnouncement] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadMessages()
    getCurrentUser()

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
      // Check if this is an announcement conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .select('type')
        .eq('id', conversationId)
        .single()

      if (conversation?.type === 'ANNOUNCEMENT') {
        setIsAnnouncement(true)
      }

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
        alert(`Failed to send: ${error.message}`)
        return
      }

      setNewMessage('')

      // Manually add message if realtime doesn't work
      if (data) {
        setMessages(prev => {
          // Check if message already exists (from realtime)
          if (prev.some(m => m.id === data.id)) return prev
          return [...prev, data]
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
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
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-white/10 rounded w-1/4"></div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-white/10 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col h-[calc(100vh-16rem)] bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader className="border-b border-white/20">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white hover:bg-white/20"
            >
              ← Back
            </Button>
          )}
          <CardTitle className="text-lg text-white">{title}</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={message.id}>
              {shouldShowDateSeparator(index) && (
                <div className="flex justify-center my-4">
                  <span className="text-xs text-gray-400 bg-white/10 px-3 py-1 rounded-full backdrop-blur-md">
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
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/20 text-white backdrop-blur-md'
                  }`}
                >
                  {message.is_system && (
                    <p className="text-xs opacity-75 mb-1">System Message</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.sender_id === currentUserId ? 'text-blue-100' : 'text-gray-300'
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
      </CardContent>

      {!readOnly && !isAnnouncement && (
        <CardFooter className="border-t border-white/20 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2 w-full">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-500"
            />
            <Button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {sending ? (
                'Sending...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </form>
        </CardFooter>
      )}
      {(readOnly || isAnnouncement) && (
        <CardFooter className="border-t border-white/20 p-4">
          <div className="w-full text-center text-gray-400 text-sm">
            📢 This is a read-only announcement
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
