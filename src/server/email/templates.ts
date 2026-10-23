// Email wording. Defaults live here; admins can override them (EmailTemplate rows).
// Placeholders use {{name}}. Bodies are plain text; HTML is derived from them.

export const REPLY_MARKER = "-- Reply above this line --";

export const TEMPLATE_DEFS = {
  "ticket.autoreply": {
    label: "New ticket: confirmation to requester",
    subject: "[{{ticket.number}}] {{ticket.subject}}",
    body: `Hi {{recipient.firstName}},

We've received your request and created ticket {{ticket.number}}. The IT team will reply here as soon as possible.

Your message:
{{message}}

You can follow the ticket at {{ticket.url}} or simply reply to this email.

CIA FIRST IT Help Desk`,
  },
  "ticket.alert": {
    label: "New ticket: alert to staff",
    subject: "New ticket {{ticket.number}}: {{ticket.subject}}",
    body: `New ticket from {{requester.name}} <{{requester.email}}>
Topic: {{ticket.topic}} · Priority: {{ticket.priority}} · Team: {{ticket.team}}

{{message}}

Open it: {{ticket.staffUrl}}`,
  },
  "ticket.reply": {
    label: "Agent reply: to requester and CCs",
    subject: "Re: [{{ticket.number}}] {{ticket.subject}}",
    body: `{{message}}

{{agent.name}}, CIA IT Team

View the ticket: {{ticket.url}}`,
  },
  "ticket.message.alert": {
    label: "Requester replied: alert to staff",
    subject: "Reply on {{ticket.number}}: {{ticket.subject}}",
    body: `{{author.name}} replied to {{ticket.number}}:

{{message}}

Open it: {{ticket.staffUrl}}`,
  },
  "ticket.assigned": {
    label: "Ticket assigned: alert to agent",
    subject: "Assigned to you: {{ticket.number}} {{ticket.subject}}",
    body: `{{agent.name}} assigned {{ticket.number}} to you.

From: {{requester.name}} · Priority: {{ticket.priority}}

Open it: {{ticket.staffUrl}}`,
  },
  "ticket.resolved": {
    label: "Ticket resolved: to requester and CCs",
    subject: "Resolved: [{{ticket.number}}] {{ticket.subject}}",
    body: `Hi {{recipient.firstName}},

The IT team has marked {{ticket.number}} as resolved. If the problem is still there, just reply to this email and the ticket will reopen.

{{ticket.url}}

CIA FIRST IT Help Desk`,
  },
  "ticket.closed": {
    label: "Ticket closed: to requester and CCs",
    subject: "Closed: [{{ticket.number}}] {{ticket.subject}}",
    body: `Hi {{recipient.firstName}},

Ticket {{ticket.number}} is now closed. If you need more help, open a new ticket at {{app.url}}.

CIA FIRST IT Help Desk`,
  },
  "ticket.requester.status": {
    label: "Requester closed or reopened: alert to staff",
    subject: "{{message}}: {{ticket.number}} {{ticket.subject}}",
    body: `{{requester.name}} changed {{ticket.number}}: {{message}}.

Open it: {{ticket.staffUrl}}`,
  },
} as const satisfies Record<string, { label: string; subject: string; body: string }>;

export type TemplateKey = keyof typeof TEMPLATE_DEFS;
export const TEMPLATE_KEYS = Object.keys(TEMPLATE_DEFS) as TemplateKey[];

// Emails the requester can reply to get the reply marker on top.
export const REPLYABLE: ReadonlySet<TemplateKey> = new Set(["ticket.autoreply", "ticket.reply", "ticket.resolved"]);

export const TEMPLATE_VARIABLES = [
  "recipient.name",
  "recipient.firstName",
  "ticket.number",
  "ticket.subject",
  "ticket.topic",
  "ticket.priority",
  "ticket.team",
  "ticket.url",
  "ticket.staffUrl",
  "requester.name",
  "requester.email",
  "agent.name",
  "author.name",
  "message",
  "app.url",
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number], string>>;

// Unknown placeholders render as empty so a typo never leaks "{{...}}" to students.
export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*([a-zA-Z.]+)\s*\}\}/g, (_m, key: string) => vars[key as keyof TemplateVars] ?? "");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Plain text → simple, safe HTML (escaped, links clickable, line breaks kept).
export function textToHtml(text: string): string {
  const linked = escapeHtml(text).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`);
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#15202b">${linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("")}</body></html>`;
}
