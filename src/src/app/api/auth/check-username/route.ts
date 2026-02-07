import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

    if (!username || typeof username !== 'string' || username.length < 2) {
      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 400 }
      )
    }

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

    const authEmail = `${username.toLowerCase()}@cleaning.local`

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUsers?.users?.some(u => u.email === authEmail)

    return NextResponse.json({ available: !userExists })
  } catch (error) {
    console.error('Check username error:', error)
    return NextResponse.json(
      { error: 'Failed to check username' },
      { status: 500 }
    )
  }
}
