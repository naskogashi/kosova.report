import AdminLanguage from "./AdminLanguage";
import { adminLanguage } from "../../lib/admin-language";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function AdminLayout({ children }) {
  return (
    <AdminLanguage initialLanguage={await adminLanguage()}>{children}</AdminLanguage>
  );
}
