import { Metadata } from "next";
import { getTheme } from "@/lib/theme";
import { requireAdmin } from "@/lib/auth-guards";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import "./admin.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const theme = getTheme();
  const user = await requireAdmin("/admin");

  return (
    <div className="admin-layout">
      <a href="#main-content" className="visually-hidden" style={{ position: "absolute", zIndex: 999 }}>
        Skip to main content
      </a>
      <AdminSidebar brandName={theme.brand.name} userName={user.name} />
      <main id="main-content" className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
