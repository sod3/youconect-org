import { ApplicationRouter } from "@/components/app-router";
export default async function AppPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  return <ApplicationRouter section={(await params).section || []} />;
}
