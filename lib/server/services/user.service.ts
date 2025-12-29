/**
 * User Service
 * 
 * Manages user records and smart account associations.
 */

import { prisma } from "@/lib/prisma";
import type { Address, Hex } from "viem";
import { getAddress } from "viem";

export interface CreateUserSmartAccountInput {
    walletAddress: Address;
    chainId: number;
    chainName?: string;
    smartAccountAddress?: Address;
    deploymentStatus?: "COUNTERFACTUAL" | "DEPLOYED";
    deploymentTxHash?: Hex;
}

export interface UpdateSmartAccountStatusInput {
    deploymentStatus: "DEPLOYED";
    deploymentTxHash: Hex;
}

/**
 * Create or update user with smart account information
 */
export async function createOrUpdateUserSmartAccount(input: CreateUserSmartAccountInput) {
    const checksummedWallet = getAddress(input.walletAddress);
    const checksummedSmartAccount = input.smartAccountAddress
        ? getAddress(input.smartAccountAddress)
        : undefined;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
        where: {
            walletAddress_chainId: {
                walletAddress: checksummedWallet,
                chainId: input.chainId,
            },
        },
    });

    if (existingUser) {
        // Update existing user - only update smart account fields if provided
        return prisma.user.update({
            where: {
                walletAddress_chainId: {
                    walletAddress: checksummedWallet,
                    chainId: input.chainId,
                },
            },
            data: {
                ...(checksummedSmartAccount && { smartAccountAddress: checksummedSmartAccount }),
                ...(input.deploymentStatus && { smartAccountStatus: input.deploymentStatus }),
                ...(input.deploymentTxHash && { deploymentTxHash: input.deploymentTxHash }),
                ...(input.chainName && { chainName: input.chainName }),
            },
        });
    }

    // Create new user
    return prisma.user.create({
        data: {
            walletAddress: checksummedWallet,
            chainId: input.chainId,
            chainName: input.chainName,
            ...(checksummedSmartAccount && { smartAccountAddress: checksummedSmartAccount }),
            ...(input.deploymentStatus && { smartAccountStatus: input.deploymentStatus }),
            ...(input.deploymentTxHash && { deploymentTxHash: input.deploymentTxHash }),
        },
    });
}

/**
 * Get user's smart account information
 */
export async function getUserSmartAccount(walletAddress: Address, chainId: number) {
    const checksummedWallet = getAddress(walletAddress);

    const user = await prisma.user.findUnique({
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
            chainId: true,
            chainName: true,
            hasCompletedOnboarding: true,
        },
    });

    return user;
}

/**
 * Update smart account deployment status
 */
export async function updateSmartAccountStatus(
    walletAddress: Address,
    chainId: number,
    input: UpdateSmartAccountStatusInput
) {
    const checksummedWallet = getAddress(walletAddress);

    return prisma.user.update({
        where: {
            walletAddress_chainId: {
                walletAddress: checksummedWallet,
                chainId,
            },
        },
        data: {
            smartAccountStatus: input.deploymentStatus,
            deploymentTxHash: input.deploymentTxHash,
        },
    });
}

/**
 * Mark onboarding as complete
 */
export async function markOnboardingComplete(
    walletAddress: Address,
    chainId: number
) {
    const checksummedWallet = getAddress(walletAddress);

    return prisma.user.update({
        where: {
            walletAddress_chainId: {
                walletAddress: checksummedWallet,
                chainId,
            },
        },
        data: {
            hasCompletedOnboarding: true,
            onboardingStep: 4,
        },
    });
}
