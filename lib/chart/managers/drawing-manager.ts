/**
 * Drawing Manager
 * Manages all chart drawings, handles mouse interactions, selection, and state
 */

import { IChartApi, ISeriesApi, Time, Coordinate, MouseEventParams } from 'lightweight-charts';
import {
  DrawingToolType,
  ChartPoint,
  ScreenPoint,
  DrawingState,
  DrawingSession,
  DrawingEvent,
  DrawingEventHandler,
  DrawingEventType,
  SerializedDrawing,
  AnchorPosition,
  AnyPrimitive,
  createPrimitive,
  getToolInfo,
} from '../primitives';

// ============================================
// TYPES
// ============================================

export interface DrawingManagerOptions {
  defaultColor?: string;
  defaultLineWidth?: number;
  defaultLineStyle?: 'solid' | 'dashed' | 'dotted';
  selectionThreshold?: number;
  anchorThreshold?: number;
}

interface DragState {
  drawing: AnyPrimitive;
  anchor: AnchorPosition | null;
  startPoint: ScreenPoint;
  startChartPoint: ChartPoint;
}

// ============================================
// DRAWING MANAGER CLASS
// ============================================

export class DrawingManager {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<'Candlestick'> | null = null;
  private _drawings: Map<string, AnyPrimitive> = new Map();
  private _selectedId: string | null = null;
  private _hoveredId: string | null = null;
  private _activeTool: DrawingToolType = null;
  private _session: DrawingSession | null = null;
  private _dragState: DragState | null = null;
  private _options: Required<DrawingManagerOptions>;
  private _eventHandlers: Map<DrawingEventType, Set<DrawingEventHandler>> = new Map();
  private _containerElement: HTMLElement | null = null;
  private _isAttached: boolean = false;
  
  // Bound event handlers for cleanup
  private _boundChartClick: (param: MouseEventParams) => void;
  private _boundCrosshairMove: (param: MouseEventParams) => void;
  private _boundKeyDown: (e: KeyboardEvent) => void;

