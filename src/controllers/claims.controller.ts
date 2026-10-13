import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import sendEmail, { getAdminNotificationEmail } from '../services/sendEmail';
import { sendAdminClaimNotificationEmail } from '../services/emailService';
import { appendClaimToSheet } from '../services/googleSheet.service';
import { envConfig } from '../configs/env';
import fs from 'fs';
import path from 'path';

export const submitClaim = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      claimType,
      customerName,
      orderNumber,
      email,
      phone,
      billingAddress,
      shippingAddress,
      purchaseDate,
      productName,
      productColor,
      productSize,
      returningProductName,
      returningProductColor,
      returningProductSize,
      exchangeProductName,
      exchangeProductColor,
      exchangeProductSize,
      reason,
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const invoiceFile = files?.['invoice']?.[0];
    const productMediaFiles = files?.['productMedia'] || [];

    if (!claimType || !['WARRANTY', 'RETURN', 'EXCHANGE'].includes(claimType.toUpperCase())) {
      res.status(400).json({ success: false, error: 'Valid claim type (warranty, return, exchange) is required' });
      return;
    }

    const parsedDate = purchaseDate ? new Date(purchaseDate) : null;
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      res.status(400).json({ success: false, error: 'Valid purchase date is required' });
      return;
    }

    if (!invoiceFile) {
      res.status(400).json({ success: false, error: 'Invoice file is required' });
      return;
    }

    if (productMediaFiles.length === 0) {
      res.status(400).json({ success: false, error: 'Product media is required' });
      return;
    }

    const invoiceUrl = `/uploads/claims/${invoiceFile.filename}`;
    const productMediaUrls = productMediaFiles.map(f => `/uploads/claims/${f.filename}`);

    const newClaim = await prisma.claim.create({
      data: {
        claimType: claimType.toUpperCase() as 'WARRANTY' | 'RETURN' | 'EXCHANGE',
        customerName,
        orderNumber,
        email,
        phone,
        billingAddress,
        shippingAddress,
        purchaseDate: parsedDate,
        productName,
        productColor,
        productSize,
        returningProductName,
        returningProductColor,
        returningProductSize,
        exchangeProductName,
        exchangeProductColor,
        exchangeProductSize,
        reason,
        invoiceUrl,
        productMediaUrls,
      },
    });

    // Send email using a custom Rimoto theme design
    const emailHtml = `
      <div style="font-family: sans-serif; background-color: #f4f4f0; padding: 40px 20px; color: #000;">
        <div style="max-w-width: 600px; margin: 0 auto; background: #fff; border: 2px solid #000; box-shadow: 6px 6px 0px #bcfb4c; padding: 40px;">
          <h1 style="text-transform: uppercase; letter-spacing: 2px; font-size: 24px; border-bottom: 2px solid #000; padding-bottom: 20px;">Claim Submitted Successfully</h1>
          <p style="font-size: 16px; margin-top: 20px;">Hi <strong>${customerName}</strong>,</p>
          <p style="font-size: 16px;">We have received your <strong>${claimType.toUpperCase()}</strong> claim (Order #${orderNumber}).</p>
          <p style="font-size: 16px; line-height: 1.6; color: #555;">Our team is reviewing the details and verifying the provided images/invoices. We will get back to you within 48 hours with the next steps.</p>
          
          <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 20px; margin-top: 30px;">
            <p style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Have queries?</p>
            <p style="margin: 5px 0; font-size: 14px;">Email: contact@rimotogear.com</p>
            <p style="margin: 5px 0; font-size: 14px;">Phone: +91 74491 02000</p>
          </div>
          
          <p style="font-size: 12px; margin-top: 40px; color: #888; text-transform: uppercase;">Rimoto Gear Team</p>
        </div>
      </div>
    `;

    try {
      // 1. Send personalized confirmation to customer
      await sendEmail(
        email,
        `Rimoto Claim Received - Order #${orderNumber}`,
        emailHtml,
        { fromName: 'Rimoto Gear Support' }
      );

      // 2. Send structured alert to admin using dedicated template without emojis
      const adminEmail = getAdminNotificationEmail();
      const productInfo = `${productName || 'N/A'}${productColor ? ` (${productColor})` : ''}${productSize ? ` [${productSize}]` : ''}`;
      const exchangeProductInfo =
        claimType === 'EXCHANGE'
          ? `${exchangeProductName || 'N/A'}${exchangeProductColor ? ` (${exchangeProductColor})` : ''}${exchangeProductSize ? ` [${exchangeProductSize}]` : ''}`
          : undefined;

      await sendAdminClaimNotificationEmail({
        adminEmail,
        orderNumber,
        customerName,
        email,
        phone,
        claimType,
        productInfo,
        exchangeProductInfo,
        reason,
        adminUrl: 'https://rimoto.xylozentech.com/admin',
      });
    } catch (emailErr) {
      console.error('Failed to send claim emails:', emailErr);
    }

    // Sync claim to Google Sheet asynchronously (non-blocking)
    const productInfo = `${productName || 'N/A'}${productColor ? ` (${productColor})` : ''}${productSize ? ` [${productSize}]` : ''}`;
    const exchangeProductInfo =
      claimType === 'EXCHANGE'
        ? `${exchangeProductName || 'N/A'}${exchangeProductColor ? ` (${exchangeProductColor})` : ''}${exchangeProductSize ? ` [${exchangeProductSize}]` : ''}`
        : undefined;

    appendClaimToSheet({
      orderNumber,
      claimType,
      customerName,
      email,
      phone,
      purchaseDate,
      productInfo,
      exchangeProductInfo,
      reason,
      invoiceUrl,
      mediaUrls: productMediaUrls,
      billingAddress,
      shippingAddress,
    }).catch((sheetErr) => {
      console.error('Failed to sync claim to Google Sheet in background:', sheetErr);
    });

    res.status(201).json({
      success: true,
      message: 'Claim submitted successfully',
      data: newClaim,
    });
  } catch (error: any) {
    console.error('Error submitting claim:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error', detail: error.message });
  }
};

export const getClaims = async (req: Request, res: Response): Promise<void> => {
  try {
    const claims = await prisma.claim.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: claims });
  } catch (error: any) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ success: false, error: 'Internal server error', detail: error.message });
  }
};

export const deleteClaim = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingClaim = await prisma.claim.findUnique({ where: { id } });
    if (!existingClaim) {
      res.status(404).json({ success: false, error: 'Claim not found' });
      return;
    }

    if (existingClaim.invoiceUrl && existingClaim.invoiceUrl.startsWith('/uploads/')) {
      const invoicePath = path.join(process.cwd(), existingClaim.invoiceUrl.replace(/^\//, ''));
      if (fs.existsSync(invoicePath)) {
        fs.unlink(invoicePath, () => {});
      }
    }

    const mediaList = Array.isArray(existingClaim.productMediaUrls)
      ? (existingClaim.productMediaUrls as string[])
      : typeof existingClaim.productMediaUrls === 'string'
      ? (() => {
          try {
            return JSON.parse(existingClaim.productMediaUrls as string);
          } catch {
            return [];
          }
        })()
      : [];

    for (const mUrl of mediaList) {
      if (typeof mUrl === 'string' && mUrl.startsWith('/uploads/')) {
        const mPath = path.join(process.cwd(), mUrl.replace(/^\//, ''));
        if (fs.existsSync(mPath)) {
          fs.unlink(mPath, () => {});
        }
      }
    }

    await prisma.claim.delete({ where: { id } });

    res.json({ success: true, message: 'Claim deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting claim:', error);
    res.status(500).json({ success: false, error: 'Internal server error', detail: error.message });
  }
};
