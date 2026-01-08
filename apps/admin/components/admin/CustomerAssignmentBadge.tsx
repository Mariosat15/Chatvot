'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { User, AlertTriangle, UserCheck } from 'lucide-react';

interface Assignment {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  assignedAt: string;
}

interface CustomerAssignmentBadgeProps {
  assignment: Assignment | null;
  compact?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function CustomerAssignmentBadge({ 
  assignment, 
  compact = false,
  showTooltip = true,
  className = '',
}: CustomerAssignmentBadgeProps) {
  if (!assignment) {
    return (
      <Badge 
        variant="outline" 
        className={`bg-yellow-500/10 text-yellow-400 border-yellow-500/30 ${className}`}
        title={showTooltip ? "This customer has not been assigned to any employee" : undefined}
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        {compact ? 'Unassigned' : 'No Agent Assigned'}
      </Badge>
    );
  }

  const tooltipText = showTooltip 
    ? `${assignment.employeeName}\n${assignment.employeeEmail}\nRole: ${assignment.employeeRole}\nAssigned: ${new Date(assignment.assignedAt).toLocaleDateString()}`
    : undefined;

  return (
    <Badge 
      variant="outline" 
      className={`bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ${className}`}
      title={tooltipText}
    >
      <UserCheck className="h-3 w-3 mr-1" />
      {compact ? assignment.employeeName.split(' ')[0] : assignment.employeeName}
    </Badge>
  );
}

// Full card version for detail views
export function CustomerAssignmentCard({ 
  assignment,
  onTransfer,
  onUnassign,
  canManage = false,
}: {
  assignment: Assignment | null;
  onTransfer?: () => void;
  onUnassign?: () => void;
  canManage?: boolean;
}) {
  if (!assignment) {
    return (
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/10 rounded-full">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <p className="font-medium text-yellow-400">No Agent Assigned</p>
            <p className="text-sm text-gray-400">This customer needs to be assigned to an employee</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-full">
            <User className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="font-medium text-white">{assignment.employeeName}</p>
            <p className="text-sm text-gray-400">{assignment.employeeEmail}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {assignment.employeeRole}
              </Badge>
              <span className="text-xs text-gray-500">
                Since {new Date(assignment.assignedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        {canManage && (
          <div className="flex gap-2">
            {onTransfer && (
              <button
                onClick={onTransfer}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Transfer
              </button>
            )}
            {onUnassign && (
              <button
                onClick={onUnassign}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Unassign
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerAssignmentBadge;
