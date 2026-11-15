import type { ButtonHTMLAttributes, ReactNode } from "react";
import { focusRing } from "./classes";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  // The accessible name and the tooltip, since the button shows only its icon
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-fg disabled:pointer-events-none disabled:opacity-50 pointer-coarse:size-11 ${focusRing} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
