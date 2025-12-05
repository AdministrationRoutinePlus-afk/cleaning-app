'use client'

import { useState, useEffect } from 'react'
import type { JobExchange, JobSession, Employee, Conversation, Message } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConversationList } from '@/components/employer/ConversationList'
import { ChatView } from '@/components/employer/ChatView'
import { AnnouncementForm } from '@/components/employer/AnnouncementForm'
import { ExchangeRequestCard } from '@/components/employer/ExchangeRequestCard'

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

interface ConversationWithDetails extends Conversation {
  messages: Message[]
}

export default function EmployerMessagesPage() {
  const [activeTab, setActiveTab] = useState('direct')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [exchanges, setExchanges] = useState<JobExchangeWithDetails[]>([])
  const [announcements, setAnnouncements] = useState<ConversationWithDetails[]>([])
  const [loadingExchanges, setLoadingExchanges] = useState(false)
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (activeTab === 'exchanges') {
      loadExchanges()
    } else if (activeTab === 'announcements') {
      loadAnnouncements()
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="direct">Direct Messages</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="exchanges">
              Exchanges
              {exchanges.length > 0 && (
                <Badge variant="default" className="ml-2">
                  {exchanges.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Direct Messages Tab */}
          <TabsContent value="direct">
            {selectedConversation ? (
              <ChatView
                conversationId={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
            ) : (
              <div>
                <h2 className="text-lg font-semibold mb-4">Conversations</h2>
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

          {/* Exchanges Tab */}
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
