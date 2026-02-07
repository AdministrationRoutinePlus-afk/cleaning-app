'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { Send, Check } from 'lucide-react'
import { toast } from 'sonner'

export function QuickMessageCard() {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadConversation()
  }, [])

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
      } else {
        // Create conversation if it doesn't exist
        await createEmployerConversation(user.id)
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    }
  }

  const createEmployerConversation = async (userId: string) => {
    try {
      // Get employer user_id
      const { data: employers, error: employerError } = await supabase
        .from('employers')
        .select('user_id')
        .not('user_id', 'is', null)

      if (employerError || !employers || employers.length === 0) {
        console.error('No employer found')
        return
      }

      const employerUserId = employers[0].user_id

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
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a quick message to your boss..."
        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 resize-none min-h-[80px]"
        disabled={sending || !conversationId}
      />
      <div className="flex items-center justify-between">
        {sent ? (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check className="w-4 h-4" />
            Message sent!
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
            'Sending...'
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </div>
      {!conversationId && (
        <p className="text-xs text-amber-400">
          Chat not available. Contact your administrator.
        </p>
      )}
    </div>
  )
}

// Export with alias for drawer usage
export { QuickMessageCard as QuickMessageContent }
