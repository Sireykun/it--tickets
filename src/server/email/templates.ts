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
  "ticket.overdue": {
    label: "SLA overdue: alert to staff",
    subject: "Overdue: {{ticket.number}} {{ticket.subject}}",
    body: `{{ticket.number}} is overdue. {{message}}

From: {{requester.name}} · Priority: {{ticket.priority}} · Team: {{ticket.team}}

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

// Plain text → safe HTML (escaped, links clickable, line breaks kept) in the school's email layout.
// Tables and inline styles because mail apps ignore most CSS; no images because many block them.
// Colours are the CIA FIRST brand values (see src/app/globals.css).
export function textToHtml(text: string): string {
  const linked = escapeHtml(text).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`);
  const paragraphs = linked
    .split(/\n{2,}/)
    // The marker's text must stay exactly as is (inbound replies are cut there), so only its look changes.
    .map((p) => (p === REPLY_MARKER ? `<p style="margin:0 0 16px;font-size:12px;color:#607184">${p}</p>` : `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`))
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>a{color:#017293}</style></head>
<body style="margin:0;padding:0;background:#f0f6fc;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0d1b2a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f6fc"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="background:#171818;border-radius:12px 12px 0 0;padding:18px 24px">
<div style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:-0.2px">CIA FIRST</div>
<div style="font-size:11px;font-weight:bold;color:#bca560;letter-spacing:2px">INTERNATIONAL SCHOOL &middot; IT HELP DESK</div>
</td></tr>
<tr><td style="height:3px;background:#bca560;line-height:3px;font-size:0">&nbsp;</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e2edf5;border-top:0;border-radius:0 0 12px 12px;padding:24px">${paragraphs}</td></tr>
<tr><td style="padding:16px 8px;text-align:center;font-size:12px;color:#4a6080">CIA FIRST International School &middot; IT Help Desk</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
