import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: false;
}

export interface MenuSeparator {
  separator: true;
}

export type MenuItemOrSeparator = MenuItem | MenuSeparator;

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: MenuItemOrSeparator[];
}

const defaultState: ContextMenuState = { visible: false, x: 0, y: 0, items: [] };

/** Global context menu component — rendered as a portal */
export function ContextMenuOverlay() {
  const [state, setState] = useState<ContextMenuState>(defaultState);
  const menuRef = useRef<HTMLDivElement>(null);

  // Listen for custom context menu events
  useEffect(() => {
    const handler = (e: CustomEvent<ContextMenuState>) => {
      e.preventDefault();
      setState(e.detail);
    };
    document.addEventListener('contextmenu-show', handler as EventListener);
    return () => document.removeEventListener('contextmenu-show', handler as EventListener);
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    if (!state.visible) return;
    const close = () => setState(defaultState);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    // Use setTimeout to avoid the same right-click closing immediately
    const timer = setTimeout(() => {
      document.addEventListener('click', close, { once: true });
      document.addEventListener('contextmenu', close, { once: true });
    }, 0);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [state.visible]);

  if (!state.visible) return null;

  // Adjust position to stay within viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: state.x,
    top: state.y,
    zIndex: 9999,
    minWidth: 160,
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="rounded-lg shadow-xl border py-1 text-sm"
      style={{
        ...menuStyle,
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {state.items.map((item, i) => {
        if ('separator' in item && item.separator) {
          return <div key={`sep-${i}`} className="my-1 mx-2" style={{ borderTop: '1px solid var(--border)' }} />;
        }
        const mi = item as MenuItem;
        return (
          <button
            key={`item-${i}`}
            role="menuitem"
            disabled={mi.disabled}
            onClick={() => {
              setState(defaultState);
              mi.onClick();
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors disabled:opacity-40"
            style={{
              color: mi.danger ? '#fb7185' : 'var(--text-primary)',
            }}
            onMouseEnter={(e) => {
              if (!mi.disabled) e.currentTarget.style.background = 'var(--bg-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '';
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

/** Show a custom context menu at the given position */
export function showContextMenu(e: React.MouseEvent, items: MenuItemOrSeparator[]) {
  e.preventDefault();
  e.stopPropagation();
  const event = new CustomEvent('contextmenu-show', {
    detail: { visible: true, x: e.clientX, y: e.clientY, items },
  });
  document.dispatchEvent(event);
}

/** Hook to register a context menu handler on an element */
export function useContextMenu(itemsFactory: (e: React.MouseEvent) => MenuItemOrSeparator[]) {
  return useCallback((e: React.MouseEvent) => {
    const items = itemsFactory(e);
    if (items.length > 0) {
      showContextMenu(e, items);
    }
  }, [itemsFactory]);
}
