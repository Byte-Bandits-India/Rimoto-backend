import nodemailer from 'nodemailer';
import { envConfig } from '../configs/env';

export interface SendEmailOptions {
  fromName?: string;
  replyTo?: string;
  includeAdmin?: boolean; // defaults to true: sends to both user and admin
}

export const sendEmail = async (
  email: string | string[],
  subject: string,
  htmlContent: string,
  options?: SendEmailOptions
): Promise<void> => {
  const host = (envConfig as any).SMTP_HOST || envConfig.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number((envConfig as any).SMTP_PORT || envConfig.EMAIL_PORT || 587);
  const user = (envConfig as any).SMTP_USER || envConfig.EMAIL_USERNAME || 'abrahambillclinton@gmail.com';
  const pass = (envConfig as any).SMTP_PASS || envConfig.EMAIL_PASSWORD || 'bznjpvzvvpjwajdl';
  const adminEmail = envConfig.ADMIN_EMAIL || 'admin@rimoto.in';

  try {
    const isGmail = host === 'smtp.gmail.com' || host === 'gmail';
    const transporter = isGmail
      ? nodemailer.createTransport({
          service: 'gmail',
          auth: { user, pass },
          tls: { rejectUnauthorized: false },
        })
      : nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          tls: { rejectUnauthorized: false },
        });

    // Collect all recipient addresses
    const rawList = Array.isArray(email) ? email : [email];
    const recipientPool: string[] = [];

    for (const item of rawList) {
      if (typeof item === 'string') {
        recipientPool.push(...item.split(',').map((s) => s.trim()));
      }
    }

    // Include admin email so both user(s) and admin receive the mail
    const shouldIncludeAdmin = options?.includeAdmin !== false;
    if (shouldIncludeAdmin && adminEmail) {
      recipientPool.push(adminEmail);
    }

    // Deduplicate and filter valid email strings
    const uniqueRecipients = Array.from(
      new Set(
        recipientPool.filter((addr) => Boolean(addr && addr.includes('@')))
      )
    );

    if (uniqueRecipients.length === 0) {
      console.warn('⚠️ sendEmail called with no valid recipients.');
      return;
    }

    const fromName = options?.fromName || 'Rimoto Gear Support';
    const mailOptions = {
      from: `"${fromName}" <${user}>`,
      replyTo: options?.replyTo || 'contact@rimotogear.com',
      to: uniqueRecipients,
      subject,
      html: htmlContent,
    };

    const mailInfo = await transporter.sendMail(mailOptions);
    console.log(
      `✅ Email sent to both user and admin [${uniqueRecipients.join(', ')}] (Subject: "${subject}", ID: ${mailInfo.messageId})`
    );
  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw new Error(
      'Email could not be sent: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
};

export default sendEmail;
