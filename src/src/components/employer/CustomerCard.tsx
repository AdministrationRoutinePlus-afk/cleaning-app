'use client'

import type { Customer } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Edit2, Eye, ShieldOff } from 'lucide-react'

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
  const getStatusBadge = (status: Customer['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">ACTIVE</Badge>
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
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/10 text-gray-300 border border-white/20 font-mono text-xs">
                  {customer.customer_code}
                </Badge>
                {getStatusBadge(customer.status)}
              </div>
              <h3 className="font-semibold text-lg text-white">{customer.full_name}</h3>
              <p className="text-sm text-gray-400">{customer.email}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-3">
        <div className="text-sm text-gray-400">
          {customer.phone && <p>Phone: {customer.phone}</p>}
          {customer.address && <p>Address: {customer.address}</p>}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(customer)}
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
          {customer.status === 'ACTIVE' && onDeactivate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDeactivate(customer)}
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              Deactivate
            </Button>
          )}
          {customer.status !== 'BLOCKED' && onBlock && (
            <Button
              size="sm"
              onClick={() => onBlock(customer)}
              className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
            >
              <ShieldOff className="w-3 h-3 mr-1" />
              Block
            </Button>
          )}
          {onViewJobs && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewJobs(customer)}
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Eye className="w-3 h-3 mr-1" />
              View Jobs
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
