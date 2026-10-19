// Shared class lists for the few primitives, so pages don't repeat long strings.
export const btn = {
  primary:
    "inline-flex min-h-14 items-center justify-center gap-2.5 rounded-md bg-blue px-6 text-[1.0625rem] font-bold text-on-blue shadow-soft transition-[background-color,transform] duration-120 ease-out-quint hover:bg-blue-press active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none in-data-[contrast=sun]:border-2 in-data-[contrast=sun]:border-ink",
  soft: "inline-flex min-h-14 items-center justify-center gap-2 rounded-md border-[1.5px] border-rule bg-card px-5 font-bold text-blue transition-colors duration-120 hover:border-blue disabled:cursor-not-allowed disabled:opacity-50",
  link: "inline-flex min-h-11 items-center gap-2 px-1 font-bold text-blue underline decoration-[1.5px] underline-offset-4 hover:decoration-[2.5px]",
  icon: "inline-flex size-12 items-center justify-center rounded-full text-ink transition-colors duration-120 hover:bg-wash",
};

export const field = {
  label: "block font-bold",
  hint: "mt-1 block text-sm text-pencil",
  input:
    "mt-2 block min-h-13 w-full rounded-sm border-[1.5px] border-rule bg-card px-3.5 py-3 text-base text-ink transition-colors duration-120 placeholder:text-pencil/70 hover:border-pencil focus-visible:border-blue aria-invalid:border-error",
  error: "mt-2 flex items-start gap-2 text-sm font-semibold text-error",
};

export const wrap =
  "mx-auto w-full max-w-[76rem] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]";
