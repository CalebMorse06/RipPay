import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sessionStore } from "@/server/store";
import { getBaseUrlFromRequest } from "@/server/config";
import { SessionLive } from "@/components/SessionLive";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await sessionStore.get(id);
  if (!session) notFound();

  const headerList = await headers();
  const baseUrl = getBaseUrlFromRequest({ headers: headerList });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <Link href="/" className="text-sm text-subtle hover:text-ink">
          ← New session
        </Link>
      </div>
      <SessionLive initial={session} baseUrl={baseUrl} />
    </div>
  );
}
