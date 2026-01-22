/**
 * Chart Drawing Primitives - Type Definitions
 * Based on TradingView Lightweight Charts Plugin System
 */

import { IChartApi, ISeriesApi, Time, Coordinate, Logical } from 'lightweight-charts';

// ============================================
// CORE TYPES
// ============================================

export interface ChartPoint {
  time: Time;
  price: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export type DrawingToolType = 
  | 'trend-line'
  | 'horizontal-line'
  | 'vertical-line'
  | 'ray'
  | 'extended-line'
  | 'parallel-channel'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'arrow'
  | 'text'
  | 'fibonacci'
  | 'pitchfork'
  | 'brush'
  | 'highlighter'
  | 'measure'
  | 'price-range'
  | 'date-range'
  | 'price-note'
  | null;

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export type AnchorPosition = 'start' | 'end' | 'middle' | 'corner' | 'center';

// ============================================
// DRAWING OPTIONS
// ============================================

export interface DrawingOptions {
  id: string;
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
  fillColor?: string;
  fillOpacity?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  showLabel?: boolean;
  labelPosition?: 'left' | 'right' | 'top' | 'bottom';
  extendLeft?: boolean;
  extendRight?: boolean;
  interactive?: boolean;
  visible?: boolean;
  locked?: boolean;
  zOrder?: number;
}

export interface TrendLineOptions extends DrawingOptions {
  startPoint: ChartPoint;
  endPoint: ChartPoint;
  showAngle?: boolean;
  showLength?: boolean;
  showPriceDiff?: boolean;
}

export interface HorizontalLineOptions extends DrawingOptions {
  price: number;
  showPrice?: boolean;
  priceFormat?: string;
}

export interface VerticalLineOptions extends DrawingOptions {
  time: Time;
  showTime?: boolean;
}

export interface RectangleOptions extends DrawingOptions {
  topLeft: ChartPoint;
  bottomRight: ChartPoint;
}

export interface FibonacciOptions extends DrawingOptions {
  startPoint: ChartPoint;
  endPoint: ChartPoint;
  levels: number[];
  levelColors?: Record<number, string>;
  showLabels?: boolean;
  showPrices?: boolean;
  reverse?: boolean;
}

export interface TextOptions extends DrawingOptions {
  point: ChartPoint;
  text: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  padding?: number;
}

export interface ArrowOptions extends DrawingOptions {
  startPoint: ChartPoint;
  endPoint: ChartPoint;
  headSize?: number;
}

export interface RayOptions extends DrawingOptions {
  startPoint: ChartPoint;
  endPoint: ChartPoint;
}

export interface ParallelChannelOptions extends DrawingOptions {
  topLine: { start: ChartPoint; end: ChartPoint };
  bottomLine: { start: ChartPoint; end: ChartPoint };
  showMiddleLine?: boolean;
}

// ============================================
// PRIMITIVE INTERFACES
// ============================================

export interface DrawingPrimitive<T extends DrawingOptions = DrawingOptions> {
  readonly id: string;
  readonly type: DrawingToolType;
  options: T;
  
  // Lifecycle
  attach(chart: IChartApi, series: ISeriesApi<'Candlestick'>): void;
  detach(): void;
  
  // State
  update(options: Partial<T>): void;
  setVisible(visible: boolean): void;
  setLocked(locked: boolean): void;
  
  // Interaction
  hitTest(point: ScreenPoint): boolean;
  getAnchorPoints(): ScreenPoint[];
  getAnchorAtPoint(point: ScreenPoint, threshold?: number): AnchorPosition | null;
  moveAnchor(anchor: AnchorPosition, point: ChartPoint): void;
  move(deltaPrice: number, deltaTime: number): void;
  
  // Serialization
  toJSON(): SerializedDrawing;
}

export interface SerializedDrawing {
  id: string;
  type: DrawingToolType;
  options: DrawingOptions;
  version: number;
}

// ============================================
// RENDERER TYPES (for Lightweight Charts)
// ============================================

export interface PrimitiveRenderer {
  draw(ctx: CanvasRenderingContext2D, pixelRatio: number): void;
  drawBackground?(ctx: CanvasRenderingContext2D, pixelRatio: number): void;
}

export interface PrimitivePaneView {
  renderer(): PrimitiveRenderer;
  zOrder?(): 'bottom' | 'normal' | 'top';
}

export interface PrimitiveAxisView {
  renderer(): PrimitiveRenderer;
  fixedCoordinate?(): number | null;
}

// ============================================
// DRAWING STATE
// ============================================

export type DrawingState = 
  | 'idle'          // No active drawing
  | 'placing'       // Placing first point
  | 'drawing'       // Drawing in progress
  | 'complete'      // Drawing finished
  | 'selected'      // Drawing is selected
  | 'editing';      // Editing anchor points

export interface DrawingSession {
  tool: DrawingToolType;
  state: DrawingState;
  points: ChartPoint[];
  preview?: DrawingPrimitive;
}

// ============================================
// COORDINATE HELPERS
// ============================================

export interface CoordinateConverter {
  timeToX(time: Time): number | null;
  xToTime(x: number): Time | null;
  priceToY(price: number): number | null;
  yToPrice(y: number): number | null;
  toScreen(point: ChartPoint): ScreenPoint | null;
  toChart(point: ScreenPoint): ChartPoint | null;
}

// ============================================
// EVENT TYPES
// ============================================

export type DrawingEventType = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'selected'
  | 'deselected'
  | 'moved'
  | 'resized';

export interface DrawingEvent {
  type: DrawingEventType;
  drawing: DrawingPrimitive;
  timestamp: number;
}

export type DrawingEventHandler = (event: DrawingEvent) => void;

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_DRAWING_OPTIONS: Partial<DrawingOptions> = {
  color: '#2962ff',
  lineWidth: 2,
  lineStyle: 'solid',
  fillOpacity: 0.2,
  fontSize: 12,
  fontFamily: 'Arial',
  showLabel: true,
  interactive: true,
  visible: true,
  locked: false,
  zOrder: 0,
};

export const DEFAULT_FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];

export const FIBONACCI_COLORS: Record<number, string> = {
  0: '#787B86',
  0.236: '#F23645',
  0.382: '#FF9800',
  0.5: '#2196F3',
  0.618: '#4CAF50',
  0.786: '#9C27B0',
  1: '#787B86',
  1.618: '#E91E63',
  2.618: '#00BCD4',
};
