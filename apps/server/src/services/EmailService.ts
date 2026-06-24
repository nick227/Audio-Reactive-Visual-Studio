export class EmailService {
  async sendPasswordResetEmail(email: string, resetUrl: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[EmailService] Password reset for ${email}\n  URL: ${resetUrl}\n`)
      return
    }
    // TODO: wire Resend/Nodemailer here for production
    console.warn('[EmailService] No email provider configured — reset URL not delivered')
  }
}
