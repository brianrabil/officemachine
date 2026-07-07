import type { HarnessMessage } from "@workspace/agent/harness";
import { env } from "@workspace/config/env";
import { Chat } from "@/components/chat";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const res = await fetch(`${env.APP_API_URL}/api/chat/${id}/messages`);
  const initialMessages: HarnessMessage[] = await res.json();
  return <Chat id={id} initialMessages={initialMessages} />;
}
