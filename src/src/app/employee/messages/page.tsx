'use client'

import { useState, useEffect, useRef } from 'react'
import type { Employee, Conversation, Message, ScheduleMessage, JobSession, JobTemplate, Customer, JobStep, JobStepChecklist } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { EmployeeChatView } from '@/components/employee/EmployeeChatView'
import { ExchangeBoard } from '@/components/employee/ExchangeBoard'
import { format } from 'date-fns'
import { MessageSquare, ClipboardList, ChevronLeft, ChevronRight, CheckSquare, Users, Megaphone, ArrowLeftRight, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useDateFormat } from '@/lib/i18n/useDateFormat'

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

// Extended types for procedures
interface JobStepWithChecklist extends JobStep {
  job_step_checklist: JobStepChecklist[]
}

interface JobTemplateWithSteps extends JobTemplate {
  customer: Customer | null
  job_steps: JobStepWithChecklist[]
}

interface CustomerWithJobs {
  customer: Customer
  jobs: JobTemplateWithSteps[]
}

interface ConversationRow {
  id: string
  type: 'boss' | 'team' | 'swap' | 'announcement' | 'jobs'
  name: string
  icon: typeof MessageSquare
  lastMessage: string | null
  timestamp: string | null
  unreadCount: number
  conversationId?: string
}

type MainTab = 'chat' | 'procedures'

