import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';

interface FloatingPanelProps {
  title: string;
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultX?: number;
  defaultY?: number;
  minWidth?: number;
  minHeight?: number;
  onClose: () => void;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export default function FloatingPanel({
  title,
  children,
  defaultWidth = 900,
  defaultHeight = 600,
  defaultX,
  defaultY,
  minWidth = 400,
  minHeight = 300,
  onClose,
}: FloatingPanelProps) {
  const [x, setX] = useState(() => {
    if (defaultX !== undefined) return defaultX;
    return Math.max(20, Math.floor((window.innerWidth - defaultWidth) / 2));
  });
  const [y, setY] = useState(() => {
    if (defaultY !== undefined) return defaultY;
    return Math.max(20, Math.floor((window.innerHeight - defaultHeight) / 2));
  });
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevRect, setPrevRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const resizeState = useRef<{ dir: ResizeDir; startX: number; startY: number; initW: number; initH: number; initX: number; initY: number } | null>(null);

  // Clamp position on mount / resize
  useEffect(() => {
    const handleResize = () => {
      setX((prev) => Math.min(prev, window.innerWidth - 100));
      setY((prev) => Math.min(prev, window.innerHeight - 60));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, initX: x, initY: y };
  }, [isMaximized, x, y]);

  const startResize = useCallback((e: React.MouseEvent, dir: ResizeDir) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeState.current = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      initW: width,
      initH: height,
      initX: x,
      initY: y,
    };
  }, [isMaximized, width, height, x, y]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Dragging
      if (dragState.current) {
        const { startX, startY, initX, initY } = dragState.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setX(Math.max(0, initX + dx));
        setY(Math.max(0, initY + dy));
      }
      // Resizing
      if (resizeState.current) {
        const { dir, startX, startY, initW, initH, initX, initY } = resizeState.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newW = initW;
        let newH = initH;
        let newX = initX;
        let newY = initY;

        if (dir.includes('e')) {
          newW = Math.max(minWidth, initW + dx);
        }
        if (dir.includes('s')) {
          newH = Math.max(minHeight, initH + dy);
        }
        if (dir.includes('w')) {
          const proposedW = Math.max(minWidth, initW - dx);
          newX = initX + (initW - proposedW);
          newW = proposedW;
        }
        if (dir.includes('n')) {
          const proposedH = Math.max(minHeight, initH - dy);
          newY = initY + (initH - proposedH);
          newH = proposedH;
        }

        setWidth(newW);
        setHeight(newH);
        setX(newX);
        setY(newY);
      }
    };

    const handleMouseUp = () => {
      dragState.current = null;
      resizeState.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, minHeight]);

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      if (prevRect) {
        setX(prevRect.x);
        setY(prevRect.y);
        setWidth(prevRect.w);
        setHeight(prevRect.h);
      }
      setIsMaximized(false);
    } else {
      setPrevRect({ x, y, w: width, h: height });
      setX(0);
      setY(0);
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
      setIsMaximized(true);
    }
  }, [isMaximized, prevRect, x, y, width, height]);

  const cursorMap: Record<ResizeDir, string> = {
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    nw: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    se: 'nwse-resize',
  };

  return (
    <div
      ref={panelRef}
      className="fixed shadow-2xl flex flex-col overflow-hidden"
      style={{
        left: x,
        top: y,
        width,
        height,
        zIndex: 'var(--z-modal)',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: isMaximized ? 0 : 8,
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 select-none cursor-move"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} style={{ color: 'var(--text-faint)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMaximize}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            aria-label="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        {children}
      </div>

      {/* Resize handles */}
      {!isMaximized && (
        <>
          {/* Edges */}
          {(['n', 's', 'e', 'w'] as ResizeDir[]).map((dir) => (
            <div
              key={dir}
              onMouseDown={(e) => startResize(e, dir)}
              style={{
                position: 'absolute',
                cursor: cursorMap[dir],
                ...(dir === 'n' || dir === 's'
                  ? { left: 6, right: 6, height: 6, [dir]: -3 }
                  : { top: 6, bottom: 6, width: 6, [dir]: -3 }),
              }}
            />
          ))}
          {/* Corners */}
          {(['nw', 'ne', 'sw', 'se'] as ResizeDir[]).map((dir) => (
            <div
              key={dir}
              onMouseDown={(e) => startResize(e, dir)}
              style={{
                position: 'absolute',
                width: 10,
                height: 10,
                cursor: cursorMap[dir],
                top: dir.includes('n') ? -3 : undefined,
                bottom: dir.includes('s') ? -3 : undefined,
                left: dir.includes('w') ? -3 : undefined,
                right: dir.includes('e') ? -3 : undefined,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
