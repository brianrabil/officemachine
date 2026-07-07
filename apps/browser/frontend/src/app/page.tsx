"use client";

import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai/react";
import { activePortAtom, sessionsAtom, newSessionDialogAtom } from "@/store/sessions";
import { useSessionsSync } from "@/store/sessions";
import { useStreamSync, hasConsoleErrorsAtom } from "@/store/stream";
import { useActivitySync } from "@/store/activity";
import { activeExtensionsAtom } from "@/store/sessions";
import { useChatStatusSync, modelSelectorOpenAtom } from "@/store/chat";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useHotkey, useHotkeys } from "@tanstack/react-hotkeys";
import { Viewport } from "@/components/viewport";
import { ActivityFeed } from "@/components/activity-feed";
import { ChatPanel } from "@/components/chat-panel";
import { ConsolePanel } from "@/components/console-panel";
import { StoragePanel } from "@/components/storage-panel";
import { ExtensionsPanel } from "@/components/extensions-panel";
import { NetworkPanel } from "@/components/network-panel";
import { SessionTree } from "@/components/session-tree";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ExtensionInfo } from "@/types";

const SIDE_PANEL_TABS = ["chat", "activity", "console", "network", "storage", "extensions"] as const;

const SidePanel = ({
  activeExtensions,
  hasConsoleErrors,
}: {
  hasConsoleErrors: boolean;
  activeExtensions: ExtensionInfo[];
}) => {
  const [tab, setTab] = useState<(typeof SIDE_PANEL_TABS)[number]>("chat");
  const setModelSelectorOpen = useSetAtom(modelSelectorOpenAtom);

  useHotkeys([
    { hotkey: "Mod+1", callback: () => setTab("chat"), options: { meta: { name: "Switch to chat", description: "Show the chat panel" } } },
    { hotkey: "Mod+2", callback: () => setTab("activity"), options: { meta: { name: "Switch to activity", description: "Show the activity panel" } } },
    { hotkey: "Mod+3", callback: () => setTab("console"), options: { meta: { name: "Switch to console", description: "Show the console panel" } } },
    { hotkey: "Mod+4", callback: () => setTab("network"), options: { meta: { name: "Switch to network", description: "Show the network panel" } } },
    { hotkey: "Mod+5", callback: () => setTab("storage"), options: { meta: { name: "Switch to storage", description: "Show the storage panel" } } },
    { hotkey: "Mod+6", callback: () => setTab("extensions"), options: { meta: { name: "Switch to extensions", description: "Show the extensions panel" } } },
  ]);

  useHotkey(
    "Mod+K",
    () => {
      setTab("chat");
      setModelSelectorOpen(true);
    },
    { meta: { name: "Model selector", description: "Open the chat model picker" } },
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof SIDE_PANEL_TABS)[number])} className="flex h-full flex-col">
      <div className="shrink-0 px-2 pt-1">
        <TabsList variant="line" className="h-7 w-full">
          <TabsTrigger value="chat" className="text-[11px]">
            Chat
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-[11px]">
            Activity
          </TabsTrigger>
          <TabsTrigger value="console" className="text-[11px]">
            Console
            {hasConsoleErrors && (
              <span className="ml-1 inline-flex size-1.5 rounded-full bg-destructive" />
            )}
          </TabsTrigger>
          <TabsTrigger value="network" className="text-[11px]">
            Network
          </TabsTrigger>
          <TabsTrigger value="storage" className="text-[11px]">
            Storage
          </TabsTrigger>
          <TabsTrigger value="extensions" className="text-[11px]">
            Extensions
            {activeExtensions.length > 0 && (
              <span className="ml-1 text-[9px] tabular-nums text-muted-foreground">
                {activeExtensions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="activity" className="min-h-0 flex-1 overflow-hidden">
        <ActivityFeed />
      </TabsContent>
      <TabsContent value="console" className="min-h-0 flex-1 overflow-hidden">
        <ConsolePanel />
      </TabsContent>
      <TabsContent value="network" className="min-h-0 flex-1 overflow-hidden">
        <NetworkPanel />
      </TabsContent>
      <TabsContent value="storage" className="min-h-0 flex-1 overflow-hidden">
        <StoragePanel />
      </TabsContent>
      <TabsContent value="extensions" className="min-h-0 flex-1 overflow-hidden">
        <ExtensionsPanel />
      </TabsContent>
      <TabsContent value="chat" className="min-h-0 flex-1 overflow-hidden">
        <ChatPanel />
      </TabsContent>
    </Tabs>
  );
};

export default function DashboardPage() {
  const activePort = useAtomValue(activePortAtom);
  useStreamSync(activePort);
  useSessionsSync();
  useActivitySync();
  useChatStatusSync();

  const sessions = useAtomValue(sessionsAtom);
  const hasSessions = sessions.length > 0;
  const setNewSessionDialog = useSetAtom(newSessionDialogAtom);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const hasConsoleErrors = useAtomValue(hasConsoleErrorsAtom);
  const activeExtensions = useAtomValue(activeExtensionsAtom);

  useHotkey("Mod+N", () => setNewSessionDialog(true), {
    meta: { name: "New session", description: "Create a new browser session" },
  });

  if (isDesktop) {
    if (!hasSessions) {
      return (
        <div className="flex h-full flex-col bg-background">
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel id="sessions" defaultSize="15%" minSize="10%" maxSize="30%">
              <SessionTree />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="empty" defaultSize="85%">
              <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">No active sessions</p>
                    <p className="text-xs text-muted-foreground/60">
                      Create a session to get started
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setNewSessionDialog(true)}>
                    <Plus className="size-3.5" />
                    New session
                  </Button>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col bg-background">
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel id="sessions" defaultSize="15%" minSize="10%" maxSize="30%">
            <SessionTree />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="viewport" defaultSize="55%" minSize="30%">
            <Viewport />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="activity" defaultSize="30%" minSize="15%" maxSize="50%">
            <SidePanel activeExtensions={activeExtensions} hasConsoleErrors={hasConsoleErrors} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Tabs defaultValue="viewport" className="min-h-0 flex-1">
        <div className="shrink-0 px-2 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="viewport">Viewport</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="sessions" className="min-h-0 overflow-hidden">
          <SessionTree />
        </TabsContent>
        <TabsContent value="viewport" className="min-h-0 overflow-hidden">
          <Viewport />
        </TabsContent>
        <TabsContent value="activity" className="min-h-0 overflow-hidden">
          <SidePanel activeExtensions={activeExtensions} hasConsoleErrors={hasConsoleErrors} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
