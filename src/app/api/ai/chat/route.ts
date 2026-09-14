import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildFinancialContext, formatContextForAI } from "@/lib/ai/context-builder";
import { z } from "zod";

const chatSchema = z.object({
  message: z.string().min(1).max(500),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).max(20).optional().default([]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as Record<string, unknown>;
    const companyId = user.companyId as string;
    if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

    const body = await req.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { message, history } = parsed.data;
    const ctx = await buildFinancialContext(companyId);
    const contextText = formatContextForAI(ctx);

    if (!process.env.OPENAI_API_KEY) {
      // Rule-based fallback responses
      const reply = getRuleBasedResponse(message.toLowerCase(), ctx);
      return NextResponse.json({ reply, source: "rule-based" });
    }

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = [
      {
        role: "system" as const,
        content: `You are CashFlowIQ, a financial assistant for ${ctx.company.name}.
You help answer questions about the company's cash flow, finances, and forecasts.
Use the financial context below to answer questions accurately.
Keep responses concise (2-4 sentences). Always mention specific numbers from the data.
Do not make up data not in the context. Caveat that recommendations are decision-support only.

FINANCIAL CONTEXT:
${contextText}`,
      },
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user" as const, content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages,
      temperature: 0.4,
      max_tokens: 400,
    });

    const reply = completion.choices[0]?.message?.content ?? "I couldn't generate a response.";
    return NextResponse.json({ reply, source: "openai" });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Chat unavailable. Please try again." }, { status: 500 });
  }
}

function getRuleBasedResponse(
  message: string,
  ctx: Awaited<ReturnType<typeof buildFinancialContext>>
): string {
  const { currentCash, receivablesSummary, payablesSummary, forecast30, topRisks, company } = ctx;
  const sym = company.currencySymbol;
  const fmt = (a: bigint) => {
    const v = Number(a) / 100;
    if (v >= 10_000_000) return `${sym}${(v / 10_000_000).toFixed(2)}Cr`;
    if (v >= 100_000) return `${sym}${(v / 100_000).toFixed(2)}L`;
    return `${sym}${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  if (message.includes("cash") && (message.includes("balance") || message.includes("position"))) {
    return `Current cash balance is ${fmt(currentCash)} across all accounts. The 30-day forecast projects ${fmt(forecast30?.projectedEndingCash ?? 0n)}.`;
  }
  if (message.includes("receivable") || message.includes("owed") || message.includes("invoice")) {
    return `Outstanding receivables total ${fmt(receivablesSummary.total)}, of which ${fmt(receivablesSummary.overdue)} is overdue. ${receivablesSummary.dueThisMonth > 0n ? `${fmt(receivablesSummary.dueThisMonth)} is expected this month.` : ""}`;
  }
  if (message.includes("payable") || message.includes("bill") || message.includes("owe")) {
    return `Outstanding payables total ${fmt(payablesSummary.total)}, with ${fmt(payablesSummary.dueThisWeek)} due this week.`;
  }
  if (message.includes("forecast") || message.includes("90") || message.includes("30 day")) {
    const shortage = forecast30?.cashShortageDate;
    return `30-day forecast shows projected cash of ${fmt(forecast30?.projectedEndingCash ?? 0n)}. ${shortage ? `⚠️ Cash shortage projected on ${shortage.toLocaleDateString("en-IN")}.` : "No cash shortage detected in the next 30 days."}`;
  }
  if (message.includes("risk")) {
    if (topRisks.length === 0) return "No active risks detected. Your cash position appears healthy.";
    return `${topRisks.length} active risk(s) detected. Most critical: ${topRisks[0].title} — ${topRisks[0].description}`;
  }
  if (message.includes("expense") || message.includes("spend") || message.includes("cost")) {
    const top = ctx.topExpenseCategories[0];
    return top
      ? `Your largest expense category is ${top.name} at ${fmt(top.amount)} over the last 6 months.`
      : "No expense data available for the current period.";
  }

  return `I can help with questions about your cash balance (${fmt(currentCash)}), receivables (${fmt(receivablesSummary.total)} outstanding), payables (${fmt(payablesSummary.total)} outstanding), and financial forecasts. What would you like to know?`;
}
