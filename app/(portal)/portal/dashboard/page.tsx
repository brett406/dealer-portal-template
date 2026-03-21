import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CustomerDashboard() {
  redirect("/portal/catalog");
}
