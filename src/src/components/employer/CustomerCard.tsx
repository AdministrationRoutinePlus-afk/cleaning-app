'use client'

import type { Customer } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Edit2, Eye, ShieldOff } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'

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
  const { t } = useTranslation()
  const getStatusBadge = (status: Customer['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">{t('ACTIVE')}</Badge>
      case 'INACTIVE':
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">{t('INACTIVE')}</Badge>
      case 'BLOCKED':
        return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">{t('BLOCKED')}</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">{status}</Badge>
    }
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-white/20 overflow-hidden w-full">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block bg-gray-800/80 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg border border-white/30 font-mono">
                  {customer.customer_code}
                </span>
                {getStatusBadge(customer.status)}
              </div>
              <h3 className="font-bold text-lg text-white">{customer.full_name}</h3>
              <p className="text-sm text-gray-400">{customer.email}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-3">
        {(customer.phone || customer.address) && (
          <div className="bg-gray-800/60 rounded-xl p-3 border border-white/20 space-y-1">
            {customer.phone && <p className="text-sm text-gray-300">{t('Phone:')} {customer.phone}</p>}
            {customer.address && <p className="text-sm text-gray-300">{t('Address:')} {customer.address}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {onEdit && (
            <Button
              size="sm"
              onClick={() => onEdit(customer)}
              className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/20"
            >
              <Edit2 className="w-3 h-3 mr-1" />
              {t('Edit')}
            </Button>
          )}
          {customer.status === 'ACTIVE' && onDeactivate && (
            <Button
              size="sm"
              onClick={() => onDeactivate(customer)}
              className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/20"
            >
              {t('Deactivate')}
            </Button>
          )}
          {customer.status !== 'BLOCKED' && onBlock && (
            <Button
              size="sm"
              onClick={() => onBlock(customer)}
              className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
            >
              <ShieldOff className="w-3 h-3 mr-1" />
              {t('Block')}
            </Button>
          )}
          {onViewJobs && (
            <Button
              size="sm"
              onClick={() => onViewJobs(customer)}
              className="flex-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30"
            >
              <Eye className="w-3 h-3 mr-1" />
              {t('View Jobs')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
