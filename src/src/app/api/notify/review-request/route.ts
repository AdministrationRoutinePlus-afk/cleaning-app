import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendReviewRequestEmail } from '@/lib/email/resend'
import { format } from 'date-fns'

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Service role key not configured' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { job_session_id } = await request.json()

    if (!job_session_id) {
      return NextResponse.json(
        { error: 'job_session_id is required' },
        { status: 400 }
      )
    }

    // 1. Fetch job session + job template + customer
    const { data: session, error: sessionError } = await supabase
      .from('job_sessions')
      .select(`
        id,
        scheduled_date,
        job_template:job_templates!inner(
          id,
          title,
          created_by,
          customer_id,
          customer:customers(id, full_name, email, user_id)
        )
      `)
      .eq('id', job_session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Job session not found' },
        { status: 404 }
      )
    }

    const jobTemplate = session.job_template as any
    const customer = jobTemplate.customer

    if (!customer) {
      return NextResponse.json(
        { error: 'No customer linked to this job' },
        { status: 400 }
      )
    }

    if (!customer.email) {
      return NextResponse.json(
        { error: 'Customer has no email address' },
        { status: 400 }
      )
    }

    // 2. Check employer settings for email review toggle
    const { data: employerSettings } = await supabase
      .from('employer_settings')
      .select('email_review_enabled')
      .eq('employer_id', jobTemplate.created_by)
      .single()

    // Default to enabled if setting doesn't exist or column not yet added
    const emailReviewEnabled = employerSettings?.email_review_enabled ?? true
    if (!emailReviewEnabled) {
      return NextResponse.json(
        { message: 'Email reviews disabled by employer', skipped: true },
        { status: 200 }
      )
    }

    // 3. Check if review token already exists for this session
    const { data: existingToken } = await supabase
      .from('review_tokens')
      .select('id')
      .eq('job_session_id', job_session_id)
      .maybeSingle()

    if (existingToken) {
      return NextResponse.json(
        { message: 'Review request already sent', skipped: true },
        { status: 200 }
      )
    }

    // 4. Generate and insert review token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('review_tokens')
      .insert({
        job_session_id,
        customer_id: customer.id,
      })
      .select('token')
      .single()

    if (tokenError || !tokenRecord) {
      console.error('Failed to create review token:', tokenError)
      return NextResponse.json(
        { error: 'Failed to create review token' },
        { status: 500 }
      )
    }

    // 5. Build review URL and send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const reviewUrl = `${appUrl}/review/${tokenRecord.token}`

    const scheduledDate = session.scheduled_date
      ? format(new Date(session.scheduled_date + 'T12:00:00'), 'MMMM d, yyyy')
      : 'Recently'

    const emailSent = await sendReviewRequestEmail(
      customer.email,
      customer.full_name,
      jobTemplate.title,
      scheduledDate,
      reviewUrl
    )

    // 6. Create in-app notification for customer (if they have a user account)
    if (customer.user_id) {
      await supabase.from('notifications').insert({
        user_id: customer.user_id,
        user_type: 'CUSTOMER',
        type: 'REVIEW_REQUEST',
        title: 'Please rate your recent cleaning',
        message: `How was "${jobTemplate.title}"? Tap to leave a review.`,
        related_id: job_session_id,
        is_read: false,
      })
    }

    // 7. Create in-app notification for employer
    const { data: employer } = await supabase
      .from('employers')
      .select('user_id')
      .eq('id', jobTemplate.created_by)
      .single()

    if (employer?.user_id) {
      await supabase.from('notifications').insert({
        user_id: employer.user_id,
        user_type: 'EMPLOYER',
        type: 'REVIEW_REQUEST',
        title: 'Review request sent',
        message: `Review request sent to ${customer.full_name} for "${jobTemplate.title}"`,
        related_id: job_session_id,
        is_read: false,
      })
    }

    return NextResponse.json({
      success: true,
      email_sent: emailSent,
      token: tokenRecord.token,
    })
  } catch (error) {
    console.error('Review request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
