/**
 * Smart Card Service
 * 
 * Core service for managing Smart Cards (ERC-7715 delegations).
 * Handles creation, activation, execution, and lifecycle.
 */

import { prisma } from "@/lib/prisma";
import { delegationBuilderService } from "./delegation-builder.service";
import { spendingLimitService } from "./spending-limit.service";
import { swapService } from "./swap.service";
import { balancesService } from "./balances.service";
import type { CreateSmartCardParams, RecordTransactionParams, CanSpendResult, SmartCardStatus, TransactionType } from "@/lib/server/types/smart-card.types";
import { type Address, type Hex, createWalletClient, createPublicClient, http, parseAbi, type PublicClient, publicActions, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getSmartAccountsEnvironment, createExecution, ExecutionMode, toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit";
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts";
import { getChainById, getViemChain } from "@/lib/server/config/chains";
import { getSmartCardChainConfig } from "@/lib/server/config/smart-card-chains";
import { getSmartCardTypeConfig } from "@/lib/server/config/smart-card-types";
import { getPaymasterUrl, AGENT_SMART_ACCOUNT_DEPLOY_SALT } from "@/lib/server/config/pimlico";
import { createSmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";

const ERC20_TRANSFER_ABI = parseAbi([
    "function transfer(address to, uint256 amount) external returns (bool)"
]);

// Smart Card status constants
const STATUS = {
    PENDING: "PENDING" as SmartCardStatus,
    ACTIVE: "ACTIVE" as SmartCardStatus,
    REVOKED: "REVOKED" as SmartCardStatus,
    EXPIRED: "EXPIRED" as SmartCardStatus,
};

/**
 * Get the Agent Smart Account address (computed from Agent EOA)
 */
export async function getAgentSmartAccountAddress(chainId: number): Promise<Address> {
    const agentPrivateKey = process.env.AGENT_EOA_PRIVATE_KEY as Hex;
    if (!agentPrivateKey) throw new Error("AGENT_EOA_PRIVATE_KEY not configured");

    const agentEOA = privateKeyToAccount(agentPrivateKey);
    const viemChain = getViemChain(chainId);

    const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(),
    });

    const agentSmartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [agentEOA.address, [], [], []],
        deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
        signer: { account: agentEOA },
    });

    return agentSmartAccount.address;
}


export class SmartCardService {
    constructor() { }

    /**
     * Create a new Smart Card with type-based delegation.
     */
    public async createSmartCard(params: CreateSmartCardParams) {
        const { userId: walletAddress, chainId, type, expiresAt } = params;

        const delegatorAddress = getAddress(params.delegatorAddress);
        const delegateAddress = getAddress(params.delegateAddress);

        // 1. Get User ID from wallet address (userId in params is actually wallet address)
        const user = await prisma.user.findUnique({
            where: {
                walletAddress_chainId: {
                    walletAddress: getAddress(walletAddress),
                    chainId,
                }
            },
            select: { id: true }
        });

        if (!user) {
            throw new Error("User not found. Please ensure your account is synced.");
        }

        const userId = user.id;

        // 2. Get type configuration
        const typeConfig = getSmartCardTypeConfig(type);
        if (!typeConfig.enabled) {
            throw new Error(`${typeConfig.displayName} is not yet available. Coming soon!`);
        }

        // 3. Check if user already has a card of this type on this chain
        const existingCard = await prisma.smartCard.findUnique({
            where: {
                userId_chainId_type: {
                    userId,
                    chainId,
                    type,
                }
            }
        });

        if (existingCard) {
            // RELAXED: Allow overwriting active cards for development
            // if (existingCard.status === STATUS.ACTIVE) {
            //     throw new Error(`You already have an active ${typeConfig.displayName} on this chain`);
            // }
            // Delete old card for re-creation
            await prisma.smartCard.delete({
                where: { id: existingCard.id }
            });
            console.log(`[SmartCard] Deleted old ${type} card for re-creation`);
        }

        // 4. Get chain name
        const chainConfig = getChainById(chainId);
        const chainName = chainConfig?.name || `Chain ${chainId}`;

        // 5. Generate name
        const cardName = params.name || typeConfig.getAutoName(chainName);

        // 6. Build the delegation struct
        const buildResult = await delegationBuilderService.buildDelegationForType({
            chainId,
            delegatorAddress,
            delegateAddress,
            type,
        });

        // 7. Serialize delegation struct
        const serializedDelegation = JSON.parse(
            JSON.stringify(buildResult.delegation, (_, v) =>
                typeof v === "bigint" ? v.toString() : v
            )
        );

        // 8. Create record in database
        const smartCard = await prisma.smartCard.create({
            data: {
                userId,
                chainId,
                type,
                name: cardName,
                delegatorAddress,
                delegateAddress,
                delegationStruct: serializedDelegation,
                whitelistedRouters: buildResult.whitelistedRouters,
                tokenLimits: [],
                status: STATUS.PENDING,
                expiresAt,
            },
        });

        console.log(`[SmartCard] Created ${type} card "${cardName}" for user ${userId}`);

        return {
            smartCard,
            delegation: serializedDelegation,
            type,
            name: cardName,
        };
    }

