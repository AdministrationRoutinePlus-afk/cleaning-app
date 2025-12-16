'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type ProfileType = 'EMPLOYER' | 'EMPLOYEE'

export default function LoginPage() {
  const router = useRouter()
  // Login state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Register state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileType, setProfileType] = useState<ProfileType>('EMPLOYEE')
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Convert username to email format for Supabase auth
      const email = username.includes('@') ? username : `${username.toLowerCase()}@cleaning.local`

      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('No user returned from authentication')
      }

      // Check which profile type the user has
      // Check employer
      const { data: employerData } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', authData.user.id)
        .single()

      if (employerData) {
        router.push('/employer/jobs')
        return
      }

      // Check employee
      const { data: employeeData } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', authData.user.id)
        .single()

      if (employeeData) {
        router.push('/employee/marketplace')
        return
      }

      // Check customer
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', authData.user.id)
        .single()

      if (customerData) {
        router.push('/customer/reviews')
        return
      }

      // If no profile found, show error
      setError('No profile found for this account. Please contact support.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegLoading(true)
    setRegError(null)

    // Validation
    if (regPassword !== confirmPassword) {
      setRegError('Passwords do not match')
      setRegLoading(false)
      return
    }

    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters long')
      setRegLoading(false)
      return
    }

    try {
      const supabase = createClient()

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: regPassword,
        options: {
          data: {
            full_name: fullName,
            profile_type: profileType,
          },
        },
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('No user returned from registration')
      }

      // Create profile based on type
      if (profileType === 'EMPLOYER') {
        const { error: profileError } = await supabase
          .from('employers')
          .insert({
            user_id: authData.user.id,
            full_name: fullName,
            email: email,
            phone: '',
          })

        if (profileError) throw profileError

        router.push('/employer/jobs')
      } else if (profileType === 'EMPLOYEE') {
        const { error: profileError } = await supabase
          .from('employees')
          .insert({
            user_id: authData.user.id,
            full_name: fullName,
            email: email,
            phone: '',
            status: 'PENDING',
          })

        if (profileError) throw profileError

        router.push('/employee/pending')
      }
    } catch (err: unknown) {
      console.error('Registration error:', err)
      if (err instanceof Error) {
        setRegError(err.message)
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        setRegError(String((err as { message: unknown }).message))
      } else {
        setRegError('An error occurred during registration')
      }
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-2">
          <Image
            src="/logo-dark.png"
            alt="Groupe ABR | Routine"
            width={300}
            height={230}
            priority
            className="w-auto max-w-[160px]"
          />
        </div>

        {/* LOGIN CARD */}
        <Card className="w-full bg-white/10 backdrop-blur-md border-white/20 mb-6">
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                  className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>
            </CardContent>

            <CardFooter className="pt-4">
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* REGISTER SECTION */}
        <Card className="w-full bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">
                  New Here?
                </h3>
                <p className="text-sm text-gray-300">
                  Join our team today
                </p>
              </div>

              <Link href="/register" className="block">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  Register
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
