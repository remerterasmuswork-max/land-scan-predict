import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireAdmin(supabaseClient: SupabaseClient) {
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  
  if (authError || !user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin'
  });

  if (roleError || !isAdmin) {
    return { authorized: false, error: "Forbidden - Admin access required", status: 403 };
  }

  return { authorized: true, user };
}
