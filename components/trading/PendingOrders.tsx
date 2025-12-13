'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cancelOrder } from '@/lib/actions/trading/order.actions';
import { toast } from 'sonner';
import { X, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface PendingOrder {
  _id: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  requestedPrice?: number;
  marginRequired: number;
  stopLoss?: number;
  takeProfit?: number;
  placedAt: string;
  status: string;
}

interface PendingOrdersProps {
  orders: PendingOrder[];
}

const PendingOrders = ({ orders }: PendingOrdersProps) => {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="size-12 text-dark-600 mx-auto mb-3" />
        <p className="text-dark-600">No pending orders</p>
        <p className="text-xs text-dark-600 mt-1">Limit orders will appear here until executed</p>
      </div>
    );
  }

  const handleCancel = async (orderId: string) => {
    setCancelling(orderId);
    try {
      const result = await cancelOrder(orderId);
      
      if (result.success) {
        toast.success('Order cancelled', {
          description: result.message,
        });
        router.refresh();
      }
    } catch (error) {
      toast.error('Failed to cancel order', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-dark-400 hover:bg-dark-300">
            <TableHead className="text-dark-600">Symbol</TableHead>
            <TableHead className="text-dark-600">Side</TableHead>
            <TableHead className="text-dark-600">Type</TableHead>
            <TableHead className="text-dark-600 text-right">Quantity</TableHead>
            <TableHead className="text-dark-600 text-right">Limit Price</TableHead>
            <TableHead className="text-dark-600 text-right">Margin Required</TableHead>
            <TableHead className="text-dark-600">Time</TableHead>
            <TableHead className="text-dark-600 text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order._id} className="border-dark-400 hover:bg-dark-300">
              <TableCell className="font-bold text-white">{order.symbol}</TableCell>
              
              <TableCell>
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold',
                  order.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                )}>
                  {order.side === 'buy' ? (
                    <><TrendingUp className="size-3 mr-1" /> BUY</>
                  ) : (
                    <><TrendingDown className="size-3 mr-1" /> SELL</>
                  )}
                </span>
              </TableCell>
              
              <TableCell>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-400">
                  📊 {order.orderType.toUpperCase()}
                </span>
              </TableCell>
              
              <TableCell className="text-right font-mono text-light-900">
                {order.quantity} lots
              </TableCell>
              
              <TableCell className="text-right font-mono font-bold text-yellow-400">
                {order.requestedPrice?.toFixed(5) || '--'}
              </TableCell>
              
              <TableCell className="text-right font-mono text-orange-400">
                ${order.marginRequired.toFixed(2)}
              </TableCell>
              
              <TableCell className="text-dark-600 text-xs">
                {new Date(order.placedAt).toLocaleString()}
              </TableCell>
              
              <TableCell className="text-center">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleCancel(order._id)}
                  disabled={cancelling === order._id}
                  className="bg-red hover:bg-red/90"
                >
                  {cancelling === order._id ? (
                    <Clock className="size-4 animate-spin" />
                  ) : (
                    <><X className="size-4 mr-1" /> Cancel</>
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Info Banner */}
      <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <p className="text-xs text-blue-400">
          💡 <span className="font-semibold">Pending limit orders</span> do NOT lock your margin. 
          Margin will only be locked when the order executes and creates an open position. 
          You can cancel these orders anytime without affecting your available capital.
        </p>
      </div>
    </div>
  );
};

export default PendingOrders;

