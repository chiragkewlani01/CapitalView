import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildFinancialContext, formatContextForAI } from "@/lib/ai/context-builder";
import { formatCompact } from "@/lib/calculations";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as Record<string, unknown>;
    const companyId = user.companyId as string;
    if (!companyId) {
      return NextResponse.json({ error: "No company" }, { status: 400 });
    }

    const ctx = await buildFinancialContext(companyId);
    const sym = ctx.company.currencySymbol;

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return rule-based insight when AI is not available
      const insight = generateRuleBasedInsight(ctx, sym);
      return NextResponse.json({ insight, source: "rule-based" });
    }

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const contextText = formatContextForAI(ctx);

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a financial analyst assistant for ${ctx.company.name}. 
Analyze the provided financial data and generate a concise management insight.

Structure your response as JSON with these fields:
{
  "summary": "2-3 sentence executive summary of cash position",
  "keyDrivers": ["driver1", "driver2", "driver3"],
  "recommendations": ["action1", "action2", "action3"],
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}

IMPORTANT: These are decision-support insights, not guaranteed financial advice. Keep it factual and data-driven.`,
        },
        {
          role: "user",
          content: contextText,
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No AI response");

    const insight = JSON.parse(content);
    return NextResponse.json({ insight, source: "openai" });
  } catch (error) {
    console.error("AI insights error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights. Please try again." },
      { status: 500 }
    );
  }
}

function generateRuleBasedInsight(
  ctx: Awaited<ReturnType<typeof buildFinancialContext>>,
  sym: string
): Record<string, unknown> {
  const { currentCash, receivablesSummary, payablesSummary, forecast30, topRisks } = ctx;
  const fmt = (a: bigint) => formatCompact(a, sym);

  const cashTrend =
    forecast30 && forecast30.projectedEndingCash > currentCash ? "improving" : "declining";

  const summary = `${ctx.company.name} currently holds ${fmt(currentCash)} in cash. 
The 30-day forecast shows a ${cashTrend} trend with projected ending balance of ${fmt(forecast30?.projectedEndingCash ?? 0n)}.
${receivablesSummary.overdue > 0n ? `${fmt(receivablesSummary.overdue)} in receivables is overdue and requires immediate follow-up.` : "Receivables collection appears on track."}`;

  const keyDrivers = [];
  if (receivablesSummary.overdue > 0n) keyDrivers.push(`${fmt(receivablesSummary.overdue)} overdue receivables reducing projected cash`);
  if (payablesSummary.dueThisMonth > 0n) keyDrivers.push(`${fmt(payablesSummary.dueThisMonth)} in payables due this month`);
  if (topRisks.length > 0) keyDrivers.push(topRisks[0].title);
  if (keyDrivers.length < 2) keyDrivers.push("Monitor expense categories for cost optimization opportunities");

  const recommendations = [
    receivablesSummary.overdue > 0n
      ? `Follow up on ${fmt(receivablesSummary.overdue)} in overdue receivables`
      : "Continue monitoring receivables for early payment patterns",
    payablesSummary.dueThisWeek > 0n
      ? `Ensure ${fmt(payablesSummary.dueThisWeek)} in payables due this week are scheduled`
      : "No immediate payable obligations this week",
    "Review the 90-day forecast scenarios for contingency planning",
  ];

  const riskLevel =
    topRisks.some((r) => r.severity === "CRITICAL") ? "CRITICAL"
      : topRisks.some((r) => r.severity === "WARNING") ? "MEDIUM"
      : "LOW";

  return { summary, keyDrivers, recommendations, riskLevel };
}
