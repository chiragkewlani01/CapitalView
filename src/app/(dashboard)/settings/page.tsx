import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Building2, CreditCard, Users } from "lucide-react";
import { formatCompact, toMajorUnits } from "@/lib/calculations";
import { AccountType } from "@prisma/client";
import { AccountDialog } from "@/components/forms/account-dialog";
import { CompanySettingsForm } from "@/components/forms/company-settings-form";
import { canWrite, canAdmin } from "@/lib/auth/guards";

export default async function SettingsPage() {
  const user = await requireAuth();
  const writeable = canWrite(user.role);
  const isAdmin = canAdmin(user.role);
  const sym = user.companyCurrencySymbol;

  const [company, accounts, members] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: user.companyId } }),
    prisma.financialAccount.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.companyMember.findMany({
      where: { companyId: user.companyId, isActive: true },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const accountTypeLabels: Record<AccountType, string> = {
    BANK: "Bank", CASH: "Cash", CREDIT: "Credit", INVESTMENT: "Investment", OTHER: "Other",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your company and account preferences</p>
      </div>

      {/* Company settings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <CardTitle className="text-sm">Company Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <CompanySettingsForm
              company={{
                name: company.name,
                currency: company.currency,
                minCashThreshold: toMajorUnits(company.minCashThreshold).toString(),
                industry: company.industry ?? "",
              }}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Company Name</p>
                  <p className="font-medium">{company.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Currency</p>
                  <p className="font-medium">{company.currency} ({company.currencySymbol})</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Min Cash Threshold</p>
                  <p className="font-medium">{formatCompact(company.minCashThreshold, sym)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Industry</p>
                  <p className="font-medium">{company.industry ?? "—"}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial accounts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <CardTitle className="text-sm">Financial Accounts</CardTitle>
            </div>
            {writeable && (
              <AccountDialog>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4" />Add Account</Button>
              </AccountDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No accounts configured.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{account.name}</p>
                      <Badge variant="secondary" className="text-[10px]">{accountTypeLabels[account.type]}</Badge>
                      {!account.isActive && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                    </div>
                    {account.bankName && (
                      <p className="text-xs text-muted-foreground">{account.bankName}{account.accountNumber ? ` ••••${account.accountNumber}` : ""}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-sm">{formatCompact(account.balance, sym)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <CardTitle className="text-sm">Team Members</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                <Badge variant="outline" className="text-xs">{m.role}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Your role */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Your Account</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="secondary">{user.role}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Company</span>
            <span className="font-medium">{user.companyName}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
