"use client";
import { useEffect, useState } from "react";
export default function useLanguage() {
  const [language, setLanguage] = useState("sq");
  useEffect(() => {
    const sync = () =>
      setLanguage(
        ["sq", "sr", "en"].includes(document.documentElement.lang)
          ? document.documentElement.lang
          : "sq",
      );
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    return () => observer.disconnect();
  }, []);
  return language;
}
