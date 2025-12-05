'use client'

import { useState, useEffect } from 'react'
import type { Employee, Conversation, Message, ScheduleMessage, JobSession, JobTemplate } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChatView } from '@/components/employer/ChatView'
import { ExchangeBoard } from '@/components/employee/ExchangeBoard'
import { format } from 'date-fns'

// Extended type for schedule messages with job details
interface ScheduleMessageWithDetails extends ScheduleMessage {
  job_session: JobSession & {
    job_template: JobTemplate
  }
}

interface ConversationWithDetails extends Conversation {
  messages: Message[]
  conversation_participants?: { user_id: string }[]
}

export default function EmployeeMessagesPage() {
  const [activeTab, setActiveTab] = useState('employer')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [employerConversation, setEmployerConversation] = useState<ConversationWithDetails | null>(null)
  const [announcements, setAnnouncements] = useState<ConversationWithDetails[]>([])
  const [coworkerConversation, setCoworkerConversation] = useState<ConversationWithDetails | null>(null)
  const [jobMessages, setJobMessages] = useState<ScheduleMessageWithDetails[]>([])
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCurrentEmployee()
  }, [])

  useEffect(() => {
    if (currentEmployee) {
      if (activeTab === 'employer') {
        loadEmployerConversation()
      } else if (activeTab === 'announcements') {
        loadAnnouncements()
      } else if (activeTab === 'coworkers') {
        loadCoworkerConversation()
      } else if (activeTab === 'jobs') {
        loadJobMessages()
      }
    }
  }, [activeTab, currentEmployee])

  const loadCurrentEmployee = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setCurrentEmployee(data)
    } catch (error) {
      console.error('Error loading employee:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEmployerConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Find direct conversation with employer
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants!inner(user_id),
          messages(*)
        `)
        .eq('type', 'DIRECT')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Filter to find conversation where current user is participant
      const conversations = data as ConversationWithDetails[]
      const myConversation = conversations.find(conv =>
        conv.conversation_participants?.some((p: any) => p.user_id === user.id)
      )

      setEmployerConversation(myConversation || null)
    } catch (error) {
      console.error('Error loading employer conversation:', error)
    }
  }

  const loadAnnouncements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants!inner(user_id),
          messages(*)
        `)
        .eq('type', 'ANNOUNCEMENT')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Filter conversations where current user is a participant
      const userAnnouncements = (data as ConversationWithDetails[]).filter(conv =>
        conv.conversation_participants?.some((p: any) => p.user_id === user.id)
      )

      setAnnouncements(userAnnouncements)
    } catch (error) {
      console.error('Error loading announcements:', error)
    }
  }

  const loadCoworkerConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Find employee group conversation
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants!inner(user_id),
          messages(*)
        `)
        .eq('type', 'EMPLOYEE_GROUP')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Filter to find conversation where current user is participant
      const conversations = data as ConversationWithDetails[]
      const groupConv = conversations.find(conv =>
        conv.conversation_participants?.some((p: any) => p.user_id === user.id)
      )

      setCoworkerConversation(groupConv || null)
    } catch (error) {
      console.error('Error loading coworker conversation:', error)
    }
  }

  const loadJobMessages = async () => {
    if (!currentEmployee) return

    try {
      const { data, error } = await supabase
        .from('schedule_messages')
        .select(`
          *,
          job_session:job_sessions(
            *,
            job_template:job_templates(*)
          )
        `)
        .eq('employee_id', currentEmployee.id)
        .order('sent_at', { ascending: false })

      if (error) throw error
      setJobMessages((data as ScheduleMessageWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading job messages:', error)
    }
  }

  const markJobMessageRead = async (messageId: string) => {
    try {
      await supabase
        .from('schedule_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId)

      // Update local state
      setJobMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, read_at: new Date().toISOString() } : msg
        )
      )
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  }

  const formatAnnouncementDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const hasUnreadMessages = (conv: ConversationWithDetails | null) => {
    if (!conv || !conv.messages) return false
    return conv.messages.some(m => !m.read_at)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentEmployee) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">Employee profile not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Compact tabs for mobile */}
          <TabsList className="w-full grid grid-cols-5 mb-6 h-auto p-1">
            <TabsTrigger value="employer" className="text-[10px] sm:text-sm px-1 py-2 relative">
              Boss
              {employerConversation && hasUnreadMessages(employerConversation) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
            </TabsTrigger>
            <TabsTrigger value="jobs" className="text-[10px] sm:text-sm px-1 py-2 relative">
              Jobs
              {jobMessages.filter(m => !m.read_at).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                  {jobMessages.filter(m => !m.read_at).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="announcements" className="text-[10px] sm:text-sm px-1 py-2">
              News
            </TabsTrigger>
            <TabsTrigger value="coworkers" className="text-[10px] sm:text-sm px-1 py-2">
              Team
            </TabsTrigger>
            <TabsTrigger value="exchanges" className="text-[10px] sm:text-sm px-1 py-2">
              Swap
            </TabsTrigger>
          </TabsList>

          {/* Employer Tab */}
          <TabsContent value="employer">
            {employerConversation ? (
              <ChatView
                conversationId={employerConversation.id}
                onBack={() => {}}
              />
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">No conversation with employer yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Your employer will start a conversation with you
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Jobs Tab - Messages pushed from Schedule */}
          <TabsContent value="jobs">
            <div className="space-y-3">
              {jobMessages.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">No job notifications yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Your employer will send you important job updates here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                jobMessages.map((msg) => (
                  <Card
                    key={msg.id}
                    className={`cursor-pointer transition-all ${!msg.read_at ? 'border-blue-500 bg-blue-50' : ''}`}
                    onClick={() => markJobMessageRead(msg.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-mono text-sm text-gray-500">
                            {msg.job_session?.job_template?.job_code || 'Job'}
                          </p>
                          <h3 className="font-medium text-gray-900">
                            {msg.job_session?.job_template?.title || 'Job Notification'}
                          </h3>
                        </div>
                        {!msg.read_at && (
                          <Badge variant="default" className="text-xs">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{msg.message}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                          {msg.job_session?.scheduled_date && (
                            <>Scheduled: {format(new Date(msg.job_session.scheduled_date), 'MMM d, yyyy')}</>
                          )}
                        </span>
                        <span>{format(new Date(msg.sent_at), 'MMM d, h:mm a')}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <div className="space-y-3">
              {announcements.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">No announcements yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Company announcements will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                announcements.map((announcement) => {
                  const firstMessage = announcement.messages?.[0]
                  return (
                    <Card
                      key={announcement.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedConversation(announcement.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm text-gray-500">
                            {formatAnnouncementDate(announcement.created_at)}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            ANNOUNCEMENT
                          </Badge>
                        </div>
                        {firstMessage && (
                          <p className="text-sm text-gray-700 line-clamp-3">
                            {firstMessage.content}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>

            {/* Modal for viewing full announcement */}
            {selectedConversation && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
                  <ChatView
                    conversationId={selectedConversation}
                    onBack={() => setSelectedConversation(null)}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Coworkers Tab */}
          <TabsContent value="coworkers">
            {coworkerConversation ? (
              <ChatView
                conversationId={coworkerConversation.id}
                onBack={() => {}}
              />
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">No team chat available yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Your employer will create a team chat for all employees
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Exchanges Tab */}
          <TabsContent value="exchanges">
            <ExchangeBoard employeeId={currentEmployee.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
