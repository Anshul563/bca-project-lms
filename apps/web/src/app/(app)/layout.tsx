import { SiteHeader } from "@/components/layout/site-header";
import { FooterYear } from "@/components/layout/footer-year";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t py-6">
        <div className="mx-auto w-full max-w-7xl px-4 text-sm text-muted-foreground">
          © <FooterYear /> LMS
        </div>
      </footer>
    </div>
  );
}
