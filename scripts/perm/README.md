# ERC-7715 Permission Testing Scripts

**100% following official MetaMask Smart Accounts Kit docs:**
https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/

## Files

### Config Files (JSON)
- `session-account.json` - Session account private key (the delegate)
- `user-config.json` - User private key for testing (the delegator)

### Scripts
- `1-setup-and-request.ts` - Steps 1-5: Setup accounts and create delegation
- `2-redeem-permission.ts` - Steps 6-7: Redeem permission and execute transfer

### Output Files (generated)
- `permissions.json` - Saved at project root after Step 1
- `transfer-result.json` - Saved at project root after Step 2

## Usage

### 1. Generate private keys

```bash
# Generate session account key
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"

# Generate test user key (or use existing funded account)
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configure

Edit `session-account.json`:
```json
{
    "privateKey": "0x...",
    "deploySalt": "0x"
}
```

Edit `user-config.json`:
```json
{
    "userPrivateKey": "0x...",
    "chainId": 11155111
}
```

Ensure `.env` has:
```
PIMLICO_API_KEY=your-key
```

### 3. Run Step 1-5

```bash
npx tsx scripts/perm/1-setup-and-request.ts
```

### 4. Run Step 6-7

```bash
npx tsx scripts/perm/2-redeem-permission.ts
```

## Prerequisites

- User account must be upgraded to MetaMask Smart Account
- User account must have Sepolia USDC tokens
- Pimlico API key for bundler/paymaster
