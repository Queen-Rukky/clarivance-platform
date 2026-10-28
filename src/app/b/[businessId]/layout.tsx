import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { WorkspaceNav } from "@/components/workspace-nav";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/data";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/b/[businessId]">) {
  const { businessId } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) notFound();
  const business = await getBusiness(businessId, user.id);
  if (!business) notFound();

  return (
    <>
      <AppHeader email={user.email} wide />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 md:flex-row md:gap-8 md:py-8">
        <WorkspaceNav businessId={business.id} businessName={business.name} />
        <main id="main" className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
      </div>
    </>
  );
}
