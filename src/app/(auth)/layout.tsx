import { PieChart } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col bg-primary text-primary-foreground p-10">
        <div className="flex items-center gap-2 mb-auto">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/20">
            <PieChart className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg">CashFlowIQ</span>
        </div>
        <div className="space-y-4">
          <blockquote className="text-xl font-semibold leading-relaxed">
            &ldquo;The most critical financial metric for any business is not revenue — it&apos;s cash flow.&rdquo;
          </blockquote>
          <p className="text-primary-foreground/70 text-sm">
            Monitor, forecast and protect your business liquidity with intelligent insights.
          </p>
        </div>
        <div className="mt-auto text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} CashFlowIQ. All rights reserved.
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
