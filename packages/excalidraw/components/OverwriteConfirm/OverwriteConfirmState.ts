import { atom, editorJotaiStore } from "../../editor-jotai";

import type React from "react";

export type OverwriteConfirmState =
  | {
      active: true;
      title: string;
      description: React.ReactNode;
      actionLabel: string;
      color: "danger" | "warning";

      onClose: () => void;
      onConfirm: () => void;
      onReject: () => void;
    }
  | { active: false };

export const overwriteConfirmStateAtom = atom<OverwriteConfirmState>({
  active: false,
});

export async function openConfirmModal<T = boolean>({
  title,
  description,
  actionLabel,
  color,
  onConfirm,
}: {
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  color: "danger" | "warning";
  onConfirm?: () => T;
}): Promise<T | false> {
  return new Promise<T | false>((resolve) => {
    editorJotaiStore.set(overwriteConfirmStateAtom, {
      active: true,
      onConfirm: () => resolve(onConfirm ? onConfirm() : (true as T)),
      onClose: () => resolve(false),
      onReject: () => resolve(false),
      title,
      description,
      actionLabel,
      color,
    });
  });
}
