import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Teilt Inhalte ueber den offiziellen wa.me-Link: oeffnet WhatsApp mit
 * vorbefuelltem Text, die Person waehlt den Empfaenger selbst und schickt
 * manuell ab. Bewusst kein automatischer Versand - der ginge nur ueber die
 * WhatsApp Business Platform (kostenpflichtig, Business-Konto noetig).
 */
export function WhatsAppShareButton({ text, label }: { text: string; label?: string }) {
  const t = useTranslations("whatsAppShare");
  const resolvedLabel = label ?? t("defaultLabel");
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary"
    >
      <MessageCircle className="h-4 w-4" />
      {resolvedLabel}
    </a>
  );
}
