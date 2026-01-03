# ZeroCliq: The "Zero Click" DeFi Intelligence Layer

**Imagine an AI agent that manages your portfolio while you sleep—without you ever handing over your private keys.**

ZeroCliq bridges the gap between **Artificial Intelligence** and **On-Chain Security**.
We realized that for AI to be useful in DeFi, it needs more than just intelligence; it needs *safe autonomy*.

By combining **MetaMask Advanced Permissions (ERC-7715)** with our unique **"Card Stack" Architecture**, we created a safer way to use AI.

**The Application has two distinct layers:**
1.  **The AI Brain (Interface):** You chat naturally with ZeroCliq to define your goals ("Buy ETH every week").
2.  **The Card Stack (Infrastructure):** Virtual, isolated sub-accounts that actually hold the funds and permission to execute those goals.

*   **You Declare the Intent:** The AI parses your request into a structured plan.
*   **You Sign Once:** Authorizing a specific Card Stack with a strict budget.
*   **The Agent Executes:** Safely contained within that stack, forever.

---

## The Problem
**"Why do I have to sign 5 times just to buy the dip?"**

DeFi has a friction problem. Users are overwhelmed by:
*   **Constant Signing:** Every approval, swap, and bridge requires a manual confirmation.
*   **Complexity:** Managing gas fees, slippage, and chain switching is a full-time job.
*   **Fragility:** If you miss a price movement by 5 minutes, you lose money.

## ⚡ The Solution
ZeroCliq inverts the model. You don't execute transactions; you **declare intents**.
*   *"DCA $500 into ETH over 2 weeks"*
*   *"Buy PEPE if it drops 10%"*
*   *"Pay my Netflix subscription with USDC"*

Our AI Agent parses these natural language requests and converts them into precise, on-chain execution plans. The user signs **once** (via ERC-7715 Advanced Permissions), and the agent handles the rest forever.

## Core Technology: The "Agentic Brain"
How do we turn "buy ETH" into a signed transaction?

### 1. Sub-Second Intelligence (Groq LPU™)
Speed is trust. We use **Groq's LPU** inference engine to parse user intents in **<300ms**.
*   *Why?* If an agent takes 5 seconds to "think", the user leaves. ZeroCliq feels instant.

### 2. Structured Intent Parsing
The `IntentParser` is the bridge between fuzzy human language and strict parameters.
*   **Input:** "DCA $500 into ETH over 2 weeks"
*   **Output:**
    ```json
    {
      "type": "DCA",
      "frequency": 604800, // 1 week in seconds
      "asset": "0xC02...cc2", // WETH Address
      "amount": "500000000" // USDC (6 decimals)
    }
    ```

### 3. "Flight Plan" Verification
Autonomy requires consent. Before any permission is signed, the **Intent Execution Modal** presents a clear, human-readable "Flight Plan".
*   You approve the specific constraints (e.g., "Max spend: 1000 USDC").

## Phase 3: Card Stacks (The Architecture)
**A Revolutionary "Sandbox" Model for Safe Automation**

ZeroCliq introduces **Card Stacks**, a novel architectural pattern that solves the "Agent Safety" problem.
Instead of giving an AI agent unrestricted access to your main wallet (EOA), you create isolated "Sandboxes" for specific tasks.

### 1. The Stack Structure (Technical Breakdown)
A "Card Stack" is not just a UI element; it is a cryptographic container defined by:
*   **The Budget:** A strict ERC-20 spending limit (e.g., 500 USDC).
*   **The Expiry:** A hardcoded end date (e.g., "Valid for 30 Days").
*   **The Permission:** A unique **Function-Scoped Session Key (ERC-7715)** that authorizes specific function calls (e.g., `swap()`) on specific contracts (e.g., Uniswap Router).

### 2. Multi-Strategy Capabilities
A single Stack can manage multiple "Sub-Cards" (Strategies), all sharing the same secure budget:
*   **The Accumulator (DCA):**
    *   *Logic:* Buys $X of Token Y every Z seconds.
    *   *Use Case:* "DCA $50 into ETH every Friday."
*   **The Sniper (Limit Orders):**
    *   *Logic:* Monitors price feeds (via Envio Indexer) and executes when Target Price is hit.
    *   *Use Case:* "Buy PEPE if it drops 15%."
*   **The Payer (Subscriptions):**
    *   *Logic:* Executes recurring stablecoin transfers to merchant addresses.
    *   *Use Case:* "Pay my Netflix ($15) and Gym ($50) monthly."

### 3. The "Kill Switch" Security
Because every stack is powered by a specific delegation:
*   **Granular Revocation:** You can "Kill" your Meme Coin Stack while keeping your Stablecoin Savings Stack running.
*   **Zero-Liability:** If the Agent's EOA key is leaked, the attacker **cannot** drain your main wallet. They can only execute the *specific* strict actions defined in the active stacks (which are capped by your budget).

