import { useCallback } from 'react';

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

export type { ContextMenuState };
