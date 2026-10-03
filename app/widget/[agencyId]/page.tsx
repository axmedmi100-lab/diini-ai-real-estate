import { PropertyChatWidget } from "@/components/chat/property-chat-widget";

export default async function WidgetPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  return <div className="h-dvh bg-transparent p-1"><PropertyChatWidget agencyId={agencyId} /></div>;
}
