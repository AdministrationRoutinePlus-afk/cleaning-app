import { createClient } from '@supabase/supabase-js'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side API route to create users with username/password
 * Uses service role key to bypass email confirmation
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check: verify caller is authenticated
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user: caller }, error: authCheckError } = await serverSupabase.auth.getUser()
    if (authCheckError || !caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify caller is an employer
    const { data: employerRow } = await serverSupabase
      .from('employers')
      .select('id')
      .eq('user_id', caller.id)
      .single()
    if (!employerRow) {
      return NextResponse.json({ error: 'Forbidden: employer access required' }, { status: 403 })
    }

    const body = await request.json()
    const { username, password, full_name, role } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Use email format for Supabase auth
    const authEmail = `${username.toLowerCase()}@cleaning.local`

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUsers?.users?.some(u => u.email === authEmail)

    if (userExists) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      )
    }

    // Create user with admin API (no email confirmation needed)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: full_name || username,
        role: role || 'employee',
        username: username
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user_id: authData.user?.id
    })

  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
