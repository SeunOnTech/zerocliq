/**
 * ZeroSlip Server Client
 * 
 * Server-only client for backend operations like faucet.
 * This file has NO React dependencies and is safe to use in API routes.
 */

import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Embedded IDL
import mockTokensIdl from "./idl/mock_tokens.json";

// ============================================================================
// CONFIGURATION
// ============================================================================

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

const MOCK_TOKENS_PROGRAM_ID = new PublicKey("DErDBoxAceabitCjvCrKrd8xeVDQdpuoeTA28gVkPkRK");

// Token configuration: name -> { decimals }
// Mints are derived from PDA seeds ["mint", name]
const TOKENS: Record<string, { decimals: number }> = {
    USDC: { decimals: 6 },
    USDT: { decimals: 6 },
    BONK: { decimals: 5 },
    WIF: { decimals: 6 },
    JUP: { decimals: 6 },
    PYTH: { decimals: 6 },
    SOL: { decimals: 9 },
};

/**
 * Derive mint PDA from token name
 */
function getMintPDA(tokenName: string): PublicKey {
    const [mint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), Buffer.from(tokenName)],
        MOCK_TOKENS_PROGRAM_ID
    );
    return mint;
}

// ============================================================================
// SERVER CLIENT
// ============================================================================

/**
 * Create a server-side client for backend operations like faucet.
 * 
 * @example
 * ```typescript
 * // In your API route
 * import { createServerClient } from '@/lib/zerocliq/server';
 * 
 * const client = createServerClient(process.env.SERVER_KEYPAIR!);
 * await client.faucetMint("USDC", userAddress, 1000);
 * ```
 */
export function createServerClient(keypairJson: string) {
    const secretKey = JSON.parse(keypairJson);
    const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    const connection = new Connection(RPC_URL);

    const provider = new AnchorProvider(
        connection,
        {
            publicKey: keypair.publicKey,
            signTransaction: async (tx) => {
                if ('partialSign' in tx) {
                    tx.partialSign(keypair);
                }
                return tx;
            },
            signAllTransactions: async (txs) => {
                for (const tx of txs) {
                    if ('partialSign' in tx) {
                        tx.partialSign(keypair);
                    }
                }
                return txs;
            },
        },
        { commitment: "confirmed" }
    );

    const mockTokensProgram = new Program(mockTokensIdl as Idl, provider);

    return {
        /**
         * Gasless faucet mint - server pays gas, user receives tokens
         */
        async faucetMint(tokenName: string, recipientAddress: string, amount: number): Promise<string> {
            const tokenUpper = tokenName.toUpperCase();
            const tokenInfo = TOKENS[tokenUpper];
            if (!tokenInfo) throw new Error(`Token ${tokenName} not found`);

            const recipient = new PublicKey(recipientAddress);
            const rawAmount = new BN(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));

            // Derive mint PDA from token name
            const mint = getMintPDA(tokenUpper);

            // Get recipient's ATA
            const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipient, true);

            // Call faucet_mint with correct accounts matching the IDL
            const signature = await (mockTokensProgram.methods as any)
                .faucetMint(rawAmount, tokenUpper)
                .accounts({
                    payer: keypair.publicKey,
                    recipient: recipient,
                    mint: mint,
                    recipientTokenAccount: recipientTokenAccount,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();

            return signature;
        },

        /**
         * Get token info by name
         */
        getTokenInfo(tokenName: string) {
            return TOKENS[tokenName.toUpperCase()];
        },
    };
}
