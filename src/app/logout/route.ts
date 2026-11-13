import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";

export async function POST() {
  const user = await getCurrentUser();
  if (user) await audit({ actor: user, action: "LOGOUT", entityType: "PortalUser", entityId: user.id, summary: `${user.email} signed out` });
  await destroySession();
  return NextResponse.redirect(new URL("/login", config.appUrl), 303);
}
