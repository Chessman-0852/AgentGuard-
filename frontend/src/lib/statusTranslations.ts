// frontend/src/lib/statusTranslations.ts
/**
 * Single source of truth for all user-facing decision labels, gate names,
 * and block reason explanations. No internal backend terminology (snake_case)
 * reaches any UI component directly.
 */

export interface BlockReasonDetail {
  short: string;        // One-line label for table cell
  headline: string;     // Bold summary for drawer
  explanation: string;  // Plain-English sentence for non-technical users
  moneyMoved: boolean;  // Crucial reassurance
  nextStep: string;     // Actionable guidance
}

export const DECISION_LABELS: Record<string, { label: string; icon: string; style: string }> = {
  allowed: {
    label: "Approved",
    icon: "✓",
    style: "bg-success/10 text-success border-success/30",
  },
  blocked: {
    label: "Blocked",
    icon: "✕",
    style: "bg-danger/10 text-danger border-danger/30",
  },
  pending: {
    label: "Reviewing",
    icon: "○",
    style: "bg-warning/10 text-warning border-warning/30",
  },
};

export const BLOCK_REASON_LABELS: Record<string, BlockReasonDetail> = {
  exceeds_transaction_cap: {
    short: "Over spending limit",
    headline: "Transaction amount exceeds spending cap",
    explanation:
      "This purchase was blocked because the requested amount is higher than the maximum allowed for a single transaction. No money was moved.",
    moneyMoved: false,
    nextStep: "Try a lower purchase amount, or request an adjustment to the transaction limit in the Policy Center.",
  },
  category_not_allowed: {
    short: "Category not permitted",
    headline: "Product category is not authorized",
    explanation:
      "Your agent is not authorized to make purchases in this category. Our strict policy restricts shopping strictly to pre-approved categories. No money was moved.",
    moneyMoved: false,
    nextStep: "Review authorized merchant categories in the Policy Center.",
  },
  confirmation_required: {
    short: "Needs human approval",
    headline: "High-value human approval threshold reached",
    explanation:
      "This purchase amount is above the threshold that can be automatically approved by autonomous agents. A human administrator must verify it before money can move.",
    moneyMoved: false,
    nextStep: "Have an administrator review and approve this order, or adjust the auto-approval threshold.",
  },
  cart_integrity_failure: {
    short: "Cart contents altered",
    headline: "Cart mismatch detected after authorization",
    explanation:
      "The item SKUs, quantities, or prices in the shopping cart were changed between initial authorization and checkout execution. AgentGuard blocked payment to prevent unauthorized charges. No money was moved.",
    moneyMoved: false,
    nextStep: "Submit a new purchase intent with the updated cart items.",
  },
  replay_detected: {
    short: "Duplicate request",
    headline: "Duplicate transaction attempt blocked",
    explanation:
      "This identical purchase request was already submitted or processed. AgentGuard's idempotency guard blocked it to prevent double billing. No money was moved.",
    moneyMoved: false,
    nextStep: "If a new purchase is needed, wait for a new time bucket or submit a distinct order.",
  },
  exceeds_daily_cap: {
    short: "Daily limit reached",
    headline: "Daily cumulative spending limit reached",
    explanation:
      "This AI agent has reached its total allowed expenditure for today. Additional transactions are halted until the daily quota resets. No money was moved.",
    moneyMoved: false,
    nextStep: "Wait until tomorrow for the quota to reset, or increase the daily budget cap.",
  },
  velocity_exceeded: {
    short: "Too many requests",
    headline: "Request rate limit exceeded",
    explanation:
      "This agent dispatched too many purchase requests within a one-minute window. AgentGuard throttled incoming actions to protect against runaway automation loops. No money was moved.",
    moneyMoved: false,
    nextStep: "Wait one minute for the rate limit window to refresh before re-trying.",
  },
  all_blocked: {
    short: "Purchases paused",
    headline: "System-wide purchase freeze active",
    explanation:
      "An administrator has engaged the global kill-switch, temporarily freezing all autonomous transactions across all agents. No money was moved.",
    moneyMoved: false,
    nextStep: "Contact your security administrator to re-enable purchasing.",
  },
};

export const DEFAULT_BLOCK_REASON: BlockReasonDetail = {
  short: "Security policy block",
  headline: "Blocked by deterministic security check",
  explanation: "This transaction did not meet AgentGuard's verification criteria. No money was moved.",
  moneyMoved: false,
  nextStep: "Review the transaction details in the audit log.",
};

export function getBlockReasonDetail(reasonCode?: string | null): BlockReasonDetail {
  if (!reasonCode) return DEFAULT_BLOCK_REASON;
  return BLOCK_REASON_LABELS[reasonCode] || {
    short: reasonCode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    headline: "Transaction prevented by security rule",
    explanation: `The transaction was stopped by rule: ${reasonCode}. No money was moved.`,
    moneyMoved: false,
    nextStep: "Check active security policies for details.",
  };
}

export const GATE_DISPLAY_INFO: Record<
  string,
  { name: string; description: string; passText: string; failText: string }
> = {
  policy: {
    name: "Policy Limits",
    description: "Evaluates max transaction cap, daily budget, and allowed product categories.",
    passText: "Within policy bounds",
    failText: "Policy rule violated",
  },
  cart: {
    name: "Cart Verification",
    description: "Cryptographically verifies price and item integrity against initial authorization snapshot.",
    passText: "Items & prices verified",
    failText: "Cart tampering detected",
  },
  risk: {
    name: "Risk Assessment",
    description: "Evaluates anomaly deviation against historic transaction baseline.",
    passText: "Normal risk profile",
    failText: "Elevated anomaly risk",
  },
  idempotency: {
    name: "Replay Protection",
    description: "Ensures identical intents cannot trigger duplicate charges or cross-agent replaying.",
    passText: "Unique intent",
    failText: "Duplicate replay blocked",
  },
  payment: {
    name: "Payment Gateway",
    description: "Secures authorized test-mode checkout execution with Razorpay.",
    passText: "Payment link created",
    failText: "Execution halted",
  },
};

export const STATUS_PIPELINE_LABELS: Record<string, string> = {
  RECEIVED: "Request received",
  PARSED: "Intent parsed",
  POLICY_CHECKED: "Policy check completed",
  CART_VERIFIED: "Cart verified",
  RISK_CHECKED: "Risk assessed",
  AUTHORIZED: "Transaction authorized",
  EXECUTING: "Processing payment",
  PAYMENT_PENDING: "Payment pending",
  PAID: "Payment complete",
  REJECTED_POLICY: "Blocked by policy",
  REJECTED_CART: "Blocked — cart altered",
  REJECTED_REPLAY: "Blocked — duplicate request",
  REJECTED_EXPIRED: "Blocked — intent expired",
  REJECTED_INVALID: "Blocked — invalid intent",
  PAYMENT_FAILED: "Payment failed",
};
