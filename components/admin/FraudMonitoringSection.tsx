'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Shield, AlertTriangle, Users, Monitor, RefreshCw, Search, 
  Eye, CheckCircle, XCircle, Clock, Ban, Info, TrendingUp, Activity, Settings, Bug,
  UserX, Trash2, AlertOctagon, ExternalLink 
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import FraudSettingsSection from '@/components/admin/FraudSettingsSection';
import FraudDebugger from '@/components/admin/FraudDebugger';
import RestrictedUsersSection from '@/components/admin/RestrictedUsersSection';
import SuspicionScoreCard from '@/components/admin/fraud/SuspicionScoreCard';
import FraudHistorySection from '@/components/admin/FraudHistorySection';
import { History } from 'lucide-react';

interface FraudAlert {
  _id: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  primaryUserId: string;
  suspiciousUserIds: string[];
  confidence: number;
  title: string;
  description: string;
  detectedAt: string;
  evidence: Array<{
    type: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
  }>;
  resolution?: string;
  actionTaken?: string;
}

interface DeviceFingerprint {
  _id: string;
  fingerprintId: string;
  userId: string;
  deviceType: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  screenResolution: string;
  timezone: string;
  language: string;
  ipAddress: string;
  linkedUserIds: string[];
  riskScore: number;
  firstSeen: string;
  lastSeen: string;
  timesUsed: number;
  isVPN: boolean;
  isProxy: boolean;
}

interface FraudStats {
  total: number;
  pending: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  critical: number;
  high: number;
}

interface DeviceStats {
  totalDevices: number;
  suspiciousDevices: number;
  highRiskDevices: number;
  vpnDevices: number;
  proxyDevices: number;
}

