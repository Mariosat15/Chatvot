/**
 * Base Primitive Class - Optimized for Performance
 * Foundation for all chart drawing tools using Lightweight Charts plugin system
 */

import { 
  IChartApi, 
  ISeriesApi, 
  Time,
  SeriesType,
  ISeriesPrimitive,
  SeriesPrimitivePaneViewZOrder,
  ISeriesPrimitivePaneView,
  ISeriesPrimitivePaneRenderer,
  Coordinate,
} from 'lightweight-charts';
import { 
  DrawingPrimitive, 
  DrawingOptions, 
  ChartPoint, 
  FreePoint,
  ScreenPoint, 
  DrawingToolType,
  SerializedDrawing,
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
} from './types';

// ============================================
// RENDER DATA
// ============================================

export interface DrawingRenderData {
  points: ScreenPoint[];
  chartPoints: ChartPoint[];
  options: DrawingOptions;
  isSelected: boolean;
  isHovered: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

// Canvas rendering target type for documentation
export interface CanvasRenderingTarget2D {
  useBitmapCoordinateSpace(callback: (scope: BitmapCoordinatesRenderingScope) => void): void;
}

export interface BitmapCoordinatesRenderingScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
  bitmapSize: { width: number; height: number };
}

// ============================================
// BASE PANE RENDERER - Optimized
// ============================================

export abstract class BasePaneRenderer implements ISeriesPrimitivePaneRenderer {
  protected _data: DrawingRenderData | null = null;

  update(data: DrawingRenderData): void {
    this._data = data;
  }

  draw(target: any): void {
    if (!this._data || !this._data.options.visible) return;
    
    try {
      if (target?.useBitmapCoordinateSpace) {
        target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
          this.drawImpl(scope.context, scope.horizontalPixelRatio, scope.verticalPixelRatio, scope.bitmapSize);
        });
      }
    } catch {}
  }

  protected abstract drawImpl(
    ctx: CanvasRenderingContext2D, 
    hpr: number, 
    vpr: number, 
    size: { width: number; height: number }
  ): void;

  protected getLineDash(style: string | undefined, pixelRatio: number): number[] {
    switch (style) {
      case 'dashed': return [8 * pixelRatio, 4 * pixelRatio];
      case 'dotted': return [2 * pixelRatio, 2 * pixelRatio];
      default: return [];
    }
  }
}

// ============================================
// BASE PANE VIEW
// ============================================

export class BasePaneView implements ISeriesPrimitivePaneView {
  protected _source: BasePrimitive<any>;
  protected _renderer: BasePaneRenderer;

  constructor(source: BasePrimitive<any>, renderer: BasePaneRenderer) {
    this._source = source;
    this._renderer = renderer;
  }

  update(): void {
    try {
      this._renderer.update(this._source.getRenderData());
    } catch {}
  }

  renderer(): ISeriesPrimitivePaneRenderer {
    return this._renderer;
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return 'normal';
  }
}

// ============================================
// BASE PRIMITIVE CLASS - Optimized
// ============================================

export abstract class BasePrimitive<T extends DrawingOptions> implements DrawingPrimitive<T>, ISeriesPrimitive<Time> {
  readonly id: string;
  readonly type: DrawingToolType;
  protected _options: T;
  protected _chart: IChartApi | null = null;
  protected _series: ISeriesApi<'Candlestick'> | null = null;
  protected _paneViews: ISeriesPrimitivePaneView[] = [];
  protected _isSelected: boolean = false;
  protected _isHovered: boolean = false;
  protected _requestUpdate?: () => void;
  
  // Performance: cache canvas size
  private _cachedCanvasSize: { width: number; height: number } = { width: 800, height: 600 };
  private _canvasSizeCacheTime: number = 0;
  
  // Performance: throttle updates
  private _pendingUpdate: boolean = false;
  private _rafId: number | null = null;

