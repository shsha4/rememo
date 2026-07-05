import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizableOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
}

export function useResizable({ initialWidth, minWidth, maxWidth, storageKey }: UseResizableOptions) {
  // Load saved width from localStorage if available
  const getSavedWidth = () => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const width = parseInt(saved, 10);
        if (!isNaN(width)) {
          return Math.max(minWidth, Math.min(maxWidth, width));
        }
      }
    }
    return initialWidth;
  };

  const [width, setWidth] = useState(getSavedWidth());
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    e.preventDefault();
  }, [width]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const delta = e.clientX - startXRef.current;
    const newWidth = startWidthRef.current + delta;
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    setWidth(clampedWidth);
  }, [isResizing, minWidth, maxWidth]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      // Save to localStorage
      if (storageKey) {
        localStorage.setItem(storageKey, width.toString());
      }
    }
  }, [isResizing, width, storageKey]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    width,
    isResizing,
    handleMouseDown,
  };
}
