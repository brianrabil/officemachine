import type { UIMessage } from "ai";
import { config } from "@workspace/agent/config";
import { Chat } from "@/components/chat";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const res = await fetch(`${config.HARNESS_API_ORIGIN}/api/chat/${id}`);
  const initialMessages: UIMessage[] = await res.json();

  return <Chat id={id} initialMessages={initialMessages} />;
}
