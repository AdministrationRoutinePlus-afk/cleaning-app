'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function EmployeePendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4 py-12 pb-20">
      <div className="w-full max-w-md text-center bg-white/5 border border-white/10 rounded-xl">
        <div className="p-6 space-y-4">
          <div className="mx-auto w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            Registration Pending
          </h2>
          <p className="text-base text-gray-300">
            Your account has been created successfully!
          </p>
        </div>
        <div className="px-6 pb-4 space-y-4">
          <p className="text-gray-300">
            An employer needs to activate your account before you can access the marketplace and start claiming jobs.
          </p>
          <p className="text-sm text-gray-400">
            You will be notified once your account is activated.
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-4">
          <Link href="/login" className="w-full">
            <Button className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20">
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
