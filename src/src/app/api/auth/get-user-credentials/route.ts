import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side API route to get user credentials (username) by user_id
 * Uses service role key to access auth.users table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id } = body

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
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

    // Get user by ID
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id)

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Extract username from email (remove @cleaning.local)
    const email = userData.user.email || ''
    const username = email.replace('@cleaning.local', '')

    return NextResponse.json({
      success: true,
      username: username,
      email: email,
      created_at: userData.user.created_at
    })

  } catch (error) {
    console.error('Get user credentials error:', error)
    return NextResponse.json(
      { error: 'Failed to get user credentials' },
      { status: 500 }
    )
  }
}
