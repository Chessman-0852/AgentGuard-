// frontend/src/lib/api.ts
/**
 * Typed client for interacting with AgentGuard FastAPI backend.
 * Gracefully formats data, sanitizes network errors, and wraps responses.
 */

export interface BoundedIntent {
  intent_id: string;
  agent_id: string;
  idempotency_key: string;
  category: string;
  item_description: string;
  max_amount_paise: number;
  currency: string;
  created_at: string;
  raw_input: string;
}

export interface GateDetail {
  passed: boolean;
  reason?: string | null;
  rule_triggered?: string | null;
  anomaly_score?: number | null;
}

export interface AuditEntryPayload {
  entry_id: number;
  intent_id: string;
  agent_id: string;
  timestamp: string;
  final_decision: "allowed" | "blocked";
  block_reason?: string | null;
  bounded_intent?: BoundedIntent;
  policy_result?: GateDetail;
  cart_result?: GateDetail;
  risk_result?: GateDetail;
  idempotency_result?: GateDetail;
  payment_result?: {
    razorpay_order_id?: string;
    payment_link_url?: string;
    status?: string;
  };
  raw_input?: string;
  amount_inr: number;
  category: string;
  entry_hash?: string;
  prev_hash?: string;
}

export interface AuditListResponse {
  entries: any[];
  count: number;
}

export interface ChainVerificationResponse {
  intact: boolean;
  entries_checked: number;
  message: string;
}

export interface PolicyResponse {
  max_transaction_amount_inr: number;
  max_daily_spend_per_agent_inr: number;
  requires_human_confirmation_above_inr: number;
  allowed_categories: string[];
  max_requests_per_minute_per_agent: number;
  idempotency_key_ttl_seconds: number;
  all_blocked: boolean;
}

export interface AgentSpendResponse {
  agent_id: string;
  date: string;
  daily_spend_paise: number;
  daily_spend_inr: number;
  daily_cap_paise: number;
  daily_cap_inr: number;
  request_count_today: number;
}

export interface IntentResponse {
  intent_id: string;
  status: "allowed" | "blocked";
  block_reason?: string | null;
  block_explanation?: string | null;
  payment_link_url?: string | null;
  razorpay_order_id?: string | null;
  bounded_intent?: any;
}

const API_BASE = "";

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function fetchAuditEntries(limit = 100, offset = 0): Promise<AuditEntryPayload[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/audit?limit=${limit}&offset=${offset}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load audit entries");
    const data: AuditListResponse = await res.json();
    
    return data.entries.map((item) => {
      let parsedPayload: any = {};
      try {
        parsedPayload = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload || {};
      } catch {
        parsedPayload = {};
      }

      const intent = parsedPayload.bounded_intent || {};
      const amountPaise = intent.max_amount_paise || 0;

      return {
        entry_id: item.entry_id,
        intent_id: item.intent_id,
        agent_id: item.agent_id,
        timestamp: item.timestamp,
        final_decision: item.final_decision,
        block_reason: item.block_reason,
        bounded_intent: intent,
        policy_result: parsedPayload.policy_result,
        cart_result: parsedPayload.cart_result,
        risk_result: parsedPayload.risk_result,
        idempotency_result: parsedPayload.idempotency_result,
        payment_result: parsedPayload.payment_result,
        raw_input: parsedPayload.raw_input || intent.raw_input || "Purchase intent",
        amount_inr: amountPaise / 100,
        category: intent.category || "general",
        entry_hash: item.entry_hash,
        prev_hash: item.prev_hash,
      };
    });
  } catch (err) {
    console.warn("Audit log fetch error:", err);
    return [];
  }
}

export async function verifyAuditChain(): Promise<ChainVerificationResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/audit/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Verification failed to execute");
    return await res.json();
  } catch (err: any) {
    return {
      intact: false,
      entries_checked: 0,
      message: err.message || "Failed to complete audit chain verification",
    };
  }
}

export async function fetchPolicy(): Promise<PolicyResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/policy`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchAgentSpend(agentId: string): Promise<AgentSpendResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/agents/${agentId}/spend`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function submitIntent(agentId: string, rawInput: string): Promise<IntentResponse> {
  const res = await fetch(`${API_BASE}/api/v1/intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: agentId,
      raw_input: rawInput,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail?.detail || errData.detail || "Unable to submit intent");
  }

  return await res.json();
}
