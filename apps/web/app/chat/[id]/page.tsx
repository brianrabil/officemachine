import type { HarnessMessage } from "@workspace/agent/agent";
import { Chat } from "@/components/chat";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const res = await fetch(`/api/chat/${id}`);
  const initialMessages: HarnessMessage[] = await res.json();
  return <Chat id={id} initialMessages={initialMessages} />;
}
