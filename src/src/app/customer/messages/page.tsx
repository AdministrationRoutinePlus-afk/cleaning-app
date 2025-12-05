'use client'

import { useEffect, useState } from 'react'
import type { Customer, Employer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { CustomerChat } from '@/components/customer/CustomerChat'
import { Card, CardContent } from '@/components/ui/card'

export default function CustomerMessagesPage() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [employer, setEmployer] = useState<Employer | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCustomerAndEmployer()
  }, [])

  const loadCustomerAndEmployer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in to view messages')
        return
      }

      // Get customer profile
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (customerError) throw customerError
      setCustomer(customerData)

      // Get employer who created this customer
      const { data: employerData, error: employerError } = await supabase
        .from('employers')
        .select('*')
        .eq('id', customerData.created_by)
        .single()

      if (employerError) throw employerError
      setEmployer(employerData)
    } catch (error) {
      console.error('Error loading data:', error)
      alert('Failed to load customer or employer profile')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!customer || !employer) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">
                Unable to load messaging. Please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>
        <CustomerChat customer={customer} employer={employer} />
      </div>
    </div>
  )
}
