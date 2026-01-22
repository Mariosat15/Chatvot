/**
 * Chart Drawing Primitives
 * Export all primitives and types
 */

// Types
export * from './types';

// Base
export { BasePrimitive, BasePaneRenderer, BasePaneView } from './base-primitive';
export type { DrawingRenderData, CanvasRenderingTarget2D } from './base-primitive';

// Primitives
export { TrendLinePrimitive } from './trend-line.primitive';
export { HorizontalLinePrimitive } from './horizontal-line.primitive';
export { VerticalLinePrimitive } from './vertical-line.primitive';
export { RectanglePrimitive } from './rectangle.primitive';
export { FibonacciPrimitive } from './fibonacci.primitive';

// Factory function for creating primitives
import { DrawingToolType, ChartPoint, FreePoint, DrawingOptions } from './types';
import { TrendLinePrimitive } from './trend-line.primitive';
import { HorizontalLinePrimitive } from './horizontal-line.primitive';
import { VerticalLinePrimitive } from './vertical-line.primitive';
import { RectanglePrimitive } from './rectangle.primitive';
import { FibonacciPrimitive } from './fibonacci.primitive';
import { Time } from 'lightweight-charts';

export type AnyPrimitive = 
  | TrendLinePrimitive 
  | HorizontalLinePrimitive 
  | VerticalLinePrimitive 
  | RectanglePrimitive 
  | FibonacciPrimitive;

export interface CreatePrimitiveOptions {
  type: DrawingToolType;
  points: ChartPoint[];
  freePoints?: FreePoint[]; // For MT5-style free positioning
  options?: Partial<DrawingOptions>;
}

/**
 * Convert ChartPoint to FreePoint
 * If time is a number, use it directly as timestamp
 * Otherwise, use current time (fallback)
 */
function toFreePoint(point: ChartPoint): FreePoint {
  const timestamp = typeof point.time === 'number' 
    ? point.time 
    : Date.now() / 1000;
  return { timestamp, price: point.price };
}

export function createPrimitive({ type, points, freePoints, options = {} }: CreatePrimitiveOptions): AnyPrimitive | null {
  switch (type) {
    case 'trend-line':
    case 'ray':
    case 'extended-line':
    case 'arrow':
      if (points.length < 2 && (!freePoints || freePoints.length < 2)) return null;
      // Prefer freePoints for MT5-style positioning, fallback to converted ChartPoints
      const startFree = freePoints?.[0] ?? toFreePoint(points[0]);
      const endFree = freePoints?.[1] ?? toFreePoint(points[1]);
      return new TrendLinePrimitive({
        startPoint: startFree,
        endPoint: endFree,
        extendLeft: type === 'extended-line',
        extendRight: type === 'ray' || type === 'extended-line',
        ...options,
      });
      
    case 'horizontal-line':
      if (points.length < 1) return null;
      return new HorizontalLinePrimitive({
        price: points[0].price,
        ...options,
      });
      
    case 'vertical-line':
      if (points.length < 1) return null;
      return new VerticalLinePrimitive({
        time: points[0].time as Time,
        ...options,
      });
      
    case 'rectangle':
      if (points.length < 2) return null;
      return new RectanglePrimitive({
        topLeft: points[0],
        bottomRight: points[1],
        ...options,
      });
      
    case 'fibonacci':
      if (points.length < 2) return null;
      return new FibonacciPrimitive({
        startPoint: points[0],
        endPoint: points[1],
        ...options,
      });
      
    default:
      return null;
  }
}

// Tool metadata
export interface ToolInfo {
  type: DrawingToolType;
  name: string;
  description: string;
  pointsRequired: number;
  icon: string;
  category: 'lines' | 'shapes' | 'fibonacci' | 'text' | 'measure';
}

export const DRAWING_TOOLS: ToolInfo[] = [
  { type: 'trend-line', name: 'Trend Line', description: 'Draw a line between two points', pointsRequired: 2, icon: 'TrendingUp', category: 'lines' },
  { type: 'horizontal-line', name: 'Horizontal Line', description: 'Draw a horizontal price level', pointsRequired: 1, icon: 'Minus', category: 'lines' },
  { type: 'vertical-line', name: 'Vertical Line', description: 'Draw a vertical time marker', pointsRequired: 1, icon: 'Minus', category: 'lines' },
  { type: 'ray', name: 'Ray', description: 'Draw a ray extending from a point', pointsRequired: 2, icon: 'ArrowRight', category: 'lines' },
  { type: 'extended-line', name: 'Extended Line', description: 'Draw a line extending in both directions', pointsRequired: 2, icon: 'ArrowLeftRight', category: 'lines' },
  { type: 'rectangle', name: 'Rectangle', description: 'Draw a rectangle zone', pointsRequired: 2, icon: 'Square', category: 'shapes' },
  { type: 'fibonacci', name: 'Fibonacci', description: 'Draw Fibonacci retracement levels', pointsRequired: 2, icon: 'Activity', category: 'fibonacci' },
];

export function getToolInfo(type: DrawingToolType): ToolInfo | undefined {
  return DRAWING_TOOLS.find(t => t.type === type);
}