**This is the missing link between "Cool AI Demo" and "Safe Financial Product."**

## Advanced Permissions (The Engine)
**"One Signature, Infinite Control"**

While the AI provides the *brains*, **MetaMask Advanced Permissions (ERC-7715)** provide the *muscle*.
This is the engine that allows ZeroCliq to be **Non-Custodial** yet **Autonomous**.

### How it Works (The "Grant & Execute" Loop)
1.  **The Request (Safe):** The AI proposes a permission structure (e.g., "Allow me to spend 100 USDC on Uniswap for 30 days"). The user signs this *once* in MetaMask.
2.  **The Execution (Trustless):** When the AI wants to execute a trade, it bundles the **User's Signature** with the transaction. The Smart Account verifies the signature on-chain and only executes if the constraints (Budget, Time, Token) are met.

> **Hackathon Track Integration: Advanced Permissions**
> We didn't just use permissions; we built an entire **Permission Orchestration Layer**.

#### 1. The Request Layer (Client-Side)
*   **[Permission Builder](lib/server/services/permission-builder.service.ts)**
    *   *See `permission-builder.service.ts`*: Our custom builder that constructs complex `erc20-token-stream` parameters with precise `period`, `maxAmount`, and `tokenAddress`.
*   **[UI Integration](components/features/ai/IntentExecutionModal.tsx)**
    *   *See `IntentExecutionModal.tsx`*: The production-grade UI where the `wallet_grantPermissions` RPC method is triggered via the intent flow.

#### 2. The Execution Layer (Server-Side)
This is where the magic happens. We implemented multiple "Redemption Engines" for different strategies:
*   **[DCA Engine](lib/server/services/dca.service.ts)**
    *   *See `dca.service.ts`*: Leverages `sendUserOperationWithDelegation` to execute Dollar-Cost Averaging swaps.
*   **[Subscription Engine](lib/server/services/subscription.service.ts)**
    *   *See `subscription.service.ts`*: Uses the same permission to execute recurring payments (e.g., Netflix), proving the versatility of the session key.

#### 3. The Enforcement Layer (Safety)
*   **[Spending Guardrails](lib/server/services/spending-limit.service.ts)**
    *   *See `spending-limit.service.ts`*: An additional safety layer that tracks daily limits and "Remaining Allowance" to prevent over-spending even if the permission allows it.

## Phase 5: Envio Intelligence (The Eyes)
**Real-Time "Proof of Automation"**

To give users confidence, we simply cannot "fire and forget" transactions. We need to show them exactly what the AI is doing.
We deployed a custom **HyperIndex** on Envio (separate repository) to track every action performed by the Smart Account.

> **Hackathon Track Integration: Envio**

#### 1. The Indexer (External Repo)
*   **[Indexer Logic (EventHandlers.ts)](https://github.com/SeunOnTech/zerocliq-indexer/blob/main/src/EventHandlers.ts)**
    *   *See `EventHandlers.ts`*: We track `UserOperationEvent` to calculate "Total Gas Saved" and "Sponsorship Volume" in real-time.
*   **[Schema Definition (schema.graphql)](https://github.com/SeunOnTech/zerocliq-indexer/blob/main/schema.graphql)**
    *   *See `schema.graphql`*: We defined custom entities like `Account`, `Paymaster`, and `HourlyStat` to build our analytics dashboard.

#### 2. The User Interface (Internal Integration)
*   **[Global Command Bar](components/features/envio/GlobalCommandBar.tsx)**
    *   *See `GlobalCommandBar.tsx`*: The "Command Bar" connects to the Envio GraphQL endpoint to visualize the "Pulse" of the network and display the live activity feed.
*   **[Hybrid Data Engine](components/features/envio/PaymasterLeaderboard.tsx)**
    *   *See `PaymasterLeaderboard.tsx`*: A sophisticated data layer that blends off-chain simulation with on-chain indexer data to ensure the demo is always populated, even on testnets with low volume.

## The Journey (Social Media)
**Building in Public**

We believe the best way to learn is to share. We documented our entire "Zero to Hero" journey building ZeroCliq to inspire others to adopt ERC-7715.

> **Hackathon Track Integration: Best Social Media Presence**

*   **[📱 The ZeroCliq Thread (X/Twitter)](INSERT_LINK_HERE)**
    *   **The Story:** How we moved from a "Manual DeFi" mindset to an "Agentic" one.
    *   **The Struggle:** Overcoming the complexity of encoding `redeemDelegations` cleanly.
    *   **The Win:** Showcasing the "Hybrid Intelligence" UI connected to Envio.
    *   **The Community:** We engaged with **@MetaMaskDev** and the Linea community to gather feedback.

---