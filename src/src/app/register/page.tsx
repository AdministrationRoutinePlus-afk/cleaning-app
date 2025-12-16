'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface RegistrationData {
  fullName: string
  username: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  address: string
  previousWork: string
  workDuration: string
  hoursPerWeek: string
  expectedSalary: string
  availability: string[]
  resumeFile: File | null
  documentsFiles: File[]
}

export default function RegisterPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 12
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form data
  const [data, setData] = useState<RegistrationData>({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    previousWork: '',
    workDuration: '',
    hoursPerWeek: '',
    expectedSalary: '',
    availability: [],
    resumeFile: null,
    documentsFiles: []
  })

  const handleNext = () => {
    setError(null)
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSkip = () => {
    setError(null)
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    setError(null)
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleAvailabilityToggle = (value: string) => {
    setData(prev => ({
      ...prev,
      availability: prev.availability.includes(value)
        ? prev.availability.filter(v => v !== value)
        : [...prev.availability, value]
    }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      // Validation
      if (!data.fullName || !data.username || !data.password) {
        setError('Please provide at least name, username, and password')
        setLoading(false)
        return
      }

      if (data.password !== data.confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }

      if (data.password.length < 6) {
        setError('Password must be at least 6 characters long')
        setLoading(false)
        return
      }

      // Create auth user using API endpoint
      const createUserResponse = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          full_name: data.fullName,
          role: 'employee'
        })
      })

      const createUserResult = await createUserResponse.json()
      if (!createUserResponse.ok) {
        throw new Error(createUserResult.error || 'Failed to create account')
      }

      const userId = createUserResult.user_id
      if (!userId) {
        throw new Error('No user ID returned from registration')
      }

      // Create employee profile
      const supabase = createClient()
      const { error: profileError } = await supabase
        .from('employees')
        .insert({
          user_id: userId,
          full_name: data.fullName,
          email: data.email || null,
          phone: data.phone || '',
          address: data.address || null,
          notes: [
            data.previousWork ? `Previous Work: ${data.previousWork}` : '',
            data.workDuration ? `Duration: ${data.workDuration}` : '',
            data.hoursPerWeek ? `Hours/Week: ${data.hoursPerWeek}` : '',
            data.expectedSalary ? `Expected Salary: ${data.expectedSalary}` : '',
            data.availability.length > 0 ? `Availability: ${data.availability.join(', ')}` : ''
          ].filter(Boolean).join('\n') || null,
          status: 'PENDING',
        })

      if (profileError) throw profileError

      // TODO: Upload resume and documents to storage if provided

      // Auto-login the user
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: `${data.username.toLowerCase()}@cleaning.local`,
        password: data.password,
      })

      if (loginError) {
        console.error('Auto-login failed:', loginError)
        // Don't throw - registration was successful, just redirect to login
        router.push('/login')
        return
      }

      router.push('/employee/pending')
    } catch (err: unknown) {
      console.error('Registration error:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        setError(String((err as { message: unknown }).message))
      } else {
        setError('An error occurred during registration')
      }
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <Label htmlFor="fullName" className="text-gray-300 text-lg">What's your full name?</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={data.fullName}
              onChange={(e) => setData({ ...data, fullName: e.target.value })}
              disabled={loading}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg py-6"
            />
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <Label htmlFor="username" className="text-gray-300 text-lg">Choose a username</Label>
            <Input
              id="username"
              type="text"
              placeholder="johndoe"
              value={data.username}
              onChange={(e) => setData({ ...data, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
              disabled={loading}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg py-6"
            />
            <p className="text-xs text-gray-400">Only lowercase letters and numbers allowed</p>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <Label htmlFor="email" className="text-gray-300 text-lg">What's your email address? (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              disabled={loading}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg py-6"
            />
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <Label htmlFor="phone" className="text-gray-300 text-lg">What's your phone number?</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={data.phone}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
              disabled={loading}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg py-6"
            />
          </div>
        )

      case 5:
        return (
          <div className="space-y-4">
            <Label htmlFor="password" className="text-gray-300 text-lg">Create a password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={data.password}
              onChange={(e) => setData({ ...data, password: e.target.value })}
              disabled={loading}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg py-6 mb-3"
            />
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm password"
              value={data.confirmPassword}
              onChange={(e) => setData({ ...data, confirmPassword: e.target.value })}
              disabled={loading}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg py-6"
            />
          </div>
        )

      case 6:
        return (
          <div className="space-y-4">
            <Label htmlFor="address" className="text-gray-300 text-lg">What's your address?</Label>
            <Textarea
              id="address"
              placeholder="Street, City, State, ZIP"
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              disabled={loading}
              rows={4}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg"
            />
          </div>
        )

      case 7:
        return (
          <div className="space-y-4">
            <Label htmlFor="previousWork" className="text-gray-300 text-lg">What previous work experience do you have?</Label>
            <Textarea
              id="previousWork"
              placeholder="Tell us about your cleaning or related experience..."
              value={data.previousWork}
              onChange={(e) => setData({ ...data, previousWork: e.target.value })}
              disabled={loading}
              rows={5}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg"
            />
          </div>
        )

      case 8:
        return (
          <div className="space-y-4">
            <Label htmlFor="workDuration" className="text-gray-300 text-lg">How much time did you spend at your previous job?</Label>
            <Input
              id="workDuration"
              type="text"
              placeholder="e.g., 2 years, 6 months..."
              value={data.workDuration}
              onChange={(e) => setData({ ...data, workDuration: e.target.value })}
              disabled={loading}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg py-6"
            />
          </div>
        )

      case 9:
        return (
          <div className="space-y-4">
            <Label className="text-gray-300 text-lg">How many hours per week do you want to work?</Label>
            <div className="space-y-3">
              {['10-20 hours', '20-30 hours', '30-40 hours', '40+ hours'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setData({ ...data, hoursPerWeek: option })}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    data.hoursPerWeek === option
                      ? 'bg-blue-600 text-white border-2 border-blue-500'
                      : 'bg-white/5 text-gray-300 border-2 border-white/20 hover:bg-white/10'
                  }`}
                  disabled={loading}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )

      case 10:
        return (
          <div className="space-y-4">
            <Label htmlFor="expectedSalary" className="text-gray-300 text-lg">What salary do you find acceptable?</Label>
            <Input
              id="expectedSalary"
              type="text"
              placeholder="e.g., $20/hour or $800/week"
              value={data.expectedSalary}
              onChange={(e) => setData({ ...data, expectedSalary: e.target.value })}
              disabled={loading}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-lg py-6"
            />
          </div>
        )

      case 11:
        return (
          <div className="space-y-4">
            <Label className="text-gray-300 text-lg">When are you available to work?</Label>
            <div className="space-y-3">
              {[
                { value: 'morning', label: 'Morning (6am-12pm)' },
                { value: 'day', label: 'Day (12pm-6pm)' },
                { value: 'evening', label: 'Evening (6pm-10pm)' },
                { value: 'night', label: 'Night (10pm-6am)' },
                { value: 'weekends', label: 'Weekends' }
              ].map((option) => (
                <div
                  key={option.value}
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    data.availability.includes(option.value)
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-white/5 border-white/20 hover:bg-white/10'
                  }`}
                  onClick={() => handleAvailabilityToggle(option.value)}
                >
                  <Checkbox
                    id={option.value}
                    checked={data.availability.includes(option.value)}
                    onCheckedChange={() => handleAvailabilityToggle(option.value)}
                    disabled={loading}
                    className="border-white/30"
                  />
                  <label htmlFor={option.value} className="text-gray-300 text-base cursor-pointer flex-1">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )

      case 12:
        return (
          <div className="space-y-4">
            <Label htmlFor="resume" className="text-gray-300 text-lg">Upload your resume (optional)</Label>
            <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-white/40 transition-colors">
              <Input
                id="resume"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setData({ ...data, resumeFile: e.target.files?.[0] || null })}
                disabled={loading}
                className="bg-white/5 border-white/20 text-white"
              />
              {data.resumeFile && (
                <p className="text-green-400 mt-2 text-sm">✓ {data.resumeFile.name}</p>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-dark.png"
            alt="Groupe ABR | Routine"
            width={300}
            height={230}
            priority
            className="w-auto max-w-[280px]"
          />
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Card */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Employee Registration</CardTitle>
          </CardHeader>

          <CardContent className="min-h-[300px]">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {renderStep()}
          </CardContent>

          <CardFooter className="flex justify-between gap-3">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={loading}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}

            <div className="flex gap-3 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={loading}
                className="bg-white/10 border-white/20 text-gray-300 hover:bg-white/20"
              >
                Skip
              </Button>

              <Button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Processing...' : currentStep === totalSteps ? 'Submit' : 'Next'}
                {currentStep < totalSteps && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
