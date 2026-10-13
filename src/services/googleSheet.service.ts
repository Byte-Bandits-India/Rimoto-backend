import { envConfig } from '../configs/env';

export interface ClaimSheetPayload {
  orderNumber: string;
  claimType: string;
  customerName: string;
  email: string;
  phone: string;
  purchaseDate?: string | Date;
  productInfo: string;
  exchangeProductInfo?: string;
  reason: string;
  invoiceUrl?: string;
  mediaUrls?: string[];
  billingAddress?: string;
  shippingAddress?: string;
}

export const appendClaimToSheet = async (payload: ClaimSheetPayload): Promise<void> => {
  const webhookUrl = envConfig.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.trim() === '') {
    // Webhook URL not configured yet, skip silently
    return;
  }

  try {
    const isLocal = envConfig.FRONTEND_URL.includes('localhost');
    const domain = isLocal ? 'https://rimoto.xylozentech.com' : envConfig.FRONTEND_URL.replace(/\/+$/, '');

    const formatUrl = (url?: string): string => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      return `${domain}${url.startsWith('/') ? url : '/' + url}`;
    };

    const formattedInvoiceUrl = formatUrl(payload.invoiceUrl);
    const formattedMediaUrls = (payload.mediaUrls || []).map(formatUrl);

    const sheetData = {
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      orderNumber: payload.orderNumber,
      claimType: payload.claimType,
      customerName: payload.customerName,
      email: payload.email,
      phone: payload.phone,
      purchaseDate: payload.purchaseDate
        ? new Date(payload.purchaseDate).toLocaleDateString('en-IN')
        : 'N/A',
      productInfo: payload.productInfo,
      exchangeProductInfo: payload.exchangeProductInfo || 'N/A',
      reason: payload.reason,
      invoiceUrl: formattedInvoiceUrl,
      mediaUrls: formattedMediaUrls,
      billingAddress: payload.billingAddress || '',
      shippingAddress: payload.shippingAddress || '',
      status: 'PENDING',
    };

    // Google Apps Script redirects POST requests to an execution URL
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(sheetData),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn(`Google Sheet webhook responded with status ${response.status}`);
    } else {
      console.log(`✅ Synced claim #${payload.orderNumber} to Google Sheet`);
    }
  } catch (err: any) {
    console.error('Failed to sync claim to Google Sheet:', err?.message || err);
    // Non-blocking: Never fail the customer's claim response if sheet sync errors
  }
};
