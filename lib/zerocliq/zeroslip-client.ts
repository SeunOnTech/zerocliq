/**
 * Zerocliq SDK - Main Client
 * 
 * A self-contained TypeScript helper class for interacting with the Zerocliq protocol.
 * Copy this entire sdk/ folder to your Next.js project for frontend/backend integration.
 * 
 * @example
 * ```typescript
 * // Frontend usage with wallet adapter
 * import { ZerocliqClient } from '@/lib/zerocliq/zeroslip-client';
 * 
 * const client = new ZerocliqClient(connection, wallet, 'devnet');
 * await client.createFixedOrder("USDC", "SOL", 100, 0.005, 3600);
 * ```
 * 
 * @example
 * ```typescript
 * // Backend usage with server keypair
 * import { ZerocliqClient } from '@/lib/zerocliq/zeroslip-client';
 * import { Keypair } from '@solana/web3.js';
 * 
 * const serverWallet = Keypair.fromSecretKey(...)
 * const client = new ZerocliqClient(connection, serverWallet, 'devnet');
 * await client.faucetMint("USDC", userAddress, 1000);
 * ```
 */

import { Connection, PublicKey, Keypair, SystemProgram, ComputeBudgetProgram, TransactionInstruction } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";

import {
    NetworkType,
    PROGRAM_IDS,
    PROTOCOL_CONFIG,
    TOKENS,
    PYTH_FEEDS,
    TokenInfo,
    getNetworkConfig,
    getTokenInfo,
    getTokenByMint,
    getPythFeed,
    getAllTokenNames,
    getAllPythPairs,
} from "./constants";

// Re-export types and constants for convenience
export type { NetworkType, TokenInfo } from "./constants";
export { getNetworkConfig, getTokenInfo, getTokenByMint, getPythFeed, getAllTokenNames, getAllPythPairs, PYTH_RECEIVER_PROGRAM_IDS } from "./constants";

// ============================================================================
// WALLET INTERFACE
// ============================================================================

/**
 * Wallet interface compatible with browser wallet adapters and Keypair
 */
export interface WalletAdapter {
    publicKey: PublicKey;
    signTransaction?: <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(tx: T) => Promise<T>;
    signAllTransactions?: <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(txs: T[]) => Promise<T[]>;
}

// ============================================================================
// MAIN CLIENT CLASS
// ============================================================================

/**
 * Zerocliq Client - Main SDK class for interacting with the Zerocliq protocol.
 * 
 * This client provides a high-level, user-friendly API for:
 * - Creating and managing orders (makers)
 * - Taking orders (takers)
 * - Minting mock tokens (faucet)
 * - Querying orders and balances
 */
export class ZerocliqClient {
    // Network and connection
    public readonly network: NetworkType;
    public readonly connection: Connection;

    // Wallet
    public readonly wallet: WalletAdapter;

    // Dynamic getter to handle wallet state
    get publicKey(): PublicKey {
        if (!this.wallet.publicKey) {
            throw new Error("Wallet not connected");
        }
        return this.wallet.publicKey;
    }

    // Anchor provider
    private provider: AnchorProvider;

    // Programs (loaded lazily)
    private _zeroslipProgram: Program | null = null;
    private _mockTokensProgram: Program | null = null;

    // Configuration
    public readonly programIds: typeof PROGRAM_IDS.devnet;
    public readonly protocolConfig: typeof PROTOCOL_CONFIG.devnet;
    public readonly tokens: typeof TOKENS.devnet;
    public readonly pythFeeds: typeof PYTH_FEEDS.devnet;
    public readonly hermesUrl: string;
    public readonly pythReceiverProgramId: PublicKey;

    /**
     * Create a new ZeroSlip client instance.
     * 
     * @param connection - Solana RPC connection
     * @param wallet - Wallet adapter (browser) or Keypair (server)
     * @param network - Network to use ('devnet' or 'mainnet')
     * 
     * @example
     * ```typescript
     * // Browser with wallet adapter
     * const client = new ZeroSlipClient(connection, wallet, 'devnet');
     * 
     * // Server with Keypair
     * const keypair = Keypair.fromSecretKey(...);
     * const client = new ZeroSlipClient(connection, keypair, 'devnet');
     * ```
     */
    constructor(
        connection: Connection,
        wallet: WalletAdapter | Keypair,
        network: NetworkType = "devnet",
        hermesUrl: string = "https://hermes.pyth.network"
    ) {
        this.connection = connection;
        this.network = network;

        // Handle both Keypair and wallet adapter
        if (wallet instanceof Keypair) {
            this.wallet = {
                publicKey: wallet.publicKey,
                signTransaction: async <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(tx: T): Promise<T> => {
                    // Legacy Transaction
                    if ('signatures' in tx && 'feePayer' in tx) {
                        (tx as import("@solana/web3.js").Transaction).partialSign(wallet);
                    }
                    // VersionedTransaction
                    else if ('sign' in tx) {
                        (tx as import("@solana/web3.js").VersionedTransaction).sign([wallet]);
                    }
                    return tx;
                },
                signAllTransactions: async <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(txs: T[]): Promise<T[]> => {
                    for (const tx of txs) {
                        if ('signatures' in tx && 'feePayer' in tx) {
                            (tx as import("@solana/web3.js").Transaction).partialSign(wallet);
                        } else if ('sign' in tx) {
                            (tx as import("@solana/web3.js").VersionedTransaction).sign([wallet]);
                        }
                    }
                    return txs;
                },
            };
        } else {
            this.wallet = wallet;
        }

        this.publicKey = this.wallet.publicKey;

        // Create Anchor provider
        this.provider = new AnchorProvider(
            connection,
            this.wallet as Wallet,
            { commitment: "confirmed" }
        );

        // Load configuration for network
        const config = getNetworkConfig(network);
        this.programIds = config.programIds;
        this.protocolConfig = config.protocolConfig;
        this.tokens = config.tokens;
        this.pythFeeds = config.pythFeeds;

        // Default Hermes URL based on network if not provided
        if (hermesUrl === "https://hermes.pyth.network" && network === "devnet") {
            this.hermesUrl = "https://hermes-beta.pyth.network";
        } else {
            this.hermesUrl = hermesUrl;
        }

        // Pyth Solana Receiver Program ID
        this.pythReceiverProgramId = config.pythReceiver;
    }

