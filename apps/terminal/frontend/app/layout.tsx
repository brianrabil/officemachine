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
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <SquareTerminalIcon className="size-4" />
            </div>
            <span className="text-sm font-medium text-foreground">OfficeMachine Terminal</span>
          </div>
          <div className="card">
            <span>Native bridge</span>
            <strong>{bridge}</strong>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
