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

export type { ContextMenuState };
