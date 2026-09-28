import { Workspace } from "@/components/workspace";
import { snapshot } from "@/lib/server/data";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <Workspace section="dashboard" data={await snapshot()} />;
}
