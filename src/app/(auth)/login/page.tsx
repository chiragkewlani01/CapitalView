"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PieChart, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = await loginAction({
      email: fd.get("email") as string,
      password: fd.get("password") as string,
    });

    if (!result.success) {
      setError(result.error ?? "Login failed.");
      setLoading(false);
      return;
    }

    router.push("/overview");
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
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@company.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••" required />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <p className="text-sm text-center text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Create one
        </Link>
      </p>

      {/* Demo credentials hint */}
      <div className="rounded-md border p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Demo credentials</p>
        <p>Email: demo@meridian.com</p>
        <p>Password: demo1234</p>
      </div>
    </div>
  );
}
