// The WhatsApp share message (PRD 5.6). No API: a standard wa.me link opens WhatsApp with the text
// ready to send. Placeholders are filled in per guest.

export const DEFAULT_WHATSAPP_MESSAGE =
  "Dear {name}, we would love to have you celebrate our wedding with us! View your invitation here: {link} — {couple}";

export const WHATSAPP_MESSAGE_MAX = 600;

export function renderWhatsappMessage(
  template: string,
  values: { name: string; link: string; couple: string },
): string {
  // One pass over the placeholders, so a guest named "{link}" cannot inject into the message.
  return template.replace(
    /\{(name|link|couple)\}/g,
    (_, key: "name" | "link" | "couple") => values[key],
  );
}

// With a phone the chat with that guest opens; without one, WhatsApp shows its contact picker.
export function whatsappLink(phone: string | undefined, message: string): string {
  const digits = phone?.replace(/\D/g, "");
  return `https://wa.me/${digits ?? ""}?text=${encodeURIComponent(message)}`;
}
