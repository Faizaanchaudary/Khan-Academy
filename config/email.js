import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const createTransporter = () => {
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD 
      }
    });
  }

  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

export const createPasswordResetEmailTemplate = (otp, userEmail) => {
  return {
    from: `"${process.env.EMAIL_FROM_NAME || 'Khan-Academy'}" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: 'Password Reset Verification Code - Khan-Academy',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Khan-Academy</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #dc3545;
            margin-bottom: 10px;
          }
          .otp-container {
            background-color: #f8f9fa;
            border: 2px dashed #dc3545;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #dc3545;
            letter-spacing: 5px;
            margin: 10px 0;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background-color: #dc3545;
            color: white;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔐 Khan-Academy</div>
            <h2>Password Reset Verification</h2>
          </div>
          
          <p>Hello,</p>
          
          <p>We received a request to reset your password for your Khan-Academy account. To complete the password reset process, please use the verification code below:</p>
          
          <div class="otp-container">
            <p><strong>Your Verification Code:</strong></p>
            <div class="otp-code">${otp}</div>
            <p><small>This code will expire in 3 minutes</small></p>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important Security Information:</strong>
            <ul>
              <li>This code is valid for 3 minutes only</li>
              <li>You have 3 attempts to enter the correct code</li>
              <li>If you didn't request this password reset, please ignore this email</li>
              <li>Never share this code with anyone</li>
            </ul>
          </div>
          
          <p>If you're having trouble with the verification code, you can request a new one from the password reset page.</p>
          
          <p>If you didn't request a password reset, please contact our support team immediately.</p>
          
          <div class="footer">
            <p>This email was sent from Khan-Academy - Your  Practice Management System</p>
            <p>© ${new Date().getFullYear()} Khan-Academy. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Password Reset Verification - Khan-Academy
      
      Hello,
      
      We received a request to reset your password for your  account.
      
      Your verification code is: ${otp}
      
      This code will expire in 3 minutes and you have 3 attempts to use it.
      
      If you didn't request this password reset, please ignore this email.
      
      Best regards,
      Khan-Academy Team
    `
  };
};

export const sendPasswordResetEmail = async (userEmail, otp) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.log('Email configuration not found. Please create .env file with email settings.');
      console.log('OTP for development:', otp);
      return {
        success: true,
        messageId: 'dev-mode-no-email-config'
      };
    }

    const transporter = createTransporter();
    
    await transporter.verify();
    const mailOptions = createPasswordResetEmailTemplate(otp, userEmail);
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    console.log('OTP for development (fallback):', otp);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  createTransporter,
  createPasswordResetEmailTemplate,
  sendPasswordResetEmail
};