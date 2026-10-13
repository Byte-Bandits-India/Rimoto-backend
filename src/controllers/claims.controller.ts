import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import sendEmail, { getAdminNotificationEmail } from '../services/sendEmail';
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

      // 2. Send structured alert to admin
      const adminEmail = getAdminNotificationEmail();
      const adminEmailHtml = `
        <div style="font-family: sans-serif; background-color: #f4f4f0; padding: 40px 20px; color: #000;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 2px solid #000; box-shadow: 6px 6px 0px #ff5722; padding: 40px;">
            <h1 style="text-transform: uppercase; letter-spacing: 2px; font-size: 22px; border-bottom: 2px solid #000; padding-bottom: 16px; margin-top: 0;">
              🚨 New ${claimType.toUpperCase()} Claim Filed
            </h1>
            <p style="font-size: 15px; margin-top: 20px; color: #333;">A new customer claim has been submitted on Rimoto Gear.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555; width: 140px;">Order Number:</td>
                <td style="padding: 10px 0; font-weight: bold;">#${orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Customer Name:</td>
                <td style="padding: 10px 0;">${customerName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Email:</td>
                <td style="padding: 10px 0;"><a href="mailto:${email}" style="color: #0066cc;">${email}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Phone:</td>
                <td style="padding: 10px 0;">${phone}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Claim Type:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #d32f2f;">${claimType}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Product:</td>
                <td style="padding: 10px 0;">${productName || 'N/A'} ${productColor ? `(${productColor})` : ''} ${productSize ? `[${productSize}]` : ''}</td>
              </tr>
              ${
                claimType === 'EXCHANGE'
                  ? `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Exchange For:</td>
                <td style="padding: 10px 0;">${exchangeProductName || 'N/A'} ${exchangeProductColor ? `(${exchangeProductColor})` : ''} ${exchangeProductSize ? `[${exchangeProductSize}]` : ''}</td>
              </tr>
              `
                  : ''
              }
            </table>

            <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 16px; margin-top: 24px; font-size: 13px;">
              <p style="margin: 0 0 6px 0; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #666;">Customer Reason / Message:</p>
              <p style="margin: 0; color: #222; line-height: 1.6; white-space: pre-wrap;">${reason}</p>
            </div>

            <div style="margin-top: 30px; text-align: center;">
              <a href="https://rimoto.xylozentech.com/admin" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px;">
                Review in Admin Dashboard
              </a>
            </div>
          </div>
        </div>
      `;

      await sendEmail(
        adminEmail,
        `🔔 [New Claim] Order #${orderNumber} (${customerName} - ${claimType})`,
        adminEmailHtml,
        { fromName: 'Rimoto Claims Bot' }
      );
    } catch (emailErr) {
      console.error('❌ Failed to send claim emails:', emailErr);
    }

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
