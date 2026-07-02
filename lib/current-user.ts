import { auth } from "@clerk/nextjs/server";
import { prisma } from "./db";

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Keep DB ownership keyed by Clerk's stable user id. Avoid calling Clerk's
  // Backend User API on every app/API request; profile fields can be synced
  // later via webhook without making core workflow loading depend on it.
  return prisma.user.upsert({
    where: { clerkId: userId },
    update: {},
    create: { clerkId: userId },
  });
}
