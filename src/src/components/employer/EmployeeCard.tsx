'use client'

import type { Employee } from '@/types/database'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface EmployeeCardProps {
  employee: Employee
  onActivate?: (employee: Employee) => void
  onDeactivate?: (employee: Employee) => void
  onBlock?: (employee: Employee) => void
  onViewProfile?: (employee: Employee) => void
}

export function EmployeeCard({
  employee,
  onActivate,
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

        <div className="flex flex-wrap gap-2 pt-2">
          {employee.status === 'PENDING' && onActivate && (
            <Button
              size="sm"
              onClick={() => onActivate(employee)}
              className="flex-1"
            >
              Activate
            </Button>
          )}
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
