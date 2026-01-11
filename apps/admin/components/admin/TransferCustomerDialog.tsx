'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  _id: string;
  name: string;
  email: string;
  role: string;
  customerCount?: number;
}

interface Assignment {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
}

interface TransferCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  customerEmail: string;
  currentAssignment: Assignment | null;
  onTransferComplete?: () => void;
}

export function TransferCustomerDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerEmail,
  currentAssignment,
  onTransferComplete,
}: TransferCustomerDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open]);

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await fetch('/api/employees');
      const data = await response.json();

      if (data.success) {
        // Filter out current assignee
        const filtered = (data.employees || []).filter(
          (emp: Employee) => emp._id !== currentAssignment?.employeeId
        );
        setEmployees(filtered);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/customer-assignments/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          toEmployeeId: selectedEmployeeId,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Customer transferred successfully');
        onOpenChange(false);
        onTransferComplete?.();
      } else {
        toast.error(data.error || 'Failed to transfer customer');
      }
    } catch (error) {
      console.error('Error transferring customer:', error);
      toast.error('Failed to transfer customer');
    } finally {
      setLoading(false);
    }
  };

  const selectedEmployee = employees.find(e => e._id === selectedEmployeeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Transfer Customer</DialogTitle>
          <DialogDescription className="text-gray-400">
            Transfer {customerName} to another employee
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Assignment */}
          {currentAssignment && (
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Current Assignment</p>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-white">{currentAssignment.employeeName}</p>
                  <p className="text-xs text-gray-400">{currentAssignment.employeeEmail}</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">
                  {currentAssignment.employeeRole}
                </Badge>
              </div>
            </div>
          )}

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-gray-500" />
          </div>

          {/* Select New Employee */}
          <div className="space-y-2">
            <Label className="text-gray-300">Transfer To</Label>
            {loadingEmployees ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 max-h-[300px]">
                  {employees.length === 0 ? (
                    <div className="p-2 text-center text-gray-400 text-sm">
                      No other employees available
                    </div>
                  ) : (
                    employees.map((emp) => (
                      <SelectItem 
                        key={emp._id} 
                        value={emp._id}
                        className="text-white"
                      >
                        <div className="flex items-center justify-between w-full gap-4">
                          <div>
                            <span className="font-medium">{emp.name}</span>
                            <span className="text-gray-400 text-xs ml-2">({emp.email})</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {emp.role}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selected Employee Preview */}
          {selectedEmployee && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
              <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2">New Assignment</p>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white">{selectedEmployee.name}</p>
                  <p className="text-xs text-gray-400">{selectedEmployee.email}</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  {selectedEmployee.role}
                </Badge>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label className="text-gray-300">Reason (Optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter a reason for the transfer..."
              className="bg-gray-800 border-gray-700 text-white"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={loading || !selectedEmployeeId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              'Transfer Customer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TransferCustomerDialog;

