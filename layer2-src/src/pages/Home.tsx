import ConciergeChat from '@/components/ConciergeChat';
import { useEmbedMode } from '@/components/SiteChrome';

// The site page (concierge.html) provides the chrome (nav, hero, sections,
// footer) as static HTML around #root, so the app renders only the chat.
export default function Home() {
  const embed = useEmbedMode();

  if (embed) {
    return (
      <div className="min-h-screen bg-canvas p-3 text-ink">
        <div className="h-[calc(100vh-24px)]"><ConciergeChat /></div>
      </div>
    );
  }

  return (
    <div className="text-ink">
      <div className="h-[72vh] min-h-[560px] max-h-[760px]">
        <ConciergeChat />
      </div>
    </div>
  );
}
