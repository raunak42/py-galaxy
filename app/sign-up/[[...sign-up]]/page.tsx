import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] px-4 py-10">
      <SignUp routing="path" path="/sign-up" signInUrl="/login" fallbackRedirectUrl="/app/flow" />
    </main>
  );
}
