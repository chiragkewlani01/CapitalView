import { requireAuth } from "@/lib/auth/guards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, TrendingUp, ArrowDownRight, ArrowUpRight } from "lucide-react";

export default async function ReportsPage() {
  const user = await requireAuth();

  const reports = [
    {
      title: "Transaction Report",
      description: "All transactions with category, account, and status details",
      icon: <ArrowDownRight className="h-5 w-5 text-blue-600" />,
      type: "transactions",
      color: "bg-blue-50",
    },
    {
      title: "Receivables Report",
      description: "Customer invoices with payment status and overdue analysis",
      icon: <ArrowUpRight className="h-5 w-5 text-green-600" />,
      type: "receivables",
      color: "bg-green-50",
    },
    {
      title: "Payables Report",
      description: "Vendor bills with payment status and upcoming obligations",
      icon: <ArrowDownRight className="h-5 w-5 text-orange-600" />,
      type: "payables",
      color: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Export your financial data as CSV</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Card key={report.type} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${report.color}`}>
                  {report.icon}
                </div>
                <CardTitle className="text-sm">{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
              <a
                href={`/api/reports?type=${report.type}`}
                download
              >
                <Button variant="outline" size="sm" className="w-full">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">About Reports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Reports are exported as CSV files compatible with Excel, Google Sheets, and other spreadsheet tools.</p>
          <p>All amounts are in the company&apos;s base currency ({user.companyCurrency}).</p>
          <p>For date-filtered reports, use the transactions page filters first and then export.</p>
        </CardContent>
      </Card>
    </div>
  );
}
