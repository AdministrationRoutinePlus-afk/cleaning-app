'use client'

import { toast } from 'sonner'
import { useEffect, useState, useRef } from 'react'
import type { Customer, Employer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { CustomerChat } from '@/components/customer/CustomerChat'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function CustomerMessagesPage() {
  const { t } = useTranslation()
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
        toast.error(t('Please log in to view messages'))
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
      const { data: employerData } = await supabase
        .from('employers')
        .select('*')
        .eq('id', customerData.created_by)
        .maybeSingle()

      if (isMountedRef.current && employerData) {
        setEmployer(employerData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error(t('Failed to load customer or employer profile'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="max-w-lg mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/4"></div>
            <div className="h-96 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <p className="text-center text-gray-400">
              {t('Customer profile not found. Please contact support.')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!employer) {
    return (
      <div className="p-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">{t('Messages')}</h1>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <p className="text-center text-gray-400">
              {t('Chat Not Available')}
            </p>
            <p className="text-center text-gray-500 text-sm mt-2">
              {t('Unable to load messaging. Please contact support.')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">{t('Messages')}</h1>
        <CustomerChat customer={customer} employer={employer} />
      </div>
    </div>
  )
}
