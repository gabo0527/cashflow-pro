// src/app/api/agents/email-send/route.ts
// ============================================================
// Email Send Agent — Sends admin-approved emails via Resend
// Uses branded VantageFP template
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.EMAIL_FROM || 'Vantage <notifications@vantagefp.co>'
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'gabriel@manocg.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vantagefp.co'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

function buildEmailHtml(subject: string, body: string, recipientName: string, tone: string): string {
  const toneColors: Record<string, { accent: string; bg: string }> = {
    info: { accent: '#10b981', bg: '#ecfdf5' },
    reminder: { accent: '#f59e0b', bg: '#fffbeb' },
    urgent: { accent: '#ef4444', bg: '#fef2f2' },
    appreciation: { accent: '#8b5cf6', bg: '#f5f3ff' },
    correction: { accent: '#3b82f6', bg: '#eff6ff' },
  }
  const colors = toneColors[tone] || toneColors.info

  // Convert \n to <br> for HTML
  const htmlBody = body
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p style="margin:0 0 12px; font-size:14px; color:#374151; line-height:1.6;">${line}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#111827; padding:24px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;">
                    <div style="width:32px; height:32px; background-color:${colors.accent}; border-radius:8px; display:inline-block;"></div>
                  </td>
                  <td>
                    <span style="color:#ffffff; font-size:18px; font-weight:700; letter-spacing:-0.3px;">VantageFP</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">Hi ${recipientName},</p>
              <div style="margin:16px 0 24px;">
                ${htmlBody}
              </div>
              <table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                <tr>
                  <td style="background-color:${colors.accent}; border-radius:8px; padding:12px 24px;">
                    <a href="${APP_URL}/contractor-portal" style="color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; display:inline-block;">Open Portal</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; border-top:1px solid #e5e7eb; background-color:#f9fafb;">
              <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.5;">
                This message was sent from VantageFP on behalf of Gabriel.
                <a href="${APP_URL}" style="color:#10b981; text-decoration:none;">Open your portal</a>
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

export async function POST(request: NextRequest) {
  try {
    const { subject, body, recipientEmail, recipientName, tone, isTeamWide } = await request.json()

    if (!subject || !body) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })
    }

    const recipients: { email: string; name: string }[] = []

    if (isTeamWide) {
      // Send to all active contractors
      const { data: contractors } = await supabase
        .from('team_members')
        .select('name, email')
        .eq('employment_type', 'contractor')
        .eq('status', 'active')
        .not('email', 'is', null)

      if (contractors) {
        contractors.forEach(c => {
          if (c.email) recipients.push({ email: c.email, name: c.name?.split(' ')[0] || 'there' })
        })
      }
    } else if (recipientEmail) {
      recipients.push({ email: recipientEmail, name: recipientName || 'there' })
    } else {
      return NextResponse.json({ error: 'No recipient specified' }, { status: 400 })
    }

    const results: { email: string; sent: boolean; error?: string }[] = []

    for (const r of recipients) {
      const html = buildEmailHtml(subject, body, r.name, tone || 'info')

      try {
        const { data: sendResult, error: sendError } = await resend.emails.send({
          from: FROM_EMAIL,
          replyTo: REPLY_TO,
          to: r.email,
          subject,
          html,
        })

        if (sendError) {
          results.push({ email: r.email, sent: false, error: sendError.message })
        } else {
          results.push({ email: r.email, sent: true })

          // Log to notification_log
          await supabase.from('notification_log').insert({
            type: 'sage_custom_email',
            recipient_email: r.email,
            recipient_name: r.name,
            reference_type: 'sage_email',
            status: 'sent',
            metadata: {
              subject,
              tone,
              is_team_wide: isTeamWide || false,
              email_id: sendResult?.id,
            },
          }).then(({ error }) => {
            if (error) console.warn('Failed to log notification:', error.message)
          })
        }
      } catch (err) {
        results.push({ email: r.email, sent: false, error: (err as Error).message })
      }
    }

    const sentCount = results.filter(r => r.sent).length

    return NextResponse.json({
      success: sentCount > 0,
      sent: sentCount,
      total: recipients.length,
      results,
    })

  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json(
      { error: 'Failed to send email', details: (error as Error).message },
      { status: 500 }
    )
  }
}
