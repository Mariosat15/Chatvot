import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { AdminRoleTemplate, DEFAULT_ROLE_TEMPLATES } from '@/database/models/admin-role-template.model';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { ADMIN_SECTIONS, type AdminSection } from '@/database/models/admin-employee.model';

// GET - List all role templates
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Initialize default templates if none exist
    const count = await AdminRoleTemplate.countDocuments();
    if (count === 0) {
      await AdminRoleTemplate.insertMany(DEFAULT_ROLE_TEMPLATES);
    }

    const templates = await AdminRoleTemplate.find({}).sort({ isDefault: -1, name: 1 }).lean();

    return NextResponse.json({
      success: true,
      templates: templates.map(t => ({
        ...t,
        id: t._id.toString(),
      })),
      availableSections: ADMIN_SECTIONS,
    });
  } catch (error) {
    console.error('Error fetching role templates:', error);
    return NextResponse.json({ error: 'Failed to fetch role templates' }, { status: 500 });
  }
}

// POST - Create new role template
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get current admin
    const currentAdmin = await Admin.findById(auth.adminId);
    if (!currentAdmin?.isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admin can manage role templates' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, allowedSections } = body;

    if (!name) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    // Check for duplicate name
    const existing = await AdminRoleTemplate.findOne({ name });
    if (existing) {
      return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 });
    }

    // Validate sections
    const validSections = (allowedSections || []).filter((s: string) => 
      ADMIN_SECTIONS.includes(s as AdminSection)
    );

    const template = new AdminRoleTemplate({
      name,
      description: description || '',
      allowedSections: validSections,
      isDefault: false,
      isActive: true,
      createdBy: auth.adminId,
    });

    await template.save();

    return NextResponse.json({
      success: true,
      template: {
        ...template.toObject(),
        id: template._id.toString(),
      },
    });
  } catch (error) {
    console.error('Error creating role template:', error);
    return NextResponse.json({ error: 'Failed to create role template' }, { status: 500 });
  }
}

// PUT - Update role template
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get current admin
    const currentAdmin = await Admin.findById(auth.adminId);
    if (!currentAdmin?.isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admin can manage role templates' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, allowedSections, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const template = await AdminRoleTemplate.findById(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Don't allow modifying default template names
    if (template.isDefault && name && name !== template.name) {
      return NextResponse.json({ error: 'Cannot rename default templates' }, { status: 403 });
    }

    // Update fields
    if (name && !template.isDefault) template.name = name;
    if (description !== undefined) template.description = description;
    if (typeof isActive === 'boolean') template.isActive = isActive;
    
    if (allowedSections) {
      template.allowedSections = allowedSections.filter((s: string) => 
        ADMIN_SECTIONS.includes(s as AdminSection)
      );
    }

    await template.save();

    // Update all employees using this template
    await Admin.updateMany(
      { roleTemplateId: id },
      { allowedSections: template.allowedSections }
    );

    return NextResponse.json({
      success: true,
      template: {
        ...template.toObject(),
        id: template._id.toString(),
      },
    });
  } catch (error) {
    console.error('Error updating role template:', error);
    return NextResponse.json({ error: 'Failed to update role template' }, { status: 500 });
  }
}

// DELETE - Delete role template
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get current admin
    const currentAdmin = await Admin.findById(auth.adminId);
    if (!currentAdmin?.isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admin can manage role templates' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const template = await AdminRoleTemplate.findById(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Don't allow deleting default templates
    if (template.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default templates' }, { status: 403 });
    }

    // Check if template is in use
    const usageCount = await Admin.countDocuments({ roleTemplateId: id });
    if (usageCount > 0) {
      return NextResponse.json({ 
        error: `This template is used by ${usageCount} employee(s). Please reassign them first.` 
      }, { status: 409 });
    }

    await AdminRoleTemplate.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting role template:', error);
    return NextResponse.json({ error: 'Failed to delete role template' }, { status: 500 });
  }
}

