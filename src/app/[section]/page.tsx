import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { snapshot } from "@/lib/server/data";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    ![
      "dashboard",
      "products",
      "discover",
      "pin-studio",
      "approval-queue",
      "scheduler",
      "published",
      "analytics",
      "ai-insights",
      "settings",
    ].includes(section)
  )
    notFound();
  return <Workspace section={section} data={await snapshot()} />;
}
