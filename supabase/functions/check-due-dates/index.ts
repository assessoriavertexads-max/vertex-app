import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EVOLUTION_URL = Deno.env.get("EVOLUTION_URL");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

function dateAddDays(base: string, days: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function sendWhatsApp(phone: string, message: string) {
  if (!EVOLUTION_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) return;
  const raw = phone.replace(/\D/g, "");
  const number = raw.startsWith("55") ? raw : `55${raw}`;
  await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
    },
    body: JSON.stringify({ number, text: message }),
  });
}

serve(async (req) => {
  // Accepts GET/POST from pg_cron or manual trigger
  // Optionally protected by a shared secret header
  if (CRON_SECRET) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  // Load all enabled scheduled automation rules
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

  // Get a default task list for create_task actions
  let listId: string | null = null;
  const { data: existingList } = await supabase
    .from("lists")
    .select("id")
    .limit(1)
    .maybeSingle();
  listId = existingList?.id ?? null;

  let totalExecuted = 0;

  for (const rule of rules) {
    // Determine which date to look for
    const daysAhead =
      rule.trigger_event === "task_due_soon" ||
      rule.trigger_event === "transaction_due_soon"
        ? parseInt(rule.trigger_value) || 0
        : 0;
    const targetDate = daysAhead > 0 ? dateAddDays(today, daysAhead) : today;

    type ItemRow = { id: string; name: string; company_id: string | null };
    let items: ItemRow[] = [];

    if (
      rule.trigger_event === "task_due_soon" ||
      rule.trigger_event === "task_due_today"
    ) {
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
      items = ((data ?? []) as Array<{ id: string; category: string; company_id: string | null }>).map(
        (t) => ({ id: t.id, name: t.category, company_id: t.company_id })
      );
    }

    for (const item of items) {
      // Resolve company info
      let companyPhone: string | null = null;
      let companyName: string | null = null;
      if (item.company_id) {
        const { data: co } = await supabase
          .from("companies")
          .select("name, phone")
          .eq("id", item.company_id)
          .single();
        companyPhone = co?.phone ?? null;
        companyName = co?.name ?? null;
      }

      const entityTitle = item.name ?? "";
      const replaceVars = (tpl: string) =>
        tpl
          .replace(/\{task_name\}/g, entityTitle)
          .replace(/\{entity_name\}/g, entityTitle)
          .replace(/\{company_name\}/g, companyName ?? "")
          .replace(/\{due_date\}/g, targetDate);

      const ad = rule.action_data as {
        task_name?: string;
        task_priority?: string;
        task_description?: string;
        due_in_days?: number;
        message_template?: string;
      };

      if (rule.action_type === "create_task" && listId && ad.task_name) {
        const taskName = replaceVars(ad.task_name);
        const dueDate = ad.due_in_days
          ? dateAddDays(today, ad.due_in_days)
          : null;
        await supabase.from("tasks").insert({
          name: taskName,
          description: ad.task_description
            ? replaceVars(ad.task_description)
            : `Criado automaticamente por "${rule.name}"`,
          priority: ad.task_priority || "normal",
          due_date: dueDate,
          company_id: item.company_id || null,
          list_id: listId,
          status: "a_receber",
        });
        totalExecuted++;
      }

      if (rule.action_type === "send_whatsapp" && companyPhone && ad.message_template) {
        await sendWhatsApp(companyPhone, replaceVars(ad.message_template));
        totalExecuted++;
      }
    }
  }

  return new Response(
    JSON.stringify({ executed: totalExecuted, date: today, rules: rules.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
