import type { ReactNode } from "react";

interface Props {
  title?: string;
  icon?: ReactNode;
  // Shown at the right of the header, such as a status badge or buttons
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  label?: string;
}

export function Card({ title, icon, actions, children, className = "", bodyClassName = "p-4 sm:p-5", label }: Props) {
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <section aria-label={label ?? title} className={`rounded-2xl border border-line bg-surface shadow-sm shadow-black/[0.03] dark:shadow-black/20 ${className}`}>
      {hasHeader && (
        <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 sm:px-5">
          {icon && <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent-text">{icon}</span>}
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
