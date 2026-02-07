'use client'

import { useState, useEffect } from 'react'
import type { Employee, Customer } from '@/types/database'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { UserX, UserCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

export function AccountManagement() {
  const { t } = useTranslation()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'employees' | 'customers'>('employees')
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .order('full_name')

      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .order('full_name')

      setEmployees(empData || [])
      setCustomers(custData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleEmployeeBlock = async (employee: Employee) => {
    setUpdating(employee.id)
    try {
      const newStatus = employee.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED'
      const { error } = await supabase
        .from('employees')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', employee.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error updating employee:', error)
      toast.error(t('Failed to update employee status'))
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleCustomerBlock = async (customer: Customer) => {
    setUpdating(customer.id)
    try {
      const newStatus = customer.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED'
      const { error } = await supabase
        .from('customers')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', customer.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error updating customer:', error)
      toast.error(t('Failed to update customer status'))
    } finally {
      setUpdating(null)
    }
  }

  const blockedEmployees = employees.filter(e => e.status === 'BLOCKED')
  const activeEmployees = employees.filter(e => e.status !== 'BLOCKED')
  const blockedCustomers = customers.filter(c => c.status === 'BLOCKED')
  const activeCustomers = customers.filter(c => c.status !== 'BLOCKED')

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-white/10 rounded w-1/3"></div>
        <div className="h-10 bg-white/10 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'employees'
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          {t('Employees')}
          {blockedEmployees.length > 0 && (
            <Badge className="ml-2 bg-red-500/20 text-red-300 border border-red-500/30 text-xs">
              {blockedEmployees.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'customers'
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          {t('Customers')}
          {blockedCustomers.length > 0 && (
            <Badge className="ml-2 bg-red-500/20 text-red-300 border border-red-500/30 text-xs">
              {blockedCustomers.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {blockedEmployees.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                {t('Blocked Employees')} ({blockedEmployees.length})
              </Label>
              <div className="space-y-2">
                {blockedEmployees.map(emp => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-white">{emp.full_name}</p>
                      <p className="text-sm text-gray-400">{emp.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleEmployeeBlock(emp)}
                      disabled={updating === emp.id}
                      className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      {updating === emp.id ? t('Unblocking...') : t('Unblock')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-gray-300">{t('Active Employees')} ({activeEmployees.length})</Label>
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">{t('No active employees')}</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activeEmployees.map(emp => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-white">{emp.full_name}</p>
                      <p className="text-sm text-gray-400">{emp.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleEmployeeBlock(emp)}
                      disabled={updating === emp.id}
                      className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                    >
                      <UserX className="w-4 h-4 mr-1" />
                      {updating === emp.id ? t('Blocking...') : t('Block')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          {blockedCustomers.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                {t('Blocked Customers')} ({blockedCustomers.length})
              </Label>
              <div className="space-y-2">
                {blockedCustomers.map(cust => (
                  <div
                    key={cust.id}
                    className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-white">{cust.full_name}</p>
                      <p className="text-sm text-gray-400">{cust.customer_code} - {cust.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleCustomerBlock(cust)}
                      disabled={updating === cust.id}
                      className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      {updating === cust.id ? t('Unblocking...') : t('Unblock')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-gray-300">{t('Active Customers')} ({activeCustomers.length})</Label>
            {activeCustomers.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">{t('No active customers')}</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activeCustomers.map(cust => (
                  <div
                    key={cust.id}
                    className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-white">{cust.full_name}</p>
                      <p className="text-sm text-gray-400">{cust.customer_code} - {cust.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleCustomerBlock(cust)}
                      disabled={updating === cust.id}
                      className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                    >
                      <UserX className="w-4 h-4 mr-1" />
                      {updating === cust.id ? t('Blocking...') : t('Block')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
