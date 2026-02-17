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

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee, Customer, EmployeeStatus, CustomerStatus, NewCustomer, EmployeeWeeklyAvailability } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmployeeCard } from '@/components/employer/EmployeeCard'
import { CustomerCard } from '@/components/employer/CustomerCard'
import { Plus, Users, Building2 } from 'lucide-react'
import { cleanupStaleSessions } from '@/lib/jobs/cleanupStaleSessions'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function EmployerUsersPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  // State
  const [employees, setEmployees] = useState<Employee[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employeeJobs, setEmployeeJobs] = useState<Map<string, Array<{ id: string; status: string; full_job_code: string | null; scheduled_date: string | null; scheduled_time: string | null; title: string; customer_name: string | null; address: string | null }>>>(new Map())
  const [employeeAvailability, setEmployeeAvailability] = useState<Map<string, EmployeeWeeklyAvailability[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [activeMainTab, setActiveMainTab] = useState<'employees' | 'customers'>('employees')
  const [employeeTab, setEmployeeTab] = useState<'active' | 'pending' | 'inactive'>('active')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // New customer form state
  const [customerForm, setCustomerForm] = useState({
    customer_code: '',
    full_name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    create_account: false,
    username: '',
    password: ''
  })

  // New employee form state
  const [employeeSheetOpen, setEmployeeSheetOpen] = useState(false)
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    create_account: false,
    username: '',
    password: ''
  })

  // Load employees and customers
  useEffect(() => {
    isMountedRef.current = true
    loadData()
    return () => { isMountedRef.current = false }
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Cleanup stale sessions before fetching
      await cleanupStaleSessions(supabase)

      // Get current employer
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) return

      // Load employees scoped to this employer
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .eq('created_by', employer.id)
        .order('created_at', { ascending: false })

      if (employeesError) throw employeesError
      setEmployees(employeesData || [])

      // Load weekly availability for all employees
      const employeeIds = (employeesData || []).map(e => e.id)
      if (employeeIds.length > 0) {
        const { data: availData } = await supabase
          .from('employee_weekly_availability')
          .select('*')
          .in('employee_id', employeeIds)
          .order('day_of_week')
        const availMap = new Map<string, EmployeeWeeklyAvailability[]>()
        for (const row of availData || []) {
          if (!availMap.has(row.employee_id)) availMap.set(row.employee_id, [])
          availMap.get(row.employee_id)!.push(row)
        }
        setEmployeeAvailability(availMap)
      }

      // Load job sessions with details for employee cards, scoped to this employer's jobs
      const { data: jobSessionsData, error: jobSessionsError } = await supabase
        .from('job_sessions')
        .select(`
          id, assigned_to, status, full_job_code, scheduled_date, scheduled_time,
          job_template:job_templates!inner(title, address, created_by, customer:customers(full_name))
        `)
        .eq('job_template.created_by', employer.id)
        .not('assigned_to', 'is', null)

      if (jobSessionsError) throw jobSessionsError

      const jobsMap = new Map<string, Array<{ id: string; status: string; full_job_code: string | null; scheduled_date: string | null; scheduled_time: string | null; title: string; customer_name: string | null; address: string | null }>>()
      for (const session of jobSessionsData || []) {
        if (!session.assigned_to) continue
        if (!jobsMap.has(session.assigned_to)) {
          jobsMap.set(session.assigned_to, [])
        }
        const template = session.job_template as any
        jobsMap.get(session.assigned_to)!.push({
          id: session.id,
          status: session.status,
          full_job_code: session.full_job_code,
          scheduled_date: session.scheduled_date,
          scheduled_time: session.scheduled_time,
          title: template?.title || 'Untitled',
          customer_name: template?.customer?.full_name || null,
          address: template?.address || null,
        })
      }
      setEmployeeJobs(jobsMap)

      // Load customers scoped to this employer
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('created_by', employer.id)
        .order('created_at', { ascending: false })

      if (customersError) throw customersError
      setCustomers(customersData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error(t('Failed to load users'))
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
      toast.error(t('Failed to activate employee'))
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
      toast.error(t('Failed to deactivate employee'))
    }
  }

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
      toast.error(t('Failed to reactivate employee'))
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
      toast.error(t('Failed to block employee'))
    }
  }

  const handleViewEmployeeProfile = (employee: Employee) => {
    router.push(`/employer/users/employee/${employee.id}`)
  }

  // Create new employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) throw new Error('Employer not found')

      let authUserId: string | null = null

      if (employeeForm.create_account && employeeForm.username && employeeForm.password) {
        const response = await fetch('/api/auth/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: employeeForm.username,
            password: employeeForm.password,
            full_name: employeeForm.full_name,
            role: 'employee'
          })
        })

        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create account')
        }
        authUserId = result.user_id
      }

      const { error: employeeError } = await supabase
        .from('employees')
        .insert({
          user_id: authUserId,
          full_name: employeeForm.full_name,
          email: employeeForm.email || `${employeeForm.username || 'employee'}@cleaning.local`,
          phone: employeeForm.phone || null,
          address: employeeForm.address || null,
          notes: employeeForm.notes || null,
          status: 'ACTIVE',
          created_by: employer.id
        })

      if (employeeError) throw employeeError

      setEmployeeForm({
        full_name: '',
        email: '',
        phone: '',
        address: '',
        notes: '',
        create_account: false,
        username: '',
        password: ''
      })
      setEmployeeSheetOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error creating employee:', error)
      toast.error(t('Failed to create employee. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

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
      toast.error(t('Failed to deactivate customer'))
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
      toast.error(t('Failed to block customer'))
    }
  }

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

      if (!/^[A-Z]{3}$/.test(customerForm.customer_code)) {
        toast.error(t('Customer code must be exactly 3 uppercase letters'))
        setSubmitting(false)
        return
      }

      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) throw new Error('Employer not found')

      // Check for duplicate customer code
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('customer_code', customerForm.customer_code.toUpperCase())
        .eq('created_by', employer.id)
        .limit(1)
        .single()

      if (existingCustomer) {
        toast.error(t('Customer code already exists'))
        setSubmitting(false)
        return
      }

      let authUserId: string | null = null

      if (customerForm.create_account && customerForm.username && customerForm.password) {
        const response = await fetch('/api/auth/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: customerForm.username,
            password: customerForm.password,
            full_name: customerForm.full_name,
            role: 'customer'
          })
        })

        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create account')
        }
        authUserId = result.user_id
      }

      const { error: customerError } = await supabase
        .from('customers')
        .insert({
          user_id: authUserId,
          customer_code: customerForm.customer_code.toUpperCase(),
          full_name: customerForm.full_name,
          email: customerForm.email || null,
          phone: customerForm.phone || null,
          address: customerForm.address || null,
          notes: customerForm.notes || null,
          status: 'ACTIVE',
          created_by: employer.id
        })

      if (customerError) throw customerError

      setCustomerForm({
        customer_code: '',
        full_name: '',
        email: '',
        phone: '',
        address: '',
        notes: '',
        create_account: false,
        username: '',
        password: ''
      })
      setSheetOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error creating customer:', error)
      toast.error(t('Failed to create customer. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  const employeeSubTabs: { value: typeof employeeTab; label: string }[] = [
    { value: 'active', label: t('Active') },
    { value: 'pending', label: t('Pending') },
    { value: 'inactive', label: t('Inactive') },
  ]

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">{t('Users')}</h1>
        </div>

        {/* Main Tabs: Employees / Customers */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveMainTab('employees')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeMainTab === 'employees'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            {t('Employees')}
          </button>
          <button
            onClick={() => setActiveMainTab('customers')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeMainTab === 'customers'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
            }`}
          >
            <Building2 className="w-4 h-4" />
            {t('Customers')}
          </button>
        </div>

        {/* EMPLOYEES TAB */}
        {activeMainTab === 'employees' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Sheet open={employeeSheetOpen} onOpenChange={setEmployeeSheetOpen}>
                <SheetTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-1" />
                    {t('Add Employee')}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-gray-900 border-white/20">
                  <SheetHeader>
                    <SheetTitle className="text-white">{t('Create New Employee')}</SheetTitle>
                    <SheetDescription className="text-gray-400">
                      {t('Add a new employee to your team. Optionally create login credentials.')}
                    </SheetDescription>
                  </SheetHeader>
                  <form onSubmit={handleCreateEmployee} className="space-y-4 mt-6">
                    <div className="space-y-2">
                      <Label htmlFor="emp_full_name" className="text-gray-300">{t('Full Name')} *</Label>
                      <Input
                        id="emp_full_name"
                        placeholder="John Doe"
                        required
                        value={employeeForm.full_name}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emp_email" className="text-gray-300">{t('Email')}</Label>
                      <Input
                        id="emp_email"
                        type="email"
                        placeholder="john@example.com"
                        value={employeeForm.email}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emp_phone" className="text-gray-300">{t('Phone')}</Label>
                      <Input
                        id="emp_phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={employeeForm.phone}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emp_address" className="text-gray-300">{t('Address')}</Label>
                      <Input
                        id="emp_address"
                        placeholder="123 Main St, City, State"
                        value={employeeForm.address}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emp_notes" className="text-gray-300">{t('Notes (optional)')}</Label>
                      <Input
                        id="emp_notes"
                        placeholder="Internal notes..."
                        value={employeeForm.notes}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, notes: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>

                    {/* Account Section */}
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <input
                          type="checkbox"
                          id="emp_create_account"
                          checked={employeeForm.create_account}
                          onChange={(e) => setEmployeeForm({ ...employeeForm, create_account: e.target.checked })}
                          className="h-4 w-4 rounded border-white/20 bg-white/5"
                        />
                        <Label htmlFor="emp_create_account" className="font-medium text-gray-300">{t('Create login account')}</Label>
                      </div>

                      {employeeForm.create_account && (
                        <div className="space-y-4 pl-6 border-l-2 border-blue-500/30">
                          <div className="space-y-2">
                            <Label htmlFor="emp_username" className="text-gray-300">{t('Username')} *</Label>
                            <Input
                              id="emp_username"
                              placeholder="johndoe"
                              required={employeeForm.create_account}
                              value={employeeForm.username}
                              onChange={(e) => setEmployeeForm({ ...employeeForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="emp_password" className="text-gray-300">{t('Password')} *</Label>
                            <Input
                              id="emp_password"
                              type="password"
                              placeholder="Minimum 6 characters"
                              required={employeeForm.create_account}
                              minLength={6}
                              value={employeeForm.password}
                              onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={submitting}>
                      {submitting ? t('Creating...') : t('Create Employee')}
                    </Button>
                  </form>
                </SheetContent>
              </Sheet>
            </div>

            {/* Employee Sub-Tabs */}
            <div className="flex gap-2">
              {employeeSubTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setEmployeeTab(tab.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    employeeTab === tab.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Employee List */}
            {filteredEmployees.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {t('No')} {employeeTab === 'inactive' ? t('inactive/blocked') : t(employeeTab)} {t('employees')}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEmployees.map((employee) => (
                  <EmployeeCard
                    key={employee.id}
                    employee={employee}
                    jobs={employeeJobs.get(employee.id)}
                    weeklyAvailability={employeeAvailability.get(employee.id)}
                    onActivate={employeeTab === 'pending' ? handleActivateEmployee : undefined}
                    onDeactivate={employeeTab === 'active' ? handleDeactivateEmployee : undefined}
                    onReactivate={employeeTab === 'inactive' ? handleReactivateEmployee : undefined}
                    onBlock={employeeTab !== 'inactive' ? handleBlockEmployee : undefined}
                    onViewProfile={handleViewEmployeeProfile}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* CUSTOMERS TAB */}
        {activeMainTab === 'customers' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-1" />
                    {t('Add Customer')}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-gray-900 border-white/20">
                  <SheetHeader>
                    <SheetTitle className="text-white">{t('Create New Customer')}</SheetTitle>
                    <SheetDescription className="text-gray-400">
                      {t('Add a new customer to your system. This will create an account for them.')}
                    </SheetDescription>
                  </SheetHeader>
                  <form onSubmit={handleCreateCustomer} className="space-y-4 mt-6">
                    <div className="space-y-2">
                      <Label htmlFor="customer_code" className="text-gray-300">{t('Customer Code (3 letters)')}</Label>
                      <Input
                        id="customer_code"
                        placeholder="ABC"
                        maxLength={3}
                        required
                        value={customerForm.customer_code}
                        onChange={(e) => setCustomerForm({ ...customerForm, customer_code: e.target.value.toUpperCase() })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-gray-300">{t('Full Name')}</Label>
                      <Input
                        id="full_name"
                        placeholder="John Doe"
                        required
                        value={customerForm.full_name}
                        onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-300">{t('Email (optional)')}</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={customerForm.email}
                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-gray-300">{t('Phone')}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={customerForm.phone}
                        onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-gray-300">{t('Address')}</Label>
                      <Input
                        id="address"
                        placeholder="123 Main St, City, State"
                        value={customerForm.address}
                        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-gray-300">{t('Notes (optional)')}</Label>
                      <Input
                        id="notes"
                        placeholder="Internal notes about this customer..."
                        value={customerForm.notes}
                        onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>

                    {/* Account Section */}
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <input
                          type="checkbox"
                          id="cust_create_account"
                          checked={customerForm.create_account}
                          onChange={(e) => setCustomerForm({ ...customerForm, create_account: e.target.checked })}
                          className="h-4 w-4 rounded border-white/20 bg-white/5"
                        />
                        <Label htmlFor="cust_create_account" className="font-medium text-gray-300">{t('Create login account')}</Label>
                      </div>

                      {customerForm.create_account && (
                        <div className="space-y-4 pl-6 border-l-2 border-blue-500/30">
                          <div className="space-y-2">
                            <Label htmlFor="cust_username" className="text-gray-300">{t('Username')} *</Label>
                            <Input
                              id="cust_username"
                              placeholder="johndoe"
                              required={customerForm.create_account}
                              value={customerForm.username}
                              onChange={(e) => setCustomerForm({ ...customerForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cust_password" className="text-gray-300">{t('Password')} *</Label>
                            <Input
                              id="cust_password"
                              type="password"
                              placeholder="Minimum 6 characters"
                              required={customerForm.create_account}
                              minLength={6}
                              value={customerForm.password}
                              onChange={(e) => setCustomerForm({ ...customerForm, password: e.target.value })}
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={submitting}>
                      {submitting ? t('Creating...') : t('Create Customer')}
                    </Button>
                  </form>
                </SheetContent>
              </Sheet>
            </div>

            {customers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t('No customers yet')}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
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
          </div>
        )}
      </div>
    </div>
  )
}
