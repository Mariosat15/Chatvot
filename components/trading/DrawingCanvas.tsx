'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';

export type DrawingToolType = 
  | 'trend-line'
  | 'horizontal-line'
  | 'vertical-line'
  | 'rectangle'
  | 'text'
  | 'arrow'
  | 'fibonacci'
  | 'ray'
  | 'extended-line'
  | 'freehand'
  | null;

export interface Point {
  x: number;
  y: number;
  price: number;
  time: number;
}

export interface DrawingItem {
  id: string;
  type: DrawingToolType;
  points: Point[];
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  text?: string;
  fontSize?: number;
  fillColor?: string;
  fillOpacity?: number;
}

interface DrawingCanvasProps {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  activeTool: DrawingToolType;
  onToolComplete: () => void;
  drawings: DrawingItem[];
  onDrawingsChange: (drawings: DrawingItem[]) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  drawingColor?: string;
  drawingLineWidth?: number;
  drawingTextSize?: number;
  onSelectionChange?: (id: string | null) => void;
}

export interface DrawingCanvasHandle {
  clearAllDrawings: () => void;
  deleteSelectedDrawing: () => void;
  getDrawings: () => DrawingItem[];
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(({
  chart,
  series,
  activeTool,
  onToolComplete,
  drawings,
  onDrawingsChange,
  containerRef,
  drawingColor = '#2962ff',
  drawingLineWidth = 2,
  drawingTextSize = 14,
  onSelectionChange,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<Point | null>(null);
  const [freehandPath, setFreehandPath] = useState<Point[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [hoverDrawingId, setHoverDrawingId] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // Wrapper to update selection and notify parent
  const updateSelection = useCallback((id: string | null) => {
    setSelectedId(id);
    onSelectionChange?.(id);
  }, [onSelectionChange]);

  useImperativeHandle(ref, () => ({
    clearAllDrawings: () => {
      onDrawingsChange([]);
      updateSelection(null);
      setEditingId(null);
    },
    deleteSelectedDrawing: () => {
      if (selectedId) {
        onDrawingsChange(drawings.filter(d => d.id !== selectedId));
        updateSelection(null);
        setEditingId(null);
      }
    },
    getDrawings: () => drawings,
  }));

  // Get current mouse position with chart coordinates
  const getPoint = useCallback((e: React.MouseEvent | MouseEvent): Point => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : 0;
    const y = rect ? e.clientY - rect.top : 0;
    
    let price = 0;
    let time = 0;
    
    try {
      if (series && chart) {
        const p = series.coordinateToPrice(y);
        const t = chart.timeScale().coordinateToTime(x);
        if (p !== null) price = p as number;
        if (t !== null) time = t as number;
      }
    } catch {}
    
    return { x, y, price, time };
  }, [chart, series]);

  // Convert stored point to current screen position
  const toScreen = useCallback((point: Point): { x: number; y: number } => {
    if (!chart || !series || !point.price || !point.time) {
      return { x: point.x, y: point.y };
    }
    
    try {
      const y = series.priceToCoordinate(point.price);
      const x = chart.timeScale().timeToCoordinate(point.time as any);
      if (x !== null && y !== null) {
        return { x, y };
      }
    } catch {}
    
    return { x: point.x, y: point.y };
  }, [chart, series]);

  // Render everything
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Draw saved drawings
    drawings.forEach(item => {
      const isSelected = item.id === selectedId;
      const isEditing = item.id === editingId;
      const isHovered = item.id === hoverDrawingId;
      
      // Convert points to screen coordinates
      const screenPoints = item.points.map(p => toScreen(p));
      
      if (screenPoints.length === 0) return;

      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash(item.lineStyle === 'dashed' ? [8, 4] : item.lineStyle === 'dotted' ? [2, 2] : []);

      switch (item.type) {
        case 'freehand':
          if (screenPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
            screenPoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
          }
          break;

        case 'trend-line':
          if (screenPoints.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
            ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
            ctx.stroke();
          }
          break;

        case 'ray':
          if (screenPoints.length >= 2) {
            const [p1, p2] = screenPoints;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p1.x + (dx / len) * 3000, p1.y + (dy / len) * 3000);
              ctx.stroke();
            }
          }
          break;

        case 'extended-line':
          if (screenPoints.length >= 2) {
            const [p1, p2] = screenPoints;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
              ctx.beginPath();
              ctx.moveTo(p1.x - (dx / len) * 3000, p1.y - (dy / len) * 3000);
              ctx.lineTo(p1.x + (dx / len) * 3000, p1.y + (dy / len) * 3000);
              ctx.stroke();
            }
          }
          break;

        case 'horizontal-line':
          if (screenPoints.length >= 1) {
            ctx.beginPath();
            ctx.moveTo(0, screenPoints[0].y);
            ctx.lineTo(canvas.width, screenPoints[0].y);
            ctx.stroke();
            
            // Price label
            ctx.setLineDash([]);
            ctx.fillStyle = item.color;
            ctx.fillRect(canvas.width / dpr - 70, screenPoints[0].y - 10, 70, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.points[0].price.toFixed(5), canvas.width / dpr - 35, screenPoints[0].y + 4);
          }
          break;

        case 'vertical-line':
          if (screenPoints.length >= 1) {
            ctx.beginPath();
            ctx.moveTo(screenPoints[0].x, 0);
            ctx.lineTo(screenPoints[0].x, canvas.height);
            ctx.stroke();
          }
          break;

        case 'rectangle':
          if (screenPoints.length >= 2) {
            const [p1, p2] = screenPoints;
            const rx = Math.min(p1.x, p2.x);
            const ry = Math.min(p1.y, p2.y);
            const rw = Math.abs(p2.x - p1.x);
            const rh = Math.abs(p2.y - p1.y);
            
            ctx.globalAlpha = item.fillOpacity || 0.2;
            ctx.fillStyle = item.fillColor || item.color;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.globalAlpha = 1;
            ctx.strokeRect(rx, ry, rw, rh);
          }
          break;

        case 'arrow':
          if (screenPoints.length >= 2) {
            const [p1, p2] = screenPoints;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            
            // Arrowhead
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const headLen = 15;
            ctx.beginPath();
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();
          }
          break;

        case 'text':
          if (screenPoints.length >= 1 && item.text) {
            ctx.font = `${item.fontSize || 14}px Arial`;
            ctx.fillStyle = item.color;
            ctx.textAlign = 'left';
            ctx.fillText(item.text, screenPoints[0].x, screenPoints[0].y);
            
            if (isSelected || isEditing) {
              const metrics = ctx.measureText(item.text);
              ctx.setLineDash([3, 3]);
              ctx.strokeStyle = item.color;
              ctx.lineWidth = 1;
              ctx.strokeRect(screenPoints[0].x - 2, screenPoints[0].y - (item.fontSize || 14), metrics.width + 4, (item.fontSize || 14) + 4);
            }
          }
          break;

        case 'fibonacci':
          if (screenPoints.length >= 2) {
            const [p1, p2] = screenPoints;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const colors = ['#787B86', '#F23645', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#787B86'];
            
            levels.forEach((level, idx) => {
              const ly = p1.y + (p2.y - p1.y) * level;
              ctx.strokeStyle = colors[idx];
              ctx.setLineDash([]);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(0, ly);
              ctx.lineTo(canvas.width / dpr, ly);
              ctx.stroke();
              
              ctx.fillStyle = colors[idx];
              ctx.font = '11px Arial';
              const levelPrice = item.points[0].price + (item.points[1].price - item.points[0].price) * level;
              ctx.fillText(`${(level * 100).toFixed(1)}%`, 10, ly - 3);
            });
            
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = '#2962ff';
            ctx.fillRect(0, Math.min(p1.y, p2.y), canvas.width / dpr, Math.abs(p2.y - p1.y));
            ctx.globalAlpha = 1;
          }
          break;
      }

      // Draw selection/edit handles
      if ((isSelected || isHovered || isEditing) && item.type !== 'freehand') {
        ctx.setLineDash([]);
        
        // Get handle points based on type
        let handlePoints = screenPoints;
        if (item.type === 'rectangle' && screenPoints.length >= 2) {
          const [p1, p2] = screenPoints;
          handlePoints = [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p1.y },
            { x: p1.x, y: p2.y },
            { x: p2.x, y: p2.y },
          ];
        } else if (item.type === 'horizontal-line') {
          handlePoints = [{ x: canvas.width / dpr / 2, y: screenPoints[0].y }];
        } else if (item.type === 'vertical-line') {
          handlePoints = [{ x: screenPoints[0].x, y: canvas.height / dpr / 2 }];
        }
        
        handlePoints.forEach((p, idx) => {
          const size = isEditing ? 8 : 6;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          
          // Inner dot for edit mode
          if (isEditing) {
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    });

    // Draw current drawing preview
    if (isDrawing && drawStart) {
      ctx.strokeStyle = drawingColor;
      ctx.lineWidth = drawingLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);

      if (activeTool === 'freehand' && freehandPath.length > 1) {
        ctx.beginPath();
        ctx.moveTo(freehandPath[0].x, freehandPath[0].y);
        freehandPath.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      } else if (drawCurrent) {
        switch (activeTool) {
          case 'trend-line':
          case 'ray':
          case 'extended-line':
          case 'arrow':
            ctx.beginPath();
            ctx.moveTo(drawStart.x, drawStart.y);
            ctx.lineTo(drawCurrent.x, drawCurrent.y);
            ctx.stroke();
            if (activeTool === 'arrow') {
              const angle = Math.atan2(drawCurrent.y - drawStart.y, drawCurrent.x - drawStart.x);
              ctx.beginPath();
              ctx.moveTo(drawCurrent.x, drawCurrent.y);
              ctx.lineTo(drawCurrent.x - 15 * Math.cos(angle - Math.PI / 6), drawCurrent.y - 15 * Math.sin(angle - Math.PI / 6));
              ctx.lineTo(drawCurrent.x - 15 * Math.cos(angle + Math.PI / 6), drawCurrent.y - 15 * Math.sin(angle + Math.PI / 6));
              ctx.closePath();
              ctx.fillStyle = drawingColor;
              ctx.fill();
            }
            break;
          case 'horizontal-line':
            ctx.beginPath();
            ctx.moveTo(0, drawStart.y);
            ctx.lineTo(canvas.width / dpr, drawStart.y);
            ctx.stroke();
            break;
          case 'vertical-line':
            ctx.beginPath();
            ctx.moveTo(drawStart.x, 0);
            ctx.lineTo(drawStart.x, canvas.height / dpr);
            ctx.stroke();
            break;
          case 'rectangle':
            const rx = Math.min(drawStart.x, drawCurrent.x);
            const ry = Math.min(drawStart.y, drawCurrent.y);
            const rw = Math.abs(drawCurrent.x - drawStart.x);
            const rh = Math.abs(drawCurrent.y - drawStart.y);
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = drawingColor;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.globalAlpha = 1;
            ctx.strokeRect(rx, ry, rw, rh);
            break;
          case 'fibonacci':
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const colors = ['#787B86', '#F23645', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#787B86'];
            levels.forEach((level, idx) => {
              const ly = drawStart.y + (drawCurrent.y - drawStart.y) * level;
              ctx.strokeStyle = colors[idx];
              ctx.beginPath();
              ctx.moveTo(0, ly);
              ctx.lineTo(canvas.width / dpr, ly);
              ctx.stroke();
            });
            break;
        }
      }
    }

    // Draw editing point preview
    if (editingId && editingPointIndex !== null && drawCurrent) {
      const drawing = drawings.find(d => d.id === editingId);
      if (drawing) {
        ctx.strokeStyle = drawing.color;
        ctx.lineWidth = drawing.lineWidth;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.7;
        
        // Preview the edited shape
        const previewPoints = drawing.points.map((p, i) => 
          i === editingPointIndex ? drawCurrent : toScreen(p)
        );
        
        if (drawing.type === 'trend-line' || drawing.type === 'arrow') {
          ctx.beginPath();
          ctx.moveTo(previewPoints[0].x, previewPoints[0].y);
          ctx.lineTo(previewPoints[1].x, previewPoints[1].y);
          ctx.stroke();
        } else if (drawing.type === 'rectangle' && previewPoints.length >= 2) {
          const rx = Math.min(previewPoints[0].x, previewPoints[1].x);
          const ry = Math.min(previewPoints[0].y, previewPoints[1].y);
          const rw = Math.abs(previewPoints[1].x - previewPoints[0].x);
          const rh = Math.abs(previewPoints[1].y - previewPoints[0].y);
          ctx.strokeRect(rx, ry, rw, rh);
        }
        
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }
    }
  }, [drawings, selectedId, editingId, hoverDrawingId, isDrawing, drawStart, drawCurrent, 
      freehandPath, activeTool, drawingColor, drawingLineWidth, toScreen, editingPointIndex]);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.getContext('2d')?.scale(dpr, dpr);
      render();
    };
    
    resize();
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    
    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
    };
  }, [containerRef, render]);

  // Re-render on chart changes
  useEffect(() => {
    if (!chart) return;
    
    const onRangeChange = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(render);
    };
    
    chart.timeScale().subscribeVisibleTimeRangeChange(onRangeChange);
    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRangeChange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [chart, render]);

  useEffect(() => { render(); }, [drawings, render]);

  // Hit test for drawings
  const hitTest = useCallback((point: { x: number; y: number }): DrawingItem | null => {
    const threshold = 12;
    
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      const pts = d.points.map(p => toScreen(p));
      if (pts.length === 0) continue;

      switch (d.type) {
        case 'freehand':
          for (let j = 0; j < pts.length - 1; j++) {
            if (distToSegment(point, pts[j], pts[j + 1]) < threshold) return d;
          }
          break;
        case 'trend-line':
        case 'ray':
        case 'extended-line':
        case 'arrow':
          if (pts.length >= 2 && distToSegment(point, pts[0], pts[1]) < threshold) return d;
          break;
        case 'horizontal-line':
          if (Math.abs(point.y - pts[0].y) < threshold) return d;
          break;
        case 'vertical-line':
          if (Math.abs(point.x - pts[0].x) < threshold) return d;
          break;
        case 'rectangle':
          if (pts.length >= 2) {
            const [p1, p2] = pts;
            if (point.x >= Math.min(p1.x, p2.x) - threshold && 
                point.x <= Math.max(p1.x, p2.x) + threshold &&
                point.y >= Math.min(p1.y, p2.y) - threshold && 
                point.y <= Math.max(p1.y, p2.y) + threshold) return d;
          }
          break;
        case 'text':
          if (point.x >= pts[0].x && point.x <= pts[0].x + 150 && 
              point.y >= pts[0].y - 20 && point.y <= pts[0].y + 5) return d;
          break;
        case 'fibonacci':
          if (pts.length >= 2) {
            const minY = Math.min(pts[0].y, pts[1].y);
            const maxY = Math.max(pts[0].y, pts[1].y);
            if (point.y >= minY - threshold && point.y <= maxY + threshold) return d;
          }
          break;
      }
    }
    return null;
  }, [drawings, toScreen]);

  // Hit test for handles (for editing)
  const hitTestHandle = useCallback((point: { x: number; y: number }, drawing: DrawingItem): number | null => {
    const threshold = 15;
    const pts = drawing.points.map(p => toScreen(p));
    
    // For rectangle, test all 4 corners
    if (drawing.type === 'rectangle' && pts.length >= 2) {
      const corners = [
        pts[0],
        { x: pts[1].x, y: pts[0].y },
        { x: pts[0].x, y: pts[1].y },
        pts[1],
      ];
      for (let i = 0; i < corners.length; i++) {
        if (Math.hypot(point.x - corners[i].x, point.y - corners[i].y) < threshold) {
          return i;
        }
      }
      return null;
    }
    
    for (let i = 0; i < pts.length; i++) {
      if (Math.hypot(point.x - pts[i].x, point.y - pts[i].y) < threshold) {
        return i;
      }
    }
    return null;
  }, [toScreen]);

  const distToSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };

  // Mouse handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    
    const pt = getPoint(e);
    
    // If we have an active tool, start drawing
    if (activeTool) {
      setIsDrawing(true);
      setDrawStart(pt);
      setDrawCurrent(pt);
      if (activeTool === 'freehand') setFreehandPath([pt]);
      updateSelection(null);
      setEditingId(null);
      return;
    }
    
    // Check if clicking on a handle in edit mode
    if (editingId) {
      const editing = drawings.find(d => d.id === editingId);
      if (editing) {
        const handleIdx = hitTestHandle({ x: pt.x, y: pt.y }, editing);
        if (handleIdx !== null) {
          setEditingPointIndex(handleIdx);
          setDrawCurrent(pt);
          return;
        }
      }
    }
    
    // Hit test for selection
    const hit = hitTest({ x: pt.x, y: pt.y });
    if (hit) {
      updateSelection(hit.id);
      if (editingId !== hit.id) setEditingId(null);
      setDragging(true);
      setDragOffset({ x: pt.x, y: pt.y });
    } else {
      updateSelection(null);
      setEditingId(null);
    }
  }, [activeTool, getPoint, hitTest, hitTestHandle, editingId, drawings]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pt = getPoint(e);
    
    // Drawing
    if (isDrawing && activeTool) {
      setDrawCurrent(pt);
      if (activeTool === 'freehand') {
        setFreehandPath(prev => [...prev, pt]);
      }
      render();
      return;
    }
    
    // Editing a point
    if (editingPointIndex !== null && editingId) {
      setDrawCurrent(pt);
      render();
      return;
    }
    
    // Dragging entire drawing
    if (dragging && selectedId && dragOffset) {
      const dx = pt.x - dragOffset.x;
      const dy = pt.y - dragOffset.y;
      
      onDrawingsChange(drawings.map(d => {
        if (d.id !== selectedId) return d;
        return {
          ...d,
          points: d.points.map(p => {
            const screen = toScreen(p);
            const newX = screen.x + dx;
            const newY = screen.y + dy;
            
            let newPrice = p.price;
            let newTime = p.time;
            try {
              if (series) {
                const pr = series.coordinateToPrice(newY);
                if (pr !== null) newPrice = pr as number;
              }
              if (chart) {
                const tm = chart.timeScale().coordinateToTime(newX);
                if (tm !== null) newTime = tm as number;
              }
            } catch {}
            
            return { x: newX, y: newY, price: newPrice, time: newTime };
          }),
        };
      }));
      
      setDragOffset({ x: pt.x, y: pt.y });
      render();
      return;
    }
    
    // Hover detection
    const hit = hitTest({ x: pt.x, y: pt.y });
    setHoverDrawingId(hit?.id || null);
    
    // Update cursor
    const canvas = canvasRef.current;
    if (canvas) {
      if (editingId) {
        const editing = drawings.find(d => d.id === editingId);
        if (editing && hitTestHandle({ x: pt.x, y: pt.y }, editing) !== null) {
          canvas.style.cursor = 'crosshair';
        } else if (hit) {
          canvas.style.cursor = 'move';
        } else {
          canvas.style.cursor = 'default';
        }
      } else if (hit) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = activeTool ? 'crosshair' : 'default';
      }
    }
    
    render();
  }, [isDrawing, activeTool, editingPointIndex, editingId, dragging, selectedId, dragOffset, 
      getPoint, hitTest, hitTestHandle, drawings, onDrawingsChange, render, toScreen, series, chart]);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pt = getPoint(e);
    
    // Finish editing point
    if (editingPointIndex !== null && editingId && drawCurrent) {
      const drawing = drawings.find(d => d.id === editingId);
      if (drawing) {
        let newPoints = [...drawing.points];
        
        // Handle rectangle corner editing specially
        if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
          const [p1, p2] = drawing.points;
          switch (editingPointIndex) {
            case 0: // top-left -> update p1
              newPoints[0] = { ...pt };
              break;
            case 1: // top-right -> update p1.y and p2.x
              newPoints[0] = { ...newPoints[0], y: pt.y, price: pt.price };
              newPoints[1] = { ...newPoints[1], x: pt.x, time: pt.time };
              break;
            case 2: // bottom-left -> update p1.x and p2.y
              newPoints[0] = { ...newPoints[0], x: pt.x, time: pt.time };
              newPoints[1] = { ...newPoints[1], y: pt.y, price: pt.price };
              break;
            case 3: // bottom-right -> update p2
              newPoints[1] = { ...pt };
              break;
          }
        } else {
          newPoints[editingPointIndex] = { ...pt };
        }
        
        onDrawingsChange(drawings.map(d => d.id === editingId ? { ...d, points: newPoints } : d));
      }
      
      setEditingPointIndex(null);
      setDrawCurrent(null);
      render();
      return;
    }
    
    // Finish drawing
    if (isDrawing && activeTool && drawStart) {
      let points: Point[] = [];
      
      if (activeTool === 'freehand' && freehandPath.length > 3) {
        // Sample to reduce points
        points = freehandPath.filter((_, i) => i % 2 === 0 || i === freehandPath.length - 1);
      } else if (activeTool === 'horizontal-line' || activeTool === 'vertical-line') {
        points = [drawStart];
      } else if (activeTool === 'text') {
        const text = prompt('Enter text:');
        if (text) {
          points = [drawStart];
          const newDrawing: DrawingItem = {
            id: `d_${Date.now()}`,
            type: activeTool,
            points,
            color: drawingColor,
            lineWidth: drawingLineWidth,
            lineStyle: 'solid',
            text,
            fontSize: drawingTextSize,
          };
          onDrawingsChange([...drawings, newDrawing]);
        }
        setIsDrawing(false);
        setDrawStart(null);
        setDrawCurrent(null);
        setFreehandPath([]);
        onToolComplete();
        return;
      } else if (pt && Math.hypot(pt.x - drawStart.x, pt.y - drawStart.y) > 5) {
        points = [drawStart, pt];
      }
      
      if (points.length > 0) {
        const newDrawing: DrawingItem = {
          id: `d_${Date.now()}`,
          type: activeTool,
          points,
          color: drawingColor,
          lineWidth: drawingLineWidth,
          lineStyle: 'solid',
          fillColor: drawingColor,
          fillOpacity: 0.2,
        };
        onDrawingsChange([...drawings, newDrawing]);
      }
      
      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      setFreehandPath([]);
      onToolComplete();
      return;
    }
    
    setDragging(false);
    setDragOffset(null);
  }, [isDrawing, activeTool, drawStart, freehandPath, editingPointIndex, editingId, drawCurrent,
      getPoint, drawings, onDrawingsChange, onToolComplete, drawingColor, drawingLineWidth, render]);

  // Double click to enter edit mode or edit properties
  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const pt = getPoint(e);
    const hit = hitTest({ x: pt.x, y: pt.y });
    
    if (hit) {
      if (hit.type === 'text') {
        // Edit text content
        const newText = prompt('Edit text:', hit.text);
        if (newText !== null) {
          onDrawingsChange(drawings.map(d => d.id === hit.id ? { ...d, text: newText } : d));
        }
      } else {
        // Enter edit mode - show handles for resizing/repositioning
        setEditingId(hit.id);
        updateSelection(hit.id);
      }
    } else {
      // Double-click on empty area - exit edit mode
      setEditingId(null);
    }
  }, [getPoint, hitTest, drawings, onDrawingsChange]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onDrawingsChange(drawings.filter(d => d.id !== selectedId));
        updateSelection(null);
        setEditingId(null);
      }
      if (e.key === 'Escape') {
        setIsDrawing(false);
        setDrawStart(null);
        setDrawCurrent(null);
        setFreehandPath([]);
        updateSelection(null);
        setEditingId(null);
        setEditingPointIndex(null);
        onToolComplete();
      }
      if (e.key === 'Enter' && editingId) {
        setEditingId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, editingId, drawings, onDrawingsChange, onToolComplete]);

  // Determine when to capture pointer events
  // IMPORTANT: Only capture when absolutely needed to allow chart crosshair to work
  const shouldCaptureEvents = () => {
    // Always capture when actively drawing
    if (activeTool || isDrawing) return true;
    // Capture when interacting with drawings
    if (dragging || editingId || editingPointIndex !== null) return true;
    // Capture when mouse is over a drawing (for selection)
    if (hoverDrawingId) return true;
    // Capture when we have a selected drawing and might want to interact
    if (selectedId) return true;
    // Otherwise, let events pass through to chart
    return false;
  };

  // Cursor based on state
  const getCursor = () => {
    if (activeTool) return 'crosshair';
    if (isDrawing) return 'crosshair';
    if (editingId || editingPointIndex !== null) return 'crosshair';
    if (dragging) return 'grabbing';
    if (hoverDrawingId) return 'pointer';
    if (selectedId) return 'default';
    return 'default';
  };

  // Z-index: highest when drawing, medium when selecting
  const getZIndex = () => {
    if (activeTool || isDrawing) return 100;
    if (selectedId || editingId || dragging) return 80;
    return 10; // Low z-index when not interacting
  };

  const captureEvents = shouldCaptureEvents();

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        cursor: getCursor(),
        // CRITICAL: Use pointer-events: none when not needed so chart crosshair works
        pointerEvents: captureEvents ? 'auto' : 'none',
        zIndex: getZIndex(),
      }}
      onMouseDown={(e) => {
        // Only process if we have a reason to
        if (activeTool || hoverDrawingId || selectedId) {
          onMouseDown(e);
        }
      }}
      onMouseMove={(e) => {
        // Check for hover state
        const pt = getPoint(e);
        const hit = hitTest({ x: pt.x, y: pt.y });
        setHoverDrawingId(hit?.id || null);
        
        // Process other mouse move logic
        onMouseMove(e);
      }}
      onMouseUp={onMouseUp}
      onMouseLeave={(e) => {
        if (isDrawing) onMouseUp(e);
        setHoverDrawingId(null);
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;
