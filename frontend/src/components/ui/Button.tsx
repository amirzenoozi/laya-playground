import type { ButtonHTMLAttributes, ReactNode } from "react";
import { focusRing } from "./classes";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-sm shadow-accent/25 hover:bg-accent-hover",
  secondary: "border border-line bg-surface text-fg shadow-xs hover:border-line-strong hover:bg-sunken",
  ghost: "text-muted hover:bg-sunken hover:text-fg",
};

const SIZES = {
  sm: "min-h-8 gap-1.5 px-2.5 text-xs pointer-coarse:min-h-11",
  md: "min-h-9 gap-2 px-3.5 text-sm pointer-coarse:min-h-11",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  icon?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", icon, className = "", children, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${focusRing} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
