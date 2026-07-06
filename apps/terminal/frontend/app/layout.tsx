import { SquareTerminalIcon } from "lucide-react";
import "./globals.css";
import { Geist_Mono } from "next/font/google";
import { useEffect, useState } from "react";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [bridge, setBridge] = useState("checking...");

  useEffect(() => {
    setBridge((window as any).zero ? "available" : "not enabled");
  }, []);

  return (
    <html lang="en" className={geistMono.variable}>
      <body className="h-screen antialiased">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-foreground">OfficeMachine Terminal</span>
          </div>
          <div className="card">
            <span>Native bridge</span>
            <strong>{bridge}</strong>
          </div>
        </header>
        <div className="flex size-full flex-col">
          <main className="flex flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
      <footer className="flex items-center justify-between gap-4 border-t border-border px-4 py-2 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>WTERM · Ghostty</span>
        </div>
      </footer>
    </html>
  );
}
