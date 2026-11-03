// Owner payment alerts (added Nov 3, 2026, at Evans's instruction:
// owners must hear about an expiring card or a failed payment before
// their menu lapses, because busy owners will not notice on their own).
//
// Every alert is recorded in the notifications table first-class:
// kind, cycle key (dedupe), recipient, subject, body and outcome.
// Sending goes through Resend when RESEND_API_KEY is set. Without it
// the alert is recorded with status "recorded" and full content, so
// nothing is ever silently dropped and Evans can see exactly what
// would have gone out. A failed send records status "failed" with the
// error. Notification problems never break webhook handling: callers
// wrap these helpers in try/catch and the state machine proceeds.
//
// The update-card link is generated fresh from Paystack at alert time
// (GET /subscription/{code}/manage/link with the billing secret), so
// alerts never carry a stale or invented link.
import type { RegistryStore } from "./registry";

export type AlertKind = "payment_failed" | "card_expiring" | "renewal_upcoming" | "grace_mid" | "grace_final" | "menu_paused";

export interface AlertContent { subject: string; text: string }

const FROM_DEFAULT = "Claro & Co <onboarding@resend.dev>";

export function formatDay(iso: string | null): string {
  if (!iso) return "the renewal date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the renewal date";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(d);
}

export async function getUpdateCardLink(subscriptionCode: string | null): Promise<string | null> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !subscriptionCode) return null;
  try {
    const res = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    return typeof json?.data?.link === "string" ? json.data.link : null;
  } catch {
    return null;
  }
}

async function sendEmail(to: string, content: AlertContent): Promise<{ status: "sent" | "recorded" | "failed"; providerId: string | null; detail: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "recorded", providerId: null, detail: "RESEND_API_KEY not set: alert recorded, not sent." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.ALERT_FROM_EMAIL || FROM_DEFAULT, to, subject: content.subject, text: content.text }),
      signal: AbortSignal.timeout(8000),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) return { status: "failed", providerId: null, detail: `Resend HTTP ${res.status}: ${JSON.stringify(json)?.slice(0, 300) ?? ""}` };
    return { status: "sent", providerId: typeof json?.id === "string" ? json.id : null, detail: "Sent via Resend." };
  } catch (err) {
    return { status: "failed", providerId: null, detail: err instanceof Error ? err.message : String(err) };
  }
}

export interface NotifyArgs {
  slug: string;
  kind: AlertKind;
  cycleKey: string;
  recipient: string | null;
  subscriptionCode: string | null;
  build: (updateLink: string | null) => AlertContent;
}

// Sends (or records) one owner alert, deduped by (slug, kind, cycle).
// Returns a short outcome word for logs and scan summaries.
export async function notifyOwner(store: RegistryStore, args: NotifyArgs): Promise<string> {
  if (await store.hasNotification(args.slug, args.kind, args.cycleKey)) return "duplicate_skipped";
  if (!args.recipient) {
    await store.recordNotification({ slug: args.slug, kind: args.kind, cycleKey: args.cycleKey, recipient: null, subject: "(no recipient)", body: "", status: "no_recipient", providerId: null, detail: "Restaurant row has no owner email yet." });
    return "no_recipient";
  }
  const link = await getUpdateCardLink(args.subscriptionCode);
  const content = args.build(link);
  const outcome = await sendEmail(args.recipient, content);
  await store.recordNotification({ slug: args.slug, kind: args.kind, cycleKey: args.cycleKey, recipient: args.recipient, subject: content.subject, body: content.text, status: outcome.status, providerId: outcome.providerId, detail: outcome.detail });
  return outcome.status;
}

// ---------------------------------------------------------------------------
// Alert copy. Plain words, no payment shaming, the menu state stated
// honestly, and the fix always one tap away. No em dashes (house rule).
// ---------------------------------------------------------------------------

function linkLine(link: string | null): string {
  return link ? `\nUpdate your card here: ${link}\n` : "\nUse the card update link in the email Paystack sent you, or reply to this email and we will help you fix it.\n";
}

export function paymentFailedContent(slug: string, graceUntil: string | null, link: string | null): AlertContent {
  return {
    subject: "Your menu payment needs attention",
    text: `Hello from Claro & Co.\n\nWe tried to take this month's payment for your menu page (${slug}) and it did not go through. Nothing is wrong with your menu: it stays fully live while you sort this out.\n\nYou have until ${formatDay(graceUntil)} to update your payment card. If the payment is still not fixed by then, your menu page will pause until it is.
${linkLine(link)}
Once a payment goes through, everything returns to normal on its own. You do not need to contact us.\n\nClaro & Co`,
  };
}

export function cardExpiringContent(slug: string, link: string | null): AlertContent {
  return {
    subject: "The card on your menu subscription is about to expire",
    text: `Hello from Claro & Co.\n\nPaystack tells us the card saved for your menu page (${slug}) is about to expire. If it expires before your next payment, that payment will fail and your menu will enter its grace period.\n\nUpdating the card now takes about a minute and keeps everything running without interruption.
${linkLine(link)}
Claro & Co`,
  };
}

export function renewalUpcomingContent(slug: string, nextPaymentDate: string | null, link: string | null): AlertContent {
  return {
    subject: "Your menu subscription renews soon",
    text: `Hello from Claro & Co.\n\nA quick heads up: the monthly payment for your menu page (${slug}) is due on ${formatDay(nextPaymentDate)}. It will be taken automatically from your saved card.\n\nIf that card has changed or expired, you can update it now so the renewal goes through cleanly.
${linkLine(link)}
Claro & Co`,
  };
}

export function graceMidContent(slug: string, graceUntil: string | null, link: string | null): AlertContent {
  return {
    subject: "Reminder: your menu payment is still outstanding",
    text: `Hello from Claro & Co.\n\nThis is a friendly reminder that the payment for your menu page (${slug}) is still outstanding. Your menu is still live.\n\nPlease update your payment card before ${formatDay(graceUntil)}. After that date the menu page will pause until the payment is made.
${linkLine(link)}
Claro & Co`,
  };
}

export function graceFinalContent(slug: string, graceUntil: string | null, link: string | null): AlertContent {
  return {
    subject: "Final reminder: your menu pauses tomorrow",
    text: `Hello from Claro & Co.\n\nThe payment for your menu page (${slug}) is still outstanding, and the grace period ends on ${formatDay(graceUntil)}. Your menu is still live today.\n\nIf the payment is not fixed by then, your menu page will pause. As soon as a payment goes through, it comes back automatically.
${linkLine(link)}
Claro & Co`,
  };
}

export function menuPausedContent(slug: string, link: string | null): AlertContent {
  return {
    subject: "Your menu page has paused",
    text: `Hello from Claro & Co.\n\nThe payment for your menu page (${slug}) was not completed inside the grace period, so the page has paused and guests currently see a short unavailable notice.\n\nThe moment a payment goes through, your menu returns automatically. You do not need a new setup.
${linkLine(link)}
Claro & Co`,
  };
}
