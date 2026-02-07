import { createClient } from '@supabase/supabase-js'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side API route to update user password
 * Uses service role key to update auth.users
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
    const { user_id, new_password } = body

    if (!user_id || !new_password) {
      return NextResponse.json(
        { error: 'user_id and new_password are required' },
        { status: 400 }
      )
    }

    if (new_password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
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

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (updateError) {
      console.error('Update password error:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    })

  } catch (error) {
    console.error('Update password error:', error)
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    )
  }
}