  constructor(options: DrawingManagerOptions = {}) {
    this._options = {
      defaultColor: options.defaultColor ?? '#2962ff',
      defaultLineWidth: options.defaultLineWidth ?? 2,
      defaultLineStyle: options.defaultLineStyle ?? 'solid',
      selectionThreshold: options.selectionThreshold ?? 10,
      anchorThreshold: options.anchorThreshold ?? 15,
    };

    // Bind event handlers
    this._boundChartClick = this.handleChartClick.bind(this);
    this._boundCrosshairMove = this.handleCrosshairMove.bind(this);
    this._boundKeyDown = this.handleKeyDown.bind(this);
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  attach(chart: IChartApi, series: ISeriesApi<'Candlestick'>, container: HTMLElement): void {
    if (this._isAttached) {
      this.detach();
    }

    this._chart = chart;
    this._series = series;
    this._containerElement = container;
    this._isAttached = true;
    
    // Subscribe to chart events
    chart.subscribeClick(this._boundChartClick);
    chart.subscribeCrosshairMove(this._boundCrosshairMove);
    document.addEventListener('keydown', this._boundKeyDown);

    console.log('[DrawingManager] Attached to chart');
  }

  detach(): void {
    if (!this._isAttached) return;

    // Remove all drawings
    this.clearAll();
    
    // Unsubscribe from chart events
    if (this._chart) {
      try {
        this._chart.unsubscribeClick(this._boundChartClick);
        this._chart.unsubscribeCrosshairMove(this._boundCrosshairMove);
      } catch {
        // Chart may be disposed
      }
    }
    
    document.removeEventListener('keydown', this._boundKeyDown);
    
    this._chart = null;
    this._series = null;
    this._containerElement = null;
    this._isAttached = false;
    
    console.log('[DrawingManager] Detached from chart');
  }

  isAttached(): boolean {
    return this._isAttached;
  }

  // ============================================
  // TOOL MANAGEMENT
  // ============================================

  setActiveTool(tool: DrawingToolType): void {
    console.log('[DrawingManager] setActiveTool:', tool);
    
    // Cancel any active session
    if (this._session) {
      this.cancelDrawing();
    }
    
    this._activeTool = tool;
    
    // Update cursor
    this.updateCursor();
    
    // Deselect if switching to a drawing tool
    if (tool !== null) {
      this.deselect();
    }
  }

  getActiveTool(): DrawingToolType {
    return this._activeTool;
  }

  // ============================================
  // DRAWING CREATION
  // ============================================

  private startDrawing(point: ChartPoint): void {
    if (!this._activeTool) return;
    
    const toolInfo = getToolInfo(this._activeTool);
    if (!toolInfo) {
      console.log('[DrawingManager] Unknown tool:', this._activeTool);
      return;
    }
    
    console.log('[DrawingManager] Starting drawing:', this._activeTool, 'at', point);
    
    this._session = {
      tool: this._activeTool,
      state: 'placing',
      points: [point],
      preview: undefined,
    };
    
    // If tool only needs one point, complete immediately
    if (toolInfo.pointsRequired === 1) {
      this.completeDrawing();
      return;
    }
    
    // Create preview primitive for 2-point tools
    this._session.preview = this.createPreviewPrimitive([point, point]);
    if (this._session.preview && this._series) {
      this._session.preview.attach(this._chart!, this._series);
      console.log('[DrawingManager] Preview created');
    }
    
    this._session.state = 'drawing';
  }

  private updateDrawing(point: ChartPoint): void {
    if (!this._session || this._session.state !== 'drawing') return;
    if (!this._session.preview) return;
    
    // Update preview with new endpoint
    const preview = this._session.preview;
    const tool = this._session.tool;
    
    try {
      if (tool === 'trend-line' || tool === 'ray' || 
          tool === 'extended-line' || tool === 'arrow') {
        (preview as any).setPoints(this._session.points[0], point);
      } else if (tool === 'rectangle') {
        (preview as any).setCorners(this._session.points[0], point);
      } else if (tool === 'fibonacci') {
        (preview as any).setPoints(this._session.points[0], point);
      }
    } catch (error) {
      console.error('[DrawingManager] Failed to update preview:', error);
    }
  }

  private completeDrawing(): void {
    if (!this._session) return;
    
    console.log('[DrawingManager] Completing drawing');
    
    // Remove preview
    if (this._session.preview) {
      try {
        this._session.preview.detach();
      } catch {}
    }
    
    // Get final points
    const points = this._session.points.length === 1 
      ? this._session.points 
      : [this._session.points[0], this._session.points[this._session.points.length - 1]];
    
    // Create actual drawing
    const drawing = createPrimitive({
      type: this._session.tool,
      points,
      options: {
        color: this._options.defaultColor,
        lineWidth: this._options.defaultLineWidth,
        lineStyle: this._options.defaultLineStyle,
      },
    });
    
    if (drawing && this._series) {
      this.addDrawing(drawing);
      this.emitEvent('created', drawing);
      console.log('[DrawingManager] Drawing created:', drawing.id);
    }
    
    // Clear session
    this._session = null;
    this.updateCursor();
  }

  cancelDrawing(): void {
    if (!this._session) return;
    
    console.log('[DrawingManager] Canceling drawing');
    
    // Remove preview
    if (this._session.preview) {
      try {
        this._session.preview.detach();
      } catch {}
    }
    
    this._session = null;
    this.updateCursor();
  }

  private createPreviewPrimitive(points: ChartPoint[]): AnyPrimitive | null {
    return createPrimitive({
      type: this._activeTool,
      points,
      options: {
        color: this._options.defaultColor,
        lineWidth: this._options.defaultLineWidth,
        lineStyle: this._options.defaultLineStyle,
      },
    });
  }

  // ============================================
  // DRAWING MANAGEMENT
  // ============================================

  addDrawing(drawing: AnyPrimitive): void {
    if (!this._series || !this._chart) return;
    
    drawing.attach(this._chart, this._series);
    this._drawings.set(drawing.id, drawing);
  }

  removeDrawing(id: string): void {
    const drawing = this._drawings.get(id);
    if (!drawing) return;
    
    drawing.detach();
    this._drawings.delete(id);
    
    if (this._selectedId === id) {
      this._selectedId = null;
    }
    
    this.emitEvent('deleted', drawing);
  }

  getDrawing(id: string): AnyPrimitive | undefined {
    return this._drawings.get(id);
  }

  getAllDrawings(): AnyPrimitive[] {
    return Array.from(this._drawings.values());
  }

  clearAll(): void {
    for (const drawing of this._drawings.values()) {
      try {
        drawing.detach();
      } catch {}
    }
    this._drawings.clear();
    this._selectedId = null;
    this._hoveredId = null;
  }

  // ============================================
  // SELECTION
  // ============================================

  select(id: string): void {
    // Deselect previous
    if (this._selectedId && this._selectedId !== id) {
      const prev = this._drawings.get(this._selectedId);
      if (prev) {
        prev.setSelected(false);
        this.emitEvent('deselected', prev);
      }
    }
    
    // Select new
    const drawing = this._drawings.get(id);
    if (drawing) {
      drawing.setSelected(true);
      this._selectedId = id;
      this.emitEvent('selected', drawing);
    }
  }

  deselect(): void {
    if (this._selectedId) {
      const drawing = this._drawings.get(this._selectedId);
      if (drawing) {
        drawing.setSelected(false);
        this.emitEvent('deselected', drawing);
      }
      this._selectedId = null;
    }
  }

  getSelectedDrawing(): AnyPrimitive | null {
    return this._selectedId ? this._drawings.get(this._selectedId) || null : null;
  }

  deleteSelected(): void {
    if (this._selectedId) {
      this.removeDrawing(this._selectedId);
    }
  }

  // ============================================
  // HIT TESTING
  // ============================================

  private hitTest(point: ScreenPoint): AnyPrimitive | null {
    // Test in reverse order (top to bottom)
    const drawings = Array.from(this._drawings.values()).reverse();
    
    for (const drawing of drawings) {
      if (drawing.hitTest(point)) {
        return drawing;
      }
    }
    
    return null;
  }

  // ============================================
  // COORDINATE CONVERSION
  // ============================================

  private getChartPointFromEvent(param: MouseEventParams): ChartPoint | null {
    if (!param.point || !this._chart || !this._series) {
      return null;
    }

    try {
      // Get price from Y coordinate
      const price = this._series.coordinateToPrice(param.point.y as Coordinate);
      if (price === null || price === undefined) {
        console.log('[DrawingManager] Could not convert Y to price');
        return null;
      }

      // Get time - use param.time if available, otherwise convert from X
      let time: Time;
      if (param.time) {
        time = param.time;
      } else {
        // Convert X coordinate to time
        const timeValue = this._chart.timeScale().coordinateToTime(param.point.x as Coordinate);
        if (timeValue === null) {
          console.log('[DrawingManager] Could not convert X to time');
          return null;
        }
        time = timeValue;
      }

      return { time, price };
    } catch (error) {
      console.error('[DrawingManager] Error converting coordinates:', error);
      return null;
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private handleChartClick(param: MouseEventParams): void {
    if (!param.point) {
      console.log('[DrawingManager] Click without point');
      return;
    }
    
    // Get chart coordinates from the event
    const chartPoint = this.getChartPointFromEvent(param);
    
    if (!chartPoint) {
      console.log('[DrawingManager] Could not get chart coordinates from click');
      return;
    }
    
    const screenPoint: ScreenPoint = { x: param.point.x, y: param.point.y };
    
    console.log('[DrawingManager] Chart click:', {
      screen: screenPoint,
      chart: chartPoint,
      activeTool: this._activeTool,
      sessionState: this._session?.state
    });
    
    // If we have an active tool
    if (this._activeTool) {
      if (!this._session) {
        // Start new drawing
        this.startDrawing(chartPoint);
      } else if (this._session.state === 'drawing') {
        // Complete the drawing
        this._session.points.push(chartPoint);
        this.completeDrawing();
      }
      return;
    }
    
    // No active tool - handle selection
    const hit = this.hitTest(screenPoint);
    
    if (hit) {
      this.select(hit.id);
    } else {
      this.deselect();
    }
  }

  private handleCrosshairMove(param: MouseEventParams): void {
    if (!param.point) return;
    
    // If drawing, update preview
    if (this._session?.state === 'drawing') {
      const chartPoint = this.getChartPointFromEvent(param);
      if (chartPoint) {
        this.updateDrawing(chartPoint);
      }
    }
    
    // Hover detection (only when not drawing)
    if (!this._session && !this._activeTool) {
      const screenPoint: ScreenPoint = { x: param.point.x, y: param.point.y };
      const hit = this.hitTest(screenPoint);
      const hitId = hit?.id || null;
      
      if (hitId !== this._hoveredId) {
        // Clear previous hover
        if (this._hoveredId) {
          const prev = this._drawings.get(this._hoveredId);
          if (prev) prev.setHovered(false);
        }
        
        // Set new hover
        if (hitId) {
          hit!.setHovered(true);
        }
        
        this._hoveredId = hitId;
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Delete selected drawing
    if ((e.key === 'Delete' || e.key === 'Backspace') && this._selectedId) {
      e.preventDefault();
      this.deleteSelected();
      return;
    }
    
    // Cancel drawing or deselect
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this._session) {
        this.cancelDrawing();
      } else if (this._activeTool) {
        this.setActiveTool(null);
      } else {
        this.deselect();
      }
      return;
    }
  }

  // ============================================
  // CURSOR MANAGEMENT
  // ============================================

  private updateCursor(): void {
    if (!this._containerElement) return;
    
    let cursor = 'default';
    
    if (this._activeTool || this._session) {
      cursor = 'crosshair';
    } else if (this._hoveredId) {
      cursor = 'pointer';
    }
    
    this._containerElement.style.cursor = cursor;
  }

  // ============================================
  // EVENTS
  // ============================================

  on(event: DrawingEventType, handler: DrawingEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: DrawingEventType, handler: DrawingEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  private emitEvent(type: DrawingEventType, drawing: AnyPrimitive): void {
    const event: DrawingEvent = {
      type,
      drawing,
      timestamp: Date.now(),
    };
    
    this._eventHandlers.get(type)?.forEach(handler => handler(event));
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  serialize(): SerializedDrawing[] {
    return Array.from(this._drawings.values()).map(d => d.toJSON());
  }

  deserialize(data: SerializedDrawing[]): void {
    this.clearAll();
    
    for (const item of data) {
      // Recreate points from options
      let points: ChartPoint[] = [];
      
      if ('startPoint' in item.options && 'endPoint' in item.options) {
        points = [item.options.startPoint as ChartPoint, item.options.endPoint as ChartPoint];
      } else if ('price' in item.options) {
        points = [{ time: 0 as any, price: item.options.price as number }];
      } else if ('time' in item.options) {
        points = [{ time: item.options.time as any, price: 0 }];
      } else if ('topLeft' in item.options && 'bottomRight' in item.options) {
        points = [item.options.topLeft as ChartPoint, item.options.bottomRight as ChartPoint];
      }
      
      const drawing = createPrimitive({
        type: item.type,
        points,
        options: { ...item.options, id: item.id },
      });
      
      if (drawing) {
        this.addDrawing(drawing);
      }
    }
  }

  // ============================================
  // OPTIONS
  // ============================================

  setDefaultColor(color: string): void {
    this._options.defaultColor = color;
  }

  setDefaultLineWidth(width: number): void {
    this._options.defaultLineWidth = width;
  }

  setDefaultLineStyle(style: 'solid' | 'dashed' | 'dotted'): void {
    this._options.defaultLineStyle = style;
  }

  getDefaultOptions(): Required<DrawingManagerOptions> {
    return { ...this._options };
  }
}
