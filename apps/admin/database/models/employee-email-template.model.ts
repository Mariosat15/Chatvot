import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface IEmployeeEmailTemplate extends Document {
  templateId: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[]; // Available variables like {{name}}, {{email}}, {{password}}, etc.
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeEmailTemplateSchema = new Schema<IEmployeeEmailTemplate>(
  {
    templateId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    htmlBody: {
      type: String,
      required: true,
    },
    textBody: {
      type: String,
      required: true,
    },
    variables: [{
      type: String,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const EmployeeEmailTemplate: Model<IEmployeeEmailTemplate> =
  (models?.EmployeeEmailTemplate as Model<IEmployeeEmailTemplate>) || 
  model<IEmployeeEmailTemplate>('EmployeeEmailTemplate', EmployeeEmailTemplateSchema);

// Default employee email templates
export const DEFAULT_EMPLOYEE_EMAIL_TEMPLATES: Omit<IEmployeeEmailTemplate, keyof Document>[] = [
  {
    templateId: 'employee_welcome',
    name: 'Employee Welcome & Credentials',
    subject: 'Welcome to {{companyName}} Admin Panel - Your Login Credentials',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; background: #f9fafb; }
    .credentials-box { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
    .credential-item { margin: 10px 0; }
    .credential-label { font-weight: bold; color: #4b5563; }
    .credential-value { background: #f3f4f6; padding: 8px 12px; border-radius: 4px; font-family: monospace; margin-top: 5px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .warning-title { color: #b45309; font-weight: bold; margin-bottom: 5px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Welcome to {{companyName}}</h1>
  </div>
  <div class="content">
    <p>Hello {{name}},</p>
    <p>You have been added as a team member with the role of <strong>{{role}}</strong>.</p>
    
    <div class="credentials-box">
      <h3 style="margin-top: 0;">Your Login Credentials</h3>
      <div class="credential-item">
        <div class="credential-label">Admin Panel URL:</div>
        <div class="credential-value">{{adminUrl}}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Email:</div>
        <div class="credential-value">{{email}}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Temporary Password:</div>
        <div class="credential-value">{{password}}</div>
      </div>
    </div>
    
    <div class="warning">
      <div class="warning-title">⚠️ Important Security Notice</div>
      <p style="margin: 0;">Please change your password immediately after your first login. This temporary password will expire in 24 hours.</p>
    </div>
    
    <p>Your access includes the following sections:</p>
    <ul>
      {{#sections}}
      <li>{{.}}</li>
      {{/sections}}
    </ul>
    
    <a href="{{adminUrl}}" class="button">Access Admin Panel</a>
    
    <p style="margin-top: 30px;">If you have any questions, please contact the administrator.</p>
    
    <p>Best regards,<br>{{companyName}} Team</p>
  </div>
  <div class="footer">
    <p>This is an automated message. Please do not reply directly to this email.</p>
    <p>© {{year}} {{companyName}}. All rights reserved.</p>
  </div>
</body>
</html>`,
    textBody: `Welcome to {{companyName}} Admin Panel

Hello {{name}},

You have been added as a team member with the role of {{role}}.

YOUR LOGIN CREDENTIALS
----------------------
Admin Panel URL: {{adminUrl}}
Email: {{email}}
Temporary Password: {{password}}

⚠️ IMPORTANT: Please change your password immediately after your first login.

Your access includes the following sections:
{{sectionsText}}

If you have any questions, please contact the administrator.

Best regards,
{{companyName}} Team`,
    variables: ['companyName', 'name', 'role', 'adminUrl', 'email', 'password', 'sections', 'sectionsText', 'year'],
    isActive: true,
  },
  {
    templateId: 'employee_password_reset',
    name: 'Employee Password Reset',
    subject: '{{companyName}} Admin - Password Reset',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; background: #f9fafb; }
    .credentials-box { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
    .credential-value { background: #f3f4f6; padding: 8px 12px; border-radius: 4px; font-family: monospace; margin-top: 5px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Password Reset</h1>
  </div>
  <div class="content">
    <p>Hello {{name}},</p>
    <p>Your admin panel password has been reset by an administrator.</p>
    
    <div class="credentials-box">
      <h3 style="margin-top: 0;">Your New Temporary Password</h3>
      <div class="credential-value">{{password}}</div>
    </div>
    
    <p>Please change this password immediately after logging in.</p>
    
    <a href="{{adminUrl}}" class="button">Login to Admin Panel</a>
    
    <p style="margin-top: 30px;">If you did not request this reset, please contact the administrator immediately.</p>
  </div>
  <div class="footer">
    <p>© {{year}} {{companyName}}. All rights reserved.</p>
  </div>
</body>
</html>`,
    textBody: `Password Reset - {{companyName}} Admin

Hello {{name}},

Your admin panel password has been reset by an administrator.

Your new temporary password: {{password}}

Please change this password immediately after logging in.

Login URL: {{adminUrl}}

If you did not request this reset, please contact the administrator immediately.

© {{year}} {{companyName}}`,
    variables: ['companyName', 'name', 'adminUrl', 'password', 'year'],
    isActive: true,
  },
  {
    templateId: 'employee_account_disabled',
    name: 'Employee Account Disabled',
    subject: '{{companyName}} Admin - Account Disabled',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #dc2626; padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; background: #f9fafb; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Account Disabled</h1>
  </div>
  <div class="content">
    <p>Hello {{name}},</p>
    <p>Your admin panel account has been disabled. You will no longer be able to access the admin panel.</p>
    <p>If you believe this is an error, please contact the administrator.</p>
    <p>Best regards,<br>{{companyName}} Team</p>
  </div>
  <div class="footer">
    <p>© {{year}} {{companyName}}. All rights reserved.</p>
  </div>
</body>
</html>`,
    textBody: `Account Disabled - {{companyName}} Admin

Hello {{name}},

Your admin panel account has been disabled. You will no longer be able to access the admin panel.

If you believe this is an error, please contact the administrator.

Best regards,
{{companyName}} Team`,
    variables: ['companyName', 'name', 'year'],
    isActive: true,
  },
];

