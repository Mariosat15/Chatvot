/**
 * Vertical Line Primitive
 * Draws a vertical line at a specific time
 */

import { 
  ISeriesPrimitivePaneView, 
  ISeriesPrimitivePaneRenderer,
  SeriesPrimitivePaneViewZOrder,
  Time,
} from 'lightweight-charts';
import { 
  BasePrimitive, 
  BasePaneRenderer, 
  BasePaneView,
  DrawingRenderData,
  CanvasRenderingTarget2D,
} from './base-primitive';
import { 
  VerticalLineOptions, 
  ChartPoint, 
  ScreenPoint, 
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
} from './types';

// ============================================
// VERTICAL LINE RENDERER
// ============================================

class VerticalLineRenderer extends BasePaneRenderer {
  draw(target: CanvasRenderingTarget2D): void {
    if (!this._data) return;
    if (!this._data.options.visible) return;
    if (this._data.points.length === 0) return;

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio, verticalPixelRatio, bitmapSize }) => {
      const data = this._data!;
      const x = data.points[0].x * horizontalPixelRatio;
      const options = data.options as VerticalLineOptions;

      // Set line style
      ctx.strokeStyle = options.color;
      ctx.lineWidth = options.lineWidth * horizontalPixelRatio;
      ctx.lineCap = 'round';
      
      // Set dash pattern
      const dash = this.getLineDash(options.lineStyle, horizontalPixelRatio);
      ctx.setLineDash(dash);

      // Draw vertical line
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, bitmapSize.height);
      ctx.stroke();

      // Reset dash
      ctx.setLineDash([]);

      // Draw selection/hover state
      if (data.isSelected || data.isHovered) {
        this.drawAnchor(ctx, data, horizontalPixelRatio, verticalPixelRatio, bitmapSize.height);
      }

      // Draw time label if enabled
      if (options.showTime) {
        this.drawTimeLabel(ctx, data, horizontalPixelRatio, verticalPixelRatio, bitmapSize.height);
      }
    });
  }

  private drawAnchor(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number,
    canvasHeight: number
  ): void {
    const x = data.points[0].x * hpr;
    const options = data.options;
    
    // Draw anchor in the middle of the canvas
    const y = canvasHeight / 2;
    const anchorRadius = (data.isSelected ? 6 : 4) * hpr;
    const borderWidth = 2 * hpr;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, anchorRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = options.color;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
    
    if (data.isSelected) {
      ctx.fillStyle = options.color;
      ctx.beginPath();
      ctx.arc(x, y, anchorRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawTimeLabel(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number,
    canvasHeight: number
  ): void {
    const options = data.options as VerticalLineOptions;
    const x = data.points[0].x * hpr;
    
    // Format time
    const time = options.time;
    let timeText: string;
    if (typeof time === 'number') {
      const date = new Date(time * 1000);
      timeText = date.toLocaleString();
    } else if (typeof time === 'string') {
      timeText = time;
    } else {
      timeText = `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
    }
    
    const fontSize = 10 * hpr;
    ctx.font = `${fontSize}px Arial`;
    
    const textWidth = ctx.measureText(timeText).width;
    const padding = 4 * hpr;
    const labelHeight = 16 * vpr;
    const labelWidth = textWidth + padding * 2;
    
    const y = canvasHeight - 20 * vpr;
    
    // Draw label background
    ctx.fillStyle = options.color;
    ctx.beginPath();
    ctx.roundRect(x - labelWidth / 2, y, labelWidth, labelHeight, 3 * hpr);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeText, x, y + labelHeight / 2);
  }

  private getLineDash(style: string, pixelRatio: number): number[] {
    switch (style) {
      case 'dashed': return [8 * pixelRatio, 4 * pixelRatio];
      case 'dotted': return [2 * pixelRatio, 2 * pixelRatio];
      default: return [];
    }
  }
}

// ============================================
// VERTICAL LINE PANE VIEW
// ============================================

class VerticalLinePaneView extends BasePaneView {
  constructor(source: VerticalLinePrimitive) {
    super(source, new VerticalLineRenderer());
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return 'normal';
  }
}

// ============================================
// VERTICAL LINE PRIMITIVE
// ============================================

export class VerticalLinePrimitive extends BasePrimitive<VerticalLineOptions> {
  constructor(options: Partial<VerticalLineOptions> & { time: Time }) {
    const fullOptions: VerticalLineOptions = {
      ...DEFAULT_DRAWING_OPTIONS,
      id: options.id || `vline_${Date.now()}`,
      time: options.time,
      showTime: options.showTime ?? false,
      ...options,
    } as VerticalLineOptions;
    
    super('vertical-line', fullOptions);
  }

  protected createPaneViews(): ISeriesPrimitivePaneView[] {
    return [new VerticalLinePaneView(this)];
  }

  getRenderData(): DrawingRenderData {
    const x = this.timeToX(this._options.time);
    const points: ScreenPoint[] = x !== null ? [{ x, y: 0 }] : [];
    
    const size = this.getCanvasSize();
    
    return {
      points,
      chartPoints: [{ time: this._options.time, price: 0 }],
      options: this._options,
      isSelected: this._isSelected,
      isHovered: this._isHovered,
      canvasWidth: size.width,
      canvasHeight: size.height,
    };
  }

  // ============================================
  // INTERACTION
  // ============================================

  hitTest(point: ScreenPoint): boolean {
    if (!this._options.visible) return false;
    
    const x = this.timeToX(this._options.time);
    if (x === null) return false;
    
    const threshold = 10;
    return Math.abs(point.x - x) < threshold;
  }

  getAnchorPoints(): ScreenPoint[] {
    const x = this.timeToX(this._options.time);
    if (x === null) return [];
    
    const size = this.getCanvasSize();
    return [{ x, y: size.height / 2 }];
  }

  getAnchorAtPoint(point: ScreenPoint, threshold: number = 15): AnchorPosition | null {
    const x = this.timeToX(this._options.time);
    if (x === null) return null;
    
    const size = this.getCanvasSize();
    const anchor = { x, y: size.height / 2 };
    
    if (this.distanceToPoint(point, anchor) < threshold) {
      return 'center';
    }
    
    return null;
  }

  moveAnchor(anchor: AnchorPosition, point: ChartPoint): void {
    if (this._options.locked) return;
    this._options.time = point.time;
    this.requestUpdate();
  }

  move(_deltaPrice: number, deltaTime: number): void {
    if (this._options.locked) return;
    // Time movement is complex - would need to convert delta to time units
    this.requestUpdate();
  }

  // ============================================
  // ADDITIONAL METHODS
  // ============================================

  setTime(time: Time): void {
    this._options.time = time;
    this.requestUpdate();
  }

  getTime(): Time {
    return this._options.time;
  }
}