    // ==========================================================================
    // PROGRAM ACCESSORS (Lazy Loading)
    // ==========================================================================

    /**
     * Get the ZeroSlip program instance.
     * Programs are loaded lazily to avoid requiring IDL at construction time.
     */
    get zeroslipProgram(): Program {
        if (!this._zeroslipProgram) {
            // IDL will be loaded dynamically or embedded
            // For now, throw error - will be implemented in next phase
            throw new Error("ZeroSlip program not initialized. Call initializePrograms() first.");
        }
        return this._zeroslipProgram;
    }

    /**
     * Get the MockTokens program instance.
     */
    get mockTokensProgram(): Program {
        if (!this._mockTokensProgram) {
            throw new Error("MockTokens program not initialized. Call initializePrograms() first.");
        }
        return this._mockTokensProgram;
    }

    /**
     * Initialize programs with IDLs.
     * Call this before using order or token methods.
     * 
     * @param zeroslipIdl - ZeroSlip program IDL
     * @param mockTokensIdl - MockTokens program IDL (optional, for faucet)
     */
    initializePrograms(zeroslipIdl: any, mockTokensIdl?: any): void {
        this._zeroslipProgram = new Program(
            zeroslipIdl,
            this.provider
        );

        if (mockTokensIdl) {
            this._mockTokensProgram = new Program(
                mockTokensIdl,
                this.provider
            );
        }
    }

    // ==========================================================================
    // TOKEN UTILITIES
    // ==========================================================================

    /**
     * Get token info by name (e.g., "USDC", "BONK")
     * 
     * @param tokenName - Token name
     * @returns Token info or undefined if not found
     */
    getToken(tokenName: string): TokenInfo | undefined {
        return getTokenInfo(this.network, tokenName);
    }

    /**
     * Get token info by mint address
     * 
     * @param mint - Token mint public key
     * @returns Token info or undefined if not found
     */
    getTokenByMint(mint: PublicKey): TokenInfo | undefined {
        return getTokenByMint(this.network, mint);
    }

    /**
     * Get all supported token names
     * 
     * @returns Array of token names
     */
    getAllTokens(): string[] {
        return getAllTokenNames(this.network);
    }

    // ==========================================================================
    // ORACLE UTILITIES
    // ==========================================================================

    /**
     * Get Pyth oracle feed info by pair name (e.g., "SOL/USD")
     * 
     * @param pair - Price pair (e.g., "SOL/USD", "BONK/USD")
     * @returns Feed info with feedId and feedBytes
     */
    getPythFeed(pair: string) {
        return getPythFeed(this.network, pair);
    }

    /**
     * Get all supported Pyth price pairs
     * 
     * @returns Array of price pair names
     */
    getAllPythPairs(): string[] {
        return getAllPythPairs(this.network);
    }

    // ==========================================================================
    // PDA DERIVATION
    // ==========================================================================

