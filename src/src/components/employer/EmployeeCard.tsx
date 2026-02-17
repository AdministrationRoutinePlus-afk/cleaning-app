'use client'

/**
 * EmployeeCard Component - Dark Theme
 */

import { useState } from 'react'
import type { Employee, EmployeeWeeklyAvailability } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User, ShieldOff, Eye, CheckCircle, Calendar, MapPin, User as UserIcon, Clock } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useDateFormat } from '@/lib/i18n/useDateFormat'

export interface EmployeeJob {
  id: string
  status: string
  full_job_code: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  title: string
  customer_name: string | null
  address: string | null
}

interface EmployeeCardProps {
  employee: Employee
  jobs?: EmployeeJob[]
  weeklyAvailability?: EmployeeWeeklyAvailability[]
  onActivate?: (employee: Employee) => void
  onReactivate?: (employee: Employee) => void
  onDeactivate?: (employee: Employee) => void
  onBlock?: (employee: Employee) => void
  onViewProfile?: (employee: Employee) => void
}

const JOB_STATUS_CONFIG: { key: string; label: string; badgeBg: string; badgeText: string; tabActiveBg: string }[] = [
  { key: 'OFFERED', label: 'Open', badgeBg: 'bg-gray-500/20', badgeText: 'text-gray-300', tabActiveBg: 'bg-gray-600' },
  { key: 'CLAIMED', label: 'To Confirm', badgeBg: 'bg-yellow-500/20', badgeText: 'text-yellow-300', tabActiveBg: 'bg-yellow-600' },
  { key: 'APPROVED', label: 'Scheduled', badgeBg: 'bg-blue-500/20', badgeText: 'text-blue-300', tabActiveBg: 'bg-blue-600' },
  { key: 'IN_PROGRESS', label: 'In Progress', badgeBg: 'bg-purple-500/20', badgeText: 'text-purple-300', tabActiveBg: 'bg-purple-600' },
  { key: 'COMPLETED', label: 'Completed', badgeBg: 'bg-green-500/20', badgeText: 'text-green-300', tabActiveBg: 'bg-green-600' },
  { key: 'EVALUATED', label: 'Evaluated', badgeBg: 'bg-teal-500/20', badgeText: 'text-teal-300', tabActiveBg: 'bg-teal-600' },
  { key: 'CANCELLED', label: 'Cancelled', badgeBg: 'bg-red-500/20', badgeText: 'text-red-300', tabActiveBg: 'bg-red-600' },
  { key: 'MISSED', label: 'Missed', badgeBg: 'bg-red-500/20', badgeText: 'text-red-300', tabActiveBg: 'bg-red-600' },
]

function getStatusConfig(status: string) {
  return JOB_STATUS_CONFIG.find(s => s.key === status) || JOB_STATUS_CONFIG[0]
}

const DAY_KEYS: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday'
}

