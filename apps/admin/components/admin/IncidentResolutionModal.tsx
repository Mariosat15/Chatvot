'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Users,
  RefreshCw,
  Loader2,
  Gift,
  XCircle,
  Calculator,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResolutionOption {
  type: string;
  label: string;
  description: string;
  totalAmount: number;
  affectedUsers: number;
  perUserAmount: number;
  requiresManualReview?: boolean;
}

interface ResolutionOptions {
  no_compensation: ResolutionOption;
  partial_refund: ResolutionOption;
  full_refund: ResolutionOption;
  result_adjustment: ResolutionOption;
}

interface IncidentSummary {
  id: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  affectedUsers: string[];
  competitionId?: string;
}

interface CompetitionSummary {
  id: string;
  name: string;
  entryFee: number;
  status: string;
  participantCount: number;
}

interface ResolveData {
  incident: IncidentSummary;
  competition: CompetitionSummary | null;
  options: ResolutionOptions;
  summary: {
    specifiedAffectedCount: number;
    effectiveAffectedCount: number;
    totalParticipants: number;
    entryFee: number;
    hasSpecificAffected: boolean;
  };
}

interface IncidentResolutionModalProps {
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export default function IncidentResolutionModal({
  incidentId,
  isOpen,
  onClose,
  onResolved,
}: IncidentResolutionModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<ResolveData | null>(null);
  const [selectedType, setSelectedType] = useState<string>('no_compensation');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch resolution options when modal opens
  useEffect(() => {
    if (isOpen && incidentId) {
      fetchResolveOptions();
    }
  }, [isOpen, incidentId]);

  const fetchResolveOptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/incidents/${incidentId}/resolve`);
      const result = await response.json();

      if (result.success) {
        setData(result);
        setSelectedType('no_compensation');
        setNotes('');
      } else {
        toast.error(result.error || 'Failed to load resolution options');
        onClose();
      }
    } catch (error) {
      console.error('Error fetching resolve options:', error);
      toast.error('Failed to load resolution options');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!notes.trim()) {
      toast.error('Please provide resolution notes');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/incidents/${incidentId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionType: selectedType,
          notes: notes.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          `Incident resolved! ${result.resolution.compensationsIssued} compensations issued totaling €${result.resolution.totalCompensation.toFixed(2)}`
        );
        onResolved();
        onClose();
      } else {
        toast.error(result.error || 'Failed to resolve incident');
      }
    } catch (error) {
      console.error('Error resolving incident:', error);
      toast.error('Failed to resolve incident');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const getSelectedOption = (): ResolutionOption | null => {
    if (!data) return null;
    return data.options[selectedType as keyof ResolutionOptions];
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'no_compensation': return 'border-gray-500/50 bg-gray-500/10';
      case 'partial_refund': return 'border-yellow-500/50 bg-yellow-500/10';
      case 'full_refund': return 'border-orange-500/50 bg-orange-500/10';
      case 'result_adjustment': return 'border-purple-500/50 bg-purple-500/10';
      default: return 'border-gray-500/50 bg-gray-500/10';
    }
  };

  const selectedOption = getSelectedOption();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            Resolve Incident
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Select a resolution type and provide notes to resolve this incident automatically.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : data ? (
          <div className="space-y-6 py-4">
            {/* Incident Summary */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Incident Details</h3>
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white">{data.incident.title}</p>
                    <p className="text-sm text-gray-400 capitalize">
                      {data.incident.type.replace(/_/g, ' ')} • 
                      <span className={cn('ml-1', getSeverityColor(data.incident.severity))}>
                        {data.incident.severity}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                    #{data.incident.id.slice(-6)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-400" />
                    <span className="text-gray-300">
                      {data.summary.hasSpecificAffected 
                        ? `${data.summary.specifiedAffectedCount} affected users` 
                        : data.competition 
                          ? `${data.summary.totalParticipants} participants (all affected)`
                          : '0 specified users'}
                    </span>
                  </div>
                  {data.competition && (
                    <>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-400" />
                        <span className="text-gray-300">Entry fee: €{data.summary.entryFee}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-400" />
                        <span className="text-gray-300">
                          Competition: 🏆 {data.competition.name} 
                          <span className="ml-1 text-yellow-400">({data.summary.totalParticipants} participants)</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Resolution Options */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Select Resolution Type</h3>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(data.options).map(([key, option]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedType(key)}
                    className={cn(
                      'relative p-4 rounded-lg border text-left transition-all',
                      selectedType === key
                        ? cn('ring-2 ring-blue-500', getTypeColor(key))
                        : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {key === 'no_compensation' && <XCircle className="h-4 w-4 text-gray-400" />}
                          {key === 'partial_refund' && <Gift className="h-4 w-4 text-yellow-400" />}
                          {key === 'full_refund' && <DollarSign className="h-4 w-4 text-orange-400" />}
                          {key === 'result_adjustment' && <Calculator className="h-4 w-4 text-purple-400" />}
                          <span className="font-medium text-white">{option.label}</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{option.description}</p>
                      </div>
                      {option.totalAmount > 0 && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-400">-€{option.totalAmount.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">Platform expense</p>
                        </div>
                      )}
                    </div>
                    
                    {option.totalAmount > 0 && (
                      <div className="mt-3 flex gap-4 text-xs text-gray-400">
                        <span>{option.affectedUsers} users</span>
                        <span>€{option.perUserAmount.toFixed(2)} each</span>
                      </div>
                    )}
                    
                    {option.requiresManualReview && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        Requires manual review
                      </div>
                    )}
                    
                    {selectedType === key && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="h-5 w-5 text-blue-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-400 mb-2 block">
                Resolution Notes <span className="text-red-400">*</span>
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Explain the decision and any relevant details for the audit trail..."
                className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
              />
            </div>

            {/* Summary */}
            {selectedOption && selectedOption.totalAmount > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <span className="font-medium text-red-400">Platform Expense Warning</span>
                </div>
                <p className="text-sm text-gray-300">
                  This resolution will automatically credit <strong>{selectedOption.affectedUsers} users</strong> with 
                  a total of <strong>€{selectedOption.totalAmount.toFixed(2)}</strong>. 
                  This amount will be recorded as a platform expense in the Financial Dashboard.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-400">
            Failed to load resolution options
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="border-gray-700"
          >
            Cancel
          </Button>
          
          {!showConfirm ? (
            <Button
              onClick={() => {
                if (!notes.trim()) {
                  toast.error('Please provide resolution notes');
                  return;
                }
                setShowConfirm(true);
              }}
              disabled={loading || !data}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Resolve Incident
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="border-gray-700"
              >
                Back
              </Button>
              <Button
                onClick={handleResolve}
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm & Execute
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
