import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EVOLUTION_URL     = Deno.env.get("EVOLUTION_URL");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
const EVOLUTION_INSTANCE= Deno.env.get("EVOLUTION_INSTANCE");
const CRON_SECRET       = Deno.env.get("CRON_SECRET");

function dateAddDays(base: string, days: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function sendWhatsApp(phone: string, message: string): Promise<void> {
  if (!EVOLUTION_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    throw new Error("Evolution API não configurada (EVOLUTION_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE)");
  }
  const raw    = phone.replace(/\D/g, "");
  const number = raw.startsWith("55") ? raw : `55${raw}`;
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number, text: message }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke("send-email-proxy", {
    body: { to, subject, html },
  });
  if (error) throw new Error(String(error.message ?? error));
}

serve(async (req) => {
  if (CRON_SECRET) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today    = new Date().toISOString().slice(0, 10);

  const { data: rules, error: rulesErr } = await supabase
    .from("automation_rules")
    .select("*")
    .in("trigger_event", [
      "task_due_soon",
      "task_due_today",
      "transaction_due_soon",
      "transaction_due_today",
    ])
    .eq("enabled", true);

  if (rulesErr || !rules?.length) {
    return new Response(JSON.stringify({ executed: 0, date: today }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Resolve a default list id once (optional — tasks work without it)
  let listId: string | null = null;
  try {
    const { data: existingList } = await supabase.from("lists").select("id").limit(1).maybeSingle();
    listId = existingList?.id ?? null;
  } catch { /* lists table may not exist */ }

  let totalExecuted = 0;
  const executionErrors: { rule_id: string; rule_name: string; item_id: string; message: string }[] = [];

  for (const rule of rules) {
    const daysAhead =
      rule.trigger_event === "task_due_soon" ||
      rule.trigger_event === "transaction_due_soon"
        ? parseInt(rule.trigger_value) || 0
        : 0;
    const targetDate = daysAhead > 0 ? dateAddDays(today, daysAhead) : today;

    type ItemRow = { id: string; name: string; company_id: string | null };
    let items: ItemRow[] = [];

    if (rule.trigger_event === "task_due_soon" || rule.trigger_event === "task_due_today") {
      const { data } = await supabase
        .from("tasks")
        .select("id, name, company_id")
        .eq("due_date", targetDate)
        .neq("status", "concluido");
      items = (data ?? []) as ItemRow[];
    } else {
      const { data } = await supabase
        .from("financial_transactions")
        .select("id, category, company_id")
        .eq("due_date", targetDate)
        .neq("status", "paid");
      items = ((data ?? []) as Array<{ id: string; category: string; company_id: string | null }>)
        .map((t) => ({ id: t.id, name: t.category, company_id: t.company_id }));
    }

    for (const item of items) {
      // Each item is isolated — a failure here does NOT abort remaining items
      try {
        let companyPhone: string | null = null;
        let companyEmail: string | null = null;
        let companyName:  string | null = null;

        if (item.company_id) {
          const { data: co } = await supabase
            .from("companies")
            .select("name, phone, email")
            .eq("id", item.company_id)
            .single();
          companyPhone = co?.phone ?? null;
          companyEmail = co?.email ?? null;
          companyName  = co?.name  ?? null;
        }

        const entityTitle = item.name ?? "";
        const replaceVars = (tpl: string) =>
          tpl
            .replace(/\{task_name\}/g,    entityTitle)
            .replace(/\{entity_name\}/g,  entityTitle)
            .replace(/\{company_name\}/g, companyName ?? "")
            .replace(/\{due_date\}/g,     targetDate);

        const ad = rule.action_data as {
          task_name?:        string;
          task_priority?:    string;
          task_description?: string;
          due_in_days?:      number;
          message_template?: string;
          email_to?:         string;   // "company" | "responsible" | literal email
          email_body?:       string;
        };

        if (rule.action_type === "create_task" && ad.task_name) {
          const taskName = replaceVars(ad.task_name);
          const dueDate  = ad.due_in_days ? dateAddDays(today, ad.due_in_days) : null;
          const { error: taskErr } = await supabase.from("tasks").insert({
            name:        taskName,
            description: ad.task_description
              ? replaceVars(ad.task_description)
              : `Criado automaticamente por "${rule.name}"`,
            priority:   ad.task_priority || "normal",
            due_date:   dueDate,
            company_id: item.company_id || null,
            ...(listId ? { list_id: listId } : {}),
            status: "a_receber",
          });
          if (taskErr) throw new Error(taskErr.message);
          totalExecuted++;
        }

        if (rule.action_type === "send_whatsapp" && companyPhone && ad.message_template) {
          await sendWhatsApp(companyPhone, replaceVars(ad.message_template));
          totalExecuted++;
        }

        if (rule.action_type === "send_email" && ad.email_body) {
          const toEmail = companyEmail;
          if (!toEmail) throw new Error("Empresa sem e-mail cadastrado");

          const subject = replaceVars(rule.email_subject ?? `Lembrete: ${entityTitle}`);
          const html    = replaceVars(ad.email_body).replace(/\n/g, "<br>");
          await sendEmail(supabase, toEmail, subject, html);
          totalExecuted++;
        }

        // Update rule observability counters on success
        await supabase
          .from("automation_rules")
          .update({
            last_run_at: new Date().toISOString(),
            last_error:  null,
            run_count:   (rule.run_count ?? 0) + 1,
          })
          .eq("id", rule.id);

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        executionErrors.push({ rule_id: rule.id, rule_name: rule.name, item_id: item.id, message });

        // Persist last error without interrupting the loop
        await supabase
          .from("automation_rules")
          .update({ last_error: message.slice(0, 500) })
          .eq("id", rule.id)
          .catch(() => { /* best-effort — don't let this mask the original error */ });
      }
    }
  }

  return new Response(
    JSON.stringify({
      executed: totalExecuted,
      errors:   executionErrors,
      date:     today,
      rules:    rules.length,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
