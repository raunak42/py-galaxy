import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] px-4 py-10">
      <SignIn routing="path" path="/login" signUpUrl="/sign-up" fallbackRedirectUrl="/app/flow" />
    </main>
  );
}
