import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  confirm: (options: ConfirmOptions) => void;
  resolve: (proceed: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  confirm: (options) => {
    set({ open: true, options });
  },
  resolve: (proceed) => {
    const { options } = get();
    if (proceed && options?.onConfirm) {
      options.onConfirm();
    }
    set({ open: false, options: null });
  },
}));

/** Convenience helper: shows a confirmation dialog and runs onConfirm if user confirms. */
export function confirm(options: ConfirmOptions) {
  useConfirmStore.getState().confirm(options);
}
