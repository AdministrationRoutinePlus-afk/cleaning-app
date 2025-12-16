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
    time_window_start: string | null
    time_window_end: string | null
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
          job_template:job_templates(job_code, title, description, time_window_start, time_window_end)
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
            job_template:job_templates(job_code, title, description, time_window_start, time_window_end)
          ),
          from_employee:employees!from_employee_id(*)
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
            job_template:job_templates(job_code, title, description, time_window_start, time_window_end)
          ),
          from_employee:employees!from_employee_id(*)
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
      // Check if employee already requested this job
      const { data: existingRequest } = await supabase
        .from('job_exchanges')
        .select('id, to_employee_id')
        .eq('id', exchangeId)
        .single()

      if (existingRequest?.to_employee_id === employeeId) {
        alert('You have already requested this job exchange.')
        return
      }

      if (existingRequest?.to_employee_id) {
        alert('Another employee has already requested this job exchange.')
        await loadData()
        return
      }

      const { error } = await supabase
        .from('job_exchanges')
        .update({ to_employee_id: employeeId })
        .eq('id', exchangeId)
        .is('to_employee_id', null) // Additional safety check

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
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return ''
    return timeStr.substring(0, 5)
  }

  const getJobTimeWindow = (job: JobSessionWithDetails) => {
    return {
      startDate: job.scheduled_date,
      startTime: job.job_template.time_window_start,
      endDate: job.scheduled_end_date || job.scheduled_date,
      endTime: job.job_template.time_window_end
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      PENDING: { className: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 font-bold', label: 'Pending' },
      APPROVED: { className: 'bg-green-500/20 text-green-300 border border-green-500/50 font-bold', label: 'Approved' },
      DENIED: { className: 'bg-red-500/20 text-red-300 border border-red-500/50 font-bold', label: 'Denied' }
    }
    const config = variants[status] || { className: 'bg-white/20 text-white border border-white/50 font-bold', label: status }
    return <Badge className={config.className}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-white/10 backdrop-blur-md border-white/20 animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-white/20 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-white/20 rounded w-2/3"></div>
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
        <button
          onClick={() => setActiveTab('post')}
          className={`py-3 px-3 rounded-lg font-semibold text-xs transition-all ${
            activeTab === 'post'
              ? 'bg-orange-500/20 text-orange-300 border-2 border-orange-500/50 scale-105 shadow-lg'
              : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:bg-white/10'
          }`}
        >
          Post Job
        </button>
        <button
          onClick={() => setActiveTab('available')}
          className={`py-3 px-3 rounded-lg font-semibold text-xs transition-all ${
            activeTab === 'available'
              ? 'bg-orange-500/20 text-orange-300 border-2 border-orange-500/50 scale-105 shadow-lg'
              : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:bg-white/10'
          }`}
        >
          Available ({availableExchanges.length})
        </button>
        <button
          onClick={() => setActiveTab('my-requests')}
          className={`py-3 px-3 rounded-lg font-semibold text-xs transition-all ${
            activeTab === 'my-requests'
              ? 'bg-orange-500/20 text-orange-300 border-2 border-orange-500/50 scale-105 shadow-lg'
              : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:bg-white/10'
          }`}
        >
          My Requests
        </button>
      </div>

      {/* Post Job Tab */}
      {activeTab === 'post' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Post your approved jobs for exchange with other employees
          </p>

          {myApprovedJobs.length === 0 ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="p-6 text-center">
                <p className="text-gray-300">No approved jobs to post</p>
              </CardContent>
            </Card>
          ) : (
            myApprovedJobs.map(job => (
              <Card key={job.id} className="bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-orange-500/50 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base text-white font-mono">{job.job_template.job_code}</CardTitle>
                      <p className="text-sm text-gray-300 mt-1">{job.job_template.title}</p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-300 border border-green-500/50 font-bold">APPROVED</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="bg-white/5 p-2 rounded-lg space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Window Start:</span>
                      <span className="text-white font-medium">
                        {formatDate(job.scheduled_date)}
                        {job.job_template.time_window_start && ` at ${formatTime(job.job_template.time_window_start)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Window End:</span>
                      <span className="text-white font-medium">
                        {formatDate(job.scheduled_end_date || job.scheduled_date)}
                        {job.job_template.time_window_end && ` at ${formatTime(job.job_template.time_window_end)}`}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <button
                    onClick={() => handlePostForExchange(job.id)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Post for Exchange
                  </button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Available Tab */}
      {activeTab === 'available' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Jobs posted by other employees for exchange
          </p>

          {availableExchanges.length === 0 ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="p-6 text-center">
                <p className="text-gray-300">No jobs available for exchange</p>
              </CardContent>
            </Card>
          ) : (
            availableExchanges.map(exchange => (
              <Card key={exchange.id} className="bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-orange-500/50 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base text-white font-mono">
                        {exchange.job_session.job_template.job_code}
                      </CardTitle>
                      <p className="text-sm text-gray-300 mt-1">
                        {exchange.job_session.job_template.title}
                      </p>
                    </div>
                    <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 font-bold">PENDING</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-2 text-sm">
                    <div className="bg-white/5 p-2 rounded-lg space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Window Start:</span>
                        <span className="text-white font-medium">
                          {formatDate(exchange.job_session.scheduled_date)}
                          {exchange.job_session.job_template.time_window_start && ` at ${formatTime(exchange.job_session.job_template.time_window_start)}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Window End:</span>
                        <span className="text-white font-medium">
                          {formatDate(exchange.job_session.scheduled_end_date || exchange.job_session.scheduled_date)}
                          {exchange.job_session.job_template.time_window_end && ` at ${formatTime(exchange.job_session.job_template.time_window_end)}`}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-300">
                        <span className="font-medium text-white">Posted by:</span>{' '}
                        {exchange.from_employee.full_name}
                      </p>
                    </div>
                    {exchange.reason && (
                      <div>
                        <p className="font-medium text-white">Reason:</p>
                        <p className="text-gray-400 text-xs italic">{exchange.reason}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <button
                    onClick={() => handleAskForJob(exchange.id)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Ask for it
                  </button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}

      {/* My Requests Tab */}
      {activeTab === 'my-requests' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Track your exchange requests and status
          </p>

          {myRequests.length === 0 ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="p-6 text-center">
                <p className="text-gray-300">No exchange requests</p>
              </CardContent>
            </Card>
          ) : (
            myRequests.map(exchange => {
              const isMyPost = exchange.from_employee_id === employeeId
              return (
                <Card key={exchange.id} className="bg-white/10 backdrop-blur-md border-2 border-white/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base text-white font-mono">
                          {exchange.job_session.job_template.job_code}
                        </CardTitle>
                        <p className="text-sm text-gray-300 mt-1">
                          {exchange.job_session.job_template.title}
                        </p>
                      </div>
                      {getStatusBadge(exchange.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="bg-white/5 p-2 rounded-lg space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Window Start:</span>
                          <span className="text-white font-medium">
                            {formatDate(exchange.job_session.scheduled_date)}
                            {exchange.job_session.job_template.time_window_start && ` at ${formatTime(exchange.job_session.job_template.time_window_start)}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Window End:</span>
                          <span className="text-white font-medium">
                            {formatDate(exchange.job_session.scheduled_end_date || exchange.job_session.scheduled_date)}
                            {exchange.job_session.job_template.time_window_end && ` at ${formatTime(exchange.job_session.job_template.time_window_end)}`}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-300">
                          <span className="font-medium text-white">Type:</span>{' '}
                          {isMyPost ? 'Posted by me' : 'Requested by me'}
                        </p>
                      </div>
                      {exchange.reason && (
                        <div>
                          <p className="font-medium text-white">Reason:</p>
                          <p className="text-gray-400 text-xs italic">{exchange.reason}</p>
                        </div>
                      )}
                      {exchange.to_employee_id && (
                        <div>
                          <p className="text-gray-300">
                            <span className="font-medium text-white">Status:</span>{' '}
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
