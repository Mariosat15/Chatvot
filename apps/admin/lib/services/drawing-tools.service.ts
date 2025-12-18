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
  | 'fibonacci'
  | 'ray'
  | 'extended-line'
  | 'freehand';

export interface DrawingPoint {
  x: number;
  y: number;
  price?: number;
  time?: number;
}

export interface DrawingObject {
  id: string;
  type: DrawingTool;
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  text?: string;
  fontSize?: number;
  fillColor?: string;
  fillOpacity?: number;
  locked?: boolean;
  visible?: boolean;
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
  '#22ab94', // Green
  '#ff9800', // Orange
  '#9c27b0', // Purple
  '#ffeb3b', // Yellow
  '#00bcd4', // Cyan
  '#e91e63', // Pink
  '#ffffff', // White
  '#787b86', // Gray
];

export const DEFAULT_LINE_STYLES: { value: 'solid' | 'dashed' | 'dotted'; label: string; preview: string }[] = [
  { value: 'solid', label: 'Solid', preview: '─────' },
  { value: 'dotted', label: 'Dotted', preview: '·····' },
  { value: 'dashed', label: 'Dashed', preview: '─ ─ ─' },
];

export const DEFAULT_LINE_WIDTHS = [1, 2, 3, 4, 5];

/**
 * Calculate distance from a point to a line segment
 */
export function pointToLineDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is inside a rectangle
 */
export function pointInRectangle(
  point: { x: number; y: number },
  rect: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);
  
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

/**
 * Get the number of points needed for each tool
 */
export function getPointsNeededForTool(tool: DrawingTool): number {
  switch (tool) {
    case 'horizontal-line':
    case 'vertical-line':
    case 'text':
      return 1;
    case 'trend-line':
    case 'ray':
    case 'extended-line':
    case 'rectangle':
    case 'arrow':
    case 'fibonacci':
      return 2;
    case 'freehand':
      return -1; // Variable points
    default:
      return 1;
  }
}

/**
 * Serialize drawings for storage
 */
export function serializeDrawings(drawings: DrawingObject[]): string {
  return JSON.stringify(drawings);
}

/**
 * Deserialize drawings from storage
 */
export function deserializeDrawings(data: string): DrawingObject[] {
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}
