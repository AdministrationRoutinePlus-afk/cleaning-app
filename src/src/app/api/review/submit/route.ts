import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
    const { token, rating, comment } = await request.json()

    if (!token || !rating) {
      return NextResponse.json(
        { error: 'Token and rating are required' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // 1. Validate token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('review_tokens')
      .select(`
        id,
        job_session_id,
        customer_id,
        used_at,
        expires_at
      `)
      .eq('token', token)
      .single()

    if (tokenError || !tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid review link' },
        { status: 404 }
      )
    }

    if (tokenRecord.used_at) {
      return NextResponse.json(
        { error: 'This review has already been submitted' },
        { status: 400 }
      )
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This review link has expired' },
        { status: 400 }
      )
    }

    // 2. Get the job session to find the assigned employee
    const { data: session } = await supabase
      .from('job_sessions')
      .select(`
        assigned_to,
        job_template:job_templates!inner(
          title,
          created_by
        )
      `)
      .eq('id', tokenRecord.job_session_id)
      .single()

    if (!session || !session.assigned_to) {
      return NextResponse.json(
        { error: 'Job session not found or no employee assigned' },
        { status: 400 }
      )
    }

    const jobTemplate = session.job_template as any

    // Sanitize comment
    const sanitizedComment = comment
      ? String(comment).slice(0, 500).trim() || null
      : null

    // 3. Create evaluation record
    const { error: evalError } = await supabase
      .from('evaluations')
      .insert({
        job_session_id: tokenRecord.job_session_id,
        customer_id: tokenRecord.customer_id,
        employee_id: session.assigned_to,
        rating,
        comment: sanitizedComment,
        submitted_at: new Date().toISOString(),
      })

    if (evalError) {
      console.error('Failed to create evaluation:', evalError)
      return NextResponse.json(
        { error: 'Failed to save review' },
        { status: 500 }
      )
    }

    // 4. Update job session status to EVALUATED
    await supabase
      .from('job_sessions')
      .update({ status: 'EVALUATED' })
      .eq('id', tokenRecord.job_session_id)

    // 5. Mark token as used
    await supabase
      .from('review_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id)

    // 6. Notify employer of the review
    const { data: employer } = await supabase
      .from('employers')
      .select('user_id')
      .eq('id', jobTemplate.created_by)
      .single()

    if (employer?.user_id) {
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
      await supabase.from('notifications').insert({
        user_id: employer.user_id,
        user_type: 'EMPLOYER',
        type: 'EVALUATION_SUBMITTED',
        title: `New review: ${stars}`,
        message: `Customer rated "${jobTemplate.title}" — ${rating}/5 stars`,
        related_id: tokenRecord.job_session_id,
        is_read: false,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Review submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
