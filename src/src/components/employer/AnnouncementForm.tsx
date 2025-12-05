'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface AnnouncementFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function AnnouncementForm({ onSuccess, onCancel }: AnnouncementFormProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || sending) return

    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create announcement conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'ANNOUNCEMENT',
          created_by: user.id
        })
        .select()
        .single()

      if (convError) throw convError

      // Get all active employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('user_id')
        .eq('status', 'ACTIVE')
        .not('user_id', 'is', null)

      if (empError) throw empError

      // Add all employees as participants
      if (employees && employees.length > 0) {
        const participants = employees
          .filter(emp => emp.user_id !== null)
          .map(emp => ({
            conversation_id: conversation.id,
            user_id: emp.user_id as string,
            joined_at: new Date().toISOString()
          }))

        const { error: participantError } = await supabase
          .from('conversation_participants')
          .insert(participants)

        if (participantError) throw participantError
      }

      // Send announcement message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: content.trim(),
          is_system: false,
          sent_at: new Date().toISOString()
        })

      if (messageError) throw messageError

      // Create notifications for all employees
      if (employees && employees.length > 0) {
        const notifications = employees
          .filter(emp => emp.user_id !== null)
          .map(emp => ({
            user_id: emp.user_id as string,
            user_type: 'EMPLOYEE' as const,
            type: 'NEW_ANNOUNCEMENT',
            title: 'New Announcement',
            message: content.trim().substring(0, 100),
            related_id: conversation.id,
            is_read: false
          }))

        await supabase.from('notifications').insert(notifications)
      }

      setContent('')
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error sending announcement:', error)
      alert('Failed to send announcement')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Announcement</CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="announcement">Message</Label>
            <Textarea
              id="announcement"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your announcement message..."
              rows={6}
              disabled={sending}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              This will be sent to all active employees
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={sending}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={sending || !content.trim()}
            className="flex-1"
          >
            {sending ? 'Sending...' : 'Send Announcement'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
