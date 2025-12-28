'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string | ReactNode;
  headerClassName?: string;
  // Desktop table cell renderer
  render: (item: T, index: number) => ReactNode;
  // Mobile card label (optional, uses header if not provided)
  mobileLabel?: string;
  // Mobile card value renderer (optional, uses render if not provided)
  mobileRender?: (item: T, index: number) => ReactNode;
  // Hide this column on mobile
  hideOnMobile?: boolean;
  // Only show on mobile (e.g., for combined data)
  mobileOnly?: boolean;
  // Alignment
  align?: 'left' | 'center' | 'right';
}

export interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  // Styling
  className?: string;
  tableClassName?: string;
  headerClassName?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  cardClassName?: string | ((item: T, index: number) => string);
  // Empty state
  emptyState?: ReactNode;
  // Row click handler
  onRowClick?: (item: T, index: number) => void;
  // Card primary content (main section shown prominently)
  cardPrimaryContent?: (item: T, index: number) => ReactNode;
  // Card secondary content (stats grid)
  cardSecondaryContent?: (item: T, index: number) => ReactNode;
  // Card footer (actions, etc.)
  cardFooter?: (item: T, index: number) => ReactNode;
  // Show loading state
  loading?: boolean;
  loadingRows?: number;
}

export default function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  className,
  tableClassName,
  headerClassName,
  rowClassName,
  cardClassName,
  emptyState,
  onRowClick,
  cardPrimaryContent,
  cardSecondaryContent,
  cardFooter,
  loading = false,
  loadingRows = 5,
}: ResponsiveTableProps<T>) {
  const desktopColumns = columns.filter(col => !col.mobileOnly);
  const mobileColumns = columns.filter(col => !col.hideOnMobile);

  const getAlignment = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Mobile loading */}
        <div className="lg:hidden space-y-3">
          {Array.from({ length: loadingRows }).map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-800/50 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-gray-700" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-gray-700 rounded mb-2" />
                  <div className="h-3 w-16 bg-gray-700/50 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(j => (
                  <div key={j} className="h-8 bg-gray-700/50 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop loading */}
        <div className="hidden lg:block rounded-xl bg-gray-800/50 overflow-hidden">
          <div className="h-12 bg-gray-900/50" />
          {Array.from({ length: loadingRows }).map((_, i) => (
            <div key={i} className="h-16 border-t border-gray-700/50 animate-pulse">
              <div className="h-full px-6 flex items-center gap-4">
                <div className="h-8 w-20 bg-gray-700/50 rounded" />
                <div className="h-4 flex-1 bg-gray-700/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn('rounded-xl bg-gray-800/30 border border-gray-700/50 p-8 text-center', className)}>
        {emptyState || (
          <div className="text-gray-400">
            <p className="text-lg font-medium">No data available</p>
            <p className="text-sm mt-1">Check back later for updates</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      {/* Mobile Card View */}
      <div className="lg:hidden space-y-2">
        {data.map((item, index) => {
          const cardClasses = typeof cardClassName === 'function' 
            ? cardClassName(item, index) 
            : cardClassName;

          return (
            <div
              key={keyExtractor(item)}
              className={cn(
                'rounded-xl p-3 bg-gray-800/50 border border-gray-700/50 transition-all',
                onRowClick && 'cursor-pointer hover:bg-gray-800/70 active:scale-[0.99]',
                cardClasses
              )}
              onClick={() => onRowClick?.(item, index)}
            >
              {/* Primary Content */}
              {cardPrimaryContent ? (
                <div className="mb-3">{cardPrimaryContent(item, index)}</div>
              ) : (
                <div className="flex items-center gap-3 mb-3">
                  {/* Default: First two columns as primary */}
                  {mobileColumns.slice(0, 2).map(col => (
                    <div key={col.key} className="flex-shrink-0">
                      {col.mobileRender ? col.mobileRender(item, index) : col.render(item, index)}
                    </div>
                  ))}
                </div>
              )}

              {/* Secondary Content - Stats Grid */}
              {cardSecondaryContent ? (
                cardSecondaryContent(item, index)
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
                  {mobileColumns.slice(2).map(col => (
                    <div key={col.key} className="bg-gray-900/30 rounded-lg py-2 px-1">
                      <p className="text-xs font-medium text-white tabular-nums truncate">
                        {col.mobileRender ? col.mobileRender(item, index) : col.render(item, index)}
                      </p>
                      <p className="text-[9px] text-gray-500 truncate">
                        {col.mobileLabel || (typeof col.header === 'string' ? col.header : col.key)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              {cardFooter && (
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  {cardFooter(item, index)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className={cn('hidden lg:block rounded-xl bg-gray-800/50 border border-gray-700/50 overflow-hidden', tableClassName)}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={cn('bg-gray-900/50 border-b border-gray-700/50', headerClassName)}>
              <tr>
                {desktopColumns.map(col => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider',
                      getAlignment(col.align),
                      col.headerClassName
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data.map((item, index) => {
                const rowClasses = typeof rowClassName === 'function' 
                  ? rowClassName(item, index) 
                  : rowClassName;

                return (
                  <tr
                    key={keyExtractor(item)}
                    className={cn(
                      'transition-colors hover:bg-gray-800/50',
                      onRowClick && 'cursor-pointer',
                      rowClasses
                    )}
                    onClick={() => onRowClick?.(item, index)}
                  >
                    {desktopColumns.map(col => (
                      <td
                        key={col.key}
                        className={cn('px-4 py-3', getAlignment(col.align))}
                      >
                        {col.render(item, index)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Utility sub-components for common patterns
export function TableBadge({ 
  children, 
  variant = 'default',
  className 
}: { 
  children: ReactNode; 
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'premium';
  className?: string;
}) {
  const variants = {
    default: 'bg-gray-700/50 text-gray-300 border-gray-600/50',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    premium: 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/30',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

export function TableValue({
  value,
  prefix,
  suffix,
  positive,
  negative,
  className,
}: {
  value: string | number;
  prefix?: string;
  suffix?: string;
  positive?: boolean;
  negative?: boolean;
  className?: string;
}) {
  const colorClass = positive 
    ? 'text-green-400' 
    : negative 
      ? 'text-red-400' 
      : 'text-white';

  return (
    <span className={cn('font-medium tabular-nums', colorClass, className)}>
      {prefix}{value}{suffix}
    </span>
  );
}

