'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Search,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Users,
  DollarSign,
  FileText,
  Eye,
  Edit,
  Trash2,
  Filter,
  ChevronDown,
  Gift,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Incident {
  _id: string;
  competitionId?: string;
  challengeId?: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  affectedUsers: string[];
  evidence: {
    priceSnapshots?: string[];
    tradeIds?: string[];
    positionIds?: string[];
  };
  resolution?: {
    summary: string;
    action: string;
    compensations: Array<{
      userId: string;
      username?: string;
      amount: number;
      reason: string;
      status: string;
      paidAt?: string;
    }>;
    resultAdjustments: Array<{
      participantId: string;
      userId: string;
      username?: string;
      previousRank?: number;
      newRank?: number;
      previousPrize?: number;
      newPrize?: number;
      adjustmentReason: string;
    }>;
  };
  createdBy: string;
  createdByEmail?: string;
  assignedTo?: string;
  priority: string;
  tags?: string[];
  auditLog: Array<{
    timestamp: string;
    action: string;
    by: string;
    details: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface CompensationForm {
  userId: string;
  amount: number;
  reason: string;
}

export default function IncidentsSection() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompensateModal, setShowCompensateModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    type: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [compensations, setCompensations] = useState<CompensationForm[]>([{ userId: '', amount: 0, reason: '' }]);
  const [submitting, setSubmitting] = useState(false);

  // New incident form
  const [newIncident, setNewIncident] = useState({
    type: 'technical_error',
    severity: 'medium',
    title: '',
    description: '',
    priority: 'medium',
    competitionId: '',
  });

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.type) params.set('type', filters.type);

      const response = await fetch(`/api/incidents?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setIncidents(data.incidents);
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
      toast.error('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const createIncident = async () => {
    if (!newIncident.title || !newIncident.description) {
      toast.error('Title and description are required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIncident),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Incident created successfully');
        setShowCreateModal(false);
        setNewIncident({
          type: 'technical_error',
          severity: 'medium',
          title: '',
          description: '',
          priority: 'medium',
          competitionId: '',
        });
        fetchIncidents();
      } else {
        toast.error(data.error || 'Failed to create incident');
      }
    } catch (error) {
      console.error('Error creating incident:', error);
      toast.error('Failed to create incident');
    } finally {
      setSubmitting(false);
    }
  };

  const updateIncidentStatus = async (incidentId: string, status: string) => {
    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Incident status updated to ${status}`);
        fetchIncidents();
        if (selectedIncident?._id === incidentId) {
          setSelectedIncident(data.incident);
        }
      }
    } catch (error) {
      console.error('Error updating incident:', error);
      toast.error('Failed to update incident');
    }
  };

  const issueCompensations = async () => {
    if (!selectedIncident) return;

    const validCompensations = compensations.filter(c => c.userId && c.amount > 0 && c.reason);
    if (validCompensations.length === 0) {
      toast.error('Please add at least one valid compensation');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/incidents/${selectedIncident._id}/compensate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compensations: validCompensations }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Issued ${data.successCount} compensations totaling €${data.totalCompensated.toFixed(2)}`);
        setShowCompensateModal(false);
        setCompensations([{ userId: '', amount: 0, reason: '' }]);
        fetchIncidents();
        // Refresh selected incident
        const incidentResponse = await fetch(`/api/incidents/${selectedIncident._id}`);
        const incidentData = await incidentResponse.json();
        if (incidentData.success) {
          setSelectedIncident(incidentData.incident);
        }
      } else {
        toast.error(data.error || 'Failed to issue compensations');
      }
    } catch (error) {
      console.error('Error issuing compensations:', error);
      toast.error('Failed to issue compensations');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteIncident = async (incidentId: string) => {
    if (!confirm('Are you sure you want to delete this incident?')) return;

    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Incident deleted');
        if (selectedIncident?._id === incidentId) {
          setSelectedIncident(null);
        }
        fetchIncidents();
      } else {
        toast.error(data.error || 'Failed to delete incident');
      }
    } catch (error) {
      console.error('Error deleting incident:', error);
      toast.error('Failed to delete incident');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-500/20 text-red-400';
      case 'investigating': return 'bg-yellow-500/20 text-yellow-400';
      case 'resolved': return 'bg-green-500/20 text-green-400';
      case 'rejected': return 'bg-gray-500/20 text-gray-400';
      case 'escalated': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />;
      case 'investigating': return <Clock className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'escalated': return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      price_feed_failure: 'Price Feed Failure',
      unfair_result: 'Unfair Result',
      technical_error: 'Technical Error',
      user_complaint: 'User Complaint',
      system_error: 'System Error',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const filteredIncidents = incidents.filter(incident =>
    searchQuery === '' ||
    incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    incident.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    incident._id.includes(searchQuery)
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-400" />
            Incident Management
          </h2>
          <p className="text-gray-400 mt-1">Track and resolve competition issues, disputes, and compensations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIncidents}
            className="border-gray-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-red-500 hover:bg-red-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Incident
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search incidents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800/50 border-gray-700"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
          <option value="escalated">Escalated</option>
        </select>

        <select
          value={filters.severity}
          onChange={(e) => setFilters(f => ({ ...f, severity: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filters.type}
          onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="price_feed_failure">Price Feed Failure</option>
          <option value="unfair_result">Unfair Result</option>
          <option value="technical_error">Technical Error</option>
          <option value="user_complaint">User Complaint</option>
          <option value="system_error">System Error</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{incidents.filter(i => i.status === 'open').length}</p>
              <p className="text-sm text-gray-400">Open Incidents</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{incidents.filter(i => i.status === 'investigating').length}</p>
              <p className="text-sm text-gray-400">Investigating</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{incidents.filter(i => i.status === 'resolved').length}</p>
              <p className="text-sm text-gray-400">Resolved</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <AlertTriangle className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{incidents.filter(i => i.severity === 'critical').length}</p>
              <p className="text-sm text-gray-400">Critical</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incidents List */}
        <div className="lg:col-span-2 bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-white">Incidents ({filteredIncidents.length})</h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-400 mt-2">Loading incidents...</p>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400">No incidents found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50 max-h-[600px] overflow-y-auto">
              {filteredIncidents.map((incident) => (
                <div
                  key={incident._id}
                  onClick={() => setSelectedIncident(incident)}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-gray-700/30 transition-colors",
                    selectedIncident?._id === incident._id && "bg-gray-700/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border", getSeverityColor(incident.severity))}>
                          {incident.severity}
                        </span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full flex items-center gap-1", getStatusColor(incident.status))}>
                          {getStatusIcon(incident.status)}
                          {incident.status}
                        </span>
                      </div>
                      <h4 className="font-medium text-white truncate">{incident.title}</h4>
                      <p className="text-sm text-gray-400 truncate">{incident.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{getTypeLabel(incident.type)}</span>
                        <span>•</span>
                        <span>{new Date(incident.createdAt).toLocaleDateString()}</span>
                        {incident.affectedUsers.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {incident.affectedUsers.length} affected
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-500 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incident Details Panel */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          {selectedIncident ? (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", getSeverityColor(selectedIncident.severity))}>
                    {selectedIncident.severity.toUpperCase()}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full flex items-center gap-1", getStatusColor(selectedIncident.status))}>
                    {getStatusIcon(selectedIncident.status)}
                    {selectedIncident.status}
                  </span>
                </div>
                <h3 className="font-semibold text-white">{selectedIncident.title}</h3>
                <p className="text-sm text-gray-400 mt-1">{getTypeLabel(selectedIncident.type)}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Description */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Description</h4>
                  <p className="text-sm text-white">{selectedIncident.description}</p>
                </div>

                {/* Affected Users */}
                {selectedIncident.affectedUsers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-1">Affected Users ({selectedIncident.affectedUsers.length})</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedIncident.affectedUsers.slice(0, 5).map((userId, idx) => (
                        <span key={idx} className="text-xs bg-gray-700 px-2 py-1 rounded">
                          {userId.slice(-8)}
                        </span>
                      ))}
                      {selectedIncident.affectedUsers.length > 5 && (
                        <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                          +{selectedIncident.affectedUsers.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Compensations */}
                {selectedIncident.resolution?.compensations && selectedIncident.resolution.compensations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                      <Gift className="h-4 w-4 text-green-400" />
                      Compensations Issued ({selectedIncident.resolution.compensations.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedIncident.resolution.compensations.map((comp, idx) => (
                        <div key={idx} className="bg-gray-700/50 rounded-lg p-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-white">{comp.username || comp.userId.slice(-8)}</span>
                            <span className="text-green-400 font-medium">€{comp.amount.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{comp.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Log */}
                {selectedIncident.auditLog && selectedIncident.auditLog.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Activity Log</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedIncident.auditLog.slice().reverse().map((entry, idx) => (
                        <div key={idx} className="text-xs border-l-2 border-gray-600 pl-2">
                          <p className="text-gray-300">{entry.details}</p>
                          <p className="text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-gray-700 space-y-2">
                {selectedIncident.status === 'open' && (
                  <Button
                    onClick={() => updateIncidentStatus(selectedIncident._id, 'investigating')}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900"
                    size="sm"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Start Investigation
                  </Button>
                )}
                {selectedIncident.status === 'investigating' && (
                  <>
                    <Button
                      onClick={() => setShowCompensateModal(true)}
                      className="w-full bg-green-500 hover:bg-green-600"
                      size="sm"
                    >
                      <Gift className="h-4 w-4 mr-2" />
                      Issue Compensation
                    </Button>
                    <Button
                      onClick={() => updateIncidentStatus(selectedIncident._id, 'resolved')}
                      className="w-full bg-blue-500 hover:bg-blue-600"
                      size="sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Resolved
                    </Button>
                  </>
                )}
                {selectedIncident.status !== 'resolved' && (
                  <Button
                    onClick={() => deleteIncident(selectedIncident._id)}
                    variant="outline"
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Incident
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                <Eye className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400">Select an incident to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">Create New Incident</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                <Input
                  value={newIncident.title}
                  onChange={(e) => setNewIncident(n => ({ ...n, title: e.target.value }))}
                  placeholder="Brief incident title"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                <textarea
                  value={newIncident.description}
                  onChange={(e) => setNewIncident(n => ({ ...n, description: e.target.value }))}
                  placeholder="Detailed description of the incident"
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                  <select
                    value={newIncident.type}
                    onChange={(e) => setNewIncident(n => ({ ...n, type: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="price_feed_failure">Price Feed Failure</option>
                    <option value="unfair_result">Unfair Result</option>
                    <option value="technical_error">Technical Error</option>
                    <option value="user_complaint">User Complaint</option>
                    <option value="system_error">System Error</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Severity</label>
                  <select
                    value={newIncident.severity}
                    onChange={(e) => setNewIncident(n => ({ ...n, severity: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Competition ID (optional)</label>
                <Input
                  value={newIncident.competitionId}
                  onChange={(e) => setNewIncident(n => ({ ...n, competitionId: e.target.value }))}
                  placeholder="Related competition ID"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={createIncident} disabled={submitting} className="bg-red-500 hover:bg-red-600">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Incident
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Compensate Modal */}
      {showCompensateModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">Issue Compensation</h3>
              <button onClick={() => setShowCompensateModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {compensations.map((comp, index) => (
                <div key={index} className="bg-gray-700/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">Compensation #{index + 1}</span>
                    {compensations.length > 1 && (
                      <button
                        onClick={() => setCompensations(c => c.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Input
                    value={comp.userId}
                    onChange={(e) => {
                      const newComps = [...compensations];
                      newComps[index].userId = e.target.value;
                      setCompensations(newComps);
                    }}
                    placeholder="User ID"
                    className="bg-gray-700 border-gray-600"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={comp.amount || ''}
                      onChange={(e) => {
                        const newComps = [...compensations];
                        newComps[index].amount = parseFloat(e.target.value) || 0;
                        setCompensations(newComps);
                      }}
                      placeholder="Amount (€)"
                      className="bg-gray-700 border-gray-600"
                    />
                    <Input
                      value={comp.reason}
                      onChange={(e) => {
                        const newComps = [...compensations];
                        newComps[index].reason = e.target.value;
                        setCompensations(newComps);
                      }}
                      placeholder="Reason"
                      className="bg-gray-700 border-gray-600"
                    />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompensations(c => [...c, { userId: '', amount: 0, reason: '' }])}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another User
              </Button>
            </div>
            <div className="p-4 border-t border-gray-700 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCompensateModal(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={issueCompensations} disabled={submitting} className="bg-green-500 hover:bg-green-600">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
                Issue Compensations
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
