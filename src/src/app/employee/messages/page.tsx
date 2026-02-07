'use client'

import { useState, useEffect, useRef } from 'react'
import type { Employee, Conversation, Message, ScheduleMessage, JobSession, JobTemplate, Customer, JobStep, JobStepChecklist } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmployeeChatView } from '@/components/employee/EmployeeChatView'
import { ExchangeBoard } from '@/components/employee/ExchangeBoard'
import { format } from 'date-fns'
import { MessageSquare, ClipboardList, ChevronDown, ChevronRight, ChevronLeft, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'

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

type MainTab = 'chat' | 'procedures'

export default function EmployeeMessagesPage() {
  const [mainTab, setMainTab] = useState<MainTab>('chat')
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
  // Procedures state
  const [procedures, setProcedures] = useState<CustomerWithJobs[]>([])
  const [loadingProcedures, setLoadingProcedures] = useState(false)
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [selectedJob, setSelectedJob] = useState<JobTemplateWithSteps | null>(null)

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
      toast.error('Failed to load your profile')
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
      toast.error('Failed to load conversation')
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
      toast.error('Failed to start conversation')
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
      toast.error('Failed to load announcements')
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
      toast.error('Failed to load group conversation')
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
      toast.error('Failed to load job messages')
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

  const loadProcedures = async () => {
    setLoadingProcedures(true)
    try {
      // Fetch all job templates with their customers and steps/checklists
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

      // Group by customer
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

        // Sort steps by step_order
        job.job_steps = job.job_steps?.sort((a, b) => a.step_order - b.step_order) || []
        // Sort checklist items by item_order
        job.job_steps.forEach(step => {
          step.job_step_checklist = step.job_step_checklist?.sort((a, b) => a.item_order - b.item_order) || []
        })

        customerMap.get(customerId)!.jobs.push(job)
      })

      // Convert to array and sort by customer name
      const proceduresArray = Array.from(customerMap.values())
        .sort((a, b) => (a.customer.full_name || '').localeCompare(b.customer.full_name || ''))

      setProcedures(proceduresArray)
    } catch (error) {
      console.error('Error loading procedures:', error)
      toast.error('Failed to load procedures')
    } finally {
      setLoadingProcedures(false)
    }
  }

  // Load procedures when switching to procedures tab
  useEffect(() => {
    if (mainTab === 'procedures' && procedures.length === 0) {
      loadProcedures()
    }
  }, [mainTab])

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(customerId)) {
        newSet.delete(customerId)
      } else {
        newSet.add(customerId)
      }
      return newSet
    })
  }

  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(jobId)) {
        newSet.delete(jobId)
      } else {
        newSet.add(jobId)
      }
      return newSet
    })
  }

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
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
          <Card className="bg-white/10  border-white/20">
            <CardContent className="p-6 text-center">
              <p className="text-gray-300">Employee profile not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-lg mx-auto">
        {/* Main Tab Selector - 2 Square Buttons */}
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
            <span>Chat</span>
            {hasAnyUnreadMessages() && (
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            )}
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
            <span>Procedures</span>
          </button>
        </div>

        {mainTab === 'chat' ? (
          /* CHAT SECTION */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Chat Sub-tabs */}
            <div className="bg-white/10 rounded-2xl border border-white/20 p-4 mb-6">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setActiveTab('employer')}
                  className={`relative py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                    activeTab === 'employer'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
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
                  className={`relative py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                    activeTab === 'jobs'
                      ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 text-white shadow-lg'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Jobs</span>
                    {jobMessages.filter(m => !m.read_at).length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                        <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {jobMessages.filter(m => !m.read_at).length}
                        </span>
                      </div>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('announcements')}
                  className={`relative py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                    activeTab === 'announcements'
                      ? 'bg-gradient-to-r from-pink-600 to-pink-700 text-white shadow-lg'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
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
                  className={`relative py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                    activeTab === 'coworkers'
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
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
                  className={`relative py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                    activeTab === 'exchanges'
                      ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Swap</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Employer Tab */}
          <TabsContent value="employer">
            {loadingConversation ? (
              <Card className="bg-white/10  border-white/20">
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
              <Card className="bg-white/10  border-white/20">
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
                <Card className="bg-white/10  border-white/20">
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
                    className={`cursor-pointer transition-all duration-300 hover:scale-[1.02]  border-2 ${
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
                <Card className="bg-white/10  border-white/20">
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
                      className="cursor-pointer transition-all duration-300 hover:scale-102 bg-white/10  border-2 border-purple-500/30 hover:border-purple-500/50 shadow-lg hover:shadow-purple-500/20"
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
              <Card className="bg-white/10  border-white/20">
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
              ) : (
                <>
                  <h2 className="text-lg font-bold text-white text-center">Job Procedures</h2>
                  <p className="text-sm text-purple-200 text-center mt-1">Tap a job to see details</p>
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
                  <p className="text-gray-400">No procedures available</p>
                </div>
              ) : selectedJob ? (
                /* DETAILED VIEW - Single Job */
                <div className="space-y-4">
                  {/* Job Description */}
                  {selectedJob.description && (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-sm text-gray-300">{selectedJob.description}</p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-purple-400">{selectedJob.job_steps?.length || 0}</p>
                      <p className="text-xs text-gray-400">Steps</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-purple-400">
                        {selectedJob.job_steps?.reduce((acc, step) => acc + (step.job_step_checklist?.length || 0), 0) || 0}
                      </p>
                      <p className="text-xs text-gray-400">Checklist Items</p>
                    </div>
                  </div>

                  {/* All Steps */}
                  {selectedJob.job_steps && selectedJob.job_steps.length > 0 ? (
                    <div className="space-y-3">
                      {selectedJob.job_steps.map((step, stepIndex) => (
                        <div key={step.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                          {/* Step Header */}
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

                          {/* Products Needed */}
                          {step.products_needed && (
                            <div className="ml-11 mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                              <p className="text-xs font-semibold text-amber-400 mb-1">Products Needed:</p>
                              <p className="text-sm text-amber-200">{step.products_needed}</p>
                            </div>
                          )}

                          {/* Checklist Items */}
                          {step.job_step_checklist && step.job_step_checklist.length > 0 && (
                            <div className="ml-11 space-y-2">
                              <p className="text-xs font-semibold text-gray-500">Checklist:</p>
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
                      <p>No steps defined for this job</p>
                    </div>
                  )}
                </div>
              ) : (
                /* SUMMARY VIEW - Jobs List */
                <div className="space-y-4">
                  {/* Total Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-purple-400">
                        {procedures.reduce((acc, p) => acc + p.jobs.length, 0)}
                      </p>
                      <p className="text-xs text-gray-400">Jobs</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-purple-400">
                        {procedures.reduce((acc, p) => acc + p.jobs.reduce((a, j) => a + (j.job_steps?.length || 0), 0), 0)}
                      </p>
                      <p className="text-xs text-gray-400">Steps</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-purple-400">
                        {procedures.reduce((acc, p) => acc + p.jobs.reduce((a, j) => a + (j.job_steps?.reduce((s, step) => s + (step.job_step_checklist?.length || 0), 0) || 0), 0), 0)}
                      </p>
                      <p className="text-xs text-gray-400">Checklist Items</p>
                    </div>
                  </div>

                  {/* Jobs List by Customer */}
                  <div className="space-y-2">
                    {procedures.map(({ customer, jobs }) => (
                      <div key={customer.id} className="border border-white/10 rounded-xl overflow-hidden">
                        <div className="p-3 bg-white/5">
                          <p className="font-semibold text-white">{customer.full_name || customer.customer_code}</p>
                        </div>
                        <div className="divide-y divide-white/5">
                          {jobs.map(job => {
                            const totalSteps = job.job_steps?.length || 0
                            const totalItems = job.job_steps?.reduce((acc, step) => acc + (step.job_step_checklist?.length || 0), 0) || 0
                            return (
                              <button
                                key={job.id}
                                onClick={() => setSelectedJob(job)}
                                className="w-full p-3 flex items-center justify-between hover:bg-purple-500/10 transition-colors text-left"
                              >
                                <div>
                                  <p className="text-sm font-medium text-white">{job.title}</p>
                                  <p className="text-xs text-gray-500">{job.job_code}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <p className="text-sm text-purple-400">{totalSteps} steps</p>
                                    <p className="text-xs text-gray-500">{totalItems} items</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
