import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getBusiness, listLeads } from "@/lib/data";
import { leadsToCsv, parseLeadFilters } from "@/lib/leads";

// Downloads leads as CSV: the ticked ones, or everything matching the filters.
// Reads go through the user's own session, so RLS limits it to their business.
export async function GET(request: NextRequest, { params }: RouteContext<"/b/[businessId]/leads/export">) {
  const { businessId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  if (!z.uuid().safeParse(businessId).success) return new NextResponse("Not found", { status: 404 });
  const business = await getBusiness(businessId, user.id);
  if (!business) return new NextResponse("Not found", { status: 404 });

  const sp = request.nextUrl.searchParams;
  const selected = new Set(sp.getAll("id").filter((id) => z.uuid().safeParse(id).success));
  const filters = parseLeadFilters(Object.fromEntries(sp.entries()));
  let leads = await listLeads(businessId, filters, 10000);
  if (selected.size > 0) leads = leads.filter((l) => selected.has(l.id));

  const slug = business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "leads";
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + leadsToCsv(leads), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-leads-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
