import fs from 'fs';
import path from 'path';

import sendEmail from './sendEmail';

const injectData = (template: string, data: Record<string, string>): string => {
  return template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || '');
};

const getTemplate = (filename: string): string => {
  const primary = path.join(__dirname, 'templates', filename);
  if (fs.existsSync(primary)) {
    return fs.readFileSync(primary, 'utf-8');
  }
  const altName = filename.includes('success')
    ? filename.replace('success', 'sucess')
    : filename.replace('sucess', 'success');
  const altPath = path.join(__dirname, 'templates', altName);
  if (fs.existsSync(altPath)) {
    return fs.readFileSync(altPath, 'utf-8');
  }
  return '';
};

export const sendInvitationRequestEmail = async (email: string): Promise<void> => {
  const template = getTemplate('invitationRequest.html');
  const htmlContent = injectData(template, { email });
  await sendEmail(email, 'Invitation Request', htmlContent, { bccAdmin: true });
};

export const sendRegistrationOtpEmail = async (
  email: string,
  name: string,
  otp: string
): Promise<void> => {
  const template = getTemplate('registrationOtp.html');
  const htmlContent = injectData(template, { name, otp });
  await sendEmail(email, 'Confirm Your Registration', htmlContent);
};

export const sendRegistrationSuccessEmail = async (email: string, name: string): Promise<void> => {
  const template = getTemplate('successRegistration.html');
  const htmlContent = injectData(template, { name });
  await sendEmail(email, 'Registration Confirmed', htmlContent);
};

export const sendResetPasswordOtpEmail = async (
  email: string,
  name: string,
  otp: string
): Promise<void> => {
  const template = getTemplate('resetPasswordOtp.html');
  const htmlContent = injectData(template, { name, otp });
  await sendEmail(email, 'Reset Your Password', htmlContent);
};

export const sendResetPasswordSuccessEmail = async (email: string, name: string): Promise<void> => {
  const template = getTemplate('successResetPassword.html');
  const htmlContent = injectData(template, { name });
  await sendEmail(email, 'Password Reset Successfully', htmlContent);
};
