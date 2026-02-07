'use client'

import { toast } from 'sonner'
import { useEffect, useState, useRef } from 'react'
import type { Customer, Employer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { CustomerChat } from '@/components/customer/CustomerChat'

export default function CustomerMessagesPage() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [employer, setEmployer] = useState<Employer | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadCustomerAndEmployer()
    return () => { isMountedRef.current = false }
  }, [])

  const loadCustomerAndEmployer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please log in to view messages')
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
      toast.error('Failed to load customer or employer profile')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/4"></div>
            <div className="h-96 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!customer || !employer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <p className="text-center text-gray-400">
              Unable to load messaging. Please contact support.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>
        <CustomerChat customer={customer} employer={employer} />
      </div>
    </div>
  )
}
