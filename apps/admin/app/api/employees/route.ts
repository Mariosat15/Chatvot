import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { AdminRoleTemplate, DEFAULT_ROLE_TEMPLATES } from '@/database/models/admin-role-template.model';
import { EmployeeEmailTemplate, DEFAULT_EMPLOYEE_EMAIL_TEMPLATES } from '@/database/models/employee-email-template.model';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { ADMIN_SECTIONS, type AdminSection } from '@/database/models/admin-employee.model';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import CompanySettings from '@/database/models/company-settings.model';

// Check if an admin is the original/super admin
async function isOriginalAdmin(admin: any): Promise<boolean> {
  const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@email.com').toLowerCase();
  const isDefaultEmail = admin.email.toLowerCase() === defaultAdminEmail;
  
  // Also check if they're the first admin (oldest by creation date)
  const oldestAdmin = await Admin.findOne({}).sort({ createdAt: 1 }).select('_id');
  const isFirstAdmin = oldestAdmin && oldestAdmin._id.toString() === admin._id.toString();
  
  return isDefaultEmail || isFirstAdmin;
}

// Generate random password
function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

// Replace template variables
function replaceTemplateVariables(text: string, variables: Record<string, any>): string {
  let result = text;
  
  // Handle simple variables
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value || ''));
  }
  
  // Handle sections list (Mustache-like)
  if (variables.sections && Array.isArray(variables.sections)) {
    const sectionsMatch = result.match(/\{\{#sections\}\}([\s\S]*?)\{\{\/sections\}\}/);
    if (sectionsMatch) {
      const itemTemplate = sectionsMatch[1];
      const sectionsList = variables.sections.map((s: string) => itemTemplate.replace('{{.}}', s)).join('');
      result = result.replace(sectionsMatch[0], sectionsList);
    }
  }
  
  return result;
}

// GET - List all employees
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get current admin to check if they're the original/super admin
    const currentAdmin = await Admin.findById(auth.adminId);
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }
    
    const isSuperAdmin = await isOriginalAdmin(currentAdmin);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admin can manage employees' }, { status: 403 });
    }

    // Get all admins (employees)
    const employees = await Admin.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Determine which is the original admin
    const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@email.com').toLowerCase();
    const oldestAdmin = await Admin.findOne({}).sort({ createdAt: 1 }).select('_id');
    
    // Get all role templates
    const templates = await AdminRoleTemplate.find({ isActive: true }).lean();

    // Get email templates
    const emailTemplates = await EmployeeEmailTemplate.find({}).lean();

    return NextResponse.json({
      success: true,
      employees: employees.map(emp => {
        const isSuper = emp.email.toLowerCase() === defaultAdminEmail || 
          (oldestAdmin && oldestAdmin._id.toString() === emp._id.toString());
        return {
          ...emp,
          id: emp._id.toString(),
          isSuperAdmin: isSuper,
        };
      }),
      roleTemplates: templates.map(t => ({
        ...t,
        id: t._id.toString(),
      })),
      emailTemplates: emailTemplates.map(t => ({
        ...t,
        id: t._id.toString(),
      })),
      availableSections: ADMIN_SECTIONS,
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

// POST - Create new employee or perform actions
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get current admin to check if they're the original/super admin
    const currentAdmin = await Admin.findById(auth.adminId);
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }
    
    const isSuperAdmin = await isOriginalAdmin(currentAdmin);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admin can manage employees' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    // Initialize default role templates if needed
    if (action === 'init_templates') {
      const existingTemplates = await AdminRoleTemplate.countDocuments({ isDefault: true });
      if (existingTemplates === 0) {
        await AdminRoleTemplate.insertMany(DEFAULT_ROLE_TEMPLATES);
      }
      
      // Initialize email templates
      for (const template of DEFAULT_EMPLOYEE_EMAIL_TEMPLATES) {
        await EmployeeEmailTemplate.findOneAndUpdate(
          { templateId: template.templateId },
          template,
          { upsert: true }
        );
      }
      
      return NextResponse.json({ success: true, message: 'Templates initialized' });
    }

    // Create new employee
    if (action === 'create') {
      const { email, name, roleTemplateId, customSections, password: manualPassword, sendEmail } = body;

      if (!email || !name) {
        return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
      }

      // Check if email already exists
      const existing = await Admin.findOne({ email: email.toLowerCase() });
      if (existing) {
        return NextResponse.json({ error: 'An admin with this email already exists' }, { status: 409 });
      }

      // Get role template if specified
      let allowedSections: AdminSection[] = [];
      let roleName = 'Custom';
      
      if (roleTemplateId) {
        const template = await AdminRoleTemplate.findById(roleTemplateId);
        if (template) {
          allowedSections = template.allowedSections;
          roleName = template.name;
        }
      } else if (customSections && Array.isArray(customSections)) {
        allowedSections = customSections.filter((s: string) => ADMIN_SECTIONS.includes(s as AdminSection));
      }

      // Generate or use manual password
      const password = manualPassword || generatePassword();

      // Create employee (new employees are never super admin - that's determined by original admin status)
      const newEmployee = new Admin({
        email: email.toLowerCase(),
        name,
        password,
        role: roleName,
        roleTemplateId: roleTemplateId || undefined,
        allowedSections,
        isFirstLogin: true,
        status: 'active',
      });

      await newEmployee.save();

      // Send email if requested
      let emailSent = false;
      if (sendEmail) {
        try {
          emailSent = await sendEmployeeCredentialsEmail(newEmployee, password, allowedSections);
        } catch (emailError) {
          console.error('Failed to send credentials email:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        employee: {
          id: newEmployee._id.toString(),
          email: newEmployee.email,
          name: newEmployee.name,
          role: newEmployee.role,
          allowedSections: newEmployee.allowedSections,
        },
        generatedPassword: sendEmail ? undefined : password, // Only return password if not emailed
        emailSent,
      });
    }

    // Send credentials email
    if (action === 'send_credentials') {
      const { employeeId, newPassword } = body;

      const employee = await Admin.findById(employeeId);
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      // Generate new password if not provided
      const password = newPassword || generatePassword();
      
      // Update password
      employee.password = password;
      employee.isFirstLogin = true;
      await employee.save();

      // Send email
      const emailSent = await sendEmployeeCredentialsEmail(employee, password, employee.allowedSections || []);

      if (!emailSent) {
        // Check if SMTP is configured
        const smtpHost = process.env.SMTP_HOST || process.env.NODEMAILER_HOST;
        if (!smtpHost) {
          return NextResponse.json({
            success: true,
            emailSent: false,
            message: 'Password updated but email could not be sent. SMTP is not configured.',
            generatedPassword: password, // Return password since email couldn't be sent
          });
        }
      }

      return NextResponse.json({
        success: true,
        emailSent,
        message: emailSent ? 'Credentials sent successfully' : 'Password updated but email failed to send. Check server logs.',
        generatedPassword: emailSent ? undefined : password, // Return password if email failed
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing employees:', error);
    return NextResponse.json({ error: 'Failed to manage employees' }, { status: 500 });
  }
}

// Helper function to send credentials email
async function sendEmployeeCredentialsEmail(
  employee: any,
  password: string,
  allowedSections: AdminSection[]
): Promise<boolean> {
  try {
    console.log(`📧 Attempting to send credentials email to ${employee.email}...`);
    
    // Get email template
    let template = await EmployeeEmailTemplate.findOne({ templateId: 'employee_welcome', isActive: true });
    
    // If no template found, try to initialize them
    if (!template) {
      console.log('📧 Email template not found, initializing templates...');
      for (const defaultTemplate of DEFAULT_EMPLOYEE_EMAIL_TEMPLATES) {
        await EmployeeEmailTemplate.findOneAndUpdate(
          { templateId: defaultTemplate.templateId },
          defaultTemplate,
          { upsert: true }
        );
      }
      template = await EmployeeEmailTemplate.findOne({ templateId: 'employee_welcome', isActive: true });
    }
    
    if (!template) {
      console.error('❌ Employee welcome email template not found even after initialization');
      return false;
    }
    
    console.log(`📧 Template found: ${template.name}`);

    // Get company settings
    const companySettings = await CompanySettings.findOne({});
    const companyName = companySettings?.companyName || 'Chartvolt';
    const adminUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.chartvolt.com';

    // Prepare variables
    const sectionLabels: Record<string, string> = {
      'overview': 'Dashboard Overview',
      'hero-page': 'Hero Page',
      'marketplace': 'Marketplace',
      'competitions': 'Competitions',
      'challenges': '1v1 Challenges',
      'trading-history': 'Trading History',
      'analytics': 'Analytics',
      'market': 'Market Hours',
      'symbols': 'Trading Symbols',
      'users': 'User Management',
      'badges': 'Badges & XP',
      'financial': 'Financial Dashboard',
      'payments': 'Pending Payments',
      'failed-deposits': 'Failed Deposits',
      'withdrawals': 'Withdrawal Settings',
      'pending-withdrawals': 'Pending Withdrawals',
      'kyc-settings': 'KYC Settings',
      'kyc-history': 'KYC History',
      'fraud': 'Fraud Detection',
      'wiki': 'Documentation',
      'credentials': 'Admin Credentials',
      'email-templates': 'Email Templates',
      'notifications': 'Notifications',
      'payment-providers': 'Payment Providers',
      'fee': 'Fee Settings',
      'invoicing': 'Invoicing',
      'reconciliation': 'Reconciliation',
      'database': 'Database',
      'ai-agent': 'AI Agent',
      'whitelabel': 'Whitelabel',
      'audit-logs': 'Audit Logs',
      'employees': 'Employee Management',
    };

    const sections = allowedSections.map(s => sectionLabels[s] || s);
    const sectionsText = sections.map(s => `• ${s}`).join('\n');

    const variables = {
      companyName,
      name: employee.name,
      email: employee.email,
      password,
      role: employee.role || 'Team Member',
      adminUrl,
      sections,
      sectionsText,
      year: new Date().getFullYear().toString(),
    };

    // Replace variables in template
    const subject = replaceTemplateVariables(template.subject, variables);
    const htmlBody = replaceTemplateVariables(template.htmlBody, variables);
    const textBody = replaceTemplateVariables(template.textBody, variables);

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || process.env.NODEMAILER_HOST,
      port: parseInt(process.env.SMTP_PORT || process.env.NODEMAILER_PORT || '587'),
      secure: (process.env.SMTP_SECURE || process.env.NODEMAILER_SECURE) === 'true',
      auth: {
        user: process.env.SMTP_USER || process.env.NODEMAILER_EMAIL,
        pass: process.env.SMTP_PASS || process.env.NODEMAILER_PASSWORD,
      },
    });

    // Check SMTP configuration
    const smtpHost = process.env.SMTP_HOST || process.env.NODEMAILER_HOST;
    const smtpUser = process.env.SMTP_USER || process.env.NODEMAILER_EMAIL;
    const smtpPass = process.env.SMTP_PASS || process.env.NODEMAILER_PASSWORD;
    
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('❌ SMTP configuration is incomplete:', {
        host: smtpHost ? 'configured' : 'missing',
        user: smtpUser ? 'configured' : 'missing',
        pass: smtpPass ? 'configured' : 'missing',
      });
      return false;
    }
    
    console.log(`📧 SMTP configured: ${smtpHost}`);
    
    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.NODEMAILER_EMAIL}>`,
      to: employee.email,
      subject,
      text: textBody,
      html: htmlBody,
    });

    console.log(`✅ Credentials email sent to ${employee.email}`);
    return true;
  } catch (error: any) {
    console.error('❌ Error sending credentials email:', error?.message || error);
    console.error('❌ Full error:', error);
    return false;
  }
}

