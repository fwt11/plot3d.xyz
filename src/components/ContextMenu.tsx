import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MenuItem, ContextMenuState } from '@/utils/contextMenu';

const defaultState: ContextMenuState = { visible: false, x: 0, y: 0, items: [] };

// Keep track of the element that had focus before the menu opened
let lastActiveElement: Element | null = null;

/** Global context menu component — rendered as a portal */
export function ContextMenuOverlay() {
  const [state, setState] = useState<ContextMenuState>(defaultState);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Listen for custom context menu events
  useEffect(() => {
    const handler = (e: CustomEvent<ContextMenuState>) => {
      e.preventDefault();
      lastActiveElement = document.activeElement;
      setState(e.detail);
      setActiveIndex(0);
    };
    document.addEventListener('contextmenu-show', handler as EventListener);
    return () => document.removeEventListener('contextmenu-show', handler as EventListener);
  }, []);

  // Adjust position to stay within viewport
  useLayoutEffect(() => {
    if (!state.visible) return;
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const padding = 8;
    let x = state.x;
    let y = state.y;

    if (x + rect.width > window.innerWidth - padding) {
      x = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (y + rect.height > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    setPosition({ x, y });
  }, [state]);

  // Focus first non-separator item when menu opens
  useEffect(() => {
    if (!state.visible) return;
    const firstIndex = state.items.findIndex((item) => !('separator' in item));
    if (firstIndex >= 0) {
      setActiveIndex(firstIndex);
      // Focus next frame after position/layout is settled
      requestAnimationFrame(() => {
        itemRefs.current[firstIndex]?.focus();
      });
    }
  }, [state.visible, state.items]);

  const close = useCallback(() => {
    setState(defaultState);
    // Return focus to the trigger element if possible
    if (lastActiveElement instanceof HTMLElement) {
      lastActiveElement.focus();
    }
  }, []);

  const triggerItem = useCallback((item: MenuItem) => {
    close();
    item.onClick();
  }, [close]);

  const moveActive = useCallback((direction: number) => {
    setActiveIndex((prev) => {
      const itemCount = state.items.length;
      let next = prev;
      for (let i = 0; i < itemCount; i++) {
        next = (next + direction + itemCount) % itemCount;
        const item = state.items[next];
        if (item && !('separator' in item) && !item.disabled) {
          itemRefs.current[next]?.focus();
          return next;
        }
      }
      return prev;
    });
  }, [state.items]);

  const jumpTo = useCallback((target: 'first' | 'last') => {
    const indices = target === 'first'
      ? state.items.map((_, i) => i)
      : state.items.map((_, i) => i).reverse();
    for (const i of indices) {
      const item = state.items[i];
      if (item && !('separator' in item) && !item.disabled) {
        setActiveIndex(i);
        itemRefs.current[i]?.focus();
        break;
      }
    }
  }, [state.items]);

  // Close on click outside or Escape / handle keyboard navigation
  useEffect(() => {
    if (!state.visible) return;
    const onClick = () => close();
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          close();
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveActive(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveActive(-1);
          break;
        case 'Home':
          e.preventDefault();
          jumpTo('first');
          break;
        case 'End':
          e.preventDefault();
          jumpTo('last');
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const item = state.items[activeIndex];
          if (item && !('separator' in item) && !item.disabled) {
            triggerItem(item);
          }
          break;
        }
        default:
          break;
      }
    };
    // Use setTimeout to avoid the same right-click closing immediately
    const timer = setTimeout(() => {
      document.addEventListener('click', onClick, { once: true });
      document.addEventListener('contextmenu', onClick, { once: true });
    }, 0);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
      document.removeEventListener('contextmenu', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [state.visible, state.items, activeIndex, close, moveActive, jumpTo, triggerItem]);

  if (!state.visible) return null;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 9999,
    minWidth: 160,
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className="rounded-lg shadow-xl border py-1 text-sm"
      style={{
        ...menuStyle,
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {state.items.map((item, i) => {
        if ('separator' in item && item.separator) {
          return <div key={`sep-${i}`} className="my-1 mx-2" style={{ borderTop: '1px solid var(--border)' }} />;
        }
        const mi = item as MenuItem;
        const isActive = i === activeIndex;
        return (
          <button
            key={`item-${i}`}
            ref={(el) => { itemRefs.current[i] = el; }}
            role="menuitem"
            tabIndex={isActive ? 0 : -1}
            disabled={mi.disabled}
            onClick={() => triggerItem(mi)}
            onMouseEnter={() => setActiveIndex(i)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors disabled:opacity-40 outline-none"
            style={{
              color: mi.danger ? '#fb7185' : 'var(--text-primary)',
              background: isActive ? 'var(--bg-surface-hover)' : undefined,
            }}
          >
            {mi.icon && <span className="w-4 shrink-0 flex items-center justify-center">{mi.icon}</span>}
            <span>{mi.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
