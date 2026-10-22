import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// Outgoing Message-IDs carry a signed ticket reference, e.g.
//   <0f3c…a1.TKT-000042.9b1d2e3f4a5b6c7d@ciaschool.edu.kh>
// Mail clients copy it into In-Reply-To/References when someone replies, which is how an
// inbound email finds its ticket. The signature stops anyone forging a reference to another ticket.

function secret(): string {
  const s = process.env.EMAIL_TOKEN_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("EMAIL_TOKEN_SECRET is not set");
  return s;
}

function domain(): string {
  return (process.env.HELPDESK_ADDRESS ?? "helpdesk@localhost").split("@")[1] ?? "localhost";
}

function sign(nonce: string, ticketNumber: string): string {
  return createHmac("sha256", secret()).update(`${nonce}.${ticketNumber}`).digest("hex").slice(0, 16);
}

export function newMessageId(ticketNumber?: string): string {
  const nonce = randomUUID().replace(/-/g, "");
  if (!ticketNumber) return `<${nonce}@${domain()}>`;
  return `<${nonce}.${ticketNumber}.${sign(nonce, ticketNumber)}@${domain()}>`;
}

const TOKEN = /<([0-9a-f]{32})\.(TKT-\d{6})\.([0-9a-f]{16})@[^>]+>/gi;

// Finds the first validly signed ticket reference in In-Reply-To / References headers.
export function ticketFromHeaders(...headers: (string | string[] | undefined | null)[]): string | null {
  const text = headers.flat().filter(Boolean).join(" ");
  for (const m of text.matchAll(TOKEN)) {
    const [, nonce, ticketNumber, sig] = m;
    const expected = sign(nonce.toLowerCase(), ticketNumber.toUpperCase());
    if (sig.length === expected.length && timingSafeEqual(Buffer.from(sig.toLowerCase()), Buffer.from(expected))) {
      return ticketNumber.toUpperCase();
    }
  }
  return null;
}

// "[TKT-000042]" in a subject. Weaker than a signed header, so callers must also check the sender.
export function ticketFromSubject(subject: string | undefined | null): string | null {
  const m = /\[(TKT-\d{6})\]/i.exec(subject ?? "");
  return m ? m[1].toUpperCase() : null;
}
