'use client';

import { useRef, useEffect } from 'react';

/**
 * Hook for drag-to-scroll functionality
 * Replaces ugly scrollbars with smooth dragging
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseDown = (e: globalThis.MouseEvent) => {
      isDraggingRef.current = true;
      startXRef.current = e.pageX - element.offsetLeft;
      scrollLeftRef.current = element.scrollLeft;
      element.style.cursor = 'grabbing';
      element.style.userSelect = 'none';
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      if (element) {
        element.style.cursor = 'grab';
        element.style.userSelect = '';
      }
    };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      
      const x = e.pageX - element.offsetLeft;
      const walk = (x - startXRef.current) * 2; // Scroll speed multiplier
      element.scrollLeft = scrollLeftRef.current - walk;
    };

    const handleMouseLeave = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        element.style.cursor = 'grab';
        element.style.userSelect = '';
      }
    };

    // Set initial cursor
    element.style.cursor = 'grab';
    element.style.scrollbarWidth = 'none'; // Firefox
    (element.style as CSSStyleDeclaration & { msOverflowStyle: string }).msOverflowStyle = 'none'; // IE/Edge

    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return ref;
}

