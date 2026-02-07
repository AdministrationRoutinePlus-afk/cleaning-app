'use client'

/**
 * EmployeeCard Component - Dark Theme
 */

import type { Employee } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { User, Shield, ShieldOff, Eye, CheckCircle } from 'lucide-react'

interface EmployeeCardProps {
  employee: Employee
  jobCounts?: Record<string, number>
  onActivate?: (employee: Employee) => void
  onReactivate?: (employee: Employee) => void
  onDeactivate?: (employee: Employee) => void
  onBlock?: (employee: Employee) => void
  onViewProfile?: (employee: Employee) => void
}

const JOB_STATUS_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'OFFERED', label: 'Open', color: 'bg-gray-500' },
  { key: 'CLAIMED', label: 'Claimed', color: 'bg-yellow-500' },
  { key: 'APPROVED', label: 'Approved', color: 'bg-blue-500' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'bg-purple-500' },
  { key: 'COMPLETED', label: 'Completed', color: 'bg-green-500' },
  { key: 'EVALUATED', label: 'Evaluated', color: 'bg-teal-500' },
  { key: 'CANCELLED', label: 'Cancelled', color: 'bg-red-500' },
  { key: 'MISSED', label: 'Missed', color: 'bg-red-500' },
]

export function EmployeeCard({
  employee,
  jobCounts,
  onActivate,
  onReactivate,
  onDeactivate,
  onBlock,
  onViewProfile
}: EmployeeCardProps) {
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
        <div className="bg-gray-800/60 rounded-xl p-3 border border-white/20 space-y-1">
          <p className="text-sm text-gray-300">Created: {format(new Date(employee.created_at), 'MMM d, yyyy')}</p>
          {employee.phone && <p className="text-sm text-gray-300">Phone: {employee.phone}</p>}
          {employee.activated_at && (
            <p className="text-sm text-gray-300">Activated: {format(new Date(employee.activated_at), 'MMM d, yyyy')}</p>
          )}
        </div>

        {/* Job Status Counts */}
        <div className="bg-white/5 rounded-xl p-2 border border-white/10">
          {jobCounts && Object.keys(jobCounts).length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {JOB_STATUS_CONFIG.filter(s => jobCounts[s.key] && jobCounts[s.key] > 0).map(s => (
                <span key={s.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-xs text-gray-300">
                  <span className={`w-2 h-2 rounded-full ${s.color}`} />
                  {jobCounts[s.key]} {s.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center">No jobs assigned</p>
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
