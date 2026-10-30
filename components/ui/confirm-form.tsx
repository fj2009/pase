"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";

export function ConfirmForm({
  action,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  children,
  trigger,
  variant = "danger",
  className,
  triggerClassName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  children: ReactNode;
  trigger: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const bypass = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        className={className}
        onSubmit={(event) => {
          if (bypass.current) return;
          if (!message) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
        <button type="submit" className={triggerClassName ?? buttonClass(variant, "sm")}>
          {trigger}
        </button>
      </form>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-md border border-line-strong bg-paper-raised p-6 shadow-lift"
          >
            <p className="label mb-2">Confirmar acción</p>
            <p id="confirm-title" className="text-base leading-relaxed">
              {message}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className={buttonClass("secondary")}
                onClick={() => setOpen(false)}
                autoFocus
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={buttonClass(variant)}
                onClick={() => {
                  bypass.current = true;
                  setOpen(false);
                  formRef.current?.requestSubmit();
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
