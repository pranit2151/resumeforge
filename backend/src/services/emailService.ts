import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: { user, pass },
      });
    }
  }
  return transporter;
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"ResumeForge Support" <noreply@resumeforge.com>',
    to: email,
    subject: 'Password Reset Request - ResumeForge',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #3b82f6;">ResumeForge Password Reset</h2>
        <p>You requested to reset your password. Click the button below to set a new password. This link is valid for 15 minutes.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 0.85rem; color: #666;">Or copy and paste this URL into your browser:</p>
        <p style="font-size: 0.8rem; word-break: break-all; color: #888;">${resetUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 0.75rem; color: #999;">If you did not request a password reset, please ignore this email.</p>
      </div>
    `,
  };

  const transport = getTransporter();
  if (transport) {
    try {
      await transport.sendMail(mailOptions);
      console.log(`[Email Service] Password reset email sent to ${email}`);
      return true;
    } catch (err: any) {
      console.error(`[Email Service Error] Failed to send email to ${email}:`, err.message);
      // Fall through to console log fallback
    }
  }

  // Console fallback for local dev when SMTP is unconfigured
  console.log(`\n==========================================`);
  console.log(`📧 [PASSWORD RESET LINK LOG] To: ${email}`);
  console.log(`🔗 Link: ${resetUrl}`);
  console.log(`==========================================\n`);
  return true;
}
