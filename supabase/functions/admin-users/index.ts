// Admin-only user management: suspend / unsuspend / delete / set role.
// Caller must already be an admin (verified server-side).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "suspend" | "unsuspend" | "delete" | "set_role";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    const callerId = claims?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdminRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!isAdminRow) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;
    const targetId = String(body?.userId || "");
    if (!action || !targetId) return json({ error: "missing_params" }, 400);
    if (targetId === callerId && (action === "delete" || action === "suspend"))
      return json({ error: "cannot_target_self" }, 400);

    if (action === "suspend" || action === "unsuspend") {
      const { error } = await admin.from("profiles")
        .update({ suspended: action === "suspend" }).eq("id", targetId);
      if (error) return json({ error: error.message }, 500);
    } else if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return json({ error: error.message }, 500);
    } else if (action === "set_role") {
      const role = String(body?.role || "");
      if (!["admin", "customer"].includes(role)) return json({ error: "bad_role" }, 400);
      await admin.from("user_roles").delete().eq("user_id", targetId);
      const { error } = await admin.from("user_roles").insert({ user_id: targetId, role });
      if (error) return json({ error: error.message }, 500);
    } else {
      return json({ error: "bad_action" }, 400);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}