    /**
     * Get a Smart Card by ID
     */
    public async getSmartCard(id: string) {
        return prisma.smartCard.findUnique({
            where: { id },
        });
    }

    /**
     * Get all Smart Cards for a user
     */
    public async getUserSmartCards(userId: string, chainId?: number) {
        return prisma.smartCard.findMany({
            where: {
                userId,
                ...(chainId && { chainId }),
            },
            orderBy: { createdAt: "desc" },
        });
    }

    /**
     * Update the signature and activate
     */
    public async updateSignature(id: string, signature: string) {
        return prisma.smartCard.update({
            where: { id },
            data: {
                signature,
                status: STATUS.ACTIVE,
            },
        });
    }

    /**
     * Revoke a Smart Card
     */
    public async revokeSmartCard(id: string) {
        return prisma.smartCard.update({
            where: { id },
            data: {
                status: STATUS.REVOKED,
                revokedAt: new Date(),
            },
        });
    }

    /**
     * Check if active
     */
    public async isActive(smartCardId: string): Promise<boolean> {
        const smartCard = await this.getSmartCard(smartCardId);
        if (!smartCard) return false;
        if (smartCard.status !== STATUS.ACTIVE) return false;
        if (smartCard.revokedAt) return false;
        if (smartCard.expiresAt && smartCard.expiresAt < new Date()) return false;
        return true;
    }

    /**
     * Check spending limits
     */
    public async canSpend(
        smartCardId: string,
        tokenAddress: Address,
        amount: bigint
    ): Promise<CanSpendResult> {
        const active = await this.isActive(smartCardId);
        if (!active) {
            return { allowed: false, reason: "Smart Card is not active" };
        }

        const limitCheck = await spendingLimitService.checkAllLimits(smartCardId, tokenAddress, amount);
        if (!limitCheck.allowed) {
            return {
                allowed: false,
                reason: limitCheck.reason,
                remainingDaily: limitCheck.limit && limitCheck.currentSpent
                    ? limitCheck.limit - limitCheck.currentSpent
                    : undefined
            };
        }

        return { allowed: true };
    }

    /**
     * Get Smart Card balance
     */
    public async getSmartCardBalance(id: string) {
        const smartCard = await this.getSmartCard(id);
        if (!smartCard) throw new Error("Smart Card not found");

        const tokens = await balancesService.getWalletBalances(
            smartCard.delegatorAddress,
            smartCard.chainId
        );

        const totalUsdValue = tokens.reduce(
            (sum: number, token: any) => sum + (token.usdValue || 0),
            0
        );

        return {
            success: true,
            smartCardId: id,
            delegatorAddress: smartCard.delegatorAddress,
            chainId: smartCard.chainId,
            totalUsdValue,
            tokens,
        };
    }

    /**
     * Record a transaction
     */
    public async recordTransaction(params: RecordTransactionParams) {
        const {
            smartCardId,
            transactionHash,
            tokenAddress,
            amount,
            transactionType,
            dexId,
            routerAddress,
            blockNumber,
            timestamp,
        } = params;

        const transaction = await prisma.smartCardTransaction.create({
            data: {
                smartCardId,
                transactionHash,
                tokenAddress,
                amount: amount.toString(),
                transactionType,
                dexId,
                routerAddress,
                blockNumber,
                timestamp: timestamp || new Date(),
            },
        });

        try {
            await spendingLimitService.incrementSpending(smartCardId, tokenAddress, amount);
        } catch (spendingError) {
            console.error("[SmartCard] Failed to update spending:", spendingError);
        }

        return transaction;
    }

