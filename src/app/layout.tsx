import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono, Silkscreen } from "next/font/google";
import { Providers } from "@/components/Providers";
import { ConnectHost } from "@/components/wallet/ConnectButton";
import { site } from "@/config/site";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-archivo", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono", display: "swap" });
const silkscreen = Silkscreen({ subsets: ["latin"], weight: ["700"], variable: "--font-silkscreen", display: "swap" });

const TITLE = `${site.name} — the stock, and its dividends`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: TITLE, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { title: TITLE, description: site.description, siteName: site.name, type: "website" },
  icons: { icon: "/logo-128.png" },
};

export const viewport: Viewport = { themeColor: "#0A0C0B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${geistMono.variable} ${silkscreen.variable}`}>
      <body>
        <Providers>
          {children}
          <ConnectHost />
        </Providers>
      </body>
    </html>
  );
}
