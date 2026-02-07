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
  onActivate?: (employee: Employee) => void
  onReactivate?: (employee: Employee) => void
  onDeactivate?: (employee: Employee) => void
  onBlock?: (employee: Employee) => void
  onViewProfile?: (employee: Employee) => void
}

export function EmployeeCard({
  employee,
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
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden w-full">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-white">{employee.full_name}</h3>
              <p className="text-sm text-gray-400">{employee.email}</p>
            </div>
          </div>
          {getStatusBadge(employee.status)}
        </div>
      </div>
      <div className="px-4 pb-3 space-y-3">
        <div className="text-sm text-gray-400">
          <p>Created: {format(new Date(employee.created_at), 'MMM d, yyyy')}</p>
          {employee.phone && <p>Phone: {employee.phone}</p>}
          {employee.activated_at && (
            <p>Activated: {format(new Date(employee.activated_at), 'MMM d, yyyy')}</p>
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
              className="flex-1 border-white/20 text-gray-300 hover:bg-white/10"
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
              className="flex-1 border-white/20 text-gray-300 hover:bg-white/10"
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