export default function FraudMonitoringSection() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [devices, setDevices] = useState<DeviceFingerprint[]>([]);
  const [stats, setStats] = useState<FraudStats | null>(null);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceFingerprint | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'dismiss' | 'ban' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvestigationAlert, setSelectedInvestigationAlert] = useState<FraudAlert | null>(null);
  const [investigationActionType, setInvestigationActionType] = useState<'suspend' | 'dismiss' | 'ban' | null>(null);
  const [showInvestigationDialog, setShowInvestigationDialog] = useState(false);
  const [suspendDuration, setSuspendDuration] = useState<number>(7);
  const [suspendUnit, setSuspendUnit] = useState<'hours' | 'days' | 'weeks'>('days');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [restrictionReason, setRestrictionReason] = useState<string>('multi_accounting');
  const [customRestrictionReason, setCustomRestrictionReason] = useState<string>('');
  const [blockTrading, setBlockTrading] = useState<boolean>(true);
  const [blockCompetitions, setBlockCompetitions] = useState<boolean>(true);
  const [blockDeposit, setBlockDeposit] = useState<boolean>(true);
  const [blockWithdraw, setBlockWithdraw] = useState<boolean>(true);
  const [fraudScores, setFraudScores] = useState<Record<string, any>>({});
  const [selectedScoreUserId, setSelectedScoreUserId] = useState<string | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);

  useEffect(() => {
    fetchAlerts();
    fetchDevices();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAlerts();
      fetchDevices();
    }, 30000);

    return () => clearInterval(interval);
  }, [statusFilter]);

  // Adjust status filter for API call
  const apiStatusFilter = statusFilter === 'all' ? '' : statusFilter;

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/fraud/alerts?status=${apiStatusFilter}&limit=100`);
      
      if (!response.ok) {
        console.error('API response not OK:', response.status, response.statusText);
        toast.error(`Failed to fetch fraud alerts: ${response.status}`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('✅ Fraud alerts fetched:', data);
      
      if (data.success === false) {
        console.error('API returned success:false:', data);
        toast.error(data.error || 'Failed to fetch fraud alerts');
        setLoading(false);
        return;
      }

      // Ensure alerts is an array
      const alertsArray = Array.isArray(data.alerts) ? data.alerts : [];
      setAlerts(alertsArray);
      setStats(data.stats || {
        total: 0,
        pending: 0,
        investigating: 0,
        resolved: 0,
        dismissed: 0,
        critical: 0,
        high: 0
      });
      
      console.log(`📊 Loaded ${alertsArray.length} alerts`);
    } catch (error) {
      console.error('❌ Error fetching alerts:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
      toast.error('Error loading fraud alerts - check console for details');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/admin/fraud/devices?minRiskScore=50&limit=50');
      
      if (!response.ok) {
        console.error('Devices API response not OK:', response.status);
        return;
      }

      const data = await response.json();
      console.log('✅ Suspicious devices fetched:', data);
      
      if (data.success === false) {
        console.error('Devices API returned success:false:', data);
        return;
      }

      // Ensure devices is an array
      const devicesArray = Array.isArray(data.devices) ? data.devices : [];
      setDevices(devicesArray);
      setDeviceStats(data.stats || {
        totalDevices: 0,
        suspiciousDevices: 0,
        highRiskDevices: 0,
        vpnDevices: 0,
        proxyDevices: 0
      });
      
      console.log(`📊 Loaded ${devicesArray.length} suspicious devices`);
    } catch (error) {
      console.error('❌ Error fetching devices:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
    }
  };

  // Fetch fraud score for a user
  const fetchFraudScore = async (userId: string) => {
    try {
      const response = await fetch(`/api/fraud/suspicion-score?userId=${userId}`);
      
      if (!response.ok) {
        console.error('Score API response not OK:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.success && data.score) {
        setFraudScores(prev => ({
          ...prev,
          [userId]: data.score
        }));
        return data.score;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error fetching fraud score:', error);
      return null;
    }
  };

  // Fetch fraud scores for all users in an alert
  const fetchScoresForAlert = async (alert: FraudAlert) => {
    const userIds = alert.suspiciousUserIds;
    const promises = userIds.map(userId => fetchFraudScore(userId));
    await Promise.all(promises);
  };

  // Get fraud score for a user (from cache or fetch)
  const getFraudScore = (userId: string) => {
    return fraudScores[userId] || null;
  };

  // Get risk badge color
  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-500 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  // Device action handlers
  const handleDeviceAction = (device: DeviceFingerprint, action: 'suspend' | 'dismiss' | 'ban') => {
    setSelectedDevice(device);
    setActionType(action);
    setActionReason('');
    setShowActionDialog(true);
  };

  const executeDeviceAction = async () => {
    if (!selectedDevice || !actionType) return;

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/fraud/devices/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice._id,
          action: actionType,
          reason: actionReason
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message);
        setShowActionDialog(false);
        setSelectedDevice(null);
        setActionType(null);
        setActionReason('');
        // Refresh data
        await fetchDevices();
        await fetchAlerts();
      } else {
        toast.error(data.message || 'Failed to perform action');
      }
    } catch (error) {
      console.error('Error performing device action:', error);
      toast.error('Failed to perform action');
    }
  };

  // Reset all alerts handler
  const handleResetAllAlerts = async () => {
    if (!resetPassword) {
      toast.error('Admin password is required');
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/fraud/reset-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: resetPassword })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message);
        setShowResetDialog(false);
        setResetPassword('');
        // Refresh data
        await fetchAlerts();
        await fetchDevices();
      } else {
        toast.error(data.message || 'Failed to reset alerts');
      }
    } catch (error) {
      console.error('Error resetting alerts:', error);
      toast.error('Failed to reset alerts');
    }
  };

  // Investigation action handlers
  const handleInvestigationAction = (alert: FraudAlert, action: 'suspend' | 'dismiss' | 'ban') => {
    setSelectedInvestigationAlert(alert);
    setInvestigationActionType(action);
    // By default, select all suspicious accounts
    setSelectedUserIds(alert.suspiciousUserIds);
    // Reset restriction settings
    setRestrictionReason('multi_accounting');
    setCustomRestrictionReason('');
    setBlockTrading(true);
    setBlockCompetitions(true);
    setBlockDeposit(true);
    setBlockWithdraw(true);
    setShowInvestigationDialog(true);
  };

  const executeInvestigationAction = async () => {
    if (!selectedInvestigationAlert || !investigationActionType) return;

    // Validate selection
    if ((investigationActionType === 'ban' || investigationActionType === 'suspend') && selectedUserIds.length === 0) {
      toast.error('Please select at least one account to restrict');
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      let endpoint = '';
      const body: Record<string, unknown> = {
        alertId: selectedInvestigationAlert._id,
        action: investigationActionType,
        userIds: selectedUserIds,
        reason: restrictionReason,
        customReason: customRestrictionReason,
        restrictions: {
          canTrade: !blockTrading,
          canEnterCompetitions: !blockCompetitions,
          canDeposit: !blockDeposit,
          canWithdraw: !blockWithdraw
        }
      };

      if (investigationActionType === 'suspend') {
        // Calculate suspension duration in milliseconds
        const durationMs = suspendDuration * (
          suspendUnit === 'hours' ? 3600000 :
          suspendUnit === 'days' ? 86400000 :
          604800000 // weeks
        );
        body.suspendUntil = new Date(Date.now() + durationMs).toISOString();
        endpoint = '/api/admin/fraud/investigation/suspend';
      } else if (investigationActionType === 'ban') {
        endpoint = '/api/admin/fraud/investigation/ban';
      } else if (investigationActionType === 'dismiss') {
        endpoint = '/api/admin/fraud/investigation/dismiss';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message);
        setShowInvestigationDialog(false);
        setSelectedInvestigationAlert(null);
        setInvestigationActionType(null);
        setSelectedUserIds([]);
        // Refresh alerts
        await fetchAlerts();
      } else {
        toast.error(data.message || 'Failed to perform action');
      }
    } catch (error) {
      console.error('Error performing investigation action:', error);
      toast.error('Failed to perform action');
    }
  };

  const handleElevateToInvestigation = async (alertId: string) => {
    try {
      await handleUpdateAlertStatus(alertId, 'investigating', 'none', 'Elevated to Investigation Center for detailed review');
      toast.success('Alert elevated to Investigation Center');
      await fetchAlerts();
    } catch (error) {
      console.error('Error elevating alert:', error);
      toast.error('Failed to elevate alert');
    }
  };

  const handleUpdateAlertStatus = async (
    alertId: string,
    status: string,
    actionTaken?: string,
    resolution?: string
  ) => {
    try {
      const response = await fetch(`/api/admin/fraud/alerts/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, actionTaken, resolution })
      });

      if (response.ok) {
        toast.success(`Alert ${status}`);
        fetchAlerts();
        setDetailsDialogOpen(false);
      } else {
        toast.error('Failed to update alert');
      }
    } catch (error) {
      console.error('Error updating alert:', error);
      toast.error('Error updating alert');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'low': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      same_device: 'Same Device',
      same_ip: 'Same IP',
      mirror_trading: 'Mirror Trading',
      same_payment: 'Same Payment',
      coordinated_entry: 'Coordinated Entry',
      suspicious_behavior: 'Suspicious Behavior',
      vpn_usage: 'VPN Usage',
      high_risk_device: 'High Risk Device'
    };
    return labels[type] || type;
  };

  const filteredAlerts = alerts.filter(alert => {
    // First filter by status - exclude 'investigating' from alerts tab (they appear in Investigation Center)
    const statusMatch = statusFilter === 'all' 
      ? alert.status !== 'investigating' // Exclude investigating alerts from Fraud Alerts tab
      : alert.status === statusFilter;
    
    if (!statusMatch) return false;
    
    // Then filter by search query
    return (
      alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.primaryUserId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.suspiciousUserIds.some(id => id.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-100 flex items-center gap-2">
            <Shield className="h-8 w-8 text-red-500" />
            Fraud Monitoring
          </h2>
          <p className="text-gray-400 mt-1">
            Detect and prevent multi-accounting and fraudulent activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowResetDialog(true)}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset All Alerts
          </Button>
          <Button
            onClick={() => {
              fetchAlerts();
              fetchDevices();
            }}
            variant="outline"
            className="bg-gray-800 border-gray-700 hover:bg-gray-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && deviceStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-red-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Critical Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">{stats.critical}</div>
              <p className="text-xs text-gray-500 mt-1">Require immediate attention</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-orange-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Pending Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">{stats.pending}</div>
              <p className="text-xs text-gray-500 mt-1">Awaiting review</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Investigation Center
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">{stats.investigating}</div>
              <p className="text-xs text-gray-500 mt-1">Active investigations</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Resolved Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">{stats.resolved + stats.dismissed}</div>
              <p className="text-xs text-gray-500 mt-1">Closed investigations</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="alerts" className="data-[state=active]:bg-gray-700">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Fraud Alerts
            {stats && stats.pending > 0 && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 text-xs">{stats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="investigation" className="data-[state=active]:bg-gray-700">
            <Activity className="h-4 w-4 mr-2" />
            Investigation Center
          </TabsTrigger>
          <TabsTrigger value="resolved" className="data-[state=active]:bg-gray-700">
            <CheckCircle className="h-4 w-4 mr-2" />
            Resolved
            {stats && (stats.resolved + stats.dismissed) > 0 && (
              <Badge className="ml-2 bg-green-500/20 text-green-400 text-xs">{stats.resolved + stats.dismissed}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="restricted" className="data-[state=active]:bg-gray-700">
            <Ban className="h-4 w-4 mr-2" />
            Restricted Users
          </TabsTrigger>
        <TabsTrigger value="settings" className="data-[state=active]:bg-gray-700">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </TabsTrigger>
        <TabsTrigger value="debug" className="data-[state=active]:bg-gray-700">
          <Bug className="h-4 w-4 mr-2" />
          Debug
        </TabsTrigger>
        <TabsTrigger value="history" className="data-[state=active]:bg-gray-700">
          <History className="h-4 w-4 mr-2" />
          History
        </TabsTrigger>
      </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by user ID or alert title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alerts List */}
          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">No fraud alerts found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {statusFilter ? 'Try changing the status filter' : 'All clear! No suspicious activity detected.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredAlerts.map((alert) => (
                <Card key={alert._id} className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="border-gray-600 text-gray-400">
                            {getAlertTypeLabel(alert.alertType)}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(alert.detectedAt).toLocaleString()}
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-100 mb-1">
                          {alert.title}
                        </h3>
                        
                        <p className="text-sm text-gray-400 mb-3">
                          {alert.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {alert.suspiciousUserIds.length} accounts
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {Math.round(alert.confidence * 100)}% confidence
                          </span>
                          {alert.evidence?.[0]?.data?.totalActivities && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <TrendingUp className="h-3 w-3" />
                              {alert.evidence[0].data.totalActivities} activities
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAlert(alert);
                            setDetailsDialogOpen(true);
                          }}
                          className="bg-gray-700 border-gray-600 hover:bg-gray-600"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                        {alert.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleElevateToInvestigation(alert._id)}
                            className="bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30"
                          >
                            <Activity className="h-4 w-4 mr-1" />
                            Investigate
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Investigation Center Tab */}
        <TabsContent value="investigation" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Investigation Center
              </CardTitle>
              <CardDescription className="text-gray-400">
                Alerts elevated for detailed investigation - Take action on suspicious accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.filter(a => a.status === 'investigating').length === 0 ? (
                  <div className="py-12 text-center">
                    <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg font-medium">No cases under investigation</p>
                    <p className="text-gray-500 text-sm mt-2">
                      Elevate alerts from the "Fraud Alerts" tab to investigate them here
                    </p>
                  </div>
                ) : (
                  alerts.filter(a => a.status === 'investigating').map((alert) => {
                    // Fetch scores for this alert (if not already cached)
                    if (!getFraudScore(alert.primaryUserId)) {
                      fetchScoresForAlert(alert);
                    }
                    
                    return (
                    <Card key={alert._id} className="bg-gray-900 border-gray-700">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-6">
                          {/* Alert Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                                <Activity className="h-3 w-3 mr-1" />
                                INVESTIGATING
                              </Badge>
                              {/* Fraud Score Badge */}
                              {(() => {
                                const primaryScore = getFraudScore(alert.primaryUserId);
                                if (primaryScore) {
                                  return (
                                    <Badge 
                                      className={getRiskBadgeColor(primaryScore.riskLevel)}
                                      title={`Fraud Score: ${primaryScore.totalScore}%`}
                                    >
                                      📊 {primaryScore.totalScore}%
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                              <span className="text-xs text-gray-500">
                                {new Date(alert.detectedAt).toLocaleString()}
                              </span>
                            </div>
                            
                            <h3 className="text-xl font-semibold text-gray-100 mb-2">
                              {alert.title}
                            </h3>
                            
                            <p className="text-sm text-gray-400 mb-4">
                              {alert.description}
                            </p>
                            
                            <div className="flex items-center gap-6 text-sm text-gray-500">
                              <span className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <strong className="text-gray-100">{alert.suspiciousUserIds.length}</strong> suspicious accounts
                              </span>
                              <span className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                <strong className="text-gray-100">{Math.round(alert.confidence * 100)}%</strong> confidence
                              </span>
                              {alert.evidence?.[0]?.data?.totalActivities && (
                                <span className="flex items-center gap-2 text-blue-400">
                                  <Activity className="h-4 w-4" />
                                  <strong>{alert.evidence[0].data.totalActivities}</strong> activities
                                </span>
                              )}
                            </div>

                            {/* User IDs */}
                            <div className="mt-4 pt-4 border-t border-gray-700">
                              <p className="text-xs text-gray-500 mb-2">Suspicious Accounts:</p>
                              <div className="flex flex-wrap gap-2">
                                {alert.suspiciousUserIds.slice(0, 3).map((userId, idx) => (
                                  <span key={userId} className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-1 rounded">
                                    {userId.substring(0, 12)}...
                                  </span>
                                ))}
                                {alert.suspiciousUserIds.length > 3 && (
                                  <span className="text-xs text-gray-500 px-2 py-1">
                                    +{alert.suspiciousUserIds.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex flex-col gap-3 min-w-[140px]">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAlert(alert);
                                setDetailsDialogOpen(true);
                              }}
                              className="bg-gray-700 border-gray-600 hover:bg-gray-600 w-full"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const score = await fetchFraudScore(alert.primaryUserId);
                                if (score) {
                                  setSelectedScoreUserId(alert.primaryUserId);
                                  setShowScoreDialog(true);
                                } else {
                                  toast.error('No fraud score available for this user');
                                }
                              }}
                              className="bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 w-full"
                            >
                              📊 View Score
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInvestigationAction(alert, 'suspend')}
                              className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 w-full"
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Suspend
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInvestigationAction(alert, 'ban')}
                              className="border-red-500/30 text-red-500 hover:bg-red-500/10 w-full"
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Ban All
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInvestigationAction(alert, 'dismiss')}
                              className="border-green-500/30 text-green-500 hover:bg-green-500/10 w-full"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <FraudSettingsSection />
        </TabsContent>

        {/* Resolved Tab - Shows dismissed and resolved alerts */}
        <TabsContent value="resolved" className="space-y-4">
          <div className="p-4 bg-green-900/20 border border-green-700/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-semibold text-green-400">Resolved & Dismissed Alerts</h3>
            </div>
            <p className="text-sm text-gray-400">
              These alerts have been reviewed and handled. They will NOT generate new alerts for the same issue.
              To re-enable monitoring for specific users, you need to manually delete the resolved alert.
            </p>
          </div>
          
          <div className="space-y-4">
            {alerts.filter(a => a.status === 'resolved' || a.status === 'dismissed').length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No resolved or dismissed alerts</p>
                </CardContent>
              </Card>
            ) : (
              alerts.filter(a => a.status === 'resolved' || a.status === 'dismissed').map(alert => (
                <Card key={alert._id} className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={alert.status === 'resolved' 
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }>
                            {alert.status === 'resolved' ? '✓ Resolved' : '✕ Dismissed'}
                          </Badge>
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 capitalize">
                            {alert.alertType.replace(/_/g, ' ')}
                          </Badge>
                          {(alert as any).competitionId && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                              Competition: {((alert as any).competitionId as string).substring(0, 8)}...
                            </Badge>
                          )}
                        </div>
                        <h4 className="text-lg font-semibold text-gray-100">{alert.title}</h4>
                        <p className="text-sm text-gray-400 mt-1">{alert.description}</p>
                        
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {alert.suspiciousUserIds.length} accounts
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Resolved: {new Date((alert as any).resolvedAt || (alert as any).updatedAt).toLocaleDateString()}
                          </span>
                          {alert.actionTaken && (
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              Action: {alert.actionTaken}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                        onClick={() => {
                          setSelectedAlert(alert);
                          setDetailsDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Restricted Users Tab */}
        <TabsContent value="restricted" className="space-y-4">
          <RestrictedUsersSection />
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <FraudDebugger />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <FraudHistorySection />
        </TabsContent>
      </Tabs>

      {/* Alert Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-[98vw] w-[98vw] max-h-[92vh] overflow-y-auto" style={{ maxWidth: '98vw', width: '98vw' }}>
          {selectedAlert && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl text-gray-100 flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                  {selectedAlert.title}
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  {selectedAlert.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4 px-2">
                {/* Alert Info */}
                <div className="grid grid-cols-4 gap-8">
                  <div>
                    <Label className="text-gray-400 text-sm">Severity</Label>
                    <Badge className={`${getSeverityColor(selectedAlert.severity)} mt-1`}>
                      {selectedAlert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Type</Label>
                    <p className="text-gray-100 mt-1">{getAlertTypeLabel(selectedAlert.alertType)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Confidence</Label>
                    <p className="text-gray-100 mt-1">{Math.round(selectedAlert.confidence * 100)}%</p>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Detected</Label>
                    <p className="text-gray-100 mt-1">{new Date(selectedAlert.detectedAt).toLocaleString()}</p>
                  </div>
                </div>

                {/* Detection Methods Summary */}
                <div className="p-4 bg-gradient-to-r from-red-900/30 to-orange-900/30 rounded-lg border border-red-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Detection Methods Summary
                    </h4>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-sm">
                      {selectedAlert.evidence.length} total detection{selectedAlert.evidence.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {/* Group evidence by type and show count */}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {Object.entries(
                      selectedAlert.evidence.reduce((acc: Record<string, number>, e: { type: string }) => {
                        acc[e.type] = (acc[e.type] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([type, count]) => (
                      <Badge 
                        key={type} 
                        className="bg-gray-700 text-gray-200 border-gray-600 px-3 py-1"
                      >
                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {count > 1 && <span className="ml-1 text-yellow-400">×{count}</span>}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Timeline showing when detections were added */}
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    <p className="text-xs text-gray-400 mb-2">Detection Timeline:</p>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {/* eslint-disable @typescript-eslint/no-explicit-any */}
                      {selectedAlert.evidence
                        .filter((e: any) => e.data?.detectedAt)
                        .sort((a: any, b: any) => new Date(a.data.detectedAt).getTime() - new Date(b.data.detectedAt).getTime())
                        .map((e: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-1 text-xs whitespace-nowrap">
                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                            <span className="text-gray-500">{new Date(e.data.detectedAt).toLocaleTimeString()}</span>
                            <span className="text-gray-400 capitalize">{e.type.replace(/_/g, ' ').substring(0, 15)}...</span>
                            {idx < selectedAlert.evidence.filter((e: any) => e.data?.detectedAt).length - 1 && (
                              <span className="text-gray-600 mx-1">→</span>
                            )}
                          </div>
                        ))}
                      {/* eslint-enable @typescript-eslint/no-explicit-any */}
                    </div>
                  </div>
                </div>

                {/* Suspicious Users */}
                <div>
                  <Label className="text-gray-400 text-sm">Suspicious Accounts ({selectedAlert.suspiciousUserIds.length})</Label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    {selectedAlert.suspiciousUserIds.map((userId, idx) => (
                      <div key={userId} className="p-4 bg-gray-800 rounded border border-gray-700 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-yellow-500 font-bold text-lg flex-shrink-0">#{idx + 1}</span>
                          <span className="text-gray-100 font-mono text-sm break-all">{userId}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Navigate to Users tab and copy user ID to clipboard
                            navigator.clipboard.writeText(userId);
                            toast.success(`User ID copied! Switch to Users tab to search.`);
                            // Close this dialog and switch to Users tab
                            setDetailsDialogOpen(false);
                            // Trigger a tab switch if possible (you can add state management for this)
                          }}
                          className="bg-blue-600 hover:bg-blue-700 border-blue-500 text-white flex-shrink-0"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View User
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence - Dynamic accumulation of detections */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-gray-400 text-sm">
                      Evidence ({selectedAlert.evidence.length} detection{selectedAlert.evidence.length !== 1 ? 's' : ''})
                    </Label>
                    <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                      Auto-updating as new fraud is detected
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-3">
                    {selectedAlert.evidence.map((evidence, index) => (
                      <div key={index} className="p-4 bg-gray-800 rounded border border-gray-700 relative">
                        {/* Detection number badge */}
                        <div className="absolute -top-2 -left-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                          #{index + 1}
                        </div>
                        
                        {/* Detection timestamp */}
                        {evidence.data?.detectedAt && (
                          <div className="absolute -top-2 right-2 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(evidence.data.detectedAt).toLocaleString()}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mb-3 mt-2">
                          <Badge className="bg-purple-500/20 text-purple-400 text-xs capitalize">
                            {evidence.type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        
                        <p className="font-semibold text-gray-100 mb-3">{evidence.description}</p>
                        
                        {/* Show detailed account info if available */}
                        {evidence.data.accountsDetails && evidence.data.accountsDetails.length > 0 ? (
                          <div className="space-y-3">
                            {evidence.data.accountsDetails.map((account: any, accIndex: number) => (
                              <div key={accIndex} className="p-3 bg-gray-900 rounded border border-gray-600">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="h-4 w-4 text-yellow-500" />
                                  <span className="font-mono text-xs text-yellow-500">
                                    Account {accIndex + 1}: {account.userId}
                                  </span>
                                </div>
                                
                                <div className="space-y-2 mt-2">
                                  <p className="text-xs text-gray-400">
                                    Devices Used: <span className="text-gray-100 font-semibold">{account.devicesUsed.length}</span>
                                  </p>
                                  
                                  {account.devicesUsed.map((device: any, devIndex: number) => (
                                    <div key={devIndex} className="ml-2 p-5 bg-gray-950 rounded border border-gray-700">
                                      <div className="grid grid-cols-5 gap-x-8 gap-y-3 text-sm">
                                        {/* Row 1: Browser Info */}
                                        <div>
                                          <span className="text-gray-500 font-semibold">Browser:</span>
                                          <span className="text-gray-200 ml-1">{device.browser}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 font-semibold">Version:</span>
                                          <span className="text-gray-200 ml-1">{device.browserVersion || 'N/A'}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 font-semibold">OS:</span>
                                          <span className="text-gray-200 ml-1">{device.os}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 font-semibold">OS Version:</span>
                                          <span className="text-gray-200 ml-1">{device.osVersion || 'N/A'}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 font-semibold">Screen:</span>
                                          <span className="text-gray-200 ml-1">{device.screenResolution}</span>
                                        </div>
                                        
                                        {/* Row 2: Display & Location Info */}
                                        <div>
                                          <span className="text-gray-500 font-semibold">Color Depth:</span>
                                          <span className="text-gray-200 ml-1">{device.colorDepth || 'N/A'} bit</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 font-semibold">Timezone:</span>
                                          <span className="text-gray-200 ml-1">{device.timezone}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 font-semibold">Language:</span>
                                          <span className="text-gray-200 ml-1">{device.language || 'N/A'}</span>
                                        </div>
                                        
                                        {/* Network Info */}
                                        <div>
                                          <span className="text-gray-500 font-semibold">IP Address:</span>
                                          <span className="text-gray-200 ml-1">{device.ipAddress}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 font-semibold">Times Used:</span>
                                          <span className="text-gray-200 ml-1">{device.timesUsed}</span>
                                        </div>
                                        <div className="col-span-3">
                                          <span className="text-gray-500 font-semibold">Last Seen:</span>
                                          <span className="text-gray-200 ml-1">
                                            {new Date(device.lastSeen).toLocaleString()}
                                          </span>
                                        </div>
                                        
                                        {/* User Agent */}
                                        <div className="col-span-5">
                                          <span className="text-gray-500 font-semibold">User Agent:</span>
                                          <p className="text-gray-200 mt-1 text-xs break-all">{device.userAgent || 'N/A'}</p>
                                        </div>
                                        
                                        {/* WebGL (GPU Info) */}
                                        {device.webgl && device.webgl !== 'unavailable' && (
                                          <div className="col-span-5">
                                            <span className="text-gray-500 font-semibold">GPU (WebGL):</span>
                                            <p className="text-yellow-400 mt-1 text-xs break-all">{device.webgl}</p>
                                          </div>
                                        )}
                                        
                                        {/* Canvas Fingerprint */}
                                        {device.canvas && (
                                          <div className="col-span-5">
                                            <span className="text-gray-500 font-semibold">Canvas Fingerprint:</span>
                                            <p className="text-blue-400 mt-1 text-[10px] font-mono break-all">
                                              {device.canvas.substring(0, 200)}...
                                            </p>
                                          </div>
                                        )}
                                        
                                        {/* Device Fingerprint ID */}
                                        <div className="col-span-5 pt-2 border-t border-gray-700">
                                          <span className="text-gray-500 font-semibold">Device Fingerprint ID:</span>
                                          <p className="font-mono text-xs text-gray-400 break-all mt-1">{device.fingerprintId}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            
                            {/* Summary */}
                            <div className="mt-3 p-2 bg-red-900/20 border border-red-700/30 rounded">
                              <p className="text-xs text-red-400">
                                <strong>{evidence.data.linkedAccounts}</strong> accounts detected 
                                (max allowed: <strong>{evidence.data.maxAllowed}</strong>)
                              </p>
                            </div>
                            
                            {/* Activity Log */}
                            {evidence.data.activityLog && evidence.data.activityLog.length > 0 && (
                              <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700/30 rounded">
                                <div className="flex items-center gap-2 mb-2">
                                  <TrendingUp className="h-4 w-4 text-blue-400" />
                                  <span className="text-sm font-semibold text-blue-400">
                                    Activity Log ({evidence.data.totalActivities} activities)
                                  </span>
                                </div>
                                
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {evidence.data.activityLog.map((activity: any, actIndex: number) => (
                                    <div key={actIndex} className="text-xs p-2 bg-gray-900 rounded border border-gray-700">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[10px]">
                                            {activity.action === 'initial_detection' ? '🎯 Initial' : '🔄 Login'}
                                          </Badge>
                                          <span className="font-mono text-gray-400">{activity.userId.substring(0, 12)}...</span>
                                          <span className="text-gray-500">via {activity.browser}</span>
                                        </div>
                                        <span className="text-gray-500">
                                          {new Date(activity.timestamp).toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="mt-1 text-gray-600 text-[10px]">
                                        IP: {activity.ipAddress}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                <div className="mt-2 pt-2 border-t border-blue-700/30">
                                  <p className="text-xs text-blue-400">
                                    <strong>Last Activity:</strong> {new Date(evidence.data.lastActivity.timestamp).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : evidence.type === 'payment_fingerprint' ? (
                          /* Beautiful display for payment fraud evidence */
                          <div className="space-y-3">
                            {/* Payment Card Display */}
                            <div className="p-4 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-500/30">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-10 w-14 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">💳</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-100 uppercase">
                                      {evidence.data.cardBrand || 'Card'}
                                    </p>
                                    <p className="text-xl font-mono font-bold text-gray-200">
                                      •••• {evidence.data.cardLast4 || '****'}
                                    </p>
                                  </div>
                                </div>
                                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                                  {evidence.data.paymentProvider?.toUpperCase() || 'Payment'}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-purple-500/20">
                                {evidence.data.cardCountry && (
                                  <div>
                                    <p className="text-xs text-gray-500">Country</p>
                                    <p className="text-sm text-gray-300 font-semibold">{evidence.data.cardCountry}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs text-gray-500">Accounts Involved</p>
                                  <p className="text-sm text-red-400 font-bold">{evidence.data.accountsInvolved || 2}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Payment Fingerprint Technical Details */}
                            <div className="p-3 bg-gray-900 rounded border border-gray-700">
                              <div className="flex items-center gap-2 mb-3">
                                <Shield className="h-4 w-4 text-blue-400" />
                                <span className="text-sm font-semibold text-blue-400">Payment Fingerprint Details</span>
                              </div>
                              <div className="space-y-2 text-xs">
                                {/* Full Fingerprint ID */}
                                <div className="py-2 border-b border-gray-700">
                                  <span className="text-gray-500 block mb-1">Fingerprint ID:</span>
                                  <code className="font-mono text-sm text-green-400 bg-gray-800 px-3 py-1.5 rounded block break-all">
                                    {evidence.data.paymentFingerprint}
                                  </code>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 py-2">
                                  {evidence.data.cardBrand && (
                                    <div>
                                      <span className="text-gray-500 block mb-0.5">Card Brand:</span>
                                      <span className="text-gray-200 font-semibold uppercase">
                                        {evidence.data.cardBrand}
                                      </span>
                                    </div>
                                  )}
                                  {evidence.data.cardCountry && (
                                    <div>
                                      <span className="text-gray-500 block mb-0.5">Issuing Country:</span>
                                      <span className="text-gray-200">{evidence.data.cardCountry}</span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-gray-500 block mb-0.5">Provider:</span>
                                    <span className="text-gray-200 capitalize">
                                      {evidence.data.paymentProvider}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 block mb-0.5">Card Number:</span>
                                    <span className="text-gray-200 font-mono">
                                      •••• {evidence.data.cardLast4}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Connected Account IDs */}
                            {evidence.data.connectedAccountIds && evidence.data.connectedAccountIds.length > 0 && (
                              <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="h-4 w-4 text-yellow-400" />
                                  <span className="text-sm font-semibold text-yellow-400">
                                    Connected Account IDs ({evidence.data.connectedAccountIds.length})
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {evidence.data.connectedAccountIds.map((accountId: string, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-900 rounded border border-gray-700">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">#{idx + 1}</span>
                                        <code className="font-mono text-xs text-yellow-300 break-all">
                                          {accountId}
                                        </code>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300"
                                        onClick={() => {
                                          // Navigate to user management with this ID
                                          const adminTab = document.querySelector('[data-value="users"]') as HTMLElement;
                                          if (adminTab) adminTab.click();
                                        }}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        View
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Warning Banner */}
                            <div className="p-3 bg-red-900/20 border border-red-700/30 rounded">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-400" />
                                <p className="text-xs text-red-400">
                                  <strong>{evidence.data.accountsInvolved || 2} accounts</strong> detected using the same payment method
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : evidence.type === 'ip_browser_match' || evidence.type === 'ip_detection' ? (
                          /* Beautiful display for IP/Browser fraud evidence */
                          <div className="space-y-3">
                            {/* IP Address Card */}
                            <div className="p-4 bg-gradient-to-br from-orange-900/30 to-red-900/30 rounded-lg border border-orange-500/30">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 bg-gradient-to-br from-orange-500 to-red-500 rounded flex items-center justify-center">
                                    <Monitor className="h-5 w-5 text-white" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">IP Address</p>
                                    <p className="text-lg font-mono font-bold text-gray-200">
                                      {evidence.data.ipAddress || evidence.data.ip || 'Unknown'}
                                    </p>
                                  </div>
                                </div>
                                {evidence.data.browser && (
                                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                    {evidence.data.browser}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-orange-500/20">
                                {evidence.data.location && (
                                  <div>
                                    <p className="text-xs text-gray-500">Location</p>
                                    <p className="text-sm text-gray-300">{evidence.data.location}</p>
                                  </div>
                                )}
                                {(evidence.data.linkedAccounts || evidence.data.accountsInvolved) && (
                                  <div>
                                    <p className="text-xs text-gray-500">Accounts</p>
                                    <p className="text-sm text-red-400 font-bold">
                                      {evidence.data.linkedAccounts || evidence.data.accountsInvolved}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Technical Details */}
                            {(evidence.data.country || evidence.data.city || evidence.data.isp) && (
                              <div className="p-3 bg-gray-900 rounded border border-gray-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <Info className="h-4 w-4 text-blue-400" />
                                  <span className="text-sm font-semibold text-blue-400">Technical Details</span>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  {evidence.data.country && (
                                    <div className="flex items-center justify-between py-1">
                                      <span className="text-gray-500">Country:</span>
                                      <span className="text-gray-300">{evidence.data.country}</span>
                                    </div>
                                  )}
                                  {evidence.data.city && (
                                    <div className="flex items-center justify-between py-1">
                                      <span className="text-gray-500">City:</span>
                                      <span className="text-gray-300">{evidence.data.city}</span>
                                    </div>
                                  )}
                                  {evidence.data.isp && (
                                    <div className="flex items-center justify-between py-1">
                                      <span className="text-gray-500">ISP:</span>
                                      <span className="text-gray-300">{evidence.data.isp}</span>
                                    </div>
                                  )}
                                  {evidence.data.org && (
                                    <div className="flex items-center justify-between py-1">
                                      <span className="text-gray-500">Organization:</span>
                                      <span className="text-gray-300">{evidence.data.org}</span>
                                    </div>
                                  )}
                                  {evidence.data.asn && (
                                    <div className="flex items-center justify-between py-1">
                                      <span className="text-gray-500">ASN:</span>
                                      <span className="font-mono text-gray-300">{evidence.data.asn}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* VPN/Proxy Indicators */}
                            {(evidence.data.isVPN || evidence.data.isProxy || evidence.data.isTor || evidence.data.isHosting) && (
                              <div className="p-3 bg-red-900/20 border border-red-700/30 rounded">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertOctagon className="h-4 w-4 text-red-400" />
                                  <span className="text-sm font-semibold text-red-400">Security Flags</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {evidence.data.isVPN && (
                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                      🔒 VPN Detected
                                    </Badge>
                                  )}
                                  {evidence.data.isProxy && (
                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                      🌐 Proxy Detected
                                    </Badge>
                                  )}
                                  {evidence.data.isTor && (
                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                      🧅 Tor Network
                                    </Badge>
                                  )}
                                  {evidence.data.isHosting && (
                                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                      🖥️ Hosting Provider
                                    </Badge>
                                  )}
                                  {evidence.data.riskScore && (
                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                      ⚠️ Risk: {evidence.data.riskScore}%
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : evidence.type === 'mirror_trading' ? (
                          /* Beautiful display for mirror trading evidence */
                          <div className="space-y-3">
                            {/* Mirror Trading Header Card */}
                            <div className="p-4 bg-gradient-to-br from-pink-900/30 to-purple-900/30 rounded-lg border border-pink-500/30">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center">
                                    <span className="text-xl">🪞</span>
                                  </div>
                                  <div>
                                    <p className="text-lg font-bold text-gray-100">
                                      {evidence.data.tradingPattern || 'Mirror Trading'}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      {evidence.data.matchingTrades || 0} synchronized trades detected
                                    </p>
                                  </div>
                                </div>
                                <Badge className={`${
                                  parseFloat(evidence.data.confidence || '0') >= 80 
                                    ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                }`}>
                                  {evidence.data.confidence || 'N/A'} Confidence
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-pink-500/20">
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-pink-400">{evidence.data.matchingTrades || 0}</p>
                                  <p className="text-xs text-gray-500">Matching Trades</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-purple-400">{evidence.data.timingCorrelation || 'N/A'}</p>
                                  <p className="text-xs text-gray-500">Timing Correlation</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-blue-400">{evidence.data.directionCorrelation || 'N/A'}</p>
                                  <p className="text-xs text-gray-500">Direction Correlation</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Recent Matches */}
                            {evidence.data.recentMatches && evidence.data.recentMatches.length > 0 && (
                              <div className="p-3 bg-gray-900 rounded border border-gray-700">
                                <div className="flex items-center gap-2 mb-3">
                                  <Activity className="h-4 w-4 text-pink-400" />
                                  <span className="text-sm font-semibold text-pink-400">Recent Matching Trades</span>
                                </div>
                                <div className="space-y-2">
                                  {evidence.data.recentMatches.map((match: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-blue-500/20 text-blue-400 text-xs">{match.pair}</Badge>
                                        <span className="text-xs text-gray-400">{match.directions}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Δ {match.timeDelta}</span>
                                        {match.isOpposite && (
                                          <Badge className="bg-red-500/20 text-red-400 text-[10px]">Opposite</Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Connected Accounts */}
                            {evidence.data.connectedAccountIds && evidence.data.connectedAccountIds.length > 0 && (
                              <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="h-4 w-4 text-yellow-400" />
                                  <span className="text-sm font-semibold text-yellow-400">
                                    Connected Accounts ({evidence.data.connectedAccountIds.length})
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {evidence.data.connectedAccountIds.map((accountId: string, idx: number) => (
                                    <code key={idx} className="block font-mono text-xs text-yellow-300 bg-gray-900 px-2 py-1 rounded">
                                      {accountId}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : evidence.type === 'coordinated_entry' ? (
                          /* Beautiful display for coordinated entry evidence */
                          <div className="space-y-3">
                            {/* Coordinated Entry Header Card */}
                            <div className="p-4 bg-gradient-to-br from-green-900/30 to-teal-900/30 rounded-lg border border-green-500/30">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                                    <span className="text-xl">🎯</span>
                                  </div>
                                  <div>
                                    <p className="text-lg font-bold text-gray-100">Coordinated Entry</p>
                                    <p className="text-sm text-gray-400">
                                      {evidence.data.involvedAccounts || 2} accounts entered within {evidence.data.timeSpan || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                  Competition Entry
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-green-500/20">
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-green-400">{evidence.data.involvedAccounts || 2}</p>
                                  <p className="text-xs text-gray-500">Accounts Involved</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-teal-400">{evidence.data.averageGap || 'N/A'}</p>
                                  <p className="text-xs text-gray-500">Average Gap</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Entry Sequence Timeline */}
                            {evidence.data.entrySequence && evidence.data.entrySequence.length > 0 && (
                              <div className="p-3 bg-gray-900 rounded border border-gray-700">
                                <div className="flex items-center gap-2 mb-3">
                                  <TrendingUp className="h-4 w-4 text-green-400" />
                                  <span className="text-sm font-semibold text-green-400">Entry Timeline</span>
                                </div>
                                <div className="space-y-2">
                                  {evidence.data.entrySequence.map((entry: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">#{idx + 1}</span>
                                        <code className="font-mono text-xs text-green-300">{entry.userId}</code>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">{new Date(entry.entryTime).toLocaleTimeString()}</span>
                                        {idx > 0 && (
                                          <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">
                                            +{entry.timeDelta || 0}s
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Competition ID */}
                            {evidence.data.competitionId && (
                              <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded">
                                <span className="text-xs text-gray-500">Competition ID: </span>
                                <code className="font-mono text-xs text-blue-400">{evidence.data.competitionId}</code>
                              </div>
                            )}
                          </div>
                        ) : evidence.type === 'trading_similarity' ? (
                          /* Beautiful display for trading similarity evidence */
                          <div className="space-y-3">
                            {/* Similarity Header Card */}
                            <div className="p-4 bg-gradient-to-br from-indigo-900/30 to-violet-900/30 rounded-lg border border-indigo-500/30">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center">
                                    <span className="text-xl">📊</span>
                                  </div>
                                  <div>
                                    <p className="text-lg font-bold text-gray-100">Trading Similarity</p>
                                    <p className="text-sm text-gray-400">
                                      {evidence.data.similarityScore || 'N/A'} overall match
                                    </p>
                                  </div>
                                </div>
                                <Badge className={`${
                                  parseFloat(evidence.data.similarityScore || '0') >= 85 
                                    ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                }`}>
                                  High Similarity
                                </Badge>
                              </div>
                              
                              {/* Similarity Breakdown */}
                              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-indigo-500/20">
                                <div className="p-2 bg-gray-800/50 rounded">
                                  <p className="text-xs text-gray-500">Pair Similarity</p>
                                  <p className="text-lg font-bold text-indigo-400">{evidence.data.pairSimilarity || 'N/A'}</p>
                                </div>
                                <div className="p-2 bg-gray-800/50 rounded">
                                  <p className="text-xs text-gray-500">Timing Similarity</p>
                                  <p className="text-lg font-bold text-violet-400">{evidence.data.timingSimilarity || 'N/A'}</p>
                                </div>
                                <div className="p-2 bg-gray-800/50 rounded">
                                  <p className="text-xs text-gray-500">Size Similarity</p>
                                  <p className="text-lg font-bold text-purple-400">{evidence.data.sizeSimilarity || 'N/A'}</p>
                                </div>
                                <div className="p-2 bg-gray-800/50 rounded">
                                  <p className="text-xs text-gray-500">Style Similarity</p>
                                  <p className="text-lg font-bold text-pink-400">{evidence.data.styleSimilarity || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Connected Accounts */}
                            {evidence.data.connectedAccountIds && evidence.data.connectedAccountIds.length > 0 && (
                              <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="h-4 w-4 text-yellow-400" />
                                  <span className="text-sm font-semibold text-yellow-400">
                                    Similar Trading Accounts
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {evidence.data.connectedAccountIds.map((accountId: string, idx: number) => (
                                    <code key={idx} className="block font-mono text-xs text-yellow-300 bg-gray-900 px-2 py-1 rounded">
                                      {accountId}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : evidence.type === 'rapid_creation' ? (
                          /* Beautiful display for rapid account creation evidence */
                          <div className="space-y-3">
                            <div className="p-4 bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-lg border border-amber-500/30">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                                    <span className="text-xl">⚡</span>
                                  </div>
                                  <div>
                                    <p className="text-lg font-bold text-gray-100">Rapid Account Creation</p>
                                    <p className="text-sm text-gray-400">
                                      {evidence.data.accountCount || 2} accounts created within {evidence.data.timeSpan || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                  Speed Flag
                                </Badge>
                              </div>
                            </div>
                            
                            {/* Connected Accounts */}
                            {evidence.data.connectedAccountIds && evidence.data.connectedAccountIds.length > 0 && (
                              <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="h-4 w-4 text-yellow-400" />
                                  <span className="text-sm font-semibold text-yellow-400">
                                    Linked Accounts ({evidence.data.connectedAccountIds.length})
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {evidence.data.connectedAccountIds.map((accountId: string, idx: number) => (
                                    <code key={idx} className="block font-mono text-xs text-yellow-300 bg-gray-900 px-2 py-1 rounded">
                                      {accountId}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Fallback for other evidence types - still show nicely */
                          <div className="space-y-3">
                            <div className="p-4 bg-gray-800 rounded border border-gray-600">
                              <div className="flex items-center gap-2 mb-3">
                                <Info className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-semibold text-gray-300 capitalize">
                                  {evidence.type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <pre className="text-xs text-gray-400 overflow-x-auto bg-gray-900 p-3 rounded">
                                {JSON.stringify(evidence.data, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleUpdateAlertStatus(selectedAlert._id, 'dismissed')}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss
                </Button>
                <Button
                  onClick={() => handleElevateToInvestigation(selectedAlert._id)}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Elevate to Investigation
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Device Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-2xl text-gray-100 flex items-center gap-3">
              {actionType === 'dismiss' && <CheckCircle className="h-6 w-6 text-green-500" />}
              {actionType === 'suspend' && <UserX className="h-6 w-6 text-yellow-500" />}
              {actionType === 'ban' && <Ban className="h-6 w-6 text-red-500" />}
              {actionType === 'dismiss' ? 'Dismiss Device' : 
               actionType === 'suspend' ? 'Suspend Device' : 
               'Ban Device'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {actionType === 'dismiss' && 'Mark this device as safe and dismiss all related alerts.'}
              {actionType === 'suspend' && 'Suspend all users linked to this device for manual review.'}
              {actionType === 'ban' && 'Permanently ban all users linked to this device.'}
            </DialogDescription>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-gray-800 rounded border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">
                  <strong>{selectedDevice.linkedUserIds.length + 1}</strong> user(s) will be affected
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  Device: {selectedDevice.browser} on {selectedDevice.os}
                </p>
              </div>

              <div>
                <Label htmlFor="reason" className="text-gray-300">
                  Reason (Optional)
                </Label>
                <Textarea
                  id="reason"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Enter reason for this action..."
                  className="mt-2 bg-gray-800 border-gray-700 text-gray-100"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowActionDialog(false)}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={executeDeviceAction}
              className={
                actionType === 'dismiss' ? 'bg-green-600 hover:bg-green-700' :
                actionType === 'suspend' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-red-600 hover:bg-red-700'
              }
            >
              Confirm {actionType === 'dismiss' ? 'Dismissal' : actionType === 'suspend' ? 'Suspension' : 'Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Investigation Action Dialog */}
      <Dialog open={showInvestigationDialog} onOpenChange={setShowInvestigationDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-gray-100 flex items-center gap-3">
              {investigationActionType === 'dismiss' && <CheckCircle className="h-6 w-6 text-green-500" />}
              {investigationActionType === 'suspend' && <Clock className="h-6 w-6 text-yellow-500" />}
              {investigationActionType === 'ban' && <Ban className="h-6 w-6 text-red-500" />}
              {investigationActionType === 'dismiss' ? 'Dismiss Investigation' : 
               investigationActionType === 'suspend' ? 'Suspend Accounts' : 
               'Ban Accounts'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {investigationActionType === 'dismiss' && 'Mark this case as resolved and close the investigation.'}
              {investigationActionType === 'suspend' && 'Temporarily suspend all suspicious accounts for a specified duration.'}
              {investigationActionType === 'ban' && 'Permanently ban all suspicious accounts from the platform.'}
            </DialogDescription>
          </DialogHeader>

          {selectedInvestigationAlert && (
            <div className="space-y-4 py-4">
              {/* Account Selection */}
              {(investigationActionType === 'ban' || investigationActionType === 'suspend') && (
                <div className="p-4 bg-gray-800 rounded border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-300 font-semibold">
                      Select Accounts to Restrict
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUserIds(selectedInvestigationAlert.suspiciousUserIds)}
                        className="text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUserIds([])}
                        className="text-xs"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedInvestigationAlert.suspiciousUserIds.map((userId) => (
                      <label key={userId} className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(userId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds([...selectedUserIds, userId]);
                            } else {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-xs text-gray-300 font-mono flex-1">{userId}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedUserIds.length} of {selectedInvestigationAlert.suspiciousUserIds.length} accounts selected
                  </p>
                </div>
              )}

              {/* Restriction Settings */}
              {(investigationActionType === 'ban' || investigationActionType === 'suspend') && (
                <>
                  <div className="space-y-3">
                    <Label className="text-gray-300 text-sm font-semibold">Restriction Reason</Label>
                    <Select value={restrictionReason} onValueChange={setRestrictionReason}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="multi_accounting">Multi-Accounting</SelectItem>
                        <SelectItem value="fraud">Fraud</SelectItem>
                        <SelectItem value="terms_violation">Terms Violation</SelectItem>
                        <SelectItem value="payment_fraud">Payment Fraud</SelectItem>
                        <SelectItem value="suspicious_activity">Suspicious Activity</SelectItem>
                        <SelectItem value="admin_decision">Admin Decision</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm font-semibold">Custom Message (shown to user)</Label>
                    <Textarea
                      value={customRestrictionReason}
                      onChange={(e) => setCustomRestrictionReason(e.target.value)}
                      placeholder="Optional: Explain why this restriction was applied..."
                      className="bg-gray-800 border-gray-700 text-gray-100"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-3 p-4 bg-gray-800 rounded border border-gray-700">
                    <Label className="text-gray-300 text-sm font-semibold">Block These Actions:</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blockTrading}
                          onChange={(e) => setBlockTrading(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">Trading</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blockCompetitions}
                          onChange={(e) => setBlockCompetitions(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">Enter Competitions</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blockDeposit}
                          onChange={(e) => setBlockDeposit(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">Deposits</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blockWithdraw}
                          onChange={(e) => setBlockWithdraw(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">Withdrawals</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {investigationActionType === 'suspend' && (
                <div className="p-4 bg-yellow-900/20 border border-yellow-700/30 rounded">
                  <Label className="text-gray-300 text-sm font-semibold mb-3 block">
                    Suspension Duration
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      value={suspendDuration}
                      onChange={(e) => setSuspendDuration(parseInt(e.target.value) || 1)}
                      className="bg-gray-800 border-gray-700 text-gray-100 w-24"
                    />
                    <Select value={suspendUnit} onValueChange={(value: 'hours' | 'days' | 'weeks') => setSuspendUnit(value)}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="weeks">Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Accounts will be suspended until: {' '}
                    <strong className="text-yellow-400">
                      {new Date(Date.now() + suspendDuration * (
                        suspendUnit === 'hours' ? 3600000 :
                        suspendUnit === 'days' ? 86400000 :
                        604800000
                      )).toLocaleString()}
                    </strong>
                  </p>
                </div>
              )}

              {investigationActionType === 'ban' && (
                <div className="p-4 bg-red-900/20 border border-red-700/30 rounded">
                  <AlertTriangle className="h-5 w-5 text-red-500 mb-2" />
                  <p className="text-sm text-red-400 font-semibold">Warning: This action is permanent!</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Banned accounts will be immediately logged out and unable to access the platform.
                  </p>
                </div>
              )}

              {investigationActionType === 'dismiss' && (
                <div className="p-4 bg-green-900/20 border border-green-700/30 rounded">
                  <p className="text-sm text-green-400">
                    This will mark the alert as resolved and close the investigation. The alert will move to "Dismissed" status.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInvestigationDialog(false)}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={executeInvestigationAction}
              className={
                investigationActionType === 'dismiss' ? 'bg-green-600 hover:bg-green-700' :
                investigationActionType === 'suspend' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-red-600 hover:bg-red-700'
              }
            >
              Confirm {investigationActionType === 'dismiss' ? 'Dismissal' : investigationActionType === 'suspend' ? 'Suspension' : 'Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset All Alerts Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-2xl text-gray-100 flex items-center gap-3">
              <AlertOctagon className="h-6 w-6 text-red-500" />
              Reset All Fraud Alerts
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              This will permanently delete all fraud alerts and reset all device risk scores.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-900/20 border border-red-700/30 rounded">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-400 font-semibold mb-2">⚠️ WARNING: This action cannot be undone!</p>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• All fraud alerts will be deleted</li>
                    <li>• All device fingerprints will be deleted</li>
                    <li>• All user restrictions will be removed (users will be unbanned/unsuspended)</li>
                    <li>• All flags and suspicions will be cleared</li>
                    <li>• You can re-detect frauds after this</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="resetPassword" className="text-gray-300">
                Admin Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="resetPassword"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Enter your admin password to confirm"
                className="mt-2 bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResetDialog(false);
                setResetPassword('');
              }}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetAllAlerts}
              disabled={!resetPassword}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset All Alerts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fraud Score Dialog (Full Screen) */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="!max-w-none !w-[95vw] !h-[95vh] !p-6 bg-gray-900 border-gray-700 overflow-y-auto" showCloseButton={false}>
          <DialogTitle className="sr-only">Fraud Detection Score Details</DialogTitle>
          {selectedScoreUserId && fraudScores[selectedScoreUserId] ? (
            <>
              <SuspicionScoreCard score={fraudScores[selectedScoreUserId]} />
              
              {/* Close Button */}
              <div className="flex justify-end mt-6 pt-6 border-t border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setShowScoreDialog(false)}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                >
                  Close
                </Button>
              </div>
            </>
          ) : selectedScoreUserId && !fraudScores[selectedScoreUserId] ? (
            <>
              <div className="py-24 text-center">
                <Shield className="h-20 w-20 text-gray-600 mx-auto mb-6" />
                <h3 className="text-2xl text-gray-400 font-semibold mb-2">No Fraud Score Available</h3>
                <p className="text-gray-600">
                  This account has not triggered any fraud detection yet
                </p>
              </div>
              <div className="flex justify-end mt-6 pt-6 border-t border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setShowScoreDialog(false)}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                >
                  Close
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

