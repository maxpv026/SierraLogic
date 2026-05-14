import { Sidebar } from "@/components/shared/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="border-b border-slate-200 bg-white px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-500">AI Website Analyzer</h2>
          </div>
        </header>
        <div className="flex-1 px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
