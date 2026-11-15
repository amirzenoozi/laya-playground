// The look every control shares: one focus ring, radius and field style, built on the theme's colour names.

export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const fieldClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg shadow-xs transition-colors sm:text-sm " +
  "placeholder:text-subtle hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const labelClass = "text-xs font-medium text-muted";
