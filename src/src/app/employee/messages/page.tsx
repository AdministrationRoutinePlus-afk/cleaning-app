'use client'

import { useState, useEffect } from 'react'
import type { Employee, Conversation, Message, ScheduleMessage, JobSession, JobTemplate } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmployeeChatView } from '@/components/employee/EmployeeChatView'
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
  const [loadingConversation, setLoadingConversation] = useState(true)
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [announcementsMarkedRead, setAnnouncementsMarkedRead] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadCurrentEmployee()
  }, [])

  useEffect(() => {
    if (currentEmployee) {
      // Load all conversations and messages on mount to check for unread
      loadEmployerConversation()
      loadAnnouncements()
      loadCoworkerConversation()
      loadJobMessages()

      // Reset the flag when reloading (coming back to messages page)
      setAnnouncementsMarkedRead(false)
    }
  }, [currentEmployee])

  // Mark messages as read when switching to a tab
  useEffect(() => {
    const markMessagesAsRead = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (activeTab === 'employer' && employerConversation) {
        // Mark employer messages as read
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', employerConversation.id)
          .is('read_at', null)
          .neq('sender_id', user.id)

        // Reload to update the red dot
        loadEmployerConversation()
      } else if (activeTab === 'coworkers' && coworkerConversation) {
        // Mark coworker messages as read
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', coworkerConversation.id)
          .is('read_at', null)
          .neq('sender_id', user.id)

        // Reload to update the red dot
        loadCoworkerConversation()
      } else if (activeTab === 'announcements') {
        // Only mark as read if we haven't already done so
        if (announcements.length > 0 && !announcementsMarkedRead) {
          const announcementIds = announcements.map(a => a.id)

          // Update in database - mark ALL messages as read, not just from others
          await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .in('conversation_id', announcementIds)
            .is('read_at', null)

          // Reload announcements from database to get fresh data with read_at set
          await loadAnnouncements()

          // Set flag to prevent re-marking on re-render
          setAnnouncementsMarkedRead(true)
        }
      } else if (activeTab === 'jobs' && jobMessages.length > 0) {
        // Mark all job messages as read
        const unreadJobMessageIds = jobMessages
          .filter(m => !m.read_at)
          .map(m => m.id)

        if (unreadJobMessageIds.length > 0) {
          await supabase
            .from('schedule_messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', unreadJobMessageIds)

          // Reload to update the red dot
          loadJobMessages()
        }
      }
    }

    markMessagesAsRead()
  }, [activeTab, employerConversation?.id, coworkerConversation?.id, announcements.length, jobMessages.length, selectedConversation])

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
      if (!user) {
        setLoadingConversation(false)
        return
      }

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

      // If no conversation exists and we're not already creating one, create it
      if (!myConversation && !creatingConversation) {
        await createEmployerConversation()
      } else if (myConversation) {
        setEmployerConversation(myConversation)
      }
    } catch (error) {
      console.error('Error loading employer conversation:', error)
    } finally {
      setLoadingConversation(false)
    }
  }

  const createEmployerConversation = async () => {
    if (creatingConversation) return // Prevent duplicate creation attempts

    setCreatingConversation(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCreatingConversation(false)
        return
      }

      // Get employer user_id - get all employers with user_id not null
      const { data: employers, error: employerError } = await supabase
        .from('employers')
        .select('user_id')
        .not('user_id', 'is', null)

      if (employerError) {
        console.error('Error fetching employers:', employerError)
        setCreatingConversation(false)
        return
      }

      if (!employers || employers.length === 0) {
        console.error('No employer found with user_id. Make sure an employer account is logged in and has a user_id.')
        setCreatingConversation(false)
        return
      }

      const employerUserId = employers[0].user_id

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'DIRECT',
          created_by: user.id
        })
        .select()
        .single()

      if (convError) throw convError

      // Add participants (employee and employer)
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: user.id },
          { conversation_id: conversation.id, user_id: employerUserId }
        ])

      if (participantsError) throw participantsError

      // Set the conversation directly instead of reloading
      setEmployerConversation({
        ...conversation,
        messages: [],
        conversation_participants: [
          { user_id: user.id },
          { user_id: employerUserId }
        ]
      })
    } catch (error) {
      console.error('Error creating employer conversation:', error)
    } finally {
      setCreatingConversation(false)
      setLoadingConversation(false)
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
    // Check if there are unread messages
    return conv.messages.some(m => !m.read_at)
  }

  const hasUnreadAnnouncements = () => {
    return announcements.some(announcement => hasUnreadMessages(announcement))
  }

  const hasAnyUnreadMessages = () => {
    // Check if there are unread messages in any tab
    const hasUnreadBoss = employerConversation && hasUnreadMessages(employerConversation)
    const hasUnreadJobs = jobMessages.filter(m => !m.read_at).length > 0
    const hasUnreadNews = hasUnreadAnnouncements()
    const hasUnreadTeam = coworkerConversation && hasUnreadMessages(coworkerConversation)

    return hasUnreadBoss || hasUnreadJobs || hasUnreadNews || hasUnreadTeam
  }

  const getJobTimeWindow = (jobTemplate: JobTemplate, scheduledDate: string | null, scheduledEndDate: string | null) => {
    // Use the time window from the job template
    const windowStart = jobTemplate.time_window_start
    const windowEnd = jobTemplate.time_window_end

    return {
      startDate: scheduledDate,
      startTime: windowStart,
      endDate: scheduledEndDate || scheduledDate, // Use scheduled end date or same day
      endTime: windowEnd
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-md mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/3"></div>
            <div className="h-12 bg-white/10 rounded"></div>
            <div className="h-40 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentEmployee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-md mx-auto">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-6 text-center">
              <p className="text-gray-300">Employee profile not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 pb-20">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Styled tabs */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              onClick={() => setActiveTab('employer')}
              className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                activeTab === 'employer'
                  ? 'bg-blue-500/20 text-blue-300 border-2 border-blue-500/50 scale-105 shadow-lg'
                  : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Boss</span>
                {employerConversation && hasUnreadMessages(employerConversation) && (
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('jobs')}
              className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                activeTab === 'jobs'
                  ? 'bg-yellow-500/20 text-yellow-300 border-2 border-yellow-500/50 scale-105 shadow-lg'
                  : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Jobs</span>
                {jobMessages.filter(m => !m.read_at).length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {jobMessages.filter(m => !m.read_at).length}
                    </span>
                  </div>
                )}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('announcements')}
              className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                activeTab === 'announcements'
                  ? 'bg-purple-500/20 text-purple-300 border-2 border-purple-500/50 scale-105 shadow-lg'
                  : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>News</span>
                {hasUnreadAnnouncements() && (
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('coworkers')}
              className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                activeTab === 'coworkers'
                  ? 'bg-green-500/20 text-green-300 border-2 border-green-500/50 scale-105 shadow-lg'
                  : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Team</span>
                {coworkerConversation && hasUnreadMessages(coworkerConversation) && (
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('exchanges')}
              className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                activeTab === 'exchanges'
                  ? 'bg-orange-500/20 text-orange-300 border-2 border-orange-500/50 scale-105 shadow-lg'
                  : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Swap</span>
              </div>
            </button>
          </div>

          {/* Employer Tab */}
          <TabsContent value="employer">
            {loadingConversation ? (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-white/20 rounded w-3/4"></div>
                    <div className="h-4 bg-white/20 rounded w-1/2"></div>
                    <div className="h-4 bg-white/20 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : employerConversation ? (
              <EmployeeChatView
                conversationId={employerConversation.id}
                title="Chat with Boss"
              />
            ) : (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6 text-center">
                  <p className="text-yellow-300 text-lg font-semibold mb-3">⚠️ Chat Not Available</p>
                  <p className="text-gray-300 mb-2">
                    The employer account needs to be set up first.
                  </p>
                  <p className="text-sm text-gray-400">
                    Ask your admin to log in to their employer account at least once to enable messaging.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Jobs Tab - Messages pushed from Schedule */}
          <TabsContent value="jobs">
            <div className="space-y-3">
              {jobMessages.length === 0 ? (
                <Card className="bg-white/10 backdrop-blur-md border-white/20">
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-300">No job notifications yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Your employer will send you important job updates here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                jobMessages.map((msg) => (
                  <Card
                    key={msg.id}
                    className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] backdrop-blur-md border-2 ${
                      !msg.read_at
                        ? 'bg-yellow-500/10 border-yellow-500/50 shadow-lg shadow-yellow-500/20 hover:border-yellow-500/70'
                        : 'bg-white/10 border-white/20 hover:border-yellow-500/40'
                    }`}
                    onClick={() => markJobMessageRead(msg.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-mono text-xs text-gray-400 mb-1">
                            {msg.job_session?.job_template?.job_code || 'Job'}
                          </p>
                          <h3 className="font-bold text-lg text-white leading-tight">
                            {msg.job_session?.job_template?.title || 'Job Notification'}
                          </h3>
                        </div>
                        {!msg.read_at && (
                          <Badge className="bg-yellow-500 text-black font-bold text-xs shrink-0 ml-2">NEW</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-300 mb-3 leading-relaxed">{msg.message}</p>
                      <div className="space-y-2 text-xs">
                        {msg.job_session?.scheduled_date && msg.job_session.job_template && (
                          <div className="bg-white/5 p-2 rounded-lg space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Window Start:</span>
                              <span className="text-white font-medium">
                                {format(new Date(msg.job_session.scheduled_date), 'EEE, MMM d, yyyy')}
                                {msg.job_session.job_template.time_window_start && ` at ${msg.job_session.job_template.time_window_start.substring(0, 5)}`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Window End:</span>
                              <span className="text-white font-medium">
                                {format(new Date(msg.job_session.scheduled_end_date || msg.job_session.scheduled_date), 'EEE, MMM d, yyyy')}
                                {msg.job_session.job_template.time_window_end && ` at ${msg.job_session.job_template.time_window_end.substring(0, 5)}`}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="text-gray-500 text-right">
                          Sent {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
                        </div>
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
                <Card className="bg-white/10 backdrop-blur-md border-white/20">
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-300">No announcements yet</p>
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
                      className="cursor-pointer transition-all duration-300 hover:scale-102 bg-white/10 backdrop-blur-md border-2 border-purple-500/30 hover:border-purple-500/50 shadow-lg hover:shadow-purple-500/20"
                      onClick={() => setSelectedConversation(announcement.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-xs text-gray-400">
                            {formatAnnouncementDate(announcement.created_at)}
                          </p>
                          <Badge className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/50 font-bold">
                            ANNOUNCEMENT
                          </Badge>
                        </div>
                        {firstMessage && (
                          <p className="text-sm text-white leading-relaxed line-clamp-3">
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
                <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
                  <EmployeeChatView
                    conversationId={selectedConversation}
                    onBack={() => setSelectedConversation(null)}
                    title="Announcement"
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Coworkers Tab */}
          <TabsContent value="coworkers">
            {coworkerConversation ? (
              <EmployeeChatView
                conversationId={coworkerConversation.id}
                title="Team Chat"
              />
            ) : (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6 text-center">
                  <p className="text-gray-300">No team chat available yet</p>
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
