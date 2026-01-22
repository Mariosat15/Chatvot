/**
 * Base Primitive Class
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
  PriceToCoordinateConverter,
  Coordinate,
} from 'lightweight-charts';
import { 
  DrawingPrimitive, 
  DrawingOptions, 
  ChartPoint, 
  ScreenPoint, 
  DrawingToolType,
  SerializedDrawing,
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
} from './types';

// ============================================
// BASE PANE RENDERER
// ============================================

export abstract class BasePaneRenderer implements ISeriesPrimitivePaneRenderer {
  protected _data: DrawingRenderData | null = null;

  update(data: DrawingRenderData): void {
    this._data = data;
  }

  abstract draw(target: CanvasRenderingTarget2D): void;
  
  drawBackground?(target: CanvasRenderingTarget2D): void;
}

// ============================================
// BASE PANE VIEW
// ============================================

export abstract class BasePaneView implements ISeriesPrimitivePaneView {
  protected _source: BasePrimitive<any>;
  protected _renderer: BasePaneRenderer;

  constructor(source: BasePrimitive<any>, renderer: BasePaneRenderer) {
    this._source = source;
    this._renderer = renderer;
  }

  update(): void {
    const data = this._source.getRenderData();
    this._renderer.update(data);
  }

  renderer(): ISeriesPrimitivePaneRenderer {
    return this._renderer;
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return 'normal';
  }
}

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

// ============================================
// CANVAS RENDERING TARGET INTERFACE
// ============================================

export interface CanvasRenderingTarget2D {
  context: CanvasRenderingContext2D;
  mediaSize: { width: number; height: number };
  bitmapSize: { width: number; height: number };
  useBitmapCoordinateSpace<T>(callback: (scope: BitmapCoordinatesRenderingScope) => T): T;
  useMediaCoordinateSpace<T>(callback: (scope: MediaCoordinatesRenderingScope) => T): T;
}

export interface BitmapCoordinatesRenderingScope {
  context: CanvasRenderingContext2D;
  bitmapSize: { width: number; height: number };
  mediaSize: { width: number; height: number };
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}

export interface MediaCoordinatesRenderingScope {
  context: CanvasRenderingContext2D;
  mediaSize: { width: number; height: number };
}

// ============================================
// BASE PRIMITIVE CLASS
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
    this._chart = null;
    this._series = null;
    this._requestUpdate = undefined;
    this._paneViews = [];
  }

  // Public attach/detach for DrawingPrimitive interface
  attach(chart: IChartApi, series: ISeriesApi<'Candlestick'>): void {
    // This is called by DrawingManager, actual attachment is done via attached()
    series.attachPrimitive(this);
  }

  detach(): void {
    if (this._series) {
      this._series.detachPrimitive(this);
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
    this._paneViews.forEach(view => {
      if ('update' in view && typeof view.update === 'function') {
        view.update();
      }
    });
  }

  // ============================================
  // STATE
  // ============================================

  update(options: Partial<T>): void {
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  setVisible(visible: boolean): void {
    this._options.visible = visible;
    this.requestUpdate();
  }

  setLocked(locked: boolean): void {
    this._options.locked = locked;
  }

  setSelected(selected: boolean): void {
    this._isSelected = selected;
    this.requestUpdate();
  }

  setHovered(hovered: boolean): void {
    this._isHovered = hovered;
    this.requestUpdate();
  }

  protected requestUpdate(): void {
    this.updateAllViews();
    this._requestUpdate?.();
  }

  // ============================================
  // COORDINATE CONVERSION
  // ============================================

  protected timeToX(time: Time): number | null {
    if (!this._chart) return null;
    const coordinate = this._chart.timeScale().timeToCoordinate(time);
    return coordinate !== null ? coordinate : null;
  }

  protected xToTime(x: number): Time | null {
    if (!this._chart) return null;
    return this._chart.timeScale().coordinateToTime(x as Coordinate);
  }

  protected priceToY(price: number): number | null {
    if (!this._series) return null;
    const coordinate = this._series.priceToCoordinate(price);
    return coordinate !== null ? coordinate : null;
  }

  protected yToPrice(y: number): number | null {
    if (!this._series) return null;
    return this._series.coordinateToPrice(y as Coordinate);
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
  // RENDER DATA
  // ============================================

  abstract getRenderData(): DrawingRenderData;

  protected getCanvasSize(): { width: number; height: number } {
    if (!this._chart) return { width: 0, height: 0 };
    const container = (this._chart as any)._chartWidget?._chartContainerElement;
    if (container) {
      return { width: container.clientWidth, height: container.clientHeight };
    }
    return { width: 800, height: 600 }; // Fallback
  }

  // ============================================
  // INTERACTION (to be implemented by subclasses)
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
  // UTILITY METHODS
  // ============================================

  protected getLineDash(): number[] {
    switch (this._options.lineStyle) {
      case 'dashed': return [8, 4];
      case 'dotted': return [2, 2];
      default: return [];
    }
  }

  protected distanceToSegment(point: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      return Math.hypot(point.x - p1.x, point.y - p1.y);
    }
    
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;
    
    return Math.hypot(point.x - projX, point.y - projY);
  }

  protected distanceToPoint(p1: ScreenPoint, p2: ScreenPoint): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }
}
