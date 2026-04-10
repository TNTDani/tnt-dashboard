import Sidebar from "@/components/Sidebar";
import GlobalSearch from "@/components/GlobalSearch";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <header className="fixed top-0 left-60 right-0 h-14 bg-[#081525]/80 backdrop-blur border-b border-[#1e3a5f] z-30 flex items-center px-6">
        <GlobalSearch />
      </header>
      <main className="ml-60 pt-14 min-h-screen p-8">
        {children}
      </main>
    </>
  );
}
