'use client'

/**
 * Employer Users Management Page (Tab 2)
 *
 * This page manages both employees and customers with the following features:
 *
 * EMPLOYEES:
 * - Three subsections: Active, Pending, Inactive/Blocked
 * - Status management: Activate pending employees, deactivate, block
 * - View Profile: Navigate to detailed employee profile with job history, evaluations, strikes
 *
 * CUSTOMERS:
 * - Customer creation with 3-letter code (e.g., ABC)
 * - Status management: Deactivate, block
 * - View Jobs: Navigate to jobs filtered by customer
 * - Edit customer details
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee, Customer, EmployeeStatus, CustomerStatus, NewCustomer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmployeeCard } from '@/components/employer/EmployeeCard'
import { CustomerCard } from '@/components/employer/CustomerCard'

export default function EmployerUsersPage() {
  const router = useRouter()
  const supabase = createClient()

  // State
  const [employees, setEmployees] = useState<Employee[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [employeeTab, setEmployeeTab] = useState<'active' | 'pending' | 'inactive'>('active')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // New customer form state - includes all fields from the plan
  const [customerForm, setCustomerForm] = useState({
    customer_code: '',
    full_name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''  // Internal notes about the customer
  })

  // Load employees and customers
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false })

      if (employeesError) throw employeesError
      setEmployees(employeesData || [])

      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (customersError) throw customersError
      setCustomers(customersData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter employees by status
  const filteredEmployees = employees.filter((emp) => {
    if (employeeTab === 'active') return emp.status === 'ACTIVE'
    if (employeeTab === 'pending') return emp.status === 'PENDING'
    if (employeeTab === 'inactive') return emp.status === 'INACTIVE' || emp.status === 'BLOCKED'
    return false
  })

  // Employee handlers
  const handleActivateEmployee = async (employee: Employee) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get employer record to use employer.id (not user.id) for FK
      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) {
        console.error('Employer not found')
        return
      }

      const { error } = await supabase
        .from('employees')
        .update({
          status: 'ACTIVE' as EmployeeStatus,
          activated_by: employer.id,
          activated_at: new Date().toISOString()
        })
        .eq('id', employee.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error activating employee:', error)
    }
  }

  const handleDeactivateEmployee = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ status: 'INACTIVE' as EmployeeStatus })
        .eq('id', employee.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deactivating employee:', error)
    }
  }

  // Reactivate an inactive employee (back to ACTIVE status)
  const handleReactivateEmployee = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ status: 'ACTIVE' as EmployeeStatus })
        .eq('id', employee.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error reactivating employee:', error)
    }
  }

  const handleBlockEmployee = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ status: 'BLOCKED' as EmployeeStatus })
        .eq('id', employee.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error blocking employee:', error)
    }
  }

  // Navigate to detailed employee profile page with job history, evaluations, strikes
  const handleViewEmployeeProfile = (employee: Employee) => {
    router.push(`/employer/users/employee/${employee.id}`)
  }

  // Navigate to detailed customer profile page with job history, evaluations, strikes
  const handleEditCustomer = (customer: Customer) => {
    router.push(`/employer/users/customer/${customer.id}`)
  }

  const handleDeactivateCustomer = async (customer: Customer) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ status: 'INACTIVE' as CustomerStatus })
        .eq('id', customer.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deactivating customer:', error)
    }
  }

  const handleBlockCustomer = async (customer: Customer) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ status: 'BLOCKED' as CustomerStatus })
        .eq('id', customer.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error blocking customer:', error)
    }
  }

  // Navigate to customer profile (jobs tab is shown there)
  const handleViewCustomerJobs = (customer: Customer) => {
    router.push(`/employer/users/customer/${customer.id}`)
  }

  // Create new customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Validate customer code (3 letters)
      if (!/^[A-Z]{3}$/.test(customerForm.customer_code)) {
        alert('Customer code must be exactly 3 uppercase letters')
        setSubmitting(false)
        return
      }

      // Get employer record to use employer.id for created_by FK
      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) {
        throw new Error('Employer not found')
      }

      // Create customer record (without auth user for now - can be invited later)
      const { error: customerError } = await supabase
        .from('customers')
        .insert({
          user_id: null, // Customer can be linked to auth user later via invite
          customer_code: customerForm.customer_code.toUpperCase(),
          full_name: customerForm.full_name,
          email: customerForm.email,
          phone: customerForm.phone || null,
          address: customerForm.address || null,
          notes: customerForm.notes || null,  // Internal notes about the customer
          status: 'ACTIVE',
          created_by: employer.id
        })

      if (customerError) throw customerError

      // Reset form and reload
      setCustomerForm({
        customer_code: '',
        full_name: '',
        email: '',
        phone: '',
        address: '',
        notes: ''
      })
      setSheetOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Failed to create customer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
        </div>

        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>

          {/* EMPLOYEES TAB */}
          <TabsContent value="employees" className="space-y-4">
            <Tabs value={employeeTab} onValueChange={(v) => setEmployeeTab(v as typeof employeeTab)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="inactive">Inactive/Blocked</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4 mt-4">
                {filteredEmployees.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No active employees</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredEmployees.map((employee) => (
                      <EmployeeCard
                        key={employee.id}
                        employee={employee}
                        onDeactivate={handleDeactivateEmployee}
                        onBlock={handleBlockEmployee}
                        onViewProfile={handleViewEmployeeProfile}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pending" className="space-y-4 mt-4">
                {filteredEmployees.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No pending employees</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredEmployees.map((employee) => (
                      <EmployeeCard
                        key={employee.id}
                        employee={employee}
                        onActivate={handleActivateEmployee}
                        onBlock={handleBlockEmployee}
                        onViewProfile={handleViewEmployeeProfile}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="inactive" className="space-y-4 mt-4">
                {filteredEmployees.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No inactive/blocked employees</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredEmployees.map((employee) => (
                      <EmployeeCard
                        key={employee.id}
                        employee={employee}
                        onReactivate={handleReactivateEmployee}
                        onViewProfile={handleViewEmployeeProfile}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* CUSTOMERS TAB */}
          <TabsContent value="customers" className="space-y-4">
            <div className="flex justify-end">
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button>Add Customer</Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Create New Customer</SheetTitle>
                    <SheetDescription>
                      Add a new customer to your system. This will create an account for them.
                    </SheetDescription>
                  </SheetHeader>
                  <form onSubmit={handleCreateCustomer} className="space-y-4 mt-6">
                    <div className="space-y-2">
                      <Label htmlFor="customer_code">Customer Code (3 letters)</Label>
                      <Input
                        id="customer_code"
                        placeholder="ABC"
                        maxLength={3}
                        required
                        value={customerForm.customer_code}
                        onChange={(e) => setCustomerForm({ ...customerForm, customer_code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        placeholder="John Doe"
                        required
                        value={customerForm.full_name}
                        onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        required
                        value={customerForm.email}
                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={customerForm.phone}
                        onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        placeholder="123 Main St, City, State"
                        value={customerForm.address}
                        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (optional)</Label>
                      <Input
                        id="notes"
                        placeholder="Internal notes about this customer..."
                        value={customerForm.notes}
                        onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create Customer'}
                    </Button>
                  </form>
                </SheetContent>
              </Sheet>
            </div>

            {customers.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No customers yet</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customers.map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    onEdit={handleEditCustomer}
                    onDeactivate={handleDeactivateCustomer}
                    onBlock={handleBlockCustomer}
                    onViewJobs={handleViewCustomerJobs}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
