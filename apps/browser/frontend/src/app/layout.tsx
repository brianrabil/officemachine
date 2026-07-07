import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { JotaiProvider } from "@/store/provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TitleBar } from "@/components/title-bar";
import { HotkeysProvider } from "@/components/hotkeys-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "agent-browser",
  description: "Observability dashboard for agent-browser",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans antialiased", geist.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <HotkeysProvider defaultOptions={{ hotkey: { conflictBehavior: "warn" } }}>
            <JotaiProvider>
              <TooltipProvider>
                <div className="flex h-screen flex-col">
                  <TitleBar />
                  <div className="min-h-0 flex-1">{children}</div>
                </div>
              </TooltipProvider>
            </JotaiProvider>
          </HotkeysProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
