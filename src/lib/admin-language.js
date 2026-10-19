import { cookies } from "next/headers";
import { translateAdmin } from "./admin-translations";
export const adminLanguage = () =>
  cookies().get("kr-admin-language")?.value === "sq" ? "sq" : "en";
export const adminText = (text) => translateAdmin(text, adminLanguage());
