import Masthead from "@/components/site/Masthead";
import Footer from "@/components/site/Footer";

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", overflowX: "clip" }}>
      <Masthead />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
