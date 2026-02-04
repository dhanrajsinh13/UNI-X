import { NextApiRequest, NextApiResponse } from 'next';
import { getCollection, withRetry, Collections, User, PasswordReset, getNextSequenceValue } from '../../../lib/mongodb';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const users = await getCollection<User>(Collections.USERS);
    const user = await withRetry(async () => {
      return users.findOne({ 
        email: email.toLowerCase()
      })
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({ 
        message: 'If this email exists in our system, you will receive a password reset link.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Save reset token to database
    const passwordResets = await getCollection<PasswordReset>(Collections.PASSWORD_RESETS);
    const resetId = await getNextSequenceValue('password_resets');
    
    await withRetry(async () => {
      return passwordResets.insertOne({
        id: resetId,
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt,
        used: false,
        created_at: new Date()
      } as any)
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Configure email transporter (you'll need to set up your email service)
    const transporter = nodemailer.createTransport({
      // For development, you can use a service like Ethereal Email or Gmail
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Email content
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@university.edu',
      to: email,
      subject: 'Password Reset Request - UNIX Social Network',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FFAF50;">Password Reset Request</h2>
          <p>Hello ${user.name},</p>
          <p>We received a request to reset your password for your UNIX account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #FFAF50; color: black; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin: 24px 0; border: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">UNIX - College Social Network</p>
        </div>
      `
    };

    // Send email (in development, you might want to just log the reset URL)
    if (process.env.NODE_ENV === 'development') {
      console.log('=== PASSWORD RESET EMAIL ===');
      console.log(`To: ${email}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log('===========================');
    } else {
      await transporter.sendMail(mailOptions);
    }

    return res.status(200).json({ 
      message: 'If this email exists in our system, you will receive a password reset link.',
      // In development, include the reset URL for testing
      ...(process.env.NODE_ENV === 'development' && { resetUrl })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}