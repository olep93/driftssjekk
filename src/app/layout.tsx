import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Driftssjekk", description: "Vurderinger og oppfølging for varehus" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nb"><body>{children}</body></html>;
}
