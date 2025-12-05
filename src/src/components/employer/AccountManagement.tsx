'use client'

import { useState, useEffect } from 'react'
import type { Employee, Customer } from '@/types/database'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { UserX, UserCheck, AlertTriangle } from 'lucide-react'

export function AccountManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load all employees (including blocked)
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .order('full_name')

      // Load all customers (including blocked)
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
      alert('Failed to update employee status')
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
      alert('Failed to update customer status')
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
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Management</CardTitle>
        <CardDescription>Block or unblock employees and customers</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="employees" className="text-sm">
              Employees
              {blockedEmployees.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {blockedEmployees.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="customers" className="text-sm">
              Customers
              {blockedCustomers.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {blockedCustomers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            {/* Blocked Employees */}
            {blockedEmployees.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  Blocked Employees ({blockedEmployees.length})
                </Label>
                <div className="space-y-2">
                  {blockedEmployees.map(emp => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{emp.full_name}</p>
                        <p className="text-sm text-gray-500">{emp.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleEmployeeBlock(emp)}
                        disabled={updating === emp.id}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        {updating === emp.id ? 'Unblocking...' : 'Unblock'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Employees */}
            <div className="space-y-2">
              <Label>Active Employees ({activeEmployees.length})</Label>
              {activeEmployees.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No active employees</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activeEmployees.map(emp => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{emp.full_name}</p>
                        <p className="text-sm text-gray-500">{emp.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleEmployeeBlock(emp)}
                        disabled={updating === emp.id}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        {updating === emp.id ? 'Blocking...' : 'Block'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            {/* Blocked Customers */}
            {blockedCustomers.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  Blocked Customers ({blockedCustomers.length})
                </Label>
                <div className="space-y-2">
                  {blockedCustomers.map(cust => (
                    <div
                      key={cust.id}
                      className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{cust.full_name}</p>
                        <p className="text-sm text-gray-500">{cust.customer_code} - {cust.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleCustomerBlock(cust)}
                        disabled={updating === cust.id}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        {updating === cust.id ? 'Unblocking...' : 'Unblock'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Customers */}
            <div className="space-y-2">
              <Label>Active Customers ({activeCustomers.length})</Label>
              {activeCustomers.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No active customers</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activeCustomers.map(cust => (
                    <div
                      key={cust.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{cust.full_name}</p>
                        <p className="text-sm text-gray-500">{cust.customer_code} - {cust.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleCustomerBlock(cust)}
                        disabled={updating === cust.id}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        {updating === cust.id ? 'Blocking...' : 'Block'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
