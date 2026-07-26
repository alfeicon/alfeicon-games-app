import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BibliotecaClient from "./BibliotecaClient";
import type { Order } from "@/app/admin/_types";

export const dynamic = "force-dynamic";

export default async function BibliotecaPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Fetch orders linked to this user
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (ordersError) {
    console.error("Error fetching user orders:", ordersError);
  }

  return <BibliotecaClient initialOrders={(orders as Order[]) || []} userEmail={user.email || ""} />;
}
