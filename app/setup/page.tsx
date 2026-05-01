import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import { getTheme } from "@/lib/theme";
import { SetupForm } from "@/components/setup/SetupForm";
import "./setup.css";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const complete = await isSetupComplete();
  if (complete) redirect("/");

  const brand = getTheme().brand.name;

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-header">
          <h1>Welcome to {brand}</h1>
          <p>Let&apos;s get you set up.</p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
