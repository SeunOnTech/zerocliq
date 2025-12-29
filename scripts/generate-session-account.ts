/**
 * Generate a Session Account for ERC-7715 Advanced Permissions
 * 
 * Run with: npx ts-node scripts/generate-session-account.ts
 * 
 * This creates a new keypair that will be used as the "session account"
 * for receiving delegated permissions from users.
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

// Generate a new random private key
const privateKey = generatePrivateKey()

// Derive the address from the private key
const account = privateKeyToAccount(privateKey)

console.log("\n==========================================")
console.log("  SESSION ACCOUNT GENERATED SUCCESSFULLY")
console.log("==========================================\n")
console.log("Add these to your .env file:\n")
console.log(`SESSION_ACCOUNT_PRIVATE_KEY=${privateKey}`)
console.log(`NEXT_PUBLIC_SESSION_SMART_ACCOUNT_ADDRESS=${account.address}`)
console.log("\n==========================================")
console.log("IMPORTANT: Keep the private key SECRET!")
console.log("Never commit it to version control.")
console.log("==========================================\n")
