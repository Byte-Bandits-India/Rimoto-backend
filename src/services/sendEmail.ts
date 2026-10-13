import nodemailer from 'nodemailer';
import { envConfig } from '../configs/env';

export interface SendEmailOptions {
  fromName?: string;
  replyTo?: string;
  bccAdmin?: boolean;
  text?: string;
}

// Convert HTML to clean plain-text for spam filter avoidance (RFC 2046)
export const stripHtml = (html: string): string => {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const wrapHtmlDocument = (content: string, title: string): string => {
  if (content.toLowerCase().includes('<!doctype') || content.toLowerCase().includes('<html')) {
    return content;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  ${content}
</body>
</html>`;
};

export const getAdminNotificationEmail = (): string => {
  const adminConfig = (envConfig as any).ADMIN_NOTIFICATION_EMAIL || envConfig.ADMIN_EMAIL;
  if (!adminConfig || adminConfig === 'admin@rimoto.in' || !adminConfig.includes('@')) {
    return (envConfig as any).SMTP_USER || envConfig.EMAIL_USERNAME || 'abrahambillclinton@gmail.com';
  }
  return adminConfig;
};

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

    const rawList = Array.isArray(email) ? email : [email];
    const uniqueRecipients = Array.from(
      new Set(
        rawList
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((addr) => Boolean(addr && addr.includes('@')))
      )
    );

    if (uniqueRecipients.length === 0) {
      console.warn('⚠️ sendEmail called with no valid recipients.');
      return;
    }

    const fullHtml = wrapHtmlDocument(htmlContent, subject);
    const plainText = options?.text || stripHtml(htmlContent);
    const fromName = options?.fromName || 'Rimoto Support';

    const bccList: string[] = [];
    if (options?.bccAdmin) {
      const adminEmail = getAdminNotificationEmail();
      if (adminEmail && !uniqueRecipients.includes(adminEmail)) {
        bccList.push(adminEmail);
      }
    }

    const mailOptions: any = {
      from: `"${fromName}" <${user}>`,
      replyTo: options?.replyTo || 'contact@rimotogear.com',
      to: uniqueRecipients.join(', '),
      subject,
      text: plainText,
      html: fullHtml,
      headers: {
        'X-Mailer': 'Rimoto Notification Engine',
        'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      },
    };

    if (bccList.length > 0) {
      mailOptions.bcc = bccList.join(', ');
    }

    const mailInfo = await transporter.sendMail(mailOptions);
    console.log(
      `✅ Email sent to [${uniqueRecipients.join(', ')}]${bccList.length > 0 ? ` (BCC: ${bccList.join(', ')})` : ''} (Subject: "${subject}", ID: ${mailInfo.messageId})`
    );
  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw new Error(
      'Email could not be sent: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
};

export default sendEmail;