    /**
     * Derive Protocol Config PDA
     */
    deriveProtocolConfigPDA(): PublicKey {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("protocol_config")],
            this.programIds.zeroslip
        );
        return pda;
    }

    /**
     * Derive Order State PDA
     * 
     * @param maker - Maker's public key
     * @param mintA - Token A mint
     * @param mintB - Token B mint
     * @param seed - Unique seed (BN or number)
     */
    deriveOrderStatePDA(
        maker: PublicKey,
        mintA: PublicKey,
        mintB: PublicKey,
        seed: BN | number
    ): PublicKey {
        const seedBN = typeof seed === "number" ? new BN(seed) : seed;
        const [pda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("order_state"),
                maker.toBuffer(),
                mintA.toBuffer(),
                mintB.toBuffer(),
                seedBN.toArrayLike(Buffer, "le", 8),
            ],
            this.programIds.zeroslip
        );
        return pda;
    }

    /**
     * Derive token mint PDA for mock tokens
     * 
     * @param tokenName - Token name (e.g., "USDC", "BONK")
     */
    deriveMockTokenMintPDA(tokenName: string): PublicKey {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint"), Buffer.from(tokenName)],
            this.programIds.mockTokens
        );
        return pda;
    }

    /**
     * Derive Vault ATA for an Order
     * 
     * The vault is an Associated Token Account owned by the order PDA.
     * 
     * @param orderState - Order state PDA
     * @param mintA - Token A mint
     * @returns Vault ATA address
     */
    async deriveVaultPDA(orderState: PublicKey, mintA: PublicKey): Promise<PublicKey> {
        return this.getATA(mintA, orderState);
    }

    /**
     * Parse Pyth Feed ID from Hex String to Byte Array
     * 
     * Converts a hex string feed ID to a 32-byte array for on-chain use.
     * 
     * @param hexString - Hex string (with or without 0x prefix)
     * @returns 32-byte array
     * 
     * @example
     * ```typescript
     * const feedBytes = ZeroSlipClient.parsePythFeedId("0xef0d8b6fda2c...");
     * ```
     */
    static parsePythFeedId(hexString: string): number[] {
        const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
        if (cleanHex.length !== 64) {
            throw new Error(`Invalid Pyth feed ID: expected 64 hex chars, got ${cleanHex.length}`);
        }
        const bytes: number[] = [];
        for (let i = 0; i < cleanHex.length; i += 2) {
            bytes.push(parseInt(cleanHex.slice(i, i + 2), 16));
        }
        return bytes;
    }

    /**
     * Format Pyth Feed ID Bytes to Hex String
     * 
     * @param feedBytes - 32-byte array
     * @returns Hex string with 0x prefix
     */
    static formatPythFeedId(feedBytes: number[]): string {
        return "0x" + feedBytes.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    // ==========================================================================
    // AMOUNT CONVERSION UTILITIES
    // ==========================================================================

    /**
     * Convert human-readable amount to raw token amount
     * 
     * @param tokenName - Token name
     * @param amount - Human-readable amount (e.g., 100 USDC)
     * @returns Raw amount as BN
     */
    toRawAmount(tokenName: string, amount: number): BN {
        const token = this.getToken(tokenName);
        if (!token) {
            throw new Error(`Token ${tokenName} not found`);
        }
        const multiplier = Math.pow(10, token.decimals);
        return new BN(Math.floor(amount * multiplier));
    }

    /**
     * Convert raw token amount to human-readable amount
     * 
     * @param tokenName - Token name
     * @param rawAmount - Raw amount (BN or number)
     * @returns Human-readable amount
     */
    toHumanAmount(tokenName: string, rawAmount: BN | number): number {
        const token = this.getToken(tokenName);
        if (!token) {
            throw new Error(`Token ${tokenName} not found`);
        }
        const raw = typeof rawAmount === "number" ? rawAmount : rawAmount.toNumber();
        return raw / Math.pow(10, token.decimals);
    }

    /**
     * Convert price rate to scaled format (multiply by 1,000,000)
     * 
     * @param priceRate - Human price rate (e.g., 0.005 SOL per USDC)
     * @returns Scaled price rate as BN
     */
    toPriceRate(priceRate: number): BN {
        return new BN(Math.floor(priceRate * 1_000_000));
    }

    /**
     * Convert scaled price rate to human-readable format
     * 
     * @param scaledRate - Scaled price rate (BN or number)
     * @returns Human-readable price rate
     */
    fromPriceRate(scaledRate: BN | number): number {
        const rate = typeof scaledRate === "number" ? scaledRate : scaledRate.toNumber();
        return rate / 1_000_000;
    }

    // ==========================================================================
    // ATA UTILITIES
    // ==========================================================================

    /**
     * Get Associated Token Address for a wallet and mint
     */
    async getATA(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
        return getAssociatedTokenAddress(mint, owner, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    }

    /**
     * Get token balance for an address
     * 
     * @param tokenName - Token name
     * @param address - Wallet address
     * @returns Balance as human-readable number, or 0 if account doesn't exist
     */
    async getTokenBalance(tokenName: string, address: PublicKey): Promise<number> {
        const token = this.getToken(tokenName);
        if (!token) {
            throw new Error(`Token ${tokenName} not found`);
        }

        try {
            const ata = await this.getATA(token.mint, address);
            const balance = await this.connection.getTokenAccountBalance(ata);
            return Number(balance.value.uiAmount || 0);
        } catch {
            return 0;
        }
    }

    // ==========================================================================
    // PHASE 2: ORDER MANAGEMENT (MAKER FUNCTIONS)
    // ==========================================================================

    /**
     * Result returned from order creation
     */
    public static OrderResult = class {
        constructor(
            public orderId: PublicKey,
            public vault: PublicKey,
            public seed: BN,
            public signature: string
        ) { }
    };

    /**
     * Create a Fixed Price Order
     * 
     * Fixed price orders have a set exchange rate that doesn't change.
     * 
     * @param tokenA - Token to sell (name, e.g., "USDC")
     * @param tokenB - Token to receive (name, e.g., "SOL")
     * @param amount - Amount of Token A to sell (human-readable, e.g., 100)
     * @param priceRate - Price rate (Token B per Token A, e.g., 0.005 SOL per USDC)
     * @param expirySeconds - Order expiry in seconds from now (e.g., 3600 for 1 hour)
     * @returns Order result with orderId, vault, seed, and signature
     * 
     * @example
     * ```typescript
     * // Create an order to sell 100 USDC for SOL at 0.005 SOL per USDC
     * const result = await client.createFixedOrder("USDC", "SOL", 100, 0.005, 3600);
     * console.log("Order ID:", result.orderId.toBase58());
     * ```
     */
    async createFixedOrder(
        tokenA: string,
        tokenB: string,
        amount: number,
        priceRate: number,
        expirySeconds: number
    ): Promise<{ orderId: PublicKey; vault: PublicKey; seed: BN; signature: string }> {
        // Validate tokens
        const tokenAInfo = this.getToken(tokenA);
        const tokenBInfo = this.getToken(tokenB);
        if (!tokenAInfo) throw new Error(`Token ${tokenA} not found. Available: ${this.getAllTokens().join(", ")}`);
        if (!tokenBInfo) throw new Error(`Token ${tokenB} not found. Available: ${this.getAllTokens().join(", ")}`);

        // Generate unique seed
        const seed = new BN(Date.now());

        // Derive PDAs
        const orderId = this.deriveOrderStatePDA(this.publicKey, tokenAInfo.mint, tokenBInfo.mint, seed);
        const vault = await this.getATA(tokenAInfo.mint, orderId);
        const makerTokenA = await this.getATA(tokenAInfo.mint, this.publicKey);

        // Convert amounts
        const rawAmount = this.toRawAmount(tokenA, amount);
        const scaledPriceRate = this.toPriceRate(priceRate);
        const expiryTs = new BN(Math.floor(Date.now() / 1000) + expirySeconds);

        // Build and send transaction
        const signature = await this.zeroslipProgram.methods
            .initializeOrder(
                seed,
                rawAmount,
                scaledPriceRate,
                expiryTs,
                { fixed: {} }, // OrderType::Fixed
                0, // margin_bps (not used for fixed)
                null // oracle_feed (not used for fixed)
            )
            .accounts({
                maker: this.publicKey,
                mintA: tokenAInfo.mint,
                mintB: tokenBInfo.mint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        return { orderId, vault, seed, signature };
    }

    /**
     * Create a Floating Price Order
     * 
     * Floating price orders use a Pyth oracle for real-time pricing with an optional spread.
     * 
     * @param tokenA - Token to sell (name, e.g., "USDC")
     * @param tokenB - Token to receive (name, e.g., "SOL")
     * @param amount - Amount of Token A to sell (human-readable)
     * @param spreadBps - Spread in basis points above oracle price (e.g., 50 = +0.5%)
     * @param oracleFeed - Pyth oracle feed pair (e.g., "SOL/USD") or raw 32-byte array
     * @param expirySeconds - Order expiry in seconds from now
     * @returns Order result with orderId, vault, seed, and signature
     * 
     * @example
     * ```typescript
     * // Create floating order with 0.5% spread above SOL/USD oracle price
     * const result = await client.createFloatingOrder("USDC", "SOL", 100, 50, "SOL/USD", 3600);
     * ```
     */
    async createFloatingOrder(
        tokenA: string,
        tokenB: string,
        amount: number,
        spreadBps: number,
        oracleFeed: string | number[],
        expirySeconds: number
    ): Promise<{ orderId: PublicKey; vault: PublicKey; seed: BN; signature: string }> {
        // Validate tokens
        const tokenAInfo = this.getToken(tokenA);
        const tokenBInfo = this.getToken(tokenB);
        if (!tokenAInfo) throw new Error(`Token ${tokenA} not found. Available: ${this.getAllTokens().join(", ")}`);
        if (!tokenBInfo) throw new Error(`Token ${tokenB} not found. Available: ${this.getAllTokens().join(", ")}`);

        // Resolve oracle feed
        let feedBytes: number[];
        if (typeof oracleFeed === "string") {
            const feed = this.getPythFeed(oracleFeed);
            if (!feed) {
                throw new Error(`Oracle feed ${oracleFeed} not found. Available: ${this.getAllPythPairs().join(", ")}`);
            }
            feedBytes = feed.feedBytes;
        } else {
            if (oracleFeed.length !== 32) {
                throw new Error("Oracle feed must be 32 bytes");
            }
            feedBytes = oracleFeed;
        }

        // Generate unique seed
        const seed = new BN(Date.now());

        // Derive PDAs
        const orderId = this.deriveOrderStatePDA(this.publicKey, tokenAInfo.mint, tokenBInfo.mint, seed);
        const vault = await this.getATA(tokenAInfo.mint, orderId);
        const makerTokenA = await this.getATA(tokenAInfo.mint, this.publicKey);

        // Convert amounts
        const rawAmount = this.toRawAmount(tokenA, amount);
        const expiryTs = new BN(Math.floor(Date.now() / 1000) + expirySeconds);

        // Build and send transaction
        const signature = await this.zeroslipProgram.methods
            .initializeOrder(
                seed,
                rawAmount,
                new BN(spreadBps), // For floating, price_rate holds the spread
                expiryTs,
                { floating: {} }, // OrderType::Floating
                spreadBps, // margin_bps
                feedBytes // oracle_feed
            )
            .accounts({
                maker: this.publicKey,
                mintA: tokenAInfo.mint,
                mintB: tokenBInfo.mint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        return { orderId, vault, seed, signature };
    }

    /**
     * Cancel an Existing Order
     * 
     * Cancels an order and returns the remaining tokens to the maker.
     * Only the original maker can cancel their order.
     * 
     * @param orderId - Order state public key (from createFixedOrder/createFloatingOrder result)
     * @returns Transaction signature
     * 
     * @example
     * ```typescript
     * const order = await client.createFixedOrder("USDC", "SOL", 100, 0.005, 3600);
     * // Later, cancel the order
     * const signature = await client.cancelOrder(order.orderId);
     * ```
     */
    async cancelOrder(orderId: PublicKey | string): Promise<string> {
        const orderPubkey = typeof orderId === "string" ? new PublicKey(orderId) : orderId;

        // Fetch order state to get mint info (using any for dynamic IDL)
        const orderState = await (this.zeroslipProgram.account as any).orderState.fetch(orderPubkey);

        const mintA = orderState.mintA as PublicKey;
        const vault = await this.getATA(mintA, orderPubkey);
        const makerTokenA = await this.getATA(mintA, this.publicKey);

        // Build and send transaction
        const signature = await this.zeroslipProgram.methods
            .cancelOrder()
            .accounts({
                maker: this.publicKey,
                orderState: orderPubkey,
                makerTokenA: makerTokenA,
                vault: vault,
                mintA: mintA,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        return signature;
    }

    // ==========================================================================
    // PHASE 3: ORDER EXECUTION (TAKER FUNCTIONS)
    // ==========================================================================

    /**
     * Take (Fill) an Existing Order
     * 
     * Executes a trade by taking tokens from an order. Supports partial fills.
     * Taker receives Token A and pays Token B plus a small SOL protocol fee.
     * 
     * @param orderId - Order state public key or base58 string
     * @param amount - Amount of Token A to take (human-readable)
     * @param maxSlippageBps - Maximum slippage in basis points (e.g., 100 = 1%)
     * @param oracleAccount - Optional Pyth oracle account (required for floating orders)
     * @returns Transaction signature
     * 
     * @example
     * ```typescript
     * // Take 50 tokens from a fixed order with 1% max slippage
     * const signature = await client.takeOrder(orderId, 50, 100);
     * 
     * // Take from floating order (must provide oracle account)
     * const signature = await client.takeOrder(orderId, 50, 100, pythOracleAccount);
     * ```
     */
    async takeOrder(
        orderId: PublicKey | string,
        amount: number,
        maxSlippageBps: number = 100,
        oracleAccount?: PublicKey,
        fallbackPrice?: number // Raw integer price (e.g. 131000000)
    ): Promise<string> {
        const orderPubkey = typeof orderId === "string" ? new PublicKey(orderId) : orderId;

        // Fetch order state
        const orderState = await (this.zeroslipProgram.account as any).orderState.fetch(orderPubkey);

        const mintA = orderState.mintA as PublicKey;
        const mintB = orderState.mintB as PublicKey;
        const maker = orderState.maker as PublicKey;
        const priceRate = orderState.priceRate as BN;
        const isFloating = orderState.orderType.floating !== undefined;

        // Get token info for amount conversion
        const tokenAInfo = this.getTokenByMint(mintA);
        const tokenBInfo = this.getTokenByMint(mintB);
        if (!tokenAInfo || !tokenBInfo) {
            throw new Error("Token info not found for order tokens");
        }

        // Convert amount to raw
        const rawAmountToTake = this.toRawAmount(tokenAInfo.name, amount);

        // Calculate expected cost and apply slippage
        const expectedCostB = rawAmountToTake.mul(priceRate).div(new BN(1_000_000));
        const maxCostB = expectedCostB.mul(new BN(10000 + maxSlippageBps)).div(new BN(10000));

        // Derive ATAs
        const vault = await this.getATA(mintA, orderPubkey);
        const takerTokenA = await this.getATA(mintA, this.publicKey);
        const takerTokenB = await this.getATA(mintB, this.publicKey);
        const makerTokenB = await this.getATA(mintB, maker);
        const protocolConfigPDA = this.deriveProtocolConfigPDA();

        // Fetch protocol config for treasury
        const protocolConfig = await (this.zeroslipProgram.account as any).protocolConfig.fetch(protocolConfigPDA);
        const treasury = protocolConfig.feeRecipient as PublicKey;

        // Build accounts object
        const accounts: any = {
            taker: this.publicKey,
            maker: maker,
            orderState: orderPubkey,
            vault: vault,
            takerTokenA: takerTokenA,
            takerTokenB: takerTokenB,
            makerTokenB: makerTokenB,
            mintA: mintA,
            mintB: mintB,
            protocolConfig: protocolConfigPDA,
            treasury: treasury,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        };

        const preInstructions: TransactionInstruction[] = [];

        // Add Compute Budget Increase
        // Pyth verification is expensive, so we bump the limit to 1M units
        preInstructions.push(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })
        );

        // Handle Floating Orders (Pyth)
        if (isFloating) {
            if (!orderState.oracleFeed) {
                throw new Error("Floating order missing oracle feed");
            }

            // format feed id
            const feedIdArr = orderState.oracleFeed as number[];
            const feedIdHex = ZerocliqClient.formatPythFeedId(feedIdArr);

            // Fetch VAA from Hermes
            const priceServiceConnection = new PriceServiceConnection(this.hermesUrl);
            const vaas = await priceServiceConnection.getLatestVaas([feedIdHex]);

            if (!vaas || vaas.length === 0) {
                throw new Error(`Failed to fetch Pyth VAA for feed ${feedIdHex}`);
            }

            // AUTOMATIC FALLBACK: If user didn't provide a fallback price, use the one we just fetched.
            // This ensures the contract works even if the user didn't manually pass a price.
            if (!fallbackPrice) {
                try {
                    // vaas[0] is the VAA (base64 string). We need to parse it or use the Price Feed API.
                    // To keep it simple without adding a VAA parser dependency, we can use 
                    // the priceServiceConnection.getLatestPriceFeeds which we probably should have used anyway.
                    // But we used getLatestVaas.
                    // Let's also fetch the parsed price for the fallback.
                    const feeds = await priceServiceConnection.getLatestPriceFeeds([feedIdHex]);
                    if (feeds && feeds.length > 0) {
                        const price = feeds[0].getPriceUnchecked(); // Use unchecked to get raw data
                        // Pyth prices are integers with exponents.
                        // We need to provide the raw price integer that matches the exponent expected on chain (-6).
                        // Note: On-chain we normalize? No, we just read raw.
                        // Let's send the raw price string -> BN.
                        fallbackPrice = Number(price.price);
                        console.log(`[SDK] Auto-detected Fallback Price: ${fallbackPrice} (for feed ${feedIdHex})`);
                    }
                } catch (err) {
                    console.warn("[SDK] Failed to auto-fetch fallback price. Transaction relies on Oracle/Frontend:", err);
                }
            }

            // Prepare Pyth Receiver
            const pythSolanaReceiver = new PythSolanaReceiver({
                connection: this.connection,
                wallet: this.wallet as any,
                receiverProgramId: this.pythReceiverProgramId
            });

            // Build atomic update instructions
            // This returns the instructions to post updates and keys to finding the accounts
            const {
                postInstructions: updateIxs,
                priceFeedIdToPriceUpdateAccount,
                closeInstructions: cleanupIxs
            } = await pythSolanaReceiver.buildPostPriceUpdateInstructions([vaas[0]]);

            // Extract instructions and signers for pre-instructions
            const preIxs: TransactionInstruction[] = [
                ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
                ...updateIxs.map(ix => ix.instruction)
            ];

            const preSigners = updateIxs.flatMap(ix => ix.signers);

            // Extract close instructions for post-instructions (to refund rent)
            const postIxs = cleanupIxs.map(ix => ix.instruction);

            // Get the actual account usage
            // The map keys are the feed IDs (hex)
            // We use the one we requested
            const priceUpdateAccount = priceFeedIdToPriceUpdateAccount[feedIdHex];

            if (!priceUpdateAccount) {
                throw new Error("Failed to resolve Pyth price update account address");
            }

            // Assign to accounts
            accounts.oracleAccount = priceUpdateAccount;

            // Build and send transaction
            const builder = this.zeroslipProgram.methods
                .takeOrder(rawAmountToTake, maxCostB, new BN(fallbackPrice || 0))
                .accounts(accounts)
                .preInstructions(preIxs)
                .postInstructions(postIxs)
                .signers(preSigners);

            try {
                // Simulate first to expose logs
                const pubkeys = await builder.pubkeys();
                const tx = await builder.transaction();

                // We need latest blockhash for simulation
                const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
                tx.recentBlockhash = blockhash;
                tx.feePayer = this.publicKey;

                // Sign with ephemeral signers (needed for simulation validity sometimes)
                if (preSigners.length > 0) {
                    tx.partialSign(...preSigners);
                }

                console.log("Simulating TakeOrder...");
                const simulation = await this.connection.simulateTransaction(tx);
                console.log("Simulation Logs:", simulation.value.logs);

                if (simulation.value.err) {
                    console.error("Simulation Error:", simulation.value.err);
                    console.error("Simulation Logs:", simulation.value.logs);
                }
            } catch (e) {
                console.warn("Simulation check failed (ignoring):", e);
            }

            const signature = await builder.rpc();

            return signature;
        } else {
            // Fixed order
            if (oracleAccount) {
                accounts.oracleAccount = oracleAccount;
            }

            // Build and send transaction
            const signature = await this.zeroslipProgram.methods
                .takeOrder(rawAmountToTake, maxCostB, new BN(fallbackPrice || 0))
                .accounts(accounts)
                .rpc();

            return signature;
        }
    }

    /**
     * Estimate the Cost to Take an Order
     * 
     * Calculates the expected Token B cost for taking a specific amount from an order.
     * This is useful for displaying to users before they commit to a trade.
     * 
     * @param orderId - Order state public key or base58 string
     * @param amount - Amount of Token A to take (human-readable)
     * @returns Cost estimation with amounts and fees
     * 
     * @example
     * ```typescript
     * const estimate = await client.estimateTakeOrderCost(orderId, 50);
     * console.log(`You will pay: ${estimate.tokenBCost} ${estimate.tokenB}`);
     * console.log(`Protocol fee: ${estimate.protocolFeeSol} SOL`);
     * ```
     */
    async estimateTakeOrderCost(
        orderId: PublicKey | string,
        amount: number
    ): Promise<{
        tokenA: string;
        tokenB: string;
        amountA: number;
        tokenBCost: number;
        priceRate: number;
        protocolFeeSol: number;
        protocolFeeLamports: number;
        isFloating: boolean;
        remainingAfterTake: number;
    }> {
        const orderPubkey = typeof orderId === "string" ? new PublicKey(orderId) : orderId;

        // Fetch order state
        const orderState = await (this.zeroslipProgram.account as any).orderState.fetch(orderPubkey);

        const mintA = orderState.mintA as PublicKey;
        const mintB = orderState.mintB as PublicKey;
        const priceRate = orderState.priceRate as BN;
        const amountARemaining = orderState.amountARemaining as BN;
        const isFloating = orderState.orderType.floating !== undefined;

        // Get token info
        const tokenAInfo = this.getTokenByMint(mintA);
        const tokenBInfo = this.getTokenByMint(mintB);
        if (!tokenAInfo || !tokenBInfo) {
            throw new Error("Token info not found for order tokens");
        }

        // Convert amount to raw and calculate cost
        const rawAmountToTake = this.toRawAmount(tokenAInfo.name, amount);
        const expectedCostBRaw = rawAmountToTake.mul(priceRate).div(new BN(1_000_000));

        // Convert back to human amounts
        const tokenBCost = this.toHumanAmount(tokenBInfo.name, expectedCostBRaw);
        const humanPriceRate = this.fromPriceRate(priceRate);
        const remainingHuman = this.toHumanAmount(tokenAInfo.name, amountARemaining);

        // Get protocol fee
        const protocolConfigPDA = this.deriveProtocolConfigPDA();
        const protocolConfig = await (this.zeroslipProgram.account as any).protocolConfig.fetch(protocolConfigPDA);
        const protocolFeeLamports = (protocolConfig.feeSolLamports as BN).toNumber();
        const protocolFeeSol = protocolFeeLamports / 1_000_000_000;

        return {
            tokenA: tokenAInfo.name,
            tokenB: tokenBInfo.name,
            amountA: amount,
            tokenBCost,
            priceRate: humanPriceRate,
            protocolFeeSol,
            protocolFeeLamports,
            isFloating,
            remainingAfterTake: remainingHuman - amount,
        };
    }

    // ==========================================================================
    // PHASE 4: MOCK TOKEN FAUCET
    // ==========================================================================

    /**
     * Mint Mock Tokens (User Pays Gas)
     * 
     * Mints mock tokens to the connected wallet. The user signs and pays gas.
     * Use this for frontend applications where users request their own tokens.
     * 
     * @param tokenName - Token to mint (e.g., "USDC", "BONK")
     * @param amount - Amount to mint (human-readable)
     * @returns Transaction signature
     * 
     * @example
     * ```typescript
     * // Mint 1000 mock USDC to connected wallet
     * const signature = await client.mintTokens("USDC", 1000);
     * ```
     */
    async mintTokens(tokenName: string, amount: number): Promise<string> {
        const tokenInfo = this.getToken(tokenName);
        if (!tokenInfo) {
            throw new Error(`Token ${tokenName} not found. Available: ${this.getAllTokens().join(", ")}`);
        }

        const rawAmount = this.toRawAmount(tokenName, amount);
        const recipientAta = await this.getATA(tokenInfo.mint, this.publicKey);

        const signature = await this.mockTokensProgram.methods
            .mintToken(rawAmount)
            .accounts({
                payer: this.publicKey,
                mint: tokenInfo.mint,
                tokenAccount: recipientAta,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return signature;
    }

    /**
     * Gasless Faucet Mint (Backend Pays Gas)
     * 
     * Mints mock tokens to any recipient address. The backend wallet signs and pays gas.
     * Use this for server-side token distribution (e.g., faucet API endpoints).
     * 
     * The recipient does NOT need to sign or pay anything.
     * 
     * @param tokenName - Token to mint (e.g., "USDC", "BONK")
     * @param recipientAddress - Recipient's wallet address (PublicKey or base58 string)
     * @param amount - Amount to mint (human-readable)
     * @returns Transaction signature
     * 
     * @example
     * ```typescript
     * // Backend: Mint 1000 USDC to a user's wallet
     * const signature = await client.faucetMint("USDC", userAddress, 1000);
     * ```
     */
    async faucetMint(
        tokenName: string,
        recipientAddress: PublicKey | string,
        amount: number
    ): Promise<string> {
        const tokenInfo = this.getToken(tokenName);
        if (!tokenInfo) {
            throw new Error(`Token ${tokenName} not found. Available: ${this.getAllTokens().join(", ")}`);
        }

        const recipient = typeof recipientAddress === "string"
            ? new PublicKey(recipientAddress)
            : recipientAddress;

        const rawAmount = this.toRawAmount(tokenName, amount);
        const recipientAta = await this.getATA(tokenInfo.mint, recipient);

        const signature = await this.mockTokensProgram.methods
            .faucetMint(rawAmount)
            .accounts({
                payer: this.publicKey,
                recipient: recipient,
                mint: tokenInfo.mint,
                tokenAccount: recipientAta,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return signature;
    }

    // ==========================================================================
    // PHASE 5: QUERY FUNCTIONS
    // ==========================================================================

    /**
     * Order data returned from queries
     */
    public static OrderData = class {
        constructor(
            public orderId: PublicKey,
            public maker: PublicKey,
            public mintA: PublicKey,
            public mintB: PublicKey,
            public tokenA: string | null,
            public tokenB: string | null,
            public amountAInitial: number,
            public amountARemaining: number,
            public priceRate: number,
            public expiryTs: number,
            public isFloating: boolean,
            public oracleFeed: number[] | null,
            public isExpired: boolean
        ) { }
    };

    /**
     * Fetch a Single Order by ID
     * 
     * @param orderId - Order state public key or base58 string
     * @returns Order data with all fields
     * 
     * @example
     * ```typescript
     * const order = await client.getOrder(orderId);
     * console.log(`Selling: ${order.amountARemaining} ${order.tokenA}`);
     * console.log(`Price: ${order.priceRate}`);
     * ```
     */
    async getOrder(orderId: PublicKey | string): Promise<{
        orderId: PublicKey;
        maker: PublicKey;
        mintA: PublicKey;
        mintB: PublicKey;
        tokenA: string | null;
        tokenB: string | null;
        amountAInitial: number;
        amountARemaining: number;
        priceRate: number;
        expiryTs: number;
        isFloating: boolean;
        oracleFeed: number[] | null;
        isExpired: boolean;
    }> {
        const orderPubkey = typeof orderId === "string" ? new PublicKey(orderId) : orderId;

        const orderState = await (this.zeroslipProgram.account as any).orderState.fetch(orderPubkey);

        const mintA = orderState.mintA as PublicKey;
        const mintB = orderState.mintB as PublicKey;
        const tokenAInfo = this.getTokenByMint(mintA);
        const tokenBInfo = this.getTokenByMint(mintB);
        const expiryTs = (orderState.expiryTs as BN).toNumber();
        const now = Math.floor(Date.now() / 1000);

        return {
            orderId: orderPubkey,
            maker: orderState.maker as PublicKey,
            mintA,
            mintB,
            tokenA: tokenAInfo?.name || null,
            tokenB: tokenBInfo?.name || null,
            amountAInitial: tokenAInfo
                ? this.toHumanAmount(tokenAInfo.name, orderState.amountAInitial as BN)
                : (orderState.amountAInitial as BN).toNumber(),
            amountARemaining: tokenAInfo
                ? this.toHumanAmount(tokenAInfo.name, orderState.amountARemaining as BN)
                : (orderState.amountARemaining as BN).toNumber(),
            priceRate: this.fromPriceRate(orderState.priceRate as BN),
            expiryTs,
            isFloating: orderState.orderType.floating !== undefined,
            oracleFeed: orderState.oracleFeed || null,
            isExpired: now >= expiryTs,
        };
    }

    /**
     * Get All Orders by a Specific Maker
     * 
     * @param makerAddress - Maker's wallet address (optional, defaults to connected wallet)
     * @returns Array of order data
     * 
     * @example
     * ```typescript
     * // Get my orders
     * const myOrders = await client.getOrdersByMaker();
     * 
     * // Get another user's orders
     * const orders = await client.getOrdersByMaker(otherAddress);
     * ```
     */
    async getOrdersByMaker(makerAddress?: PublicKey | string): Promise<Array<{
        orderId: PublicKey;
        maker: PublicKey;
        tokenA: string | null;
        tokenB: string | null;
        amountARemaining: number;
        priceRate: number;
        isFloating: boolean;
        isExpired: boolean;
    }>> {
        const maker = makerAddress
            ? (typeof makerAddress === "string" ? new PublicKey(makerAddress) : makerAddress)
            : this.publicKey;

        const allOrders = await (this.zeroslipProgram.account as any).orderState.all([
            { memcmp: { offset: 8, bytes: maker.toBase58() } }
        ]);

        const now = Math.floor(Date.now() / 1000);

        return allOrders.map((order: any) => {
            const mintA = order.account.mintA as PublicKey;
            const mintB = order.account.mintB as PublicKey;
            const tokenAInfo = this.getTokenByMint(mintA);
            const tokenBInfo = this.getTokenByMint(mintB);
            const expiryTs = (order.account.expiryTs as BN).toNumber();

            return {
                orderId: order.publicKey,
                maker: order.account.maker as PublicKey,
                tokenA: tokenAInfo?.name || null,
                tokenB: tokenBInfo?.name || null,
                amountARemaining: tokenAInfo
                    ? this.toHumanAmount(tokenAInfo.name, order.account.amountARemaining as BN)
                    : (order.account.amountARemaining as BN).toNumber(),
                priceRate: this.fromPriceRate(order.account.priceRate as BN),
                isFloating: order.account.orderType.floating !== undefined,
                isExpired: now >= expiryTs,
            };
        });
    }

    /**
     * Get All Active Orders (Not Expired)
     * 
     * @param filters - Optional filters by token
     * @returns Array of active order data
     * 
     * @example
     * ```typescript
     * // Get all active orders
     * const orders = await client.getActiveOrders();
     * 
     * // Filter by token A
     * const usdcOrders = await client.getActiveOrders({ tokenA: "USDC" });
     * ```
     */
    async getActiveOrders(filters?: { tokenA?: string; tokenB?: string }): Promise<Array<{
        orderId: PublicKey;
        maker: PublicKey;
        tokenA: string | null;
        tokenB: string | null;
        amountARemaining: number;
        priceRate: number;
        isFloating: boolean;
        expiryTs: number;
    }>> {
        const memcmpFilters: any[] = [];

        // Add token filters if provided
        if (filters?.tokenA) {
            const tokenAInfo = this.getToken(filters.tokenA);
            if (tokenAInfo) {
                memcmpFilters.push({ memcmp: { offset: 8 + 32, bytes: tokenAInfo.mint.toBase58() } });
            }
        }
        if (filters?.tokenB) {
            const tokenBInfo = this.getToken(filters.tokenB);
            if (tokenBInfo) {
                memcmpFilters.push({ memcmp: { offset: 8 + 32 + 32, bytes: tokenBInfo.mint.toBase58() } });
            }
        }

        const allOrders = await (this.zeroslipProgram.account as any).orderState.all(memcmpFilters);

        const now = Math.floor(Date.now() / 1000);

        // Filter out expired orders and orders with 0 remaining
        return allOrders
            .filter((order: any) => {
                const expiryTs = (order.account.expiryTs as BN).toNumber();
                const remaining = (order.account.amountARemaining as BN).toNumber();
                return now < expiryTs && remaining > 0;
            })
            .map((order: any) => {
                const mintA = order.account.mintA as PublicKey;
                const mintB = order.account.mintB as PublicKey;
                const tokenAInfo = this.getTokenByMint(mintA);
                const tokenBInfo = this.getTokenByMint(mintB);

                return {
                    orderId: order.publicKey,
                    maker: order.account.maker as PublicKey,
                    tokenA: tokenAInfo?.name || null,
                    tokenB: tokenBInfo?.name || null,
                    amountARemaining: tokenAInfo
                        ? this.toHumanAmount(tokenAInfo.name, order.account.amountARemaining as BN)
                        : (order.account.amountARemaining as BN).toNumber(),
                    priceRate: this.fromPriceRate(order.account.priceRate as BN),
                    isFloating: order.account.orderType.floating !== undefined,
                    expiryTs: (order.account.expiryTs as BN).toNumber(),
                };
            });
    }

    /**
     * Get Orders for a Specific Token Pair
     * 
     * @param tokenA - Token being sold
     * @param tokenB - Token being bought
     * @returns Array of orders for this pair
     * 
     * @example
     * ```typescript
     * const orders = await client.getOrdersByTokenPair("USDC", "SOL");
     * ```
     */
    async getOrdersByTokenPair(tokenA: string, tokenB: string): Promise<Array<{
        orderId: PublicKey;
        maker: PublicKey;
        amountARemaining: number;
        priceRate: number;
        isFloating: boolean;
        isExpired: boolean;
    }>> {
        const tokenAInfo = this.getToken(tokenA);
        const tokenBInfo = this.getToken(tokenB);

        if (!tokenAInfo) throw new Error(`Token ${tokenA} not found`);
        if (!tokenBInfo) throw new Error(`Token ${tokenB} not found`);

        const allOrders = await (this.zeroslipProgram.account as any).orderState.all([
            { memcmp: { offset: 8 + 32, bytes: tokenAInfo.mint.toBase58() } },
            { memcmp: { offset: 8 + 32 + 32, bytes: tokenBInfo.mint.toBase58() } },
        ]);

        const now = Math.floor(Date.now() / 1000);

        return allOrders.map((order: any) => {
            const expiryTs = (order.account.expiryTs as BN).toNumber();

            return {
                orderId: order.publicKey,
                maker: order.account.maker as PublicKey,
                amountARemaining: this.toHumanAmount(tokenA, order.account.amountARemaining as BN),
                priceRate: this.fromPriceRate(order.account.priceRate as BN),
                isFloating: order.account.orderType.floating !== undefined,
                isExpired: now >= expiryTs,
            };
        });
    }

    /**
     * Get Protocol Configuration
     * 
     * @returns Protocol config with admin, fee recipient, and fee amount
     * 
     * @example
     * ```typescript
     * const config = await client.getProtocolConfig();
     * console.log(`Protocol fee: ${config.feeSol} SOL`);
     * ```
     */
    async getProtocolConfig(): Promise<{
        admin: PublicKey;
        feeRecipient: PublicKey;
        feeLamports: number;
        feeSol: number;
    }> {
        const protocolConfigPDA = this.deriveProtocolConfigPDA();
        const config = await (this.zeroslipProgram.account as any).protocolConfig.fetch(protocolConfigPDA);

        const feeLamports = (config.feeSolLamports as BN).toNumber();

        return {
            admin: config.admin as PublicKey,
            feeRecipient: config.feeRecipient as PublicKey,
            feeLamports,
            feeSol: feeLamports / 1_000_000_000,
        };
    }
}