  constructor(type: DrawingToolType, options: T) {
    this.id = options.id || `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this._options = { ...DEFAULT_DRAWING_OPTIONS, ...options, id: this.id } as T;
  }

  // ============================================
  // GETTERS
  // ============================================

  get options(): T {
    return this._options;
  }

  get chart(): IChartApi | null {
    return this._chart;
  }

  get series(): ISeriesApi<'Candlestick'> | null {
    return this._series;
  }

  get isSelected(): boolean {
    return this._isSelected;
  }

  get isHovered(): boolean {
    return this._isHovered;
  }

  // ============================================
  // LIFECYCLE - ISeriesPrimitive
  // ============================================

  attached({ chart, series, requestUpdate }: { 
    chart: IChartApi; 
    series: ISeriesApi<SeriesType>; 
    requestUpdate: () => void; 
  }): void {
    this._chart = chart;
    this._series = series as ISeriesApi<'Candlestick'>;
    this._requestUpdate = requestUpdate;
    this._paneViews = this.createPaneViews();
  }

  detached(): void {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._chart = null;
    this._series = null;
    this._requestUpdate = undefined;
    this._paneViews = [];
  }

  attach(chart: IChartApi, series: ISeriesApi<'Candlestick'>): void {
    try {
      series.attachPrimitive(this);
    } catch {}
  }

  detach(): void {
    if (this._series) {
      try {
        this._series.detachPrimitive(this);
      } catch {}
    }
  }

  // ============================================
  // PANE VIEWS - ISeriesPrimitive
  // ============================================

  paneViews(): readonly ISeriesPrimitivePaneView[] {
    return this._paneViews;
  }

  protected abstract createPaneViews(): ISeriesPrimitivePaneView[];

  updateAllViews(): void {
    for (const view of this._paneViews) {
      if ('update' in view && typeof view.update === 'function') {
        (view as any).update();
      }
    }
  }

  // ============================================
  // STATE - Optimized with RAF batching
  // ============================================

  update(options: Partial<T>): void {
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  setVisible(visible: boolean): void {
    if (this._options.visible !== visible) {
      this._options.visible = visible;
      this.requestUpdate();
    }
  }

  setLocked(locked: boolean): void {
    this._options.locked = locked;
  }

  setSelected(selected: boolean): void {
    if (this._isSelected !== selected) {
      this._isSelected = selected;
      this.requestUpdate();
    }
  }

  setHovered(hovered: boolean): void {
    if (this._isHovered !== hovered) {
      this._isHovered = hovered;
      this.requestUpdate();
    }
  }

  protected requestUpdate(): void {
    // Batch updates using RAF
    if (this._pendingUpdate) return;
    this._pendingUpdate = true;
    
    this._rafId = requestAnimationFrame(() => {
      this._pendingUpdate = false;
      this.updateAllViews();
      this._requestUpdate?.();
    });
  }

  // Force immediate update (for critical changes)
  protected requestImmediateUpdate(): void {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._pendingUpdate = false;
    this.updateAllViews();
    this._requestUpdate?.();
  }

  // ============================================
  // COORDINATE CONVERSION - Cached
  // ============================================

  protected timeToX(time: Time): number | null {
    if (!this._chart) return null;
    try {
      return this._chart.timeScale().timeToCoordinate(time);
    } catch { return null; }
  }

  protected xToTime(x: number): Time | null {
    if (!this._chart) return null;
    try {
      return this._chart.timeScale().coordinateToTime(x as Coordinate);
    } catch { return null; }
  }

  protected priceToY(price: number): number | null {
    if (!this._series) return null;
    try {
      return this._series.priceToCoordinate(price);
    } catch { return null; }
  }

  protected yToPrice(y: number): number | null {
    if (!this._series) return null;
    try {
      return this._series.coordinateToPrice(y as Coordinate);
    } catch { return null; }
  }

  protected toScreen(point: ChartPoint): ScreenPoint | null {
    const x = this.timeToX(point.time);
    const y = this.priceToY(point.price);
    if (x === null || y === null) return null;
    return { x, y };
  }

  protected toChart(point: ScreenPoint): ChartPoint | null {
    const time = this.xToTime(point.x);
    const price = this.yToPrice(point.y);
    if (time === null || price === null) return null;
    return { time, price };
  }

  // ============================================
  // FREE COORDINATE CONVERSION (MT5-style, no snapping)
  // Uses reference bar anchoring to survive lazy loading
  // Reference: https://tradingview.github.io/lightweight-charts/docs/plugins/series-primitives
  // ============================================

  /**
   * Convert FreePoint to screen coordinates
   * Uses reference bar anchoring - survives lazy loading when new bars are added
   * 
   * The key insight: logical indices shift when new bars load, but bar times don't.
   * So we anchor to a specific bar's time and store the offset.
   */
  protected freePointToScreen(point: FreePoint): ScreenPoint | null {
    if (!this._chart || !this._series) return null;
    
    try {
      const timeScale = this._chart.timeScale();
      let x: number | null = null;
      
      // Method 1: Use reference bar anchoring (survives lazy loading)
      if (point.referenceBarTime !== undefined && point.offsetFromBar !== undefined) {
        // Get the X coordinate of the reference bar
        const refX = timeScale.timeToCoordinate(point.referenceBarTime as any);
        
        if (refX !== null) {
          // Estimate bar width by looking at visible range
          const visibleRange = timeScale.getVisibleLogicalRange();
          if (visibleRange) {
            const tsWidth = timeScale.width();
            const barsVisible = visibleRange.to - visibleRange.from;
            const barWidth = barsVisible > 0 ? tsWidth / barsVisible : 10;
            
            // Apply offset from reference bar
            x = refX + (point.offsetFromBar * barWidth);
          } else {
            x = refX;
          }
        }
      }
      
      // Method 2: Fallback to timeToCoordinate for exact bar times
      if (x === null && point.timestamp) {
        x = timeScale.timeToCoordinate(point.timestamp as any);
      }
      
      if (x === null) return null;
      
      // Y coordinate from price
      const y = this._series.priceToCoordinate(point.price);
      if (y === null) return null;
      
      return { x, y };
    } catch {
      return null;
    }
  }

  /**
   * Convert screen coordinates to FreePoint
   * Creates anchoring data for stable positioning across lazy loading
   */
  protected screenToFreePoint(point: ScreenPoint): FreePoint | null {
    if (!this._chart || !this._series) return null;
    
    try {
      const timeScale = this._chart.timeScale();
      
      // Get the time at this X coordinate (snaps to nearest bar)
      const time = timeScale.coordinateToTime(point.x as Coordinate);
      
      // Get the X coordinate of that bar (reference point)
      let referenceBarTime: number | undefined;
      let offsetFromBar: number = 0;
      
      if (time !== null) {
        referenceBarTime = typeof time === 'number' ? time : undefined;
        
        // Calculate offset from the reference bar
        if (referenceBarTime !== undefined) {
          const refX = timeScale.timeToCoordinate(time);
          if (refX !== null) {
            // Get bar width
            const visibleRange = timeScale.getVisibleLogicalRange();
            if (visibleRange) {
              const tsWidth = timeScale.width();
              const barsVisible = visibleRange.to - visibleRange.from;
              const barWidth = barsVisible > 0 ? tsWidth / barsVisible : 10;
              
              // Calculate fractional offset from reference bar
              offsetFromBar = (point.x - refX) / barWidth;
            }
          }
        }
      }
      
      // Get logical index for timestamp calculation
      const logicalIndex = timeScale.coordinateToLogical(point.x as Coordinate);
      
      // Calculate precise timestamp using visible range
      let timestamp = referenceBarTime ?? 0;
      if (logicalIndex !== null) {
        const visibleRange = timeScale.getVisibleRange();
        const logicalRange = timeScale.getVisibleLogicalRange();
        if (visibleRange && logicalRange) {
          const startTime = typeof visibleRange.from === 'number' ? visibleRange.from : 0;
          const endTime = typeof visibleRange.to === 'number' ? visibleRange.to : startTime + 1;
          const timeSpan = endTime - startTime;
          const logicalSpan = logicalRange.to - logicalRange.from;
          if (logicalSpan > 0 && timeSpan > 0) {
            const ratio = (logicalIndex - logicalRange.from) / logicalSpan;
            timestamp = startTime + ratio * timeSpan;
          }
        }
      }
      
      // Price from Y coordinate
      const price = this._series.coordinateToPrice(point.y as Coordinate);
      if (price === null) return null;
      
      return { 
        timestamp, 
        price,
        referenceBarTime,
        offsetFromBar,
      };
    } catch {
      return null;
    }
  }

  // ============================================
  // RENDER DATA
  // ============================================

  abstract getRenderData(): DrawingRenderData;

  protected getCanvasSize(): { width: number; height: number } {
    // Cache canvas size for 100ms
    const now = Date.now();
    if (now - this._canvasSizeCacheTime < 100) {
      return this._cachedCanvasSize;
    }
    
    if (this._chart) {
      try {
        const chartElement = (this._chart as any).chartElement?.();
        if (chartElement) {
          this._cachedCanvasSize = { 
            width: chartElement.clientWidth || 800, 
            height: chartElement.clientHeight || 600 
          };
          this._canvasSizeCacheTime = now;
        }
      } catch {}
    }
    return this._cachedCanvasSize;
  }

  // ============================================
  // INTERACTION
  // ============================================

  abstract hitTest(point: ScreenPoint): boolean;
  abstract getAnchorPoints(): ScreenPoint[];
  abstract getAnchorAtPoint(point: ScreenPoint, threshold?: number): AnchorPosition | null;
  abstract moveAnchor(anchor: AnchorPosition, point: ChartPoint): void;
  abstract move(deltaPrice: number, deltaTime: number): void;

  // ============================================
  // SERIALIZATION
  // ============================================

  toJSON(): SerializedDrawing {
    return {
      id: this.id,
      type: this.type,
      options: this._options as DrawingOptions,
      version: 1,
    };
  }

  // ============================================
  // UTILITY METHODS - Optimized
  // ============================================

  protected distanceToSegment(point: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      return Math.hypot(point.x - p1.x, point.y - p1.y);
    }
    
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    return Math.hypot(point.x - (p1.x + t * dx), point.y - (p1.y + t * dy));
  }

  protected distanceToPoint(p1: ScreenPoint, p2: ScreenPoint): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }
}
