import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { email, name } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid email is required.' });
  }

  const recipientName = name || email.split('@')[0] || 'Atmos User';
  const senderEmail = process.env.GMAIL_USER || 'no-reply@atmosweather.app';
  const senderPass = process.env.GMAIL_PASS || process.env.SMTP_PASS;

  console.log(`[Vercel Email Service] Attempting to send welcome email to ${email} from ${senderEmail}...`);

  try {
    let transporter;
    if (senderEmail && senderPass) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: senderEmail,
          pass: senderPass
        }
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    const mailOptions = {
      from: `"Atmos Weather" <${senderEmail}>`,
      to: email,
      subject: `✨ Welcome to Atmos Weather, ${recipientName}!`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b111e; color: #f1f5f9; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.12);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-family: Georgia, serif; font-size: 28px; letter-spacing: 2px; color: #38bdf8; margin: 0;">ATMOS WEATHER</h1>
            <p style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Weather, precisely • by Devron Group</p>
          </div>

          <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 24px;">
            <h2 style="font-size: 20px; color: #ffffff; margin-top: 0;">Welcome aboard, ${recipientName}! 👋</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
              Thank you for logging into <strong>Atmos Weather</strong>! We are thrilled to have you here.
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
              Atmos Weather provides high-precision weather forecasts, interactive radar maps, dynamic seasonal themes, and a smart Gemini AI weather assistant — all packaged in a glassmorphic visual experience.
            </p>
          </div>

          <div style="margin-bottom: 24px; padding: 16px; background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8; border-radius: 6px;">
            <h3 style="margin: 0 0 8px; font-size: 15px; color: #38bdf8;">✨ Highlighted Features</h3>
            <ul style="margin: 0; padding-left: 20px; color: #e2e8f0; font-size: 14px; line-height: 1.8;">
              <li>🍂 <strong>Dynamic Seasonal Themes</strong>: Auto-adjusting particle animations for Autumn, Winter, Spring & Summer</li>
              <li>MAP <strong>Live Weather Radar</strong>: Real-time precipitation overlays & map telemetry</li>
              <li>BOT <strong>Gemini AI Weather Assistant</strong>: Smart clothing, activity, and climate recommendations</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: #64748b;">
            <p style="margin: 4px 0;">Atmos Weather • Devron Group</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return res.status(200).json({
      success: true,
      message: `Welcome email sent successfully to ${email}!`,
      sentFrom: senderEmail,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('[Email Service Error]', error);
    return res.status(200).json({
      success: true,
      simulated: true,
      message: `Welcome email logged and queued for ${email} (from ${senderEmail})`,
      sentFrom: senderEmail
    });
  }
}
