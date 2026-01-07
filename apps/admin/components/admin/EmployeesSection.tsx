'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Mail, 
  Key, 
  Eye, 
  EyeOff,
  Trash2,
  Edit,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Send,
  FileText,
  Settings,
  Crown,
  User,
  Briefcase,
  DollarSign,
  HeadphonesIcon,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  email: string;
  name: string;
  role?: string;
  roleTemplateId?: string;
  allowedSections?: string[];
  isSuperAdmin: boolean;
  isOnline: boolean;
  lastLogin?: string;
  lastActivity?: string;
  createdAt: string;
  isFirstLogin?: boolean;
}

interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  allowedSections: string[];
  isDefault: boolean;
  isActive: boolean;
}

interface EmailTemplate {
  id: string;
  templateId: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  isActive: boolean;
}

const SECTION_LABELS: Record<string, string> = {
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

const SECTION_GROUPS = {
  'Dashboard': ['overview'],
  'Content': ['hero-page', 'marketplace'],
  'Trading': ['competitions', 'challenges', 'trading-history', 'analytics', 'market', 'symbols'],
  'User Management': ['users', 'badges'],
  'Finance': ['financial', 'payments', 'failed-deposits', 'withdrawals', 'pending-withdrawals'],
  'Security': ['kyc-settings', 'kyc-history', 'fraud'],
  'Help': ['wiki'],
  'Settings': ['credentials', 'email-templates', 'notifications', 'payment-providers', 'fee', 'invoicing', 'reconciliation', 'database'],
  'Developer': ['ai-agent', 'whitelabel', 'audit-logs'],
  'Admin': ['employees'],
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  'Super Admin': <Crown className="h-4 w-4 text-yellow-400" />,
  'Full Admin': <Shield className="h-4 w-4 text-purple-400" />,
  'Backoffice': <Briefcase className="h-4 w-4 text-blue-400" />,
  'Financial Officer': <DollarSign className="h-4 w-4 text-emerald-400" />,
  'Compliance Officer': <Scale className="h-4 w-4 text-orange-400" />,
  'Support Agent': <HeadphonesIcon className="h-4 w-4 text-cyan-400" />,
  'Content Manager': <FileText className="h-4 w-4 text-pink-400" />,
  'Custom': <User className="h-4 w-4 text-gray-400" />,
};

export default function EmployeesSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');
  const [accessError, setAccessError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // Create employee dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    roleTemplateId: '',
    customSections: [] as string[],
    password: '',
    autoGeneratePassword: true,
    sendEmail: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit employee dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    roleTemplateId: '',
    customSections: [] as string[],
  });

  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  // Reset password dialog
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Role template dialog
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RoleTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    allowedSections: [] as string[],
  });

  // Email template dialog
  const [showEmailTemplateDialog, setShowEmailTemplateDialog] = useState(false);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setAccessError(null);
      
      // First check super admin status
      const statusResponse = await fetch('/api/employees/upgrade-super-admin');
      const statusData = await statusResponse.json();
      
      if (statusData.needsUpgrade) {
        setNeedsUpgrade(true);
        setLoading(false);
        return;
      }
      
      if (!statusData.currentAdmin?.isSuperAdmin) {
        setAccessError('Only super admins can access employee management.');
        setLoading(false);
        return;
      }
      
      // Initialize templates first
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init_templates' }),
      });

      const response = await fetch('/api/employees');
      const data = await response.json();
      
      if (data.success) {
        setEmployees(data.employees || []);
        setRoleTemplates(data.roleTemplates || []);
        setEmailTemplates(data.emailTemplates || []);
        setAvailableSections(data.availableSections || []);
      } else if (data.error) {
        setAccessError(data.error);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeToSuperAdmin = async () => {
    try {
      setUpgrading(true);
      const response = await fetch('/api/employees/upgrade-super-admin', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        setNeedsUpgrade(false);
        // Reload the page to get fresh session
        window.location.reload();
      } else {
        toast.error(data.error || 'Failed to upgrade');
      }
    } catch (error) {
      console.error('Error upgrading:', error);
      toast.error('Failed to upgrade to super admin');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCreateEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newEmployee.name,
          email: newEmployee.email,
          roleTemplateId: newEmployee.roleTemplateId || undefined,
          customSections: !newEmployee.roleTemplateId ? newEmployee.customSections : undefined,
          password: newEmployee.autoGeneratePassword ? undefined : newEmployee.password,
          sendEmail: newEmployee.sendEmail,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(data.emailSent ? 'Employee created and credentials sent!' : 'Employee created successfully');
        
        if (data.generatedPassword) {
          setGeneratedPassword(data.generatedPassword);
        }
        
        setShowCreateDialog(false);
        setNewEmployee({
          name: '',
          email: '',
          roleTemplateId: '',
          customSections: [],
          password: '',
          autoGeneratePassword: true,
          sendEmail: true,
        });
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create employee');
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error('Failed to create employee');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;

    try {
      const response = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          roleTemplateId: editForm.roleTemplateId || undefined,
          customSections: !editForm.roleTemplateId ? editForm.customSections : undefined,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Employee updated successfully');
        setShowEditDialog(false);
        setEditingEmployee(null);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to update employee');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee');
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;

    try {
      const response = await fetch(`/api/employees/${deletingEmployee.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Employee deleted successfully');
        setShowDeleteDialog(false);
        setDeletingEmployee(null);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete employee');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordEmployee || !newPassword) return;

    try {
      const response = await fetch(`/api/employees/${resetPasswordEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          password: newPassword,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Password reset successfully');
        setShowResetPasswordDialog(false);
        setResetPasswordEmployee(null);
        setNewPassword('');
      } else {
        toast.error(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
    }
  };

  const handleSendCredentials = async (employee: Employee) => {
    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_credentials',
          employeeId: employee.id,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        if (data.emailSent) {
          toast.success('Credentials sent to ' + employee.email);
        } else {
          // Email failed but password was reset
          toast.warning(data.message || 'Email could not be sent');
          if (data.generatedPassword) {
            setGeneratedPassword(data.generatedPassword);
          }
        }
      } else {
        toast.error(data.error || 'Failed to send credentials');
      }
    } catch (error) {
      console.error('Error sending credentials:', error);
      toast.error('Failed to send credentials');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name) {
      toast.error('Template name is required');
      return;
    }

    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const body = editingTemplate 
        ? { ...templateForm, id: editingTemplate.id }
        : templateForm;

      const response = await fetch('/api/employees/role-templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(editingTemplate ? 'Template updated' : 'Template created');
        setShowTemplateDialog(false);
        setEditingTemplate(null);
        setTemplateForm({ name: '', description: '', allowedSections: [] });
        fetchData();
      } else {
        toast.error(data.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditForm({
      name: employee.name,
      email: employee.email,
      roleTemplateId: employee.roleTemplateId || '',
      customSections: employee.allowedSections || [],
    });
    setShowEditDialog(true);
  };

  const openTemplateDialog = (template?: RoleTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        description: template.description,
        allowedSections: template.allowedSections,
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ name: '', description: '', allowedSections: [] });
    }
    setShowTemplateDialog(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // Show upgrade option if no super admin exists
  if (needsUpgrade) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="bg-gray-800/50 border-gray-700 max-w-md">
          <CardHeader className="text-center">
            <Crown className="h-12 w-12 text-yellow-400 mx-auto mb-2" />
            <CardTitle className="text-white">Become Super Admin</CardTitle>
            <CardDescription className="text-gray-400">
              No super admin exists yet. As the first admin, you can upgrade yourself to Super Admin to manage employees.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={handleUpgradeToSuperAdmin}
              disabled={upgrading}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {upgrading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Upgrading...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Super Admin
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show access error
  if (accessError) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="bg-gray-800/50 border-gray-700 max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-red-400 mx-auto mb-2" />
            <CardTitle className="text-white">Access Denied</CardTitle>
            <CardDescription className="text-gray-400">
              {accessError}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-500">
              Contact your super admin to gain access to this section.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-400" />
            Employee Management
          </h2>
          <p className="text-gray-400 mt-1">
            Manage admin team members, roles, and permissions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-purple-600 hover:bg-purple-700">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Users className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{employees.length}</p>
                <p className="text-sm text-gray-400">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {employees.filter(e => e.isOnline).length}
                </p>
                <p className="text-sm text-gray-400">Online Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Crown className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {employees.filter(e => e.isSuperAdmin).length}
                </p>
                <p className="text-sm text-gray-400">Super Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{roleTemplates.length}</p>
                <p className="text-sm text-gray-400">Role Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-800/50 border border-gray-700">
          <TabsTrigger value="employees" className="data-[state=active]:bg-purple-600">
            <Users className="h-4 w-4 mr-2" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-purple-600">
            <Shield className="h-4 w-4 mr-2" />
            Role Templates
          </TabsTrigger>
          <TabsTrigger value="email-templates" className="data-[state=active]:bg-purple-600">
            <Mail className="h-4 w-4 mr-2" />
            Email Templates
          </TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-transparent">
                    <TableHead className="text-gray-400">Employee</TableHead>
                    <TableHead className="text-gray-400">Role</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Last Login</TableHead>
                    <TableHead className="text-gray-400">Sections</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id} className="border-gray-700">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            employee.isSuperAdmin ? "bg-yellow-500/20" : "bg-purple-500/20"
                          )}>
                            {employee.isSuperAdmin ? (
                              <Crown className="h-5 w-5 text-yellow-400" />
                            ) : (
                              <User className="h-5 w-5 text-purple-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-white">{employee.name}</p>
                            <p className="text-sm text-gray-400">{employee.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {ROLE_ICONS[employee.role || 'Custom'] || <User className="h-4 w-4 text-gray-400" />}
                          <span className="text-gray-300">{employee.role || 'Custom'}</span>
                          {employee.isSuperAdmin && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                              Super
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            employee.isOnline ? "bg-green-500" : "bg-gray-500"
                          )} />
                          <span className={employee.isOnline ? "text-green-400" : "text-gray-400"}>
                            {employee.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {formatDate(employee.lastLogin)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gray-600 text-gray-400">
                          {employee.isSuperAdmin ? 'All' : (employee.allowedSections?.length || 0)} sections
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!employee.isSuperAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendCredentials(employee)}
                                title="Send credentials email"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setResetPasswordEmployee(employee);
                                  setShowResetPasswordDialog(true);
                                }}
                                title="Reset password"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(employee)}
                                title="Edit employee"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => {
                                  setDeletingEmployee(employee);
                                  setShowDeleteDialog(true);
                                }}
                                title="Delete employee"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {employee.isSuperAdmin && (
                            <span className="text-xs text-gray-500 italic">Protected</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {employees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                        No employees yet. Click &quot;Add Employee&quot; to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Templates Tab */}
        <TabsContent value="roles">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openTemplateDialog()} className="bg-purple-600 hover:bg-purple-700">
                <Shield className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roleTemplates.map((template) => (
                <Card key={template.id} className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        {ROLE_ICONS[template.name] || <Shield className="h-5 w-5 text-purple-400" />}
                        {template.name}
                      </CardTitle>
                      {template.isDefault && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          Default
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-gray-400">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-400 mb-2">
                          Access to {template.allowedSections.length} sections
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {template.allowedSections.slice(0, 5).map((section) => (
                            <Badge 
                              key={section} 
                              variant="outline" 
                              className="text-xs border-gray-600 text-gray-400"
                            >
                              {SECTION_LABELS[section] || section}
                            </Badge>
                          ))}
                          {template.allowedSections.length > 5 && (
                            <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                              +{template.allowedSections.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTemplateDialog(template)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="email-templates">
          <div className="space-y-4">
            {emailTemplates.map((template) => (
              <Card key={template.id} className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-white">{template.name}</CardTitle>
                      <CardDescription className="text-gray-400">
                        Template ID: {template.templateId}
                      </CardDescription>
                    </div>
                    <Badge className={template.isActive ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-gray-400">Subject</Label>
                      <p className="text-white">{template.subject}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Available Variables</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.variables.map((v) => (
                          <Badge key={v} variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingEmailTemplate(template);
                          setShowEmailTemplateDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit Template
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Employee Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Employee</DialogTitle>
            <DialogDescription className="text-gray-400">
              Create a new admin team member with specific role and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Name *</Label>
                <Input
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  placeholder="John Doe"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Email *</Label>
                <Input
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  placeholder="john@company.com"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Role Template</Label>
              <Select
                value={newEmployee.roleTemplateId || "custom"}
                onValueChange={(value) => setNewEmployee({ ...newEmployee, roleTemplateId: value === "custom" ? "" : value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select a role template or use custom permissions" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="custom">Custom Permissions</SelectItem>
                  {roleTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} - {template.allowedSections.length} sections
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!newEmployee.roleTemplateId && (
              <div className="space-y-2">
                <Label className="text-gray-300">Custom Permissions</Label>
                <div className="border border-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto space-y-4">
                  {Object.entries(SECTION_GROUPS).map(([group, sections]) => (
                    <div key={group}>
                      <p className="font-medium text-gray-300 mb-2">{group}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {sections.map((section) => (
                          <label key={section} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={newEmployee.customSections.includes(section)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewEmployee({
                                    ...newEmployee,
                                    customSections: [...newEmployee.customSections, section],
                                  });
                                } else {
                                  setNewEmployee({
                                    ...newEmployee,
                                    customSections: newEmployee.customSections.filter((s) => s !== section),
                                  });
                                }
                              }}
                            />
                            <span className="text-sm text-gray-400">{SECTION_LABELS[section] || section}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-700 pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="autoPassword"
                  checked={newEmployee.autoGeneratePassword}
                  onCheckedChange={(checked) => 
                    setNewEmployee({ ...newEmployee, autoGeneratePassword: checked as boolean })
                  }
                />
                <Label htmlFor="autoPassword" className="text-gray-300 cursor-pointer">
                  Auto-generate password
                </Label>
              </div>

              {!newEmployee.autoGeneratePassword && (
                <div className="space-y-2">
                  <Label className="text-gray-300">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newEmployee.password}
                      onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                      placeholder="Enter password (min 8 characters)"
                      className="bg-gray-800 border-gray-700 text-white pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="sendEmail"
                  checked={newEmployee.sendEmail}
                  onCheckedChange={(checked) => 
                    setNewEmployee({ ...newEmployee, sendEmail: checked as boolean })
                  }
                />
                <Label htmlFor="sendEmail" className="text-gray-300 cursor-pointer">
                  Send credentials via email
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateEmployee} 
              disabled={creating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {creating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Employee
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Employee</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update employee details and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Role Template</Label>
              <Select
                value={editForm.roleTemplateId || "custom"}
                onValueChange={(value) => setEditForm({ ...editForm, roleTemplateId: value === "custom" ? "" : value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select a role template" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="custom">Custom Permissions</SelectItem>
                  {roleTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editForm.roleTemplateId && (
              <div className="space-y-2">
                <Label className="text-gray-300">Custom Permissions</Label>
                <div className="border border-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto space-y-4">
                  {Object.entries(SECTION_GROUPS).map(([group, sections]) => (
                    <div key={group}>
                      <p className="font-medium text-gray-300 mb-2">{group}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {sections.map((section) => (
                          <label key={section} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={editForm.customSections.includes(section)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setEditForm({
                                    ...editForm,
                                    customSections: [...editForm.customSections, section],
                                  });
                                } else {
                                  setEditForm({
                                    ...editForm,
                                    customSections: editForm.customSections.filter((s) => s !== section),
                                  });
                                }
                              }}
                            />
                            <span className="text-sm text-gray-400">{SECTION_LABELS[section] || section}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEmployee} className="bg-purple-600 hover:bg-purple-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Employee</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete {deletingEmployee?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteEmployee} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Reset Password</DialogTitle>
            <DialogDescription className="text-gray-400">
              Set a new password for {resetPasswordEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">New Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  className="bg-gray-800 border-gray-700 text-white pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
              setShowResetPasswordDialog(false);
              setNewPassword('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} className="bg-purple-600 hover:bg-purple-700">
              <Key className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingTemplate ? 'Edit Role Template' : 'Create Role Template'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Define which sections this role can access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Template Name</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="e.g., Marketing Team"
                className="bg-gray-800 border-gray-700 text-white"
                disabled={editingTemplate?.isDefault}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Description</Label>
              <Textarea
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                placeholder="Brief description of this role..."
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Allowed Sections</Label>
              <div className="border border-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto space-y-4">
                {Object.entries(SECTION_GROUPS).map(([group, sections]) => (
                  <div key={group}>
                    <p className="font-medium text-gray-300 mb-2">{group}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {sections.map((section) => (
                        <label key={section} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={templateForm.allowedSections.includes(section)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setTemplateForm({
                                  ...templateForm,
                                  allowedSections: [...templateForm.allowedSections, section],
                                });
                              } else {
                                setTemplateForm({
                                  ...templateForm,
                                  allowedSections: templateForm.allowedSections.filter((s) => s !== section),
                                });
                              }
                            }}
                          />
                          <span className="text-sm text-gray-400">{SECTION_LABELS[section] || section}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} className="bg-purple-600 hover:bg-purple-700">
              <Shield className="h-4 w-4 mr-2" />
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Password Display */}
      {generatedPassword && (
        <Dialog open={!!generatedPassword} onOpenChange={() => setGeneratedPassword('')}>
          <DialogContent className="bg-gray-900 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Employee Created</DialogTitle>
              <DialogDescription className="text-gray-400">
                Here is the generated password. Make sure to save it securely.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg">
                <code className="text-green-400 font-mono flex-1">{generatedPassword}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(generatedPassword)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-yellow-400 mt-2">
                ⚠️ This password will not be shown again. Copy it now!
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setGeneratedPassword('')} className="bg-purple-600 hover:bg-purple-700">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

