'use client'

/**
 * EmployeeCard Component - Dark Theme
 */

import { useState } from 'react'
import type { Employee } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { User, ShieldOff, Eye, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

export interface EmployeeJob {
  id: string
  status: string
  full_job_code: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  title: string
  customer_name: string | null
}

interface EmployeeCardProps {
  employee: Employee
  jobs?: EmployeeJob[]
  onActivate?: (employee: Employee) => void
  onReactivate?: (employee: Employee) => void
  onDeactivate?: (employee: Employee) => void
  onBlock?: (employee: Employee) => void
  onViewProfile?: (employee: Employee) => void
}

const JOB_STATUS_CONFIG: { key: string; label: string; dotColor: string; textColor: string }[] = [
  { key: 'OFFERED', label: 'Open', dotColor: 'bg-gray-500', textColor: 'text-gray-300' },
  { key: 'CLAIMED', label: 'Claimed', dotColor: 'bg-yellow-500', textColor: 'text-yellow-300' },
  { key: 'APPROVED', label: 'Approved', dotColor: 'bg-blue-500', textColor: 'text-blue-300' },
  { key: 'IN_PROGRESS', label: 'In Progress', dotColor: 'bg-purple-500', textColor: 'text-purple-300' },
  { key: 'COMPLETED', label: 'Completed', dotColor: 'bg-green-500', textColor: 'text-green-300' },
  { key: 'EVALUATED', label: 'Evaluated', dotColor: 'bg-teal-500', textColor: 'text-teal-300' },
  { key: 'CANCELLED', label: 'Cancelled', dotColor: 'bg-red-500', textColor: 'text-red-300' },
  { key: 'MISSED', label: 'Missed', dotColor: 'bg-red-500', textColor: 'text-red-300' },
]

function getStatusConfig(status: string) {
  return JOB_STATUS_CONFIG.find(s => s.key === status) || { key: status, label: status, dotColor: 'bg-gray-500', textColor: 'text-gray-300' }
}

export function EmployeeCard({
  employee,
  jobs,
  onActivate,
  onReactivate,
  onDeactivate,
  onBlock,
  onViewProfile
}: EmployeeCardProps) {
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null)

  const getStatusBadge = (status: Employee['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">ACTIVE</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">PENDING</Badge>
      case 'INACTIVE':
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">INACTIVE</Badge>
      case 'BLOCKED':
        return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">BLOCKED</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">{status}</Badge>
    }
  }

  // Build counts and group jobs by status
  const jobCounts: Record<string, number> = {}
  const jobsByStatus: Record<string, EmployeeJob[]> = {}
  if (jobs) {
    for (const job of jobs) {
      jobCounts[job.status] = (jobCounts[job.status] || 0) + 1
      if (!jobsByStatus[job.status]) jobsByStatus[job.status] = []
      jobsByStatus[job.status].push(job)
    }
  }

  const hasJobs = jobs && jobs.length > 0
  const activeStatuses = JOB_STATUS_CONFIG.filter(s => jobCounts[s.key] && jobCounts[s.key] > 0)

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-white/20 overflow-hidden w-full">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-white">{employee.full_name}</h3>
              <p className="text-sm text-gray-400">{employee.email}</p>
            </div>
          </div>
          {getStatusBadge(employee.status)}
        </div>
      </div>
      <div className="px-4 pb-3 space-y-3">
        {/* Job Status Counts - clickable to expand */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          {hasJobs ? (
            <div>
              <div className="flex flex-wrap gap-1.5 p-2">
                {activeStatuses.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setExpandedStatus(expandedStatus === s.key ? null : s.key)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors cursor-pointer ${
                      expandedStatus === s.key
                        ? 'bg-white/15 ring-1 ring-white/20'
                        : 'bg-white/5 hover:bg-white/10'
                    } ${s.textColor}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${s.dotColor}`} />
                    {jobCounts[s.key]} {s.label}
                    {expandedStatus === s.key ? (
                      <ChevronUp className="w-3 h-3 ml-0.5" />
                    ) : (
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    )}
                  </button>
                ))}
              </div>

              {/* Expanded job details */}
              {expandedStatus && jobsByStatus[expandedStatus] && (
                <div className="border-t border-white/10 px-2 py-1.5 space-y-1 max-h-48 overflow-y-auto">
                  {jobsByStatus[expandedStatus].map(job => (
                    <div key={job.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{job.title}</p>
                        <div className="flex items-center gap-2 text-gray-400">
                          {job.full_job_code && <span>{job.full_job_code}</span>}
                          {job.customer_name && <span>{job.customer_name}</span>}
                        </div>
                      </div>
                      {job.scheduled_date && (
                        <span className="text-gray-400 ml-2 shrink-0">
                          {format(new Date(job.scheduled_date + 'T00:00:00'), 'MMM d')}
                          {job.scheduled_time && ` ${job.scheduled_time.slice(0, 5)}`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center p-2">No jobs assigned</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {employee.status === 'PENDING' && onActivate && (
            <Button
              size="sm"
              onClick={() => onActivate(employee)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Activate
            </Button>
          )}
          {employee.status === 'INACTIVE' && onReactivate && (
            <Button
              size="sm"
              onClick={() => onReactivate(employee)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Reactivate
            </Button>
          )}
          {employee.status === 'ACTIVE' && onDeactivate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDeactivate(employee)}
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              Deactivate
            </Button>
          )}
          {employee.status !== 'BLOCKED' && onBlock && (
            <Button
              size="sm"
              onClick={() => onBlock(employee)}
              className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
            >
              <ShieldOff className="w-3 h-3 mr-1" />
              Block
            </Button>
          )}
          {onViewProfile && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewProfile(employee)}
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Eye className="w-3 h-3 mr-1" />
              View Profile
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
