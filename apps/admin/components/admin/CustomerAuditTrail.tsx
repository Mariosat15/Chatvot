'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  RefreshCw, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  Clock,
  User,
  DollarSign,
  Shield,
  AlertTriangle,
  TrendingUp,
  FileText,
  Award,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Download,
  ArrowUpDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface AuditEntry {
  _id: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  action: string;
  actionCategory: string;
  description: string;
  performedBy: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    employeeRole: string;
    department: string;
    isSuperAdmin: boolean;
  };
  metadata?: Record<string, any>;
  timestamp: string;
}

interface AuditCategory {
  id: string;
  icon: string;
  color: string;
  label: string;
}

interface CustomerAuditTrailProps {
  customerId: string;
  customerEmail?: string;
  customerName?: string;
  className?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  assignment: <ArrowUpDown className="h-4 w-4" />,
  profile: <User className="h-4 w-4" />,
  financial: <DollarSign className="h-4 w-4" />,
  kyc: <Shield className="h-4 w-4" />,
  fraud: <AlertTriangle className="h-4 w-4" />,
  trading: <TrendingUp className="h-4 w-4" />,
  restriction: <Shield className="h-4 w-4" />,
  badge: <Award className="h-4 w-4" />,
  note: <MessageSquare className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  assignment: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  profile: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  financial: 'bg-green-500/20 text-green-400 border-green-500/30',
  kyc: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  fraud: 'bg-red-500/20 text-red-400 border-red-500/30',
  trading: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  restriction: 'bg-red-500/20 text-red-400 border-red-500/30',
  badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  note: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function CustomerAuditTrail({ 
  customerId, 
  customerEmail,
  customerName,
  className = '' 
}: CustomerAuditTrailProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchAuditTrail = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        customerId,
        limit: limit.toString(),
        skip: (page * limit).toString(),
      });
      
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }

      const response = await fetch(`/api/customer-audit?${params}`);
      const data = await response.json();

      if (data.success) {
        setEntries(data.entries || []);
        setTotal(data.total || 0);
        if (data.categories) {
          setCategories(data.categories);
        }
      } else {
        toast.error(data.error || 'Failed to fetch audit trail');
      }
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      toast.error('Failed to fetch audit trail');
    } finally {
      setLoading(false);
    }
  }, [customerId, selectedCategory, page]);

  useEffect(() => {
    fetchAuditTrail();
  }, [fetchAuditTrail]);

  const handleAddNote = async () => {
    if (!noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    try {
      setAddingNote(true);
      const response = await fetch('/api/customer-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          customerEmail,
          customerName,
          note: noteText.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Note added successfully');
        setNoteText('');
        setShowAddNote(false);
        fetchAuditTrail();
      } else {
        toast.error(data.error || 'Failed to add note');
      }
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEntries(newExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const exportAuditTrail = () => {
    const csvContent = [
      ['Date', 'Category', 'Action', 'Description', 'Performed By', 'Role', 'Department'].join(','),
      ...entries.map(entry => [
        formatDate(entry.timestamp),
        entry.actionCategory,
        entry.action,
        `"${entry.description.replace(/"/g, '""')}"`,
        entry.performedBy.employeeName,
        entry.performedBy.employeeRole,
        entry.performedBy.department,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${customerId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit trail exported');
  };

  return (
    <Card className={`bg-gray-900/50 border-gray-800 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            Audit Trail
            <Badge variant="outline" className="ml-2">
              {total} entries
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportAuditTrail}
              className="text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
            <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Note
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Add Note</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Add a note to this customer's audit trail
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter your note..."
                  className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddNote(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddNote}
                    disabled={addingNote || !noteText.trim()}
                  >
                    {addingNote ? 'Adding...' : 'Add Note'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAuditTrail}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className="text-white">
                    <span className="flex items-center gap-2">
                      {cat.icon} {cat.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No audit entries found</p>
            <p className="text-sm mt-1">Actions on this customer will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry._id}
                className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden"
              >
                <div
                  className="p-3 cursor-pointer hover:bg-gray-800/80 transition-colors"
                  onClick={() => toggleExpanded(entry._id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div className={`p-2 rounded-lg ${CATEGORY_COLORS[entry.actionCategory] || CATEGORY_COLORS.other}`}>
                      {CATEGORY_ICONS[entry.actionCategory] || CATEGORY_ICONS.other}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white truncate">
                          {entry.description}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(entry.timestamp)}
                          </span>
                          {expandedEntries.has(entry._id) ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[entry.actionCategory] || ''}`}>
                          {entry.actionCategory}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          by {entry.performedBy.employeeName}
                          {entry.performedBy.isSuperAdmin && (
                            <Badge variant="outline" className="ml-1 text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                              Super Admin
                            </Badge>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedEntries.has(entry._id) && (
                  <div className="px-3 pb-3 pt-0 border-t border-gray-700/50 mt-2">
                    <div className="grid grid-cols-2 gap-4 text-sm pt-3">
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Performed By</p>
                        <p className="text-white">{entry.performedBy.employeeName}</p>
                        <p className="text-gray-400 text-xs">{entry.performedBy.employeeEmail}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Role / Department</p>
                        <p className="text-white">{entry.performedBy.employeeRole}</p>
                        <p className="text-gray-400 text-xs">{entry.performedBy.department}</p>
                      </div>
                    </div>
                    
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mt-3">
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Details</p>
                        <div className="bg-gray-900/50 rounded p-2 text-xs">
                          <pre className="text-gray-300 whitespace-pre-wrap">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-400">
                  Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * limit >= total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CustomerAuditTrail;

