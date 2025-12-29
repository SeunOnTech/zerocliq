# ZeroSlip SDK

A simplified TypeScript SDK for the ZeroSlip protocol. Works with Solana Wallet Adapter.

## Setup

The SDK is already installed at `lib/zeroslip/`. 

Make sure you have these dependencies in your project:

```bash
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token @solana/wallet-adapter-react
```

---

## Frontend Usage (React Hook)

```tsx
import { useZeroSlip } from '@/lib/zeroslip/client';

function TradingComponent() {
  const zeroslip = useZeroSlip();

  // Check if wallet is connected
  if (!zeroslip.connected) {
    return <div>Please connect your wallet</div>;
  }

  // Create a fixed price order
  const handleCreateOrder = async () => {
    const result = await zeroslip.createFixedOrder(
      "USDC",   // Token to sell
      "BONK",   // Token to receive
      100,      // Amount (human-readable)
      0.005,    // Price rate
      3600      // Expiry (1 hour)
    );
    console.log("Order created:", result.orderId);
  };

  // Take an order
  const handleTakeOrder = async (orderId: string) => {
    const signature = await zeroslip.takeOrder(orderId, 50, 100); // 1% slippage
    console.log("Trade executed:", signature);
  };

  // Get active orders
  const handleLoadOrders = async () => {
    const orders = await zeroslip.getActiveOrders();
    console.log(orders);
  };

  // Mint test tokens (devnet)
  const handleMintTokens = async () => {
    const signature = await zeroslip.mintTokens("USDC", 1000);
    console.log("Minted:", signature);
  };

  return (
    <div>
      <p>Connected: {zeroslip.publicKey}</p>
      <button onClick={handleCreateOrder}>Create Order</button>
      <button onClick={handleLoadOrders}>Load Orders</button>
      <button onClick={handleMintTokens}>Get Test USDC</button>
    </div>
  );
}
```

---

## Backend Usage (Faucet API)

```typescript
// app/api/faucet/route.ts
import { createServerClient } from '@/lib/zeroslip/client';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { tokenName, recipientAddress, amount } = await req.json();

  // Validate
  if (!['USDC', 'USDT', 'BONK', 'WIF', 'JUP', 'PYTH'].includes(tokenName)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }
  if (amount > 10000) {
    return NextResponse.json({ error: 'Max 10000 per request' }, { status: 400 });
  }

  // Create server client with env keypair
  const client = createServerClient(process.env.SERVER_KEYPAIR!);

  try {
    // Server signs & pays gas, user receives tokens (gasless for user)
    const signature = await client.faucetMint(tokenName, recipientAddress, amount);
    return NextResponse.json({ success: true, signature });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

---

## API Reference

### `useZeroSlip()` (React Hook)

Returns an object with:

| Property | Type | Description |
|----------|------|-------------|
| `connected` | boolean | Whether wallet is connected |
| `publicKey` | string \| null | Connected wallet address |
| `createFixedOrder(tokenA, tokenB, amount, priceRate, expirySeconds)` | Promise | Create fixed price order |
| `createFloatingOrder(tokenA, tokenB, amount, spreadBps, oracleFeed, expirySeconds)` | Promise | Create oracle-priced order |
| `takeOrder(orderId, amount, maxSlippageBps?)` | Promise | Take/fill an order |
| `cancelOrder(orderId)` | Promise | Cancel your order |
| `getActiveOrders()` | Promise | Get all active orders |
| `getOrder(orderId)` | Promise | Get single order details |
| `getMyOrders()` | Promise | Get orders you created |
| `mintTokens(tokenName, amount)` | Promise | Mint test tokens (user pays gas) |
| `getTokenBalance(tokenName)` | Promise | Get your token balance |
| `tokens` | string[] | List of supported tokens |

### The `Order` Object

When you call `getActiveOrders()` or `getOrder()`, you receive an object with rich data ready for your UI:

```typescript
interface Order {
    orderId: string;
    maker: string;
    
    // Rich token objects
    tokenA: { symbol: string; mint: string; decimals: number };
    tokenB: { symbol: string; mint: string; decimals: number };

    amountARemaining: number; // Raw amount left (e.g. 1.5)

    // DISPLAY HELPERS (Use these in your UI!)
    formattedPrice: string;   // e.g. "151.20 USDC" or "Oracle + 1.00%"
    formattedAmount: string;  // e.g. "1.5000 SOL"
    
    // LOGIC FIELDS
    effectivePrice: number;   // Calculated Dollar Price (e.g. 151.20)
    priceRate: number;        // Raw value: fixed price (0.5) OR spread bps (100)
    isFloating: boolean;      // True if price comes from Oracle
    expiryTs: number;
}
```

**Example Usage:**

```tsx
 {orders.map(order => (
    <div key={order.orderId} className="card">
       {/* Token Info */}
       <div className="flex items-center">
          <img src={`/icons/${order.tokenA.symbol}.png`} />
          <span>{order.tokenA.symbol} → {order.tokenB.symbol}</span>
       </div>

       {/* Formatted Data */}
       <p className="price">{order.formattedPrice}</p>
       <p className="avail">Avail: {order.formattedAmount}</p>
       
       {/* Advanced Logic */}
       {order.isFloating && (
          <span className="badge">Dynamic Price</span>
       )}
    </div>
 ))}
```

### `createServerClient(keypairJson)` (Backend)

| Method | Description |
|--------|-------------|
| `faucetMint(tokenName, recipientAddress, amount)` | Mint tokens to user (gasless) |
| `getActiveOrders()` | Get all active orders |

---

## Environment Variables

Add to your `.env.local`:

```bash
# RPC endpoint
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Server keypair (for faucet API)
# Use your Anchor deploy keypair: cat ~/.config/solana/id.json
SERVER_KEYPAIR=[68,21,139,168,...]
```

---

## Supported Tokens (Devnet)

| Token | Decimals |
|-------|----------|
| USDC | 6 |
| USDT | 6 |
| BONK | 5 |
| WIF | 6 |
| JUP | 6 |
| PYTH | 6 |

---

## Program IDs (Devnet)

| Program | ID |
|---------|-----|
| ZeroSlip | `2F7iDmCAWmNg1KS2GEFGteGmuq7LysKYzq5qvgR3z5Sg` |
| MockTokens | `8uZWyqPLTTkWncpTBHmgBbztKcSvcVr8esS5ggagQde` |
