"use client";
export default function BrandingImage({ asset, className }) {
  return (
    <img
      src={`/api/branding/${asset.key}?v=2`}
      alt={asset.name}
      className={className}
      onError={(event) => {
        const image = event.currentTarget;
        if (image.getAttribute("src") !== asset.fallback)
          image.setAttribute("src", asset.fallback);
      }}
    />
  );
}
