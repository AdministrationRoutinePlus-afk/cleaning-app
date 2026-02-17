import { Resend } from 'resend'

function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendReviewRequestEmail(
  to: string,
  customerName: string,
  jobTitle: string,
  scheduledDate: string,
  reviewUrl: string
): Promise<boolean> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'

  try {
    const { error } = await getResendClient().emails.send({
      from: fromEmail,
      to,
      subject: `How was your cleaning? Rate "${jobTitle}"`,
      html: buildReviewEmailHtml(customerName, jobTitle, scheduledDate, reviewUrl),
    })

    if (error) {
      console.error('Resend error:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Failed to send review email:', err)
    return false
  }
}

function buildReviewEmailHtml(
  customerName: string,
  jobTitle: string,
  scheduledDate: string,
  reviewUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#1f2937;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;">
              <div style="font-size:36px;margin-bottom:16px;">&#10024;</div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                How was your cleaning?
              </h1>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:14px;">
                Hi ${customerName}, we&rsquo;d love your feedback
              </p>
            </td>
          </tr>

          <!-- Job Info -->
          <tr>
            <td style="padding:0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:12px;">
                <tr>
                  <td style="padding:16px;">
                    <div style="color:#60a5fa;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                      Service completed
                    </div>
                    <div style="color:#ffffff;font-size:16px;font-weight:600;margin-bottom:4px;">
                      ${jobTitle}
                    </div>
                    <div style="color:#9ca3af;font-size:13px;">
                      ${scheduledDate}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${reviewUrl}" style="display:inline-block;padding:14px 32px;background-color:#3b82f6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:12px;">
                      Rate Your Experience
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;color:#6b7280;font-size:12px;text-align:center;">
                This link expires in 14 days
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.1);">
              <p style="margin:0;color:#6b7280;font-size:12px;text-align:center;">
                You received this email because a cleaning service was completed at your location.
                No account or login is required to submit your review.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
