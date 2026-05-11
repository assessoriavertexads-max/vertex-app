import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY");
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const FROM_EMAIL       = Deno.env.get("FROM_EMAIL") ?? "automacao@vertexads.com.br";
const FROM_NAME        = Deno.env.get("FROM_NAME")  ?? "Vertex Automação";
const CRON_SECRET      = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface SendEmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

interface SendResult {
  success: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
}

async function sendViaResend(payload: SendEmailPayload): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? `Resend error ${res.status}`);
  }
  return { success: true, provider: "resend", messageId: data.id };
}

async function sendViaSendGrid(payload: SendEmailPayload): Promise<SendResult> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: payload.subject,
      content: payload.html
        ? [{ type: "text/html", value: payload.html }]
        : [{ type: "text/plain", value: payload.text ?? "" }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${body}`);
  }
  const msgId = res.headers.get("X-Message-Id") ?? undefined;
  return { success: true, provider: "sendgrid", messageId: msgId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Allow calls from cron secret or authenticated Supabase requests
  if (CRON_SECRET) {
    const secret = req.headers.get("x-cron-secret");
    const auth   = req.headers.get("authorization");
    if (secret !== CRON_SECRET && !auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let payload: SendEmailPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.to || !payload.subject) {
    return new Response(
      JSON.stringify({ error: "Fields 'to' and 'subject' are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!RESEND_API_KEY && !SENDGRID_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "No email provider configured. Set RESEND_API_KEY or SENDGRID_API_KEY.",
        configured: false,
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const result = RESEND_API_KEY
      ? await sendViaResend(payload)
      : await sendViaSendGrid(payload);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