export function EmployeeCard({
  employee,
  jobs,
  weeklyAvailability,
  onActivate,
  onReactivate,
  onDeactivate,
  onBlock,
  onViewProfile
}: EmployeeCardProps) {
  const { t } = useTranslation()
  const { formatDate: formatDateLocale } = useDateFormat()
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const getStatusBadge = (status: Employee['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">{t('ACTIVE')}</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">{t('PENDING')}</Badge>
      case 'INACTIVE':
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">{t('INACTIVE')}</Badge>
      case 'BLOCKED':
        return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">{t('BLOCKED')}</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">{status}</Badge>
    }
  }

  // Group jobs by status
  const jobsByStatus: Record<string, EmployeeJob[]> = {}
  if (jobs) {
    for (const job of jobs) {
      if (!jobsByStatus[job.status]) jobsByStatus[job.status] = []
      jobsByStatus[job.status].push(job)
    }
  }

  const hasJobs = jobs && jobs.length > 0
  const activeStatuses = JOB_STATUS_CONFIG.filter(s => jobsByStatus[s.key]?.length > 0)

  // Only show tab content when explicitly clicked
  const selectedTab = activeTab && jobsByStatus[activeTab] ? activeTab : null
  const selectedConfig = selectedTab ? getStatusConfig(selectedTab) : null
  const selectedJobs = selectedTab ? jobsByStatus[selectedTab] || [] : []

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
        {/* Jobs Section */}
        <div className="bg-gray-800/60 rounded-xl border border-white/10 overflow-hidden">
          {hasJobs ? (
            <>
              {/* Status Tabs */}
              <div className="flex gap-1.5 p-2 overflow-x-auto">
                {activeStatuses.map(s => {
                  const count = jobsByStatus[s.key]?.length || 0
                  const isActive = selectedTab === s.key
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActiveTab(activeTab === s.key ? null : s.key)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        isActive
                          ? `${s.tabActiveBg} text-white shadow-lg`
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                      }`}
                    >
                      {t(s.label)}
                      {count > 0 && (
                        <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-white/20' : 'bg-white/10'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Job Cards */}
              {selectedTab && selectedJobs.length > 0 && (
                <div className="px-2 pb-2 space-y-2 max-h-64 overflow-y-auto">
                  {selectedJobs.map(job => (
                    <div key={job.id} className="bg-gray-900/60 rounded-lg p-3 border-l-2 border-white/20 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-white font-bold text-sm">{job.full_job_code || '---'}</p>
                          <p className="text-gray-400 text-xs">{job.title}</p>
                        </div>
                        {selectedConfig && (
                          <Badge className={`${selectedConfig.badgeBg} ${selectedConfig.badgeText} border-0 text-[10px] shrink-0`}>
                            {t(selectedConfig.label)}
                          </Badge>
                        )}
                      </div>
                      {job.scheduled_date && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>
                            {formatDateLocale(new Date(job.scheduled_date + 'T00:00:00'), 'MMM d, yyyy')}
                            {job.scheduled_time && `  at ${job.scheduled_time.slice(0, 5)}`}
                          </span>
                        </div>
                      )}
                      {job.address && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{job.address}</span>
                        </div>
                      )}
                      {job.customer_name && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <UserIcon className="w-3 h-3 shrink-0" />
                          <span>{job.customer_name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500 text-center py-3">{t('No jobs assigned')}</p>
          )}
        </div>

        {/* Availability Section */}
        <div className="bg-gray-800/60 rounded-xl border border-white/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{t('Availability')}</span>
            </div>
            {employee.availability_mode && (
              <Badge className={`text-[10px] ${
                employee.availability_mode === 'fixed'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
              }`}>
                {employee.availability_mode === 'fixed' ? t('Fixed') : t('Custom')}
              </Badge>
            )}
          </div>
          {employee.availability_mode === 'fixed' && weeklyAvailability && weeklyAvailability.length > 0 ? (
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map(day => {
                const avail = weeklyAvailability.find(a => a.day_of_week === day)
                const isAvailable = avail?.is_available
                return (
                  <div
                    key={day}
                    className={`text-center rounded-lg py-1.5 px-0.5 ${
                      isAvailable
                        ? 'bg-green-500/15 border border-green-500/30'
                        : 'bg-white/5 border border-white/5'
                    }`}
                  >
                    <p className={`text-[10px] font-bold ${isAvailable ? 'text-green-300' : 'text-gray-600'}`}>
                      {t(DAY_KEYS[day]).slice(0, 3)}
                    </p>
                    {isAvailable && avail?.start_time && avail?.end_time && (
                      <p className="text-[9px] text-green-400/80 mt-0.5">
                        {avail.start_time.slice(0, 5)}-{avail.end_time.slice(0, 5)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : employee.availability_mode === 'custom' ? (
            <p className="text-xs text-gray-500">{t('Custom schedule set by employee')}</p>
          ) : (
            <p className="text-xs text-gray-500">{t('Not configured')}</p>
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
              {t('Activate')}
            </Button>
          )}
          {employee.status === 'INACTIVE' && onReactivate && (
            <Button
              size="sm"
              onClick={() => onReactivate(employee)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('Reactivate')}
            </Button>
          )}
          {employee.status === 'ACTIVE' && onDeactivate && (
            <Button
              size="sm"
              onClick={() => onDeactivate(employee)}
              className="flex-1 bg-white/10 border border-white/30 text-white hover:bg-white/20"
            >
              {t('Deactivate')}
            </Button>
          )}
          {employee.status !== 'BLOCKED' && onBlock && (
            <Button
              size="sm"
              onClick={() => onBlock(employee)}
              className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
            >
              <ShieldOff className="w-3 h-3 mr-1" />
              {t('Block')}
            </Button>
          )}
          {onViewProfile && (
            <Button
              size="sm"
              onClick={() => onViewProfile(employee)}
              className="flex-1 bg-white/10 border border-white/30 text-white hover:bg-white/20"
            >
              <Eye className="w-3 h-3 mr-1" />
              {t('View Profile')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
