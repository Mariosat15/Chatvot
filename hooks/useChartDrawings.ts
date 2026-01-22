'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { DrawingManager, DrawingManagerOptions } from '@/lib/chart/managers';
import { 
  DrawingToolType, 
  AnyPrimitive, 
  SerializedDrawing,
  DrawingEventType,
} from '@/lib/chart/primitives';

// ============================================
// TYPES
// ============================================

export interface UseChartDrawingsOptions extends DrawingManagerOptions {
  storageKey?: string;
  autoSave?: boolean;
}

export interface UseChartDrawingsReturn {
  // Manager reference
  manager: DrawingManager | null;
  
  // Tool state
  activeTool: DrawingToolType;
  setActiveTool: (tool: DrawingToolType) => void;
  
  // Selection state
  selectedDrawing: AnyPrimitive | null;
  hasSelection: boolean;
  
  // Drawings state
  drawings: AnyPrimitive[];
  drawingsCount: number;
  
  // Actions
  deleteSelected: () => void;
  clearAll: () => void;
  
  // Settings
  defaultColor: string;
  defaultLineWidth: number;
  setDefaultColor: (color: string) => void;
  setDefaultLineWidth: (width: number) => void;
  
  // Lifecycle
  attach: (chart: IChartApi, series: ISeriesApi<'Candlestick'>, container: HTMLElement) => void;
  detach: () => void;
  
  // Serialization
  save: () => void;
  load: () => void;
}

// ============================================
// HOOK
// ============================================

export function useChartDrawings(options: UseChartDrawingsOptions = {}): UseChartDrawingsReturn {
  const {
    storageKey = 'chart-drawings',
    autoSave = true,
    ...managerOptions
  } = options;

  // Manager reference
  const managerRef = useRef<DrawingManager | null>(null);
  
  // State
  const [activeTool, setActiveToolState] = useState<DrawingToolType>(null);
  const [selectedDrawing, setSelectedDrawing] = useState<AnyPrimitive | null>(null);
  const [drawings, setDrawings] = useState<AnyPrimitive[]>([]);
  const [defaultColor, setDefaultColorState] = useState(managerOptions.defaultColor ?? '#2962ff');
  const [defaultLineWidth, setDefaultLineWidthState] = useState(managerOptions.defaultLineWidth ?? 2);

  // Initialize manager
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new DrawingManager(managerOptions);
    }
    
    return () => {
      managerRef.current?.detach();
      managerRef.current = null;
    };
  }, []);

  // Set up event listeners
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    const updateDrawings = () => {
      setDrawings(manager.getAllDrawings());
    };

    const handleSelected = () => {
      setSelectedDrawing(manager.getSelectedDrawing());
      updateDrawings();
    };

    const handleDeselected = () => {
      setSelectedDrawing(null);
      updateDrawings();
    };

    const handleCreated = () => {
      updateDrawings();
      if (autoSave) save();
    };

    const handleDeleted = () => {
      setSelectedDrawing(null);
      updateDrawings();
      if (autoSave) save();
    };

    const handleMoved = () => {
      updateDrawings();
    };

    const handleResized = () => {
      if (autoSave) save();
    };

    manager.on('selected', handleSelected);
    manager.on('deselected', handleDeselected);
    manager.on('created', handleCreated);
    manager.on('deleted', handleDeleted);
    manager.on('moved', handleMoved);
    manager.on('resized', handleResized);

    return () => {
      manager.off('selected', handleSelected);
      manager.off('deselected', handleDeselected);
      manager.off('created', handleCreated);
      manager.off('deleted', handleDeleted);
      manager.off('moved', handleMoved);
      manager.off('resized', handleResized);
    };
  }, [autoSave]);

  // Set active tool
  const setActiveTool = useCallback((tool: DrawingToolType) => {
    setActiveToolState(tool);
    managerRef.current?.setActiveTool(tool);
  }, []);

  // Set default color
  const setDefaultColor = useCallback((color: string) => {
    setDefaultColorState(color);
    managerRef.current?.setDefaultColor(color);
  }, []);

  // Set default line width
  const setDefaultLineWidth = useCallback((width: number) => {
    setDefaultLineWidthState(width);
    managerRef.current?.setDefaultLineWidth(width);
  }, []);

  // Delete selected
  const deleteSelected = useCallback(() => {
    managerRef.current?.deleteSelected();
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    managerRef.current?.clearAll();
    setSelectedDrawing(null);
    setDrawings([]);
    if (autoSave) save();
  }, [autoSave]);

  // Attach to chart
  const attach = useCallback((
    chart: IChartApi, 
    series: ISeriesApi<'Candlestick'>, 
    container: HTMLElement
  ) => {
    managerRef.current?.attach(chart, series, container);
    load(); // Load saved drawings
  }, []);

  // Detach from chart
  const detach = useCallback(() => {
    if (autoSave) save();
    managerRef.current?.detach();
  }, [autoSave]);

  // Save drawings to storage
  const save = useCallback(() => {
    if (!managerRef.current) return;
    
    try {
      const data = managerRef.current.serialize();
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save drawings:', error);
    }
  }, [storageKey]);

  // Load drawings from storage
  const load = useCallback(() => {
    if (!managerRef.current) return;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data: SerializedDrawing[] = JSON.parse(stored);
        managerRef.current.deserialize(data);
        setDrawings(managerRef.current.getAllDrawings());
      }
    } catch (error) {
      console.error('Failed to load drawings:', error);
    }
  }, [storageKey]);

  return {
    manager: managerRef.current,
    activeTool,
    setActiveTool,
    selectedDrawing,
    hasSelection: selectedDrawing !== null,
    drawings,
    drawingsCount: drawings.length,
    deleteSelected,
    clearAll,
    defaultColor,
    defaultLineWidth,
    setDefaultColor,
    setDefaultLineWidth,
    attach,
    detach,
    save,
    load,
  };
}

export default useChartDrawings;
