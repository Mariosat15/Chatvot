import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * POST /api/customer-assignment/auto-assign
 * 
 * Automatically assigns a new customer to an employee based on settings.
 * Called after user registration.
 * 
 * Body: { userId, userEmail, userName }
 */
export async function POST(request: NextRequest) {
  console.log('🎯 [AutoAssign] API endpoint called');
  
  try {
    const body = await request.json();
    const { userId, userEmail, userName } = body;
    
    console.log('🎯 [AutoAssign] Request body:', { userId, userEmail, userName });

    if (!userId || !userEmail) {
      console.log('❌ [AutoAssign] Missing userId or userEmail');
      return NextResponse.json(
        { error: 'userId and userEmail are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      console.log('❌ [AutoAssign] Database connection failed');
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }
    
    console.log('✅ [AutoAssign] Database connected');

    // Get assignment settings
    const settingsCollection = db.collection('assignment_settings');
    const settingsDoc = await settingsCollection.findOne({});

    // Define settings interface
    interface AssignmentConfig {
      autoAssignEnabled: boolean;
      assignmentStrategy: string;
      assignableRoles: string[];
      maxCustomersPerEmployee: number;
      notifyEmployeeOnAssignment: boolean;
      notifyCustomerOnAssignment: boolean;
    }

    // If no settings exist, use defaults
    const settings: AssignmentConfig = settingsDoc ? {
      autoAssignEnabled: settingsDoc.autoAssignEnabled ?? false,
      assignmentStrategy: settingsDoc.assignmentStrategy ?? 'least_customers',
      assignableRoles: settingsDoc.assignableRoles ?? ['Backoffice'],
      maxCustomersPerEmployee: settingsDoc.maxCustomersPerEmployee ?? 0,
      notifyEmployeeOnAssignment: settingsDoc.notifyEmployeeOnAssignment ?? true,
      notifyCustomerOnAssignment: settingsDoc.notifyCustomerOnAssignment ?? false,
    } : {
      autoAssignEnabled: false,
      assignmentStrategy: 'least_customers',
      assignableRoles: ['Backoffice'],
      maxCustomersPerEmployee: 0,
      notifyEmployeeOnAssignment: true,
      notifyCustomerOnAssignment: false,
    };

    console.log('🔧 [AutoAssign] Settings loaded:', JSON.stringify(settings, null, 2));

    // Check if auto-assign is enabled
    if (!settings.autoAssignEnabled) {
      console.log(`⏭️ [AutoAssign] Auto-assignment is disabled for ${userEmail}`);
      return NextResponse.json({
        success: true,
        assigned: false,
        reason: 'Auto-assignment is disabled',
      });
    }
    
    console.log('✅ [AutoAssign] Auto-assignment is enabled');

    // Check if customer already has an assignment
    const assignmentsCollection = db.collection('customer_assignments');
    const existingAssignment = await assignmentsCollection.findOne({
      customerId: userId,
      isActive: true,
    });

    if (existingAssignment) {
      console.log(`⏭️ [AutoAssign] Customer ${userEmail} already assigned to ${existingAssignment.employeeName}`);
      return NextResponse.json({
        success: true,
        assigned: false,
        reason: 'Customer already assigned',
        employeeName: existingAssignment.employeeName,
      });
    }

    // Get eligible employees from admins collection
    const adminsCollection = db.collection('admins');
    const assignableRoles = settings.assignableRoles || ['Backoffice'];
    
    console.log('🔍 [AutoAssign] Looking for employees with roles:', assignableRoles);
    
    // First, let's see ALL admins in the database for debugging
    const allAdmins = await adminsCollection.find({}).toArray();
    console.log('📋 [AutoAssign] ALL admins in database:', allAdmins.map(a => ({
      email: a.email,
      role: a.role,
      status: a.status,
      isFirstLogin: a.isFirstLogin
    })));

    const eligibleEmployeesQuery: any = {
      status: 'active',
      role: { $in: assignableRoles },
    };
    
    console.log('🔍 [AutoAssign] Query:', JSON.stringify(eligibleEmployeesQuery));

    const eligibleEmployees = await adminsCollection.find(eligibleEmployeesQuery).toArray();
    
    console.log('👥 [AutoAssign] Eligible employees found:', eligibleEmployees.length, 
      eligibleEmployees.map(e => ({ email: e.email, role: e.role })));

    if (eligibleEmployees.length === 0) {
      console.log(`⚠️ [AutoAssign] No eligible employees found for ${userEmail}`);
      return NextResponse.json({
        success: true,
        assigned: false,
        reason: 'No eligible employees available',
      });
    }

    // Filter by max customers if set
    let availableEmployees = eligibleEmployees;
    if (settings.maxCustomersPerEmployee > 0) {
      const employeeCounts = await assignmentsCollection.aggregate([
        { $match: { isActive: true, employeeId: { $in: eligibleEmployees.map(e => e._id.toString()) } } },
        { $group: { _id: '$employeeId', count: { $sum: 1 } } },
      ]).toArray();

      const countMap = new Map(employeeCounts.map(e => [e._id, e.count]));
      availableEmployees = eligibleEmployees.filter(emp => {
        const count = countMap.get(emp._id.toString()) || 0;
        return count < settings.maxCustomersPerEmployee;
      });

      if (availableEmployees.length === 0) {
        console.log(`⚠️ [AutoAssign] All employees at max capacity for ${userEmail}`);
        return NextResponse.json({
          success: true,
          assigned: false,
          reason: 'All employees at maximum customer capacity',
        });
      }
    }

    // Select employee based on strategy
    let selectedEmployee: any = null;
    const strategy = settings.assignmentStrategy || 'least_customers';

    switch (strategy) {
      case 'least_customers': {
        const employeeCounts = await assignmentsCollection.aggregate([
          { $match: { isActive: true, employeeId: { $in: availableEmployees.map(e => e._id.toString()) } } },
          { $group: { _id: '$employeeId', count: { $sum: 1 } } },
        ]).toArray();

        const countMap = new Map(employeeCounts.map(e => [e._id, e.count]));
        
        // Sort by count ascending, pick the one with least customers
        availableEmployees.sort((a, b) => {
          const countA = countMap.get(a._id.toString()) || 0;
          const countB = countMap.get(b._id.toString()) || 0;
          return countA - countB;
        });
        selectedEmployee = availableEmployees[0];
        break;
      }
      case 'round_robin': {
        // Simple round robin - use modulo of current timestamp
        const index = Date.now() % availableEmployees.length;
        selectedEmployee = availableEmployees[index];
        break;
      }
      case 'newest_employee': {
        availableEmployees.sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        selectedEmployee = availableEmployees[0];
        break;
      }
      case 'oldest_employee': {
        availableEmployees.sort((a, b) => 
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
        selectedEmployee = availableEmployees[0];
        break;
      }
      case 'random':
      default: {
        const randomIndex = Math.floor(Math.random() * availableEmployees.length);
        selectedEmployee = availableEmployees[randomIndex];
        break;
      }
    }

    if (!selectedEmployee) {
      console.log(`⚠️ [AutoAssign] Could not select employee for ${userEmail}`);
      return NextResponse.json({
        success: true,
        assigned: false,
        reason: 'Could not select employee by strategy',
      });
    }

    // Create the assignment
    const assignment = {
      customerId: userId,
      customerEmail: userEmail.toLowerCase(),
      customerName: userName || userEmail.split('@')[0],
      employeeId: selectedEmployee._id.toString(),
      employeeName: selectedEmployee.name,
      employeeEmail: selectedEmployee.email,
      employeeRole: selectedEmployee.role || 'Backoffice',
      assignedAt: new Date(),
      assignedBy: {
        type: 'auto',
        reason: `Auto-assigned via ${strategy} strategy`,
        strategy: strategy,
      },
      isActive: true,
    };

    await assignmentsCollection.insertOne(assignment);

    console.log(`✅ [AutoAssign] Customer ${userEmail} assigned to ${selectedEmployee.name} (${selectedEmployee.email})`);

    // Log to audit trail
    try {
      const auditCollection = db.collection('customer_audit_trail');
      await auditCollection.insertOne({
        customerId: userId,
        customerEmail: userEmail.toLowerCase(),
        customerName: userName || userEmail.split('@')[0],
        action: 'customer_assigned',
        actionCategory: 'assignment',
        description: `Customer auto-assigned to ${selectedEmployee.name} (${selectedEmployee.role}) via ${strategy} strategy`,
        performedBy: {
          employeeId: 'system',
          employeeName: 'System',
          employeeEmail: 'system@auto-assign',
          employeeRole: 'system',
          department: 'Assignment',
        },
        metadata: {
          strategy,
          employeeId: selectedEmployee._id.toString(),
          employeeName: selectedEmployee.name,
          employeeRole: selectedEmployee.role,
        },
        timestamp: new Date(),
      });
    } catch (auditError) {
      console.error('Failed to log audit trail:', auditError);
    }

    return NextResponse.json({
      success: true,
      assigned: true,
      employee: {
        id: selectedEmployee._id.toString(),
        name: selectedEmployee.name,
        email: selectedEmployee.email,
        role: selectedEmployee.role,
      },
      strategy,
    });
  } catch (error) {
    console.error('❌ [AutoAssign] Error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-assign customer' },
      { status: 500 }
    );
  }
}

