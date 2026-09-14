"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signupAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PieChart, Loader2 } from "lucide-react";
import { loginAction } from "@/actions/auth";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const result = await signupAction({
      name: fd.get("name") as string,
      email: fd.get("email") as string,
      password,
    });

    if (!result.success) {
      setError(result.error ?? "Signup failed.");
      setLoading(false);
      return;
    }

    // Auto-login after signup
    await loginAction({
      email: fd.get("email") as string,
      password,
    });

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 lg:hidden mb-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <PieChart className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-bold">CashFlowIQ</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-muted-foreground text-sm mt-1">Start managing your cash flow intelligently</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" placeholder="Priya Sharma" required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" placeholder="you@company.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="Min. 8 characters" required minLength={8} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" placeholder="••••••••" required />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="text-sm text-center text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
