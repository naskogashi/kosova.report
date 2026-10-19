import { cookies } from "next/headers";
import { translateAdmin } from "./admin-translations";
export const adminLanguage = async () =>
  (await cookies()).get("kr-admin-language")?.value === "sq" ? "sq" : "en";
// Server components read the cookie once: `const t = await adminTranslator();`
export async function adminTranslator() {
  const language = await adminLanguage();
  return (text) => translateAdmin(text, language);
}
