'use client'

/**
 * Employer Messages Page (Tab 4)
 *
 * This page provides all messaging functionality for employers:
 *
 * TAB 1: DIRECT MESSAGES
 * - View list of 1-on-1 conversations with employees
 * - Start new conversations with any active employee
 * - Real-time chat with read receipts
 *
 * TAB 2: ANNOUNCEMENTS
 * - Broadcast messages to all active employees (one-way)
 * - View history of past announcements
 *
 * TAB 3: GROUP CHAT
 * - View the employee group chat (read-only for employer)
 * - Employees can chat with each other here
 *
 * TAB 4: JOB MESSAGES
 * - View messages pushed from Schedule to employees
 * - Shows all schedule_messages records
 *
 * TAB 5: EXCHANGES
 * - View pending job exchange requests
 * - Approve or deny employee swap requests
 */

import { useState, useEffect } from 'react'
import type { JobExchange, JobSession, Employee, Conversation, Message, ScheduleMessage } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConversationList } from '@/components/employer/ConversationList'
import { ChatView } from '@/components/employer/ChatView'
import { AnnouncementForm } from '@/components/employer/AnnouncementForm'
import { ExchangeRequestCard } from '@/components/employer/ExchangeRequestCard'
import { format } from 'date-fns'

// Extended type for job exchanges with related data
interface JobExchangeWithDetails extends JobExchange {
  job_session: JobSession & {
    job_template?: {
      job_code: string
      title: string
    }
  }
  from_employee: Employee
  to_employee: Employee | null
}

// Extended type for conversations with messages
interface ConversationWithDetails extends Conversation {
  messages: Message[]
}

// Extended type for schedule messages with employee info
interface ScheduleMessageWithDetails extends ScheduleMessage {
  employee: Employee
  job_session: JobSession & {
    job_template?: {
      job_code: string
      title: string
    }
  }
}

