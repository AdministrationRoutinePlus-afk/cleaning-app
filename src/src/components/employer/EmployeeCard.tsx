'use client'

/**
 * EmployeeCard Component
 *
 * Displays employee information in a card format with action buttons:
 * - PENDING employees: Activate, Block
 * - ACTIVE employees: Deactivate, Block, View Profile
 * - INACTIVE employees: Reactivate, View Profile
 * - BLOCKED employees: View Profile only
 *
 * Used in the Employer Users page (Tab 2) for employee management.
 */

import type { Employee } from '@/types/database'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface EmployeeCardProps {
  employee: Employee
  onActivate?: (employee: Employee) => void      // For pending -> active
  onReactivate?: (employee: Employee) => void    // For inactive -> active
  onDeactivate?: (employee: Employee) => void    // For active -> inactive
  onBlock?: (employee: Employee) => void         // For any -> blocked
  onViewProfile?: (employee: Employee) => void   // View detailed profile
}

export function EmployeeCard({
  employee,
  onActivate,
  onReactivate,
  onDeactivate,
  onBlock,
  onViewProfile
}: EmployeeCardProps) {
  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500'
      case 'PENDING':
        return 'bg-yellow-500'
      case 'INACTIVE':
        return 'bg-gray-500'
      case 'BLOCKED':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{employee.full_name}</h3>
            <p className="text-sm text-gray-600">{employee.email}</p>
          </div>
          <Badge className={getStatusColor(employee.status)}>
            {employee.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-gray-600">
          <p>Created: {format(new Date(employee.created_at), 'MMM d, yyyy')}</p>
          {employee.phone && <p>Phone: {employee.phone}</p>}
          {employee.activated_at && (
            <p>Activated: {format(new Date(employee.activated_at), 'MMM d, yyyy')}</p>
          )}
        </div>

        {/* Action buttons vary based on employee status */}
        <div className="flex flex-wrap gap-2 pt-2">
          {/* Activate button for PENDING employees */}
          {employee.status === 'PENDING' && onActivate && (
            <Button
              size="sm"
              onClick={() => onActivate(employee)}
              className="flex-1"
            >
              Activate
            </Button>
          )}
          {/* Reactivate button for INACTIVE employees */}
          {employee.status === 'INACTIVE' && onReactivate && (
            <Button
              size="sm"
              onClick={() => onReactivate(employee)}
              className="flex-1"
            >
              Reactivate
            </Button>
          )}
          {/* Deactivate button for ACTIVE employees */}
          {employee.status === 'ACTIVE' && onDeactivate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDeactivate(employee)}
              className="flex-1"
            >
              Deactivate
            </Button>
          )}
          {/* Block button available for non-blocked employees */}
          {employee.status !== 'BLOCKED' && onBlock && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onBlock(employee)}
              className="flex-1"
            >
              Block
            </Button>
          )}
          {/* View Profile always available */}
          {onViewProfile && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onViewProfile(employee)}
              className="flex-1"
            >
              View Profile
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
