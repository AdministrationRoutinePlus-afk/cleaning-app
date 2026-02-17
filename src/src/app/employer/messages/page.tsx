'use client'

/**
 * Employer Messages Page (Tab 4)
 *
 * This page provides all messaging functionality for employers:
 *
 * TAB 1: DIRECT MESSAGES
 * TAB 2: ANNOUNCEMENTS
 * TAB 3: GROUP CHAT
 * TAB 4: JOB MESSAGES
 * TAB 5: EXCHANGES
 */

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import type { JobExchange, JobSession, Employee, Conversation, Message, ScheduleMessage, JobSplit } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConversationList } from '@/components/employer/ConversationList'
import { ChatView } from '@/components/employer/ChatView'
import { AnnouncementForm } from '@/components/employer/AnnouncementForm'
import { ExchangeRequestCard } from '@/components/employer/ExchangeRequestCard'
import { SplitApprovalCard } from '@/components/employer/SplitApprovalCard'
import { format } from 'date-fns'
import { MessageSquare, Megaphone, Users, Briefcase, ArrowLeftRight, Plus, ArrowLeft, UserCircle } from 'lucide-react'
import { CustomerChatList } from '@/components/employer/CustomerChatList'
import { useTranslation } from '@/lib/i18n/useTranslation'

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
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('direct')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')

  // Split request type for employer view
  interface JobSplitWithDetails extends JobSplit {
    job_session: JobSession & {
      job_template?: {
        job_code: string
        title: string
      }
    }
    requested_by_employee: Employee
    partner_employee: Employee
  }

  // Data state
  const [exchanges, setExchanges] = useState<JobExchangeWithDetails[]>([])
  const [splitRequests, setSplitRequests] = useState<JobSplitWithDetails[]>([])
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

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

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

      // Also load pending split requests (PENDING_EMPLOYER)
      const { data: splits, error: splitError } = await supabase
        .from('job_splits')
        .select(`
          *,
          job_session:job_sessions(
            *,
            job_template:job_templates(job_code, title)
          ),
          requested_by_employee:employees!job_splits_requested_by_fkey(*),
          partner_employee:employees!job_splits_partner_id_fkey(*)
        `)
        .in('status', ['PENDING_PARTNER', 'PENDING_EMPLOYER'])
        .order('created_at', { ascending: false })

      if (!splitError) {
        setSplitRequests((splits as JobSplitWithDetails[]) || [])
      }
    } catch (error) {
      console.error('Error loading exchanges:', error)
      toast.error(t('Failed to load exchange requests'))
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
      toast.error(t('Failed to load announcements'))
    } finally {
      setLoadingAnnouncements(false)
    }
  }

  const handleAnnouncementSuccess = () => {
    setShowAnnouncementForm(false)
    loadAnnouncements()
  }

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
      toast.error(t('Failed to load employees'))
    } finally {
      setLoadingEmployees(false)
    }
  }

  const loadGroupChat = async () => {
    setLoadingGroup(true)
    try {
      const { data: groupConv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('type', 'EMPLOYEE_GROUP')
        .single()

      if (convError && convError.code !== 'PGRST116') throw convError

      if (groupConv) {
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
      toast.error(t('Failed to load group chat'))
    } finally {
      setLoadingGroup(false)
    }
  }

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
      toast.error(t('Failed to load schedule messages'))
    } finally {
      setLoadingSchedule(false)
    }
  }

  const handleStartConversation = async () => {
    if (!selectedEmployeeId) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('user_id, full_name')
        .eq('id', selectedEmployeeId)
        .single()

      if (empError) {
        console.error('Error fetching employee:', empError)
        toast.error(t('Error fetching employee data'))
        return
      }

      if (!employee?.user_id) {
        toast.info(`${employee?.full_name || t('This employee')} ${t('does not have a user account linked yet. They need to register/login first before you can chat with them.')}`)
        return
      }

      // Check if conversation already exists
      const { data: userParticipations, error: upError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (upError) {
        console.log('Error checking user participations (may be empty):', upError)
      }

      if (userParticipations && userParticipations.length > 0) {
        const convIds = userParticipations.map(p => p.conversation_id)

        const { data: sharedConvs } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', employee.user_id)
          .in('conversation_id', convIds)

        if (sharedConvs && sharedConvs.length > 0) {
          setSelectedConversation(sharedConvs[0].conversation_id)
          setShowNewConversation(false)
          setSelectedEmployeeId('')
          return
        }
      }

      // Create new conversation
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
        toast.error(`Failed to create conversation: ${convError.message || JSON.stringify(convError)}`)
        return
      }

      // Add participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id, joined_at: new Date().toISOString() },
          { conversation_id: newConv.id, user_id: employee.user_id, joined_at: new Date().toISOString() }
        ])

      if (partError) {
        console.error('Error adding participants:', partError)
        toast.error(`Failed to add participants: ${partError.message || JSON.stringify(partError)}`)
        return
      }

      setSelectedConversation(newConv.id)
      setShowNewConversation(false)
      setSelectedEmployeeId('')
    } catch (error) {
      console.error('Error starting conversation:', error)
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error)
      toast.error(`Failed to start conversation: ${errorMsg}`)
    }
  }

  const formatAnnouncementDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const tabs = [
    { value: 'direct', label: t('Chat'), icon: MessageSquare },
    { value: 'announcements', label: t('News'), icon: Megaphone },
    { value: 'group', label: t('Team'), icon: Users },
    { value: 'job-messages', label: t('Jobs'), icon: Briefcase },
    { value: 'exchanges', label: t('Swap'), icon: ArrowLeftRight, badge: exchanges.length + splitRequests.length },
    { value: 'customers', label: t('Clients'), icon: UserCircle },
  ]

  // Skeleton loader for dark theme
  const SkeletonLoader = ({ count = 3 }: { count?: number }) => (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white/5 p-4 rounded-xl animate-pulse border border-white/10">
          <div className="h-4 bg-white/10 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-white/10 rounded w-full"></div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">{t('Messages')}</h1>

        {/* Tab Navigation - 6 tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 border border-white/10">
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => {
                setActiveTab(tab.value)
                setSelectedConversation(null)
              }}
              className={`flex-1 py-2 px-1 rounded-lg text-[10px] sm:text-sm font-medium transition-colors relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 ${
                activeTab === tab.value
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* TAB 1: Direct Messages */}
        {activeTab === 'direct' && (
          <>
            {selectedConversation ? (
              <ChatView
                conversationId={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
            ) : showNewConversation ? (
              /* New Conversation Form */
              <div className="bg-white/5 rounded-xl p-6 space-y-4 border border-white/10">
                <h2 className="text-lg font-semibold text-white">{t('Start New Conversation')}</h2>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">{t('Select Employee')}</label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder={t('Choose an employee...')} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-white/20">
                      {employees.map(emp => (
                        <SelectItem
                          key={emp.id}
                          value={emp.id}
                          disabled={!emp.user_id}
                          className="text-white hover:bg-white/10"
                        >
                          {emp.full_name} ({emp.email})
                          {!emp.user_id && ` - ${t('No account')}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {employees.some(e => !e.user_id) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('Employees without accounts need to register before you can message them.')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setShowNewConversation(false)
                      setSelectedEmployeeId('')
                    }}
                    className="bg-white/10 border border-white/30 text-white hover:bg-white/20"
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    onClick={handleStartConversation}
                    disabled={!selectedEmployeeId}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {t('Start Chat')}
                  </Button>
                </div>
              </div>
            ) : (
              /* Conversation List */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">{t('Conversations')}</h2>
                  <Button
                    onClick={() => setShowNewConversation(true)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('New Chat')}
                  </Button>
                </div>
                <ConversationList onSelectConversation={setSelectedConversation} />
              </div>
            )}
          </>
        )}

        {/* Announcements Tab */}
        {activeTab === 'announcements' && (
          <>
            {showAnnouncementForm ? (
              <AnnouncementForm
                onSuccess={handleAnnouncementSuccess}
                onCancel={() => setShowAnnouncementForm(false)}
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">{t('Past Announcements')}</h2>
                  <Button
                    onClick={() => setShowAnnouncementForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('New')}
                  </Button>
                </div>

                {loadingAnnouncements ? (
                  <SkeletonLoader count={2} />
                ) : announcements.length === 0 ? (
                  <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-gray-400">{t('No announcements yet')}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('Create your first announcement to notify all employees')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((announcement) => {
                      const firstMessage = announcement.messages?.[0]
                      return (
                        <div
                          key={announcement.id}
                          className="bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/[0.07] transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm text-gray-500">
                              {formatAnnouncementDate(announcement.created_at)}
                            </p>
                            <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">{t('ANNOUNCEMENT')}</Badge>
                          </div>
                          {firstMessage && (
                            <p className="text-sm text-gray-300">{firstMessage.content}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB 3: Employee Group Chat (read-only for employer) */}
        {activeTab === 'group' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{t('Employee Group Chat')}</h2>
              <Badge className="bg-white/10 text-gray-300 border border-white/20">{t('Read Only')}</Badge>
            </div>

            {loadingGroup ? (
              <SkeletonLoader />
            ) : groupMessages.length === 0 ? (
              <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                <p className="text-gray-400">{t('No group chat messages yet')}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('Messages will appear here when employees chat with each other')}
                </p>
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl border border-white/10 max-h-[500px] overflow-y-auto">
                <div className="p-4 space-y-3">
                  {groupMessages.map((message) => (
                    <div key={message.id} className="border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-300">
                          {t('Employee')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(message.sent_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Job Push Messages (from Schedule) */}
        {activeTab === 'job-messages' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">{t('Job Messages')}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {t('Messages sent to employees from the Schedule tab')}
            </p>

            {loadingSchedule ? (
              <SkeletonLoader />
            ) : scheduleMessages.length === 0 ? (
              <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                <p className="text-gray-400">{t('No job messages yet')}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('Use "Push to Messages" in Schedule to send messages about jobs')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduleMessages.map((msg) => (
                  <div key={msg.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-mono text-sm text-gray-500">
                          {msg.job_session?.job_template?.job_code || t('Unknown Job')}
                        </span>
                        <h3 className="font-medium text-white">
                          {msg.job_session?.job_template?.title || t('Job Message')}
                        </h3>
                      </div>
                      <div className="text-right">
                        <Badge className={msg.read_at
                          ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }>
                          {msg.read_at ? t('Read') : t('Unread')}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{msg.message}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{t('To')}: {msg.employee?.full_name || t('Unknown')}</span>
                      <span>{format(new Date(msg.sent_at), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Customer Chat */}
        {activeTab === 'customers' && (
          <>
            {selectedConversation ? (
              <ChatView
                conversationId={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">{t('Clients')}</h2>
                <CustomerChatList onSelectConversation={setSelectedConversation} />
              </div>
            )}
          </>
        )}

        {/* TAB 5: Exchange & Split Requests */}
        {activeTab === 'exchanges' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">{t('Pending Requests')}</h2>

            {loadingExchanges ? (
              <SkeletonLoader count={2} />
            ) : (exchanges.length === 0 && splitRequests.length === 0) ? (
              <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                <p className="text-gray-400">{t('No pending requests')}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('Requests will appear here when employees request job exchanges or splits')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Split Requests */}
                {splitRequests.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-purple-300">{t('Job Splits')}</h3>
                    {splitRequests.map((split) => (
                      <SplitApprovalCard
                        key={split.id}
                        split={split}
                        onUpdate={loadExchanges}
                      />
                    ))}
                  </>
                )}

                {/* Exchange Requests */}
                {exchanges.length > 0 && (
                  <>
                    {splitRequests.length > 0 && (
                      <h3 className="text-sm font-semibold text-blue-300 mt-4">{t('Job Exchanges')}</h3>
                    )}
                    {exchanges.map((exchange) => (
                      <ExchangeRequestCard
                        key={exchange.id}
                        exchange={exchange}
                        onUpdate={loadExchanges}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
