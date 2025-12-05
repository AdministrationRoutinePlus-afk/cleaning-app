'use client'

import { useEffect, useState } from 'react'
import type { JobExchange, JobSession, Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface JobSessionWithDetails extends JobSession {
  job_template: {
    job_code: string
    title: string
    description: string | null
  }
}

interface JobExchangeWithDetails extends JobExchange {
  job_session: JobSessionWithDetails
  from_employee: Employee
}

interface ExchangeBoardProps {
  employeeId: string
}

export function ExchangeBoard({ employeeId }: ExchangeBoardProps) {
  const [myApprovedJobs, setMyApprovedJobs] = useState<JobSessionWithDetails[]>([])
  const [availableExchanges, setAvailableExchanges] = useState<JobExchangeWithDetails[]>([])
  const [myRequests, setMyRequests] = useState<JobExchangeWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'post' | 'available' | 'my-requests'>('post')
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [employeeId])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadMyApprovedJobs(),
        loadAvailableExchanges(),
        loadMyRequests()
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadMyApprovedJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(job_code, title, description)
        `)
        .eq('assigned_to', employeeId)
        .eq('status', 'APPROVED')
        .order('scheduled_date', { ascending: true })

      if (error) throw error
      setMyApprovedJobs((data as JobSessionWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading approved jobs:', error)
    }
  }

  const loadAvailableExchanges = async () => {
    try {
      const { data, error } = await supabase
        .from('job_exchanges')
        .select(`
          *,
          job_session:job_sessions(
            *,
            job_template:job_templates(job_code, title, description)
          ),
          from_employee:employees!job_exchanges_from_employee_id_fkey(*)
        `)
        .eq('status', 'PENDING')
        .is('to_employee_id', null)
        .neq('from_employee_id', employeeId)
        .order('requested_at', { ascending: false })

      if (error) throw error
      setAvailableExchanges((data as JobExchangeWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading available exchanges:', error)
    }
  }

  const loadMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('job_exchanges')
        .select(`
          *,
          job_session:job_sessions(
            *,
            job_template:job_templates(job_code, title, description)
          ),
          from_employee:employees!job_exchanges_from_employee_id_fkey(*)
        `)
        .or(`from_employee_id.eq.${employeeId},to_employee_id.eq.${employeeId}`)
        .order('requested_at', { ascending: false })

      if (error) throw error
      setMyRequests((data as JobExchangeWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading my requests:', error)
    }
  }

  const handlePostForExchange = async (jobSessionId: string) => {
    try {
      const reason = prompt('Why do you want to exchange this job?')
      if (!reason) return

      const { error } = await supabase
        .from('job_exchanges')
        .insert({
          job_session_id: jobSessionId,
          from_employee_id: employeeId,
          reason: reason.trim(),
          status: 'PENDING',
          requested_at: new Date().toISOString()
        })

      if (error) throw error

      alert('Job posted for exchange successfully!')
      await loadData()
      setActiveTab('my-requests')
    } catch (error) {
      console.error('Error posting job for exchange:', error)
      alert('Failed to post job for exchange')
    }
  }

  const handleAskForJob = async (exchangeId: string) => {
    try {
      const { error } = await supabase
        .from('job_exchanges')
        .update({ to_employee_id: employeeId })
        .eq('id', exchangeId)

      if (error) throw error

      alert('Request sent! Waiting for the employee to choose and employer to approve.')
      await loadData()
    } catch (error) {
      console.error('Error requesting job:', error)
      alert('Failed to request job')
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return ''
    return timeStr.substring(0, 5)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      PENDING: { variant: 'default', label: 'Pending' },
      APPROVED: { variant: 'secondary', label: 'Approved' },
      DENIED: { variant: 'destructive', label: 'Denied' }
    }
    const config = variants[status] || { variant: 'outline' as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tab Selection */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant={activeTab === 'post' ? 'default' : 'outline'}
          onClick={() => setActiveTab('post')}
          className="text-xs sm:text-sm"
        >
          Post Job
        </Button>
        <Button
          variant={activeTab === 'available' ? 'default' : 'outline'}
          onClick={() => setActiveTab('available')}
          className="text-xs sm:text-sm"
        >
          Available ({availableExchanges.length})
        </Button>
        <Button
          variant={activeTab === 'my-requests' ? 'default' : 'outline'}
          onClick={() => setActiveTab('my-requests')}
          className="text-xs sm:text-sm"
        >
          My Requests
        </Button>
      </div>

      {/* Post Job Tab */}
      {activeTab === 'post' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Post your approved jobs for exchange with other employees
          </p>

          {myApprovedJobs.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">No approved jobs to post</p>
              </CardContent>
            </Card>
          ) : (
            myApprovedJobs.map(job => (
              <Card key={job.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{job.job_template.job_code}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{job.job_template.title}</p>
                    </div>
                    <Badge variant="secondary">APPROVED</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-700">
                      <span className="font-medium">Date:</span> {formatDate(job.scheduled_date)}
                    </p>
                    {job.scheduled_time && (
                      <p className="text-gray-700">
                        <span className="font-medium">Time:</span> {formatTime(job.scheduled_time)}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handlePostForExchange(job.id)}
                    className="w-full"
                    size="sm"
                  >
                    Post for Exchange
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Available Tab */}
      {activeTab === 'available' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Jobs posted by other employees for exchange
          </p>

          {availableExchanges.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">No jobs available for exchange</p>
              </CardContent>
            </Card>
          ) : (
            availableExchanges.map(exchange => (
              <Card key={exchange.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {exchange.job_session.job_template.job_code}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {exchange.job_session.job_template.title}
                      </p>
                    </div>
                    {getStatusBadge(exchange.status)}
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-700">
                        <span className="font-medium">Date:</span>{' '}
                        {formatDate(exchange.job_session.scheduled_date)}
                      </p>
                      {exchange.job_session.scheduled_time && (
                        <p className="text-gray-700">
                          <span className="font-medium">Time:</span>{' '}
                          {formatTime(exchange.job_session.scheduled_time)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-700">
                        <span className="font-medium">Posted by:</span>{' '}
                        {exchange.from_employee.full_name}
                      </p>
                    </div>
                    {exchange.reason && (
                      <div>
                        <p className="font-medium text-gray-700">Reason:</p>
                        <p className="text-gray-600 text-xs italic">{exchange.reason}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handleAskForJob(exchange.id)}
                    className="w-full"
                    size="sm"
                  >
                    Ask for it
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}

      {/* My Requests Tab */}
      {activeTab === 'my-requests' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Track your exchange requests and status
          </p>

          {myRequests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">No exchange requests</p>
              </CardContent>
            </Card>
          ) : (
            myRequests.map(exchange => {
              const isMyPost = exchange.from_employee_id === employeeId
              return (
                <Card key={exchange.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {exchange.job_session.job_template.job_code}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {exchange.job_session.job_template.title}
                        </p>
                      </div>
                      {getStatusBadge(exchange.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-gray-700">
                          <span className="font-medium">Date:</span>{' '}
                          {formatDate(exchange.job_session.scheduled_date)}
                        </p>
                        {exchange.job_session.scheduled_time && (
                          <p className="text-gray-700">
                            <span className="font-medium">Time:</span>{' '}
                            {formatTime(exchange.job_session.scheduled_time)}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-700">
                          <span className="font-medium">Type:</span>{' '}
                          {isMyPost ? 'Posted by me' : 'Requested by me'}
                        </p>
                      </div>
                      {exchange.reason && (
                        <div>
                          <p className="font-medium text-gray-700">Reason:</p>
                          <p className="text-gray-600 text-xs italic">{exchange.reason}</p>
                        </div>
                      )}
                      {exchange.to_employee_id && (
                        <div>
                          <p className="text-gray-700">
                            <span className="font-medium">Status:</span>{' '}
                            {exchange.status === 'PENDING'
                              ? 'Waiting for employer approval'
                              : exchange.status === 'APPROVED'
                              ? 'Exchange approved!'
                              : 'Exchange denied'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
