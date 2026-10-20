// A logo that fits the theme: the dark-theme version swaps in under [data-theme="dark"].
// Logos without a transparent background sit in a soft white card on every theme.
export default function ThemedLogo({ asset, className = "", alt = asset.name }) {
  if (asset.boxed)
    return (
      <span className="inline-flex shrink-0 rounded-lg bg-[#fff] px-2.5 py-1.5 shadow-[0_0_0_1px_var(--color-rule)]">
        <img src={asset.light} alt={alt} className="block h-9 w-auto max-w-none" />
      </span>
    );
  return (
    <>
      <img src={asset.light} alt={alt} className={`${className} ${asset.dark ? "dark:hidden" : ""}`} />
      {asset.dark && <img src={asset.dark} alt="" aria-hidden="true" className={`${className} hidden dark:block`} />}
    </>
  );
}