export default function EmployeeMessagesPage() {
  const { t } = useTranslation()
  const { formatDate } = useDateFormat()
  const [mainTab, setMainTab] = useState<MainTab>('chat')
  const [selectedView, setSelectedView] = useState<string | null>(null)
  const [employerConversation, setEmployerConversation] = useState<ConversationWithDetails | null>(null)
  const [announcements, setAnnouncements] = useState<ConversationWithDetails[]>([])
  const [coworkerConversation, setCoworkerConversation] = useState<ConversationWithDetails | null>(null)
  const [jobMessages, setJobMessages] = useState<ScheduleMessageWithDetails[]>([])
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingConversation, setLoadingConversation] = useState(true)
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<string | null>(null)
  // Procedures state
  const [procedures, setProcedures] = useState<CustomerWithJobs[]>([])
  const [loadingProcedures, setLoadingProcedures] = useState(false)
  const [selectedJob, setSelectedJob] = useState<JobTemplateWithSteps | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithJobs | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadCurrentEmployee()
    return () => { isMountedRef.current = false }
  }, [])

  useEffect(() => {
    if (currentEmployee) {
      loadEmployerConversation()
      loadAnnouncements()
      loadCoworkerConversation()
      loadJobMessages()
    }
  }, [currentEmployee])

  // Mark messages as read when opening a conversation
  useEffect(() => {
    if (!selectedView) return

    const markRead = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (selectedView === 'boss' && employerConversation) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', employerConversation.id)
          .is('read_at', null)
          .neq('sender_id', user.id)
        loadEmployerConversation()
      } else if (selectedView === 'team' && coworkerConversation) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', coworkerConversation.id)
          .is('read_at', null)
          .neq('sender_id', user.id)
        loadCoworkerConversation()
      } else if (selectedView === 'announcement' && announcements.length > 0) {
        const announcementIds = announcements.map(a => a.id)
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in('conversation_id', announcementIds)
          .is('read_at', null)
        loadAnnouncements()
      } else if (selectedView === 'jobs' && jobMessages.length > 0) {
        const unreadIds = jobMessages.filter(m => !m.read_at).map(m => m.id)
        if (unreadIds.length > 0) {
          await supabase
            .from('schedule_messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', unreadIds)
          loadJobMessages()
        }
      }
    }

    markRead()
  }, [selectedView])

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
      toast.error(t('Failed to load your profile'))
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

      const conversations = data as ConversationWithDetails[]
      const myConversation = conversations.find(conv =>
        conv.conversation_participants?.some((p: any) => p.user_id === user.id)
      )

      if (!myConversation && !creatingConversation) {
        await createEmployerConversation()
      } else if (myConversation) {
        setEmployerConversation(myConversation)
      }
    } catch (error) {
      console.error('Error loading employer conversation:', error)
      toast.error(t('Failed to load conversation'))
    } finally {
      setLoadingConversation(false)
    }
  }

  const createEmployerConversation = async () => {
    if (creatingConversation) return

    setCreatingConversation(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCreatingConversation(false)
        return
      }

      const { data: employers, error: employerError } = await supabase
        .from('employers')
        .select('user_id')
        .not('user_id', 'is', null)

      if (employerError || !employers || employers.length === 0) {
        setCreatingConversation(false)
        return
      }

      const employerUserId = employers[0].user_id

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'DIRECT',
          created_by: user.id
        })
        .select()
        .single()

      if (convError) throw convError

      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: user.id },
          { conversation_id: conversation.id, user_id: employerUserId }
        ])

      if (participantsError) throw participantsError

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
      toast.error(t('Failed to start conversation'))
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

      const userAnnouncements = (data as ConversationWithDetails[]).filter(conv =>
        conv.conversation_participants?.some((p: any) => p.user_id === user.id)
      )

      setAnnouncements(userAnnouncements)
    } catch (error) {
      console.error('Error loading announcements:', error)
      toast.error(t('Failed to load announcements'))
    }
  }

  const loadCoworkerConversation = async () => {
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
        .eq('type', 'EMPLOYEE_GROUP')
        .order('created_at', { ascending: false })

      if (error) throw error

      const conversations = data as ConversationWithDetails[]
      const groupConv = conversations.find(conv =>
        conv.conversation_participants?.some((p: any) => p.user_id === user.id)
      )

      setCoworkerConversation(groupConv || null)
    } catch (error) {
      console.error('Error loading coworker conversation:', error)
      toast.error(t('Failed to load group conversation'))
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
      toast.error(t('Failed to load job messages'))
    }
  }

  const markJobMessageRead = async (messageId: string) => {
    try {
      await supabase
        .from('schedule_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId)

      setJobMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, read_at: new Date().toISOString() } : msg
        )
      )
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  }

  const loadProcedures = async () => {
    setLoadingProcedures(true)
    try {
      const { data: jobTemplates, error } = await supabase
        .from('job_templates')
        .select(`
          *,
          customer:customers(*),
          job_steps(
            *,
            job_step_checklist(*)
          )
        `)
        .eq('status', 'ACTIVE')
        .order('title', { ascending: true })

      if (error) throw error

      const customerMap = new Map<string, CustomerWithJobs>()

      ;(jobTemplates as JobTemplateWithSteps[])?.forEach(job => {
        if (!job.customer) return

        const customerId = job.customer.id
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customer: job.customer,
            jobs: []
          })
        }

        job.job_steps = job.job_steps?.sort((a, b) => a.step_order - b.step_order) || []
        job.job_steps.forEach(step => {
          step.job_step_checklist = step.job_step_checklist?.sort((a, b) => a.item_order - b.item_order) || []
        })

        customerMap.get(customerId)!.jobs.push(job)
      })

      const proceduresArray = Array.from(customerMap.values())
        .sort((a, b) => (a.customer.full_name || '').localeCompare(b.customer.full_name || ''))

      setProcedures(proceduresArray)
    } catch (error) {
      console.error('Error loading procedures:', error)
      toast.error(t('Failed to load procedures'))
    } finally {
      setLoadingProcedures(false)
    }
  }

  useEffect(() => {
    if (mainTab === 'procedures' && procedures.length === 0) {
      loadProcedures()
    }
  }, [mainTab])

  // Build conversation list
  const getConversationList = (): ConversationRow[] => {
    const rows: ConversationRow[] = []

    // Boss conversation
    if (employerConversation) {
      const msgs = employerConversation.messages || []
      const sorted = [...msgs].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      const latest = sorted[0]
      const unread = msgs.filter(m => !m.read_at).length

      rows.push({
        id: 'boss',
        type: 'boss',
        name: t('Boss'),
        icon: MessageSquare,
        lastMessage: latest?.content || null,
        timestamp: latest?.sent_at || employerConversation.created_at,
        unreadCount: unread,
        conversationId: employerConversation.id,
      })
    }

    // Job messages
    if (jobMessages.length > 0) {
      const latest = jobMessages[0] // Already sorted desc
      const unread = jobMessages.filter(m => !m.read_at).length

      rows.push({
        id: 'jobs',
        type: 'jobs',
        name: t('Jobs'),
        icon: Briefcase,
        lastMessage: latest?.message || null,
        timestamp: latest?.sent_at || null,
        unreadCount: unread,
      })
    }

    // Announcements
    if (announcements.length > 0) {
      const allMsgs = announcements.flatMap(a => a.messages || [])
      const sorted = [...allMsgs].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      const latest = sorted[0]
      const unread = allMsgs.filter(m => !m.read_at).length

      rows.push({
        id: 'announcement',
        type: 'announcement',
        name: t('News'),
        icon: Megaphone,
        lastMessage: latest?.content || null,
        timestamp: latest?.sent_at || null,
        unreadCount: unread,
      })
    }

    // Team conversation
    if (coworkerConversation) {
      const msgs = coworkerConversation.messages || []
      const sorted = [...msgs].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      const latest = sorted[0]
      const unread = msgs.filter(m => !m.read_at).length

      rows.push({
        id: 'team',
        type: 'team',
        name: t('Team'),
        icon: Users,
        lastMessage: latest?.content || null,
        timestamp: latest?.sent_at || coworkerConversation.created_at,
        unreadCount: unread,
        conversationId: coworkerConversation.id,
      })
    }

    // Swap always available
    if (currentEmployee) {
      rows.push({
        id: 'swap',
        type: 'swap',
        name: t('Swap'),
        icon: ArrowLeftRight,
        lastMessage: t('Shift exchange board'),
        timestamp: null,
        unreadCount: 0,
      })
    }

    // Sort by most recent message
    rows.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0
      if (!a.timestamp) return 1
      if (!b.timestamp) return -1
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return rows
  }

  const formatTimestamp = (ts: string | null): string => {
    if (!ts) return ''
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return format(date, 'h:mm a')
    } else if (diffDays === 1) {
      return t('Yesterday')
    } else if (diffDays < 7) {
      return formatDate(date, 'EEEE')
    } else {
      return formatDate(date, 'MMM d')
    }
  }

  const getIconColor = (type: string) => {
    switch (type) {
      case 'boss': return 'bg-blue-500/20 text-blue-400'
      case 'jobs': return 'bg-yellow-500/20 text-yellow-400'
      case 'announcement': return 'bg-pink-500/20 text-pink-400'
      case 'team': return 'bg-green-500/20 text-green-400'
      case 'swap': return 'bg-orange-500/20 text-orange-400'
      default: return 'bg-white/10 text-gray-400'
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
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-gray-300">{t('Employee profile not found')}</p>
          </div>
        </div>
      </div>
    )
  }

  // Render the selected conversation view
  const renderConversationView = () => {
    if (selectedView === 'boss' && employerConversation) {
      return (
        <EmployeeChatView
          conversationId={employerConversation.id}
          title={t('Chat with Boss')}
          onBack={() => setSelectedView(null)}
        />
      )
    }

    if (selectedView === 'team' && coworkerConversation) {
      return (
        <EmployeeChatView
          conversationId={coworkerConversation.id}
          title={t('Team Chat')}
          onBack={() => setSelectedView(null)}
        />
      )
    }

    if (selectedView === 'announcement') {
      if (selectedAnnouncement) {
        return (
          <EmployeeChatView
            conversationId={selectedAnnouncement}
            title={t('Announcement')}
            onBack={() => setSelectedAnnouncement(null)}
            readOnly
          />
        )
      }

      // Show announcement list
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSelectedView(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-lg font-bold text-white">{t('News')}</h2>
          </div>
          {announcements.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-gray-300">{t('No announcements yet')}</p>
            </div>
          ) : (
            announcements.map((ann) => {
              const firstMessage = ann.messages?.[0]
              return (
                <button
                  key={ann.id}
                  onClick={() => setSelectedAnnouncement(ann.id)}
                  className="w-full text-left bg-white/5 rounded-xl p-3 border border-white/10 mb-2 hover:border-pink-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-xs text-gray-400">
                      {formatDate(new Date(ann.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                    <Badge className="text-xs bg-pink-500/20 text-pink-300 border border-pink-500/50 font-bold">
                      {t('NEWS')}
                    </Badge>
                  </div>
                  {firstMessage && (
                    <p className="text-sm text-white line-clamp-2">{firstMessage.content}</p>
                  )}
                </button>
              )
            })
          )}
        </div>
      )
    }

    if (selectedView === 'jobs') {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSelectedView(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-lg font-bold text-white">{t('Job Notifications')}</h2>
          </div>
          {jobMessages.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-gray-300">{t('No job notifications yet')}</p>
              <p className="text-sm text-gray-400 mt-1">
                {t('Your employer will send you important job updates here')}
              </p>
            </div>
          ) : (
            jobMessages.map((msg) => (
              <div
                key={msg.id}
                className={`cursor-pointer transition-all rounded-xl border ${
                  !msg.read_at
                    ? 'bg-yellow-500/10 border-yellow-500/50'
                    : 'bg-white/5 border-white/10'
                }`}
                onClick={() => markJobMessageRead(msg.id)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-mono text-xs text-gray-400 mb-1">
                        {msg.job_session?.job_template?.job_code || 'Job'}
                      </p>
                      <h3 className="font-bold text-white">
                        {msg.job_session?.job_template?.title || 'Job Notification'}
                      </h3>
                    </div>
                    {!msg.read_at && (
                      <Badge className="bg-yellow-500 text-black font-bold text-xs shrink-0 ml-2">{t('NEW')}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{msg.message}</p>
                  {msg.job_session?.scheduled_date && msg.job_session.job_template && (
                    <div className="bg-white/5 p-2 rounded-lg space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{t('Window Start:')}</span>
                        <span className="text-white font-medium">
                          {formatDate(new Date(msg.job_session.scheduled_date), 'EEE, MMM d, yyyy')}
                          {msg.job_session.job_template.time_window_start && ` at ${msg.job_session.job_template.time_window_start.substring(0, 5)}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{t('Window End:')}</span>
                        <span className="text-white font-medium">
                          {formatDate(new Date(msg.job_session.scheduled_end_date || msg.job_session.scheduled_date), 'EEE, MMM d, yyyy')}
                          {msg.job_session.job_template.time_window_end && ` at ${msg.job_session.job_template.time_window_end.substring(0, 5)}`}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="text-gray-500 text-xs text-right mt-2">
                    {t('Sent')} {formatDate(new Date(msg.sent_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )
    }

    if (selectedView === 'swap') {
      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSelectedView(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-lg font-bold text-white">{t('Swap')}</h2>
          </div>
          <ExchangeBoard employeeId={currentEmployee.id} />
        </div>
      )
    }

    return null
  }

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-lg mx-auto">
        {/* Main Tab Selector - 2 Square Buttons */}
        {!selectedView && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setMainTab('chat')}
              className={`aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all ${
                mainTab === 'chat'
                  ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
                  : 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <MessageSquare className={`w-10 h-10 ${mainTab === 'chat' ? 'text-white' : 'text-gray-400'}`} />
              <span>{t('Chat')}</span>
            </button>

            <button
              onClick={() => setMainTab('procedures')}
              className={`aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all ${
                mainTab === 'procedures'
                  ? 'bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-400'
                  : 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <ClipboardList className={`w-10 h-10 ${mainTab === 'procedures' ? 'text-white' : 'text-gray-400'}`} />
              <span>{t('Procedures')}</span>
            </button>
          </div>
        )}

        {mainTab === 'chat' ? (
          <div className="w-full">
            {selectedView ? (
              renderConversationView()
            ) : (
              /* Conversation List */
              <div className="space-y-2">
                {loadingConversation ? (
                  <div className="animate-pulse space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-white/5 rounded-xl"></div>
                    ))}
                  </div>
                ) : (
                  getConversationList().map((row) => {
                    const Icon = row.icon
                    const isUnread = row.unreadCount > 0

                    return (
                      <button
                        key={row.id}
                        onClick={() => setSelectedView(row.type)}
                        className={`w-full text-left rounded-xl p-3 border mb-2 transition-colors ${
                          isUnread
                            ? 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getIconColor(row.type)}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-white text-sm">{row.name}</p>
                              <div className="flex items-center gap-2">
                                {row.timestamp && (
                                  <span className="text-xs text-gray-500">{formatTimestamp(row.timestamp)}</span>
                                )}
                                {isUnread && (
                                  <span className="bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                    {row.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                            {row.lastMessage && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{row.lastMessage}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          /* PROCEDURES SECTION */
          <div className="bg-white/10 rounded-2xl border border-white/20 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-4">
              {selectedJob ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedJob.title}</h2>
                    <p className="text-sm text-purple-200">{selectedJob.job_code}</p>
                  </div>
                </div>
              ) : selectedCustomer ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedCustomer.customer.full_name || selectedCustomer.customer.customer_code}</h2>
                    <p className="text-sm text-purple-200">{selectedCustomer.jobs.length} {t('jobs')}</p>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-white text-center">{t('Job Procedures')}</h2>
                  <p className="text-sm text-purple-200 text-center mt-1">{t('Select a client')}</p>
                </>
              )}
            </div>

            <div className="p-4">
              {loadingProcedures ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-12 bg-white/10 rounded-lg"></div>
                  <div className="h-12 bg-white/10 rounded-lg"></div>
                  <div className="h-12 bg-white/10 rounded-lg"></div>
                </div>
              ) : procedures.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">{t('No procedures available')}</p>
                </div>
              ) : selectedJob ? (
                /* LEVEL 3 - Job Details */
                <div className="space-y-4">
                  {selectedJob.description && (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-sm text-gray-300">{selectedJob.description}</p>
                    </div>
                  )}

                  {selectedJob.job_steps && selectedJob.job_steps.length > 0 ? (
                    <div className="space-y-3">
                      {selectedJob.job_steps.map((step, stepIndex) => (
                        <div key={step.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="w-8 h-8 rounded-full bg-purple-600 text-white text-sm flex items-center justify-center font-bold flex-shrink-0">
                              {stepIndex + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-semibold text-white text-base">{step.title}</p>
                              {step.description && (
                                <p className="text-sm text-gray-400 mt-1">{step.description}</p>
                              )}
                            </div>
                          </div>

                          {step.products_needed && (
                            <div className="ml-11 mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                              <p className="text-xs font-semibold text-amber-400 mb-1">{t('Products Needed:')}</p>
                              <p className="text-sm text-amber-200">{step.products_needed}</p>
                            </div>
                          )}

                          {step.job_step_checklist && step.job_step_checklist.length > 0 && (
                            <div className="ml-11 space-y-2">
                              <p className="text-xs font-semibold text-gray-500">{t('Checklist:')}</p>
                              {step.job_step_checklist.map(item => (
                                <div key={item.id} className="flex items-start gap-2 p-2 bg-white/5 rounded-lg">
                                  <CheckSquare className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                                  <span className="text-sm text-gray-300">{item.item_text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <p>{t('No steps defined for this job')}</p>
                    </div>
                  )}
                </div>
              ) : selectedCustomer ? (
                /* LEVEL 2 - Jobs for selected customer */
                <div className="space-y-2">
                  {selectedCustomer.jobs.map(job => {
                    const totalSteps = job.job_steps?.length || 0
                    return (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-purple-500/10 rounded-xl border border-white/10 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{job.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{job.job_code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-purple-400">{totalSteps} {t('steps')}</span>
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                /* LEVEL 1 - Customer List */
                <div className="space-y-2">
                  {procedures.map((entry) => (
                    <button
                      key={entry.customer.id}
                      onClick={() => setSelectedCustomer(entry)}
                      className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-purple-500/10 rounded-xl border border-white/10 transition-colors text-left"
                    >
                      <p className="font-semibold text-white">{entry.customer.full_name || entry.customer.customer_code}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-purple-400">{entry.jobs.length} {t('jobs')}</span>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
