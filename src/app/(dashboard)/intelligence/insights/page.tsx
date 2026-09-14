"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Lightbulb, RefreshCw, Bot, User, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Insight {
  summary: string;
  keyDrivers: string[];
  recommendations: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function InsightsPage() {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightSource, setInsightSource] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInsight();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadInsight() {
    setInsightLoading(true);
    try {
      const res = await fetch("/api/ai/insights");
      const data = await res.json();
      if (data.insight) {
        setInsight(data.insight);
        setInsightSource(data.source);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInsightLoading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || chatLoading) return;

    const userMsg: Message = { role: "user", content: inputValue };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inputValue,
          history: messages.slice(-10),
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Unable to connect. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  const SUGGESTED_QUESTIONS = [
    "Why is our cash position declining?",
    "Which customers owe us the most?",
    "What are our biggest expenses?",
    "When could we face a cash shortage?",
  ];

  const riskColors: Record<string, string> = {
    LOW: "text-green-600 bg-green-50",
    MEDIUM: "text-amber-600 bg-amber-50",
    HIGH: "text-orange-600 bg-orange-50",
    CRITICAL: "text-red-600 bg-red-50",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">AI Financial Insights</h1>
        <p className="text-sm text-muted-foreground">
          Management insights and financial assistant powered by your real data
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Management Insight */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Management Insight</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={loadInsight} disabled={insightLoading} className="h-7 text-xs">
                {insightLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {insightLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Analyzing financial data...</span>
              </div>
            ) : insight ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${riskColors[insight.riskLevel]}`}>
                    {insight.riskLevel} RISK
                  </span>
                  {insightSource === "rule-based" && (
                    <span className="text-xs text-muted-foreground">(rule-based analysis)</span>
                  )}
                </div>

                <p className="text-sm leading-relaxed">{insight.summary}</p>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Drivers</p>
                  <ul className="space-y-1">
                    {insight.keyDrivers.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recommendations</p>
                  <ul className="space-y-1">
                    {insight.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">→</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  These are decision-support insights only. Consult a qualified financial advisor before taking action.
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Click Refresh to generate insights.</p>
            )}
          </CardContent>
        </Card>

        {/* AI Assistant */}
        <Card className="flex flex-col h-[520px]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Financial Assistant</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            <ScrollArea className="flex-1 px-4">
              {messages.length === 0 ? (
                <div className="py-4 space-y-3">
                  <p className="text-xs text-muted-foreground text-center">Ask questions about your finances</p>
                  <div className="space-y-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setInputValue(q)}
                        className="w-full text-left text-xs border rounded-md px-3 py-2 hover:bg-accent transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-3 space-y-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}>
                        {msg.content}
                      </div>
                      {msg.role === "user" && (
                        <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
            <Separator />
            <form onSubmit={sendMessage} className="flex gap-2 p-3">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about your finances..."
                className="h-8 text-sm flex-1"
                disabled={chatLoading}
              />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={chatLoading || !inputValue.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
