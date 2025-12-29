/**
 * Smart Account Service
 * 
 * Handles deterministic smart account address computation and on-chain verification.
 * Uses MetaMask Delegation Toolkit's Hybrid implementation.
 */

import { createPublicClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit";
import { getViemChain } from "@/lib/server/config/chains";
import { prisma } from "@/lib/prisma";
import { getAddress } from "viem";

export type SmartAccountStatus = "NONE" | "COUNTERFACTUAL" | "DEPLOYED";

export interface SmartAccountInfo {
    address: Address;
    status: SmartAccountStatus;
    isDeployed: boolean;
    deploymentTxHash: Hex | null;
    computedAt: Date;
}

export interface ComputeSmartAccountResult {
    success: boolean;
    smartAccount: SmartAccountInfo | null;
    cached: boolean;
    error?: string;
}

/**
 * Compute the deterministic smart account address for a given EOA.
 */
export async function computeSmartAccountAddress(
    walletAddress: Address,
    chainId: number
): Promise<Address> {
    console.log(`[SmartAccount] Computing address for ${walletAddress} on chain ${chainId}`);

    const viemChain = getViemChain(chainId);

    const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(),
    });

    // Use a dummy signer - address doesn't depend on signer
    const dummyPrivateKey = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
    const dummyAccount = privateKeyToAccount(dummyPrivateKey);

    // Compute smart account address
    const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [walletAddress, [], [], []], // Owner is the user's wallet
        deploySalt: "0x",
        signer: { account: dummyAccount },
    });

    console.log(`[SmartAccount] Computed address: ${smartAccount.address}`);

    return smartAccount.address;
}

/**
 * Check if a smart account is deployed on-chain.
 */
export async function checkDeploymentStatus(
    smartAccountAddress: Address,
    chainId: number
): Promise<{ isDeployed: boolean }> {
    console.log(`[SmartAccount] Checking deployment for ${smartAccountAddress}`);

    const viemChain = getViemChain(chainId);

    const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(),
    });

    const code = await publicClient.getCode({ address: smartAccountAddress });

    const isDeployed = code !== undefined && code !== "0x" && (code?.length || 0) > 2;

    console.log(`[SmartAccount] Is deployed: ${isDeployed ? "YES" : "NO"}`);

    return { isDeployed };
}

/**
 * Get or compute smart account for a user.
 * Checks DB first, computes if not found.
 */
export async function getOrComputeSmartAccount(
    walletAddress: Address,
    chainId: number,
    options?: { forceRefresh?: boolean }
): Promise<ComputeSmartAccountResult> {
    const checksummedWallet = getAddress(walletAddress);

    try {
        // 1. Check database for existing record
        const existingUser = await prisma.user.findUnique({
            where: {
                walletAddress_chainId: {
                    walletAddress: checksummedWallet,
                    chainId,
                },
            },
            select: {
                smartAccountAddress: true,
                smartAccountStatus: true,
                deploymentTxHash: true,
                updatedAt: true,
            },
        });

        // 2. Fast path: Return cached if available
        if (
            existingUser?.smartAccountAddress &&
            existingUser?.smartAccountStatus &&
            !options?.forceRefresh
        ) {
            console.log(`[SmartAccount] Cache HIT for ${checksummedWallet}`);

            return {
                success: true,
                cached: true,
                smartAccount: {
                    address: existingUser.smartAccountAddress as Address,
                    status: existingUser.smartAccountStatus as SmartAccountStatus,
                    isDeployed: existingUser.smartAccountStatus === "DEPLOYED",
                    deploymentTxHash: existingUser.deploymentTxHash as Hex | null,
                    computedAt: existingUser.updatedAt,
                },
            };
        }

        // 3. Slow path: Compute address + verify on-chain
        console.log(`[SmartAccount] Computing for ${checksummedWallet}...`);

        const smartAccountAddress = await computeSmartAccountAddress(checksummedWallet, chainId);
        const { isDeployed } = await checkDeploymentStatus(smartAccountAddress, chainId);

        const status: SmartAccountStatus = isDeployed ? "DEPLOYED" : "COUNTERFACTUAL";

        // 4. Update database
        await prisma.user.update({
            where: {
                walletAddress_chainId: {
                    walletAddress: checksummedWallet,
                    chainId,
                },
            },
            data: {
                smartAccountAddress: getAddress(smartAccountAddress),
                smartAccountStatus: status,
            },
        });

        console.log(`[SmartAccount] Saved: ${smartAccountAddress} (${status})`);

        return {
            success: true,
            cached: false,
            smartAccount: {
                address: smartAccountAddress,
                status,
                isDeployed,
                deploymentTxHash: null,
                computedAt: new Date(),
            },
        };
    } catch (error: any) {
        console.error(`[SmartAccount] Error:`, error);

        return {
            success: false,
            cached: false,
            smartAccount: null,
            error: error.message || "Failed to compute smart account",
        };
    }
}

/**
 * Refresh smart account status from on-chain.
 */
export async function refreshSmartAccountStatus(
    walletAddress: Address,
    chainId: number
): Promise<ComputeSmartAccountResult> {
    return getOrComputeSmartAccount(walletAddress, chainId, { forceRefresh: true });
}