export default function EmployerMessagesPage() {
  const [activeTab, setActiveTab] = useState('direct')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')

  // Data state
  const [exchanges, setExchanges] = useState<JobExchangeWithDetails[]>([])
  const [announcements, setAnnouncements] = useState<ConversationWithDetails[]>([])
  const [groupMessages, setGroupMessages] = useState<Message[]>([])
  const [scheduleMessages, setScheduleMessages] = useState<ScheduleMessageWithDetails[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  // Loading state
  const [loadingExchanges, setLoadingExchanges] = useState(false)
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [loadingGroup, setLoadingGroup] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  const supabase = createClient()

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'exchanges') {
      loadExchanges()
    } else if (activeTab === 'announcements') {
      loadAnnouncements()
    } else if (activeTab === 'group') {
      loadGroupChat()
    } else if (activeTab === 'job-messages') {
      loadScheduleMessages()
    } else if (activeTab === 'direct') {
      loadEmployees()
    }
  }, [activeTab])

  const loadExchanges = async () => {
    setLoadingExchanges(true)
    try {
      const { data, error } = await supabase
        .from('job_exchanges')
        .select(`
          *,
          job_session:job_sessions(
            *,
            job_template:job_templates(job_code, title)
          ),
          from_employee:employees!job_exchanges_from_employee_id_fkey(*),
          to_employee:employees!job_exchanges_to_employee_id_fkey(*)
        `)
        .eq('status', 'PENDING')
        .order('requested_at', { ascending: false })

      if (error) throw error
      setExchanges((data as JobExchangeWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading exchanges:', error)
    } finally {
      setLoadingExchanges(false)
    }
  }

  const loadAnnouncements = async () => {
    setLoadingAnnouncements(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          messages(*)
        `)
        .eq('type', 'ANNOUNCEMENT')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAnnouncements((data as ConversationWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading announcements:', error)
    } finally {
      setLoadingAnnouncements(false)
    }
  }

  const handleAnnouncementSuccess = () => {
    setShowAnnouncementForm(false)
    loadAnnouncements()
  }

  /**
   * Load employees for starting new conversations
   */
  const loadEmployees = async () => {
    setLoadingEmployees(true)
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('full_name', { ascending: true })

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      setLoadingEmployees(false)
    }
  }

  /**
   * Load group chat messages (EMPLOYEE_GROUP conversation type)
   * Employer can view but not participate
   */
  const loadGroupChat = async () => {
    setLoadingGroup(true)
    try {
      // Find or get the employee group chat
      const { data: groupConv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('type', 'EMPLOYEE_GROUP')
        .single()

      if (convError && convError.code !== 'PGRST116') throw convError

      if (groupConv) {
        // Load messages from the group chat
        const { data: messages, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', groupConv.id)
          .order('sent_at', { ascending: false })
          .limit(50)

        if (msgError) throw msgError
        setGroupMessages(messages || [])
      } else {
        setGroupMessages([])
      }
    } catch (error) {
      console.error('Error loading group chat:', error)
    } finally {
      setLoadingGroup(false)
    }
  }

  /**
   * Load schedule messages (pushed from Schedule tab)
   */
  const loadScheduleMessages = async () => {
    setLoadingSchedule(true)
    try {
      const { data, error } = await supabase
        .from('schedule_messages')
        .select(`
          *,
          employee:employees(*),
          job_session:job_sessions(
            *,
            job_template:job_templates(job_code, title)
          )
        `)
        .order('sent_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setScheduleMessages((data as ScheduleMessageWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading schedule messages:', error)
    } finally {
      setLoadingSchedule(false)
    }
  }

  /**
   * Start a new direct conversation with an employee
   */
  const handleStartConversation = async () => {
    if (!selectedEmployeeId) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get employee user_id
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('user_id, full_name')
        .eq('id', selectedEmployeeId)
        .single()

      if (empError) {
        console.error('Error fetching employee:', empError)
        alert('Error fetching employee data')
        return
      }

      if (!employee?.user_id) {
        alert(`${employee?.full_name || 'This employee'} does not have a user account linked yet. They need to register/login first before you can chat with them.`)
        return
      }

      // Check if conversation already exists between these two users
      // First get user's conversations via conversation_participants
      console.log('Checking for existing conversation between:', user.id, 'and', employee.user_id)

      const { data: userParticipations, error: upError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (upError) {
        console.log('Error checking user participations (may be empty):', upError)
        // Continue - user might have no conversations yet
      }

      if (userParticipations && userParticipations.length > 0) {
        const convIds = userParticipations.map(p => p.conversation_id)

        // Check if employee is in any of these conversations
        const { data: sharedConvs } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', employee.user_id)
          .in('conversation_id', convIds)

        if (sharedConvs && sharedConvs.length > 0) {
          // Found existing conversation
          console.log('Found existing conversation:', sharedConvs[0].conversation_id)
          setSelectedConversation(sharedConvs[0].conversation_id)
          setShowNewConversation(false)
          setSelectedEmployeeId('')
          return
        }
      }

      console.log('No existing conversation found, creating new one')

      // Create new conversation
      console.log('Creating conversation for user:', user.id)
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'DIRECT',
          created_by: user.id
        })
        .select()
        .single()

      if (convError) {
        console.error('Error creating conversation:', convError)
        alert(`Failed to create conversation: ${convError.message || JSON.stringify(convError)}`)
        return
      }

      console.log('Conversation created:', newConv.id)

      // Add participants
      console.log('Adding participants:', user.id, employee.user_id)
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id, joined_at: new Date().toISOString() },
          { conversation_id: newConv.id, user_id: employee.user_id, joined_at: new Date().toISOString() }
        ])

      if (partError) {
        console.error('Error adding participants:', partError)
        alert(`Failed to add participants: ${partError.message || JSON.stringify(partError)}`)
        return
      }

      console.log('Participants added successfully')

      // Open the new conversation
      setSelectedConversation(newConv.id)
      setShowNewConversation(false)
      setSelectedEmployeeId('')
    } catch (error) {
      console.error('Error starting conversation:', error)
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error)
      alert(`Failed to start conversation: ${errorMsg}`)
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Navigation - 5 tabs, compact for mobile */}
          <TabsList className="w-full grid grid-cols-5 mb-6 h-auto p-1">
            <TabsTrigger value="direct" className="text-[10px] sm:text-sm px-1 py-2">Chat</TabsTrigger>
            <TabsTrigger value="announcements" className="text-[10px] sm:text-sm px-1 py-2">News</TabsTrigger>
            <TabsTrigger value="group" className="text-[10px] sm:text-sm px-1 py-2">Team</TabsTrigger>
            <TabsTrigger value="job-messages" className="text-[10px] sm:text-sm px-1 py-2">Jobs</TabsTrigger>
            <TabsTrigger value="exchanges" className="text-[10px] sm:text-sm px-1 py-2 relative">
              Swap
              {exchanges.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                  {exchanges.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Direct Messages */}
          <TabsContent value="direct">
            {selectedConversation ? (
              <ChatView
                conversationId={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
            ) : showNewConversation ? (
              /* New Conversation Form */
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold">Start New Conversation</h2>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-600">Select Employee</label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an employee..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem
                            key={emp.id}
                            value={emp.id}
                            disabled={!emp.user_id}
                          >
                            {emp.full_name} ({emp.email})
                            {!emp.user_id && ' - No account'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {employees.some(e => !e.user_id) && (
                      <p className="text-xs text-gray-500 mt-1">
                        Employees without accounts need to register before you can message them.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowNewConversation(false)
                        setSelectedEmployeeId('')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleStartConversation}
                      disabled={!selectedEmployeeId}
                    >
                      Start Chat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Conversation List */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Conversations</h2>
                  <Button onClick={() => setShowNewConversation(true)} size="sm">
                    + New Chat
                  </Button>
                </div>
                <ConversationList onSelectConversation={setSelectedConversation} />
              </div>
            )}
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            {showAnnouncementForm ? (
              <AnnouncementForm
                onSuccess={handleAnnouncementSuccess}
                onCancel={() => setShowAnnouncementForm(false)}
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Past Announcements</h2>
                  <Button onClick={() => setShowAnnouncementForm(true)}>
                    New Announcement
                  </Button>
                </div>

                {loadingAnnouncements ? (
                  <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="bg-white p-4 rounded-lg animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                      </div>
                    ))}
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg">
                    <p className="text-gray-500">No announcements yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Create your first announcement to notify all employees
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((announcement) => {
                      const firstMessage = announcement.messages?.[0]
                      return (
                        <div
                          key={announcement.id}
                          className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm text-gray-500">
                              {formatAnnouncementDate(announcement.created_at)}
                            </p>
                            <Badge variant="secondary">ANNOUNCEMENT</Badge>
                          </div>
                          {firstMessage && (
                            <p className="text-sm text-gray-700">{firstMessage.content}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Employee Group Chat (read-only for employer) */}
          <TabsContent value="group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Employee Group Chat</h2>
                <Badge variant="outline">Read Only</Badge>
              </div>

              {loadingGroup ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : groupMessages.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg">
                  <p className="text-gray-500">No group chat messages yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Messages will appear here when employees chat with each other
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border max-h-[500px] overflow-y-auto">
                  <div className="p-4 space-y-3">
                    {groupMessages.map((message) => (
                      <div key={message.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            Employee
                          </span>
                          <span className="text-xs text-gray-400">
                            {format(new Date(message.sent_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{message.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 4: Job Push Messages (from Schedule) */}
          <TabsContent value="job-messages">
            <div>
              <h2 className="text-lg font-semibold mb-4">Job Messages</h2>
              <p className="text-sm text-gray-500 mb-4">
                Messages sent to employees from the Schedule tab
              </p>

              {loadingSchedule ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : scheduleMessages.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg">
                  <p className="text-gray-500">No job messages yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Use "Push to Messages" in Schedule to send messages about jobs
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduleMessages.map((msg) => (
                    <Card key={msg.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-mono text-sm text-gray-500">
                              {msg.job_session?.job_template?.job_code || 'Unknown Job'}
                            </span>
                            <h3 className="font-medium text-gray-900">
                              {msg.job_session?.job_template?.title || 'Job Message'}
                            </h3>
                          </div>
                          <div className="text-right">
                            <Badge variant={msg.read_at ? 'secondary' : 'default'}>
                              {msg.read_at ? 'Read' : 'Unread'}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{msg.message}</p>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>To: {msg.employee?.full_name || 'Unknown'}</span>
                          <span>{format(new Date(msg.sent_at), 'MMM d, h:mm a')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 5: Exchange Requests */}
          <TabsContent value="exchanges">
            <div>
              <h2 className="text-lg font-semibold mb-4">Pending Exchange Requests</h2>

              {loadingExchanges ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : exchanges.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg">
                  <p className="text-gray-500">No pending exchange requests</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Requests will appear here when employees request job exchanges
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exchanges.map((exchange) => (
                    <ExchangeRequestCard
                      key={exchange.id}
                      exchange={exchange}
                      onUpdate={loadExchanges}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
