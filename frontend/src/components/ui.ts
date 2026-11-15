// Shared Tailwind classes, so every field and button looks the same.

export const fieldClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base sm:text-sm placeholder:text-stone-400 " +
  "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 " +
  "dark:border-stone-700 dark:bg-stone-900 dark:placeholder:text-stone-500";

export const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white " +
  "hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11";

export const secondaryButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-stone-300 px-3 text-sm " +
  "hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800 pointer-coarse:min-h-11";

export const iconButtonClass =
  "inline-flex size-8 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-900 " +
  "dark:hover:bg-stone-800 dark:hover:text-stone-100 pointer-coarse:size-11";

export const cardClass = "rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900";
