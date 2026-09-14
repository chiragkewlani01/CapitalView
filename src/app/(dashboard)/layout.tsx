import { requireAuth } from "@/lib/auth/guards";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto bg-muted/20">
          <div className="container max-w-7xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