    /**
     * Execute a gasless swap using a Smart Card
     */
    public async executeSwap(smartCardId: string, quote: any) {
        console.log(`[SmartCard] Executing GASLESS swap for card ${smartCardId}`);

        // 1. Get Smart Card
        const smartCard = await this.getSmartCard(smartCardId);
        if (!smartCard || smartCard.status !== STATUS.ACTIVE) {
            throw new Error("Smart Card not active");
        }

        // 2. Validate Limits
        const amountIn = BigInt(quote.request.amountIn);
        const tokenIn = quote.request.tokenIn;

        const canSpend = await this.canSpend(smartCardId, tokenIn as Address, amountIn);
        if (!canSpend.allowed) {
            throw new Error(`Spending limit exceeded: ${canSpend.reason}`);
        }

        // 3. Get Chain Config
        const chainConfig = getChainById(smartCard.chainId);
        if (!chainConfig) throw new Error("Chain not supported");

        const viemChain = getViemChain(smartCard.chainId);
        const environment = getSmartAccountsEnvironment(smartCard.chainId);

        // 4. Setup Agent EOA
        const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as Hex;
        if (!agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY not configured");
        const agentEOA = privateKeyToAccount(agentPrivateKey);

        // 5. Create Public Client
        const publicClient = createPublicClient({
            chain: viemChain,
            transport: http(),
        });

        // Check User SA deployment
        const userSA = smartCard.delegatorAddress as Address;
        const userSACode = await publicClient.getCode({ address: userSA });
        if (!userSACode || userSACode === "0x") {
            throw new Error("User Smart Account not deployed. Please deploy first.");
        }

        // 6. Get User EOA for Recipient
        const user = await prisma.user.findUnique({ where: { id: smartCard.userId } });
        if (!user) throw new Error("User not found");
        const recipientEOA = user.walletAddress as Address;

        // 7. Build Execution Data
        const tempClient = createWalletClient({
            account: agentEOA,
            chain: viemChain,
            transport: http()
        }).extend(publicActions);

        const executionData = await swapService.buildExecution({
            route: {
                ...quote.bestRoute,
                amountIn: BigInt(quote.bestRoute.amountIn || amountIn),
                amountOut: BigInt(quote.bestRoute.amountOut),
                minAmountOut: BigInt(quote.bestRoute.minAmountOut)
            },
            userAddress: smartCard.delegatorAddress as Address,
            deadline: Math.floor(Date.now() / 1000) + 300,
            client: tempClient as unknown as PublicClient,
            tokenIn: { address: tokenIn, decimals: 18, symbol: "TOKEN", name: "Token", logoURI: "" },
            recipient: recipientEOA
        });

        if (!executionData) {
            throw new Error("Failed to build swap execution data");
        }

        // 8. Deserialize delegation
        const delegation = smartCard.delegationStruct as any;
        const saltStr = delegation.salt?.toString() || "0";
        let saltBigInt: bigint;
        if (saltStr === "0x" || saltStr === "" || saltStr === "0") {
            saltBigInt = 0n;
        } else {
            saltBigInt = BigInt(saltStr);
        }

        const deserializedDelegation = {
            ...delegation,
            salt: saltBigInt,
            signature: smartCard.signature as Hex,
            caveats: delegation.caveats.map((c: any) => ({
                ...c,
                args: c.args as Hex,
                terms: c.terms as Hex,
                enforcer: c.enforcer as Address
            }))
        };

        // 9. Create Agent Smart Account
        const agentSmartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [agentEOA.address, [], [], []],
            deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
            signer: { account: agentEOA },
        });

        // 10. Setup Pimlico Paymaster
        const paymasterUrl = getPaymasterUrl(smartCard.chainId);

        const pimlicoClient = createPimlicoClient({
            transport: http(paymasterUrl),
            entryPoint: {
                address: entryPoint07Address,
                version: "0.7",
            },
        });

        // 11. Create SmartAccountClient
        const smartAccountClient = createSmartAccountClient({
            account: agentSmartAccount as any,
            chain: viemChain,
            bundlerTransport: http(paymasterUrl),
            paymaster: pimlicoClient,
            userOperation: {
                estimateFeesPerGas: async () => {
                    return (await pimlicoClient.getUserOperationGasPrice()).fast;
                },
            },
        });

        // Helper: Execute via sponsored UserOperation
        const executeViaPaymaster = async (
            tx: { to: string; data: string; value?: string },
            description: string
        ): Promise<Hex> => {
            const singleExecution = createExecution({
                target: tx.to as Address,
                value: tx.value ? BigInt(tx.value) : 0n,
                callData: tx.data as Hex
            });

            const calldata = DelegationManager.encode.redeemDelegations({
                delegations: [[deserializedDelegation]],
                modes: [ExecutionMode.SingleDefault],
                executions: [[singleExecution]]
            });

            // Simulate first
            try {
                await publicClient.call({
                    to: environment.DelegationManager,
                    data: calldata,
                    account: agentSmartAccount.address,
                });
            } catch (simError: any) {
                throw new Error(`Simulation failed: ${simError.message}`);
            }

            // Send UserOperation
            const hash = await smartAccountClient.sendTransaction({
                to: environment.DelegationManager as Address,
                data: calldata,
                value: 0n,
            } as any);

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed for ${description}`);
            }

            return hash;
        };

        // 12. Execute Approval (if needed)
        let approvalHash: Hex | null = null;
        if (executionData.approvals.length > 0) {
            for (const approval of executionData.approvals) {
                approvalHash = await executeViaPaymaster(
                    approval,
                    `Approve ${approval.description || 'token'}`
                );
            }
        }

        // 13. Execute Swap
        const swapHash = await executeViaPaymaster(
            executionData.swap,
            `Swap on ${quote.bestRoute.dexId}`
        );

        // 14. Record Transaction
        await this.recordTransaction({
            smartCardId,
            transactionHash: swapHash,
            tokenAddress: tokenIn,
            amount: amountIn,
            transactionType: "SWAP" as TransactionType,
            dexId: quote.bestRoute.dexId,
            routerAddress: executionData.swap.to,
        });

        console.log("[SmartCard] ✅ Swap executed successfully!");

        return {
            transactionHash: swapHash,
            approvalHash: approvalHash || undefined,
            gasSponsored: true
        };
    }
}

export const smartCardService = new SmartCardService();
