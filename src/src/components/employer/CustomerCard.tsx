'use client'

import type { Customer } from '@/types/database'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface CustomerCardProps {
  customer: Customer
  onEdit?: (customer: Customer) => void
  onDeactivate?: (customer: Customer) => void
  onBlock?: (customer: Customer) => void
  onViewJobs?: (customer: Customer) => void
}

export function CustomerCard({
  customer,
  onEdit,
  onDeactivate,
  onBlock,
  onViewJobs
}: CustomerCardProps) {
  const getStatusColor = (status: Customer['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500'
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
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {customer.customer_code}
              </Badge>
              <Badge className={getStatusColor(customer.status)}>
                {customer.status}
              </Badge>
            </div>
            <h3 className="font-semibold text-lg mt-2">{customer.full_name}</h3>
            <p className="text-sm text-gray-600">{customer.email}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-gray-600">
          {customer.phone && <p>Phone: {customer.phone}</p>}
          {customer.address && <p>Address: {customer.address}</p>}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(customer)}
              className="flex-1"
            >
              Edit
            </Button>
          )}
          {customer.status === 'ACTIVE' && onDeactivate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDeactivate(customer)}
              className="flex-1"
            >
              Deactivate
            </Button>
          )}
          {customer.status !== 'BLOCKED' && onBlock && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onBlock(customer)}
              className="flex-1"
            >
              Block
            </Button>
          )}
          {onViewJobs && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onViewJobs(customer)}
              className="flex-1"
            >
              View Jobs
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
