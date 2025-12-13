/**
 * Drawing Tools Service
 * Provides drawing tools like trend lines, horizontal/vertical lines, rectangles, etc.
 */

export type DrawingTool = 
  | 'trend-line'
  | 'horizontal-line'
  | 'vertical-line'
  | 'rectangle'
  | 'text'
  | 'arrow'
  | 'fibonacci';

export interface DrawingObject {
  id: string;
  type: DrawingTool;
  points: { time: number; price: number }[];
  color: string;
  lineWidth: number;
  lineStyle: number; // 0=solid, 1=dotted, 2=dashed, 3=large-dashed
  text?: string;
  fontSize?: number;
  fillColor?: string;
  transparency?: number;
}

export interface FibonacciLevels {
  0: number;
  0.236: number;
  0.382: number;
  0.5: number;
  0.618: number;
  0.786: number;
  1: number;
}

export function calculateFibonacciLevels(
  startPrice: number,
  endPrice: number
): FibonacciLevels {
  const diff = endPrice - startPrice;
  
  return {
    0: startPrice,
    0.236: startPrice + (diff * 0.236),
    0.382: startPrice + (diff * 0.382),
    0.5: startPrice + (diff * 0.5),
    0.618: startPrice + (diff * 0.618),
    0.786: startPrice + (diff * 0.786),
    1: endPrice,
  };
}

export const DEFAULT_DRAWING_COLORS = [
  '#2962ff', // Blue
  '#f23645', // Red
  '#00e676', // Green
  '#ff6d00', // Orange
  '#9c27b0', // Purple
  '#fdd835', // Yellow
  '#00bcd4', // Cyan
  '#ff4081', // Pink
];

export const DEFAULT_LINE_STYLES = [
  { value: 0, label: 'Solid', preview: '─────' },
  { value: 1, label: 'Dotted', preview: '·····' },
  { value: 2, label: 'Dashed', preview: '─ ─ ─' },
  { value: 3, label: 'Large Dashed', preview: '── ──' },
];

export const DEFAULT_LINE_WIDTHS = [1, 2, 3, 4, 5];

