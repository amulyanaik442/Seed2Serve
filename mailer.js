/* ============================================================
   Seed2Serve — Email helper
   Sends transactional emails (e.g. password reset) through a
   configured provider. Supports Resend and Mailgun over REST
   using Node's global fetch (Node >= 18); no npm dependency.

   Configure in .env:
     EMAIL_PROVIDER = resend | mailgun   (default resend)
     EMAIL_API_KEY  = <provider API key>
     EMAIL_FROM     = "Seed2Serve <no-reply@yourdomain.com>"
     MAILGUN_DOMAIN = mg.yourdomain.com  (only for mailgun)
   ============================================================ */
'use strict';

require('dotenv').config();

const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
const apiKey = process.env.EMAIL_API_KEY || '';
const from = process.env.EMAIL_FROM || '';
const mailgunDomain = process.env.MAILGUN_DOMAIN || '';

async function sendMail({ to, subject, html, text }) {
  if (!apiKey || !from) {
    console.warn(
      '[mailer] EMAIL_API_KEY / EMAIL_FROM not configured — cannot send email.',
      { to, subject }
    );
    return { ok: false, skipped: true };
  }

  const fallbackText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (provider === 'mailgun' && mailgunDomain) {
    const form = new URLSearchParams();
    form.set('from', from);
    form.set('to', to);
    form.set('subject', subject);
    form.set('html', html);
    form.set('text', fallbackText);
    const res = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('api:' + apiKey).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form
    });
    return { ok: res.ok, status: res.status };
  }

  // Default: Resend
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: fallbackText
    })
  });
  return { ok: res.ok, status: res.status };
}

module.exports = { sendMail };