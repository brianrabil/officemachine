import type { HarnessMessage } from "@workspace/agent/agent";
import { config } from "@workspace/config";
import { Chat } from "@/components/chat";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const res = await fetch(`${config.APP_API_URL}/api/chat/${id}`);
  const initialMessages: HarnessMessage[] = await res.json();
  return <Chat id={id} initialMessages={initialMessages} />;
}
