import { createClient } from '@supabase/supabase-js'
import { ReviewForm } from './ReviewForm'
import { InvalidReviewPage } from './InvalidReviewPage'

interface ReviewPageProps {
  params: Promise<{ token: string }>
}

interface TokenData {
  id: string
  job_session_id: string
  customer_id: string
  used_at: string | null
  expires_at: string
  token: string
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { token } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseServiceKey) {
    return <InvalidReviewPage messageKey="Server configuration error" />
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Validate token
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('review_tokens')
    .select('id, job_session_id, customer_id, used_at, expires_at, token')
    .eq('token', token)
    .single()

  if (tokenError || !tokenRecord) {
    return <InvalidReviewPage messageKey="This review link is not valid." />
  }

  const tokenData = tokenRecord as TokenData

  if (tokenData.used_at) {
    return <InvalidReviewPage messageKey="This review has already been submitted. Thank you!" />
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    return <InvalidReviewPage messageKey="This review link has expired." />
  }

  // Fetch job details for context
  const { data: session } = await supabase
    .from('job_sessions')
    .select(`
      scheduled_date,
      assigned_to,
      job_template:job_templates!inner(title),
      employee:employees!job_sessions_assigned_to_fkey(full_name)
    `)
    .eq('id', tokenData.job_session_id)
    .single()

  const jobTemplate = (session?.job_template as any) || {}
  const employee = (session?.employee as any) || {}

  const jobTitle = jobTemplate.title || null
  const employeeName = employee.full_name || null
  const scheduledDate = session?.scheduled_date || null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ReviewForm
          token={token}
          jobTitle={jobTitle}
          employeeName={employeeName}
          scheduledDate={scheduledDate}
        />
      </div>
    </div>
  )
}
