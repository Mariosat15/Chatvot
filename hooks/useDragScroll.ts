'use client';

import { useRef, useEffect } from 'react';

/**
 * Hook for drag-to-scroll functionality
 * Replaces ugly scrollbars with smooth dragging
 * Supports both horizontal and vertical scrolling
 */
export function useDragScroll<T extends HTMLElement>(options?: { 
  direction?: 'horizontal' | 'vertical' | 'both';
  speed?: number;
}) {
  const ref = useRef<T>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const scrollTopRef = useRef(0);
  
  const direction = options?.direction ?? 'both';
  const speed = options?.speed ?? 1.5;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Don't start drag if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, [role="button"], svg')) {
        return;
      }
      
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      scrollLeftRef.current = element.scrollLeft;
      scrollTopRef.current = element.scrollTop;
      element.style.cursor = 'grabbing';
      element.style.userSelect = 'none';
      
      // Prevent text selection while dragging
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (element) {
        element.style.cursor = 'grab';
        element.style.userSelect = '';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      
      if (direction === 'horizontal' || direction === 'both') {
        const deltaX = e.clientX - startXRef.current;
        element.scrollLeft = scrollLeftRef.current - deltaX * speed;
      }
      
      if (direction === 'vertical' || direction === 'both') {
        const deltaY = e.clientY - startYRef.current;
        element.scrollTop = scrollTopRef.current - deltaY * speed;
      }
    };

    const handleMouseLeave = () => {
      // Don't stop if mouse leaves - let mouseup on document handle it
    };

    // Set initial cursor and hide scrollbars
    element.style.cursor = 'grab';
    element.style.scrollbarWidth = 'none'; // Firefox
    (element.style as CSSStyleDeclaration & { msOverflowStyle: string }).msOverflowStyle = 'none'; // IE/Edge
    
    // Add class for webkit scrollbar hiding (Chrome, Safari)
    element.classList.add('hide-scrollbar');

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
      element.classList.remove('hide-scrollbar');
    };
  }, [direction, speed]);

  return ref;
}

