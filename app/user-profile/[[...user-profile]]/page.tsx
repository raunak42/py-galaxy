import { UserProfile } from "@clerk/nextjs";

export default function UserProfilePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] px-4 py-10">
      <UserProfile routing="path" path="/user-profile" />
    </main>
  );
}
