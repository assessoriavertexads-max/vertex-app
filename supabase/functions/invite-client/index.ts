import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth: verify caller is an authenticated agency user ──────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify the caller's role is 'agencia'
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (callerProfile?.role !== "agencia") {
      return new Response(JSON.stringify({ error: "Forbidden: only agency users can invite clients" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse request body ────────────────────────────────────────────────────
    const { email, company_id } = await req.json() as {
      email: string;
      company_id: string;
    };

    if (!email || !company_id) {
      return new Response(JSON.stringify({ error: "email and company_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify the company belongs to this agency ──────────────────────────────
    const { data: company } = await adminClient
      .from("companies")
      .select("id, name, auth_user_id")
      .eq("id", company_id)
      .single();

    if (!company || company.auth_user_id !== callerUser.id) {
      return new Response(JSON.stringify({ error: "Company not found or not owned by you" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check if this email already has a client account for this company ─────
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, role, company_id")
      .eq("company_id", company_id)
      .eq("role", "cliente")
      .maybeSingle();

    // ── Create or re-invite the auth user ─────────────────────────────────────
    const inviteResult = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        role:           "cliente",
        company_id:     company_id,
        agency_user_id: callerUser.id,
      },
    });

    if (inviteResult.error) {
      const msg = inviteResult.error.message ?? String(inviteResult.error);
      // If user already exists, return gracefully
      if (msg.toLowerCase().includes("already been registered")) {
        return new Response(
          JSON.stringify({ success: true, message: "Usuário já cadastrado. Um novo convite foi reenviado se possível.", already_existed: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(msg);
    }

    const invitedUser = inviteResult.data.user;

    // ── Upsert profile as safety net (trigger should have done this already) ──
    if (invitedUser) {
      await adminClient.from("profiles").upsert({
        id:             invitedUser.id,
        role:           "cliente",
        company_id:     company_id,
        agency_user_id: callerUser.id,
      }, { onConflict: "id" });
    }

    return new Response(
      JSON.stringify({
        success:      true,
        message:      `Convite enviado para ${email}`,
        user_id:      invitedUser?.id,
        company_name: company.name,
        already_had_client: !!existingProfile,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
