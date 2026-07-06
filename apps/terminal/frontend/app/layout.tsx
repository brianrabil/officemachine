import "./globals.css";
import { Geist_Mono } from "next/font/google";
import { NativeBridgeStatus } from "@/components/native-bridge-status";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistMono.variable}>
      <body className="h-screen antialiased">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-foreground">OfficeMachine Terminal</span>
          </div>
          <NativeBridgeStatus />
        </header>
        <div className="flex size-full flex-col">
          <main className="flex flex-1 overflow-hidden">{children}</main>
        </div>
        <footer className="flex items-center justify-between gap-4 border-t border-border px-4 py-2 font-mono text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>WTERM · Ghostty</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
