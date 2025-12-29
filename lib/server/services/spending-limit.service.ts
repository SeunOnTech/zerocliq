/**
 * Spending Limit Service
 * 
 * Tracks and enforces spending limits on Smart Cards.
 */

import { prisma } from "@/lib/prisma";
import type { Address } from "viem";
import type { LimitCheckResult, SpendingStatus } from "@/lib/server/types/spending-limit.types";
import type { TokenLimitConfig } from "@/lib/server/types/delegation.types";

export class SpendingLimitService {
    constructor() { }

    /**
     * Check if a transaction would exceed daily limits
     */
    public async checkDailyLimit(
        smartCardId: string,
        tokenAddress: Address,
        amount: bigint
    ): Promise<LimitCheckResult> {
        // 1. Get Smart Card limits
        const smartCard = await prisma.smartCard.findUnique({
            where: { id: smartCardId },
            select: { tokenLimits: true },
        });

        if (!smartCard || !smartCard.tokenLimits) {
            return { allowed: true }; // No limits configured
        }

        // 2. Find limit for this token
        const limits = smartCard.tokenLimits as unknown as TokenLimitConfig[];
        const tokenLimit = limits.find(
            (l) => l.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
        );

        if (!tokenLimit) {
            return { allowed: true }; // No limit for this specific token
        }

        // 3. Get current spending
        const spending = await prisma.smartCardSpending.findUnique({
            where: {
                smartCardId_tokenAddress: {
                    smartCardId,
                    tokenAddress,
                },
            },
        });

        // 4. Check if we need to reset daily limit
        let currentDailySpent = BigInt(0);
        if (spending) {
            const lastReset = new Date(spending.lastResetDate);
            const now = new Date();
            const isSameDay =
                lastReset.getDate() === now.getDate() &&
                lastReset.getMonth() === now.getMonth() &&
                lastReset.getFullYear() === now.getFullYear();

            if (isSameDay) {
                currentDailySpent = BigInt(spending.dailySpent);
            }
        }

        // 5. Compare
        const limitAmount = BigInt(tokenLimit.limitAmount);
        if (currentDailySpent + amount > limitAmount) {
            return {
                allowed: false,
                reason: `Daily limit exceeded. Limit: ${limitAmount}, Spent: ${currentDailySpent}, Attempted: ${amount}`,
                currentSpent: currentDailySpent,
                limit: limitAmount,
            };
        }

        return { allowed: true };
    }

    /**
     * Check all limits (daily and total)
     */
    public async checkAllLimits(
        smartCardId: string,
        tokenAddress: Address,
        amount: bigint
    ): Promise<LimitCheckResult> {
        return this.checkDailyLimit(smartCardId, tokenAddress, amount);
    }

    /**
     * Increment spending for a token
     */
    public async incrementSpending(
        smartCardId: string,
        tokenAddress: Address,
        amount: bigint
    ) {
        const now = new Date();

        return prisma.$transaction(async (tx) => {
            const existing = await tx.smartCardSpending.findUnique({
                where: {
                    smartCardId_tokenAddress: {
                        smartCardId,
                        tokenAddress,
                    },
                },
            });

            if (!existing) {
                return tx.smartCardSpending.create({
                    data: {
                        smartCardId,
                        tokenAddress,
                        dailySpent: amount.toString(),
                        totalSpent: amount.toString(),
                        lastResetDate: now,
                    },
                });
            }

            // Check if we need to reset daily
            const lastReset = new Date(existing.lastResetDate);
            const isSameDay =
                lastReset.getDate() === now.getDate() &&
                lastReset.getMonth() === now.getMonth() &&
                lastReset.getFullYear() === now.getFullYear();

            let newDailySpent = BigInt(existing.dailySpent);
            if (!isSameDay) {
                newDailySpent = BigInt(0); // Reset
            }

            newDailySpent += amount;
            const newTotalSpent = BigInt(existing.totalSpent) + amount;

            return tx.smartCardSpending.update({
                where: {
                    smartCardId_tokenAddress: {
                        smartCardId,
                        tokenAddress,
                    },
                },
                data: {
                    dailySpent: newDailySpent.toString(),
                    totalSpent: newTotalSpent.toString(),
                    lastResetDate: now,
                },
            });
        });
    }

    /**
     * Get spending status for a specific token
     */
    public async getSpendingStatus(
        smartCardId: string,
        tokenAddress: Address
    ): Promise<SpendingStatus | null> {
        const smartCard = await prisma.smartCard.findUnique({
            where: { id: smartCardId },
            select: { tokenLimits: true },
        });

        if (!smartCard || !smartCard.tokenLimits) return null;

        const limits = smartCard.tokenLimits as unknown as TokenLimitConfig[];
        const tokenLimit = limits.find(
            (l) => l.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
        );

        if (!tokenLimit) return null;

        const spending = await prisma.smartCardSpending.findUnique({
            where: {
                smartCardId_tokenAddress: {
                    smartCardId,
                    tokenAddress,
                },
            },
        });

        let dailySpent = BigInt(0);
        let totalSpent = BigInt(0);
        let lastResetDate = new Date();

        if (spending) {
            totalSpent = BigInt(spending.totalSpent);
            lastResetDate = new Date(spending.lastResetDate);

            const now = new Date();
            const isSameDay =
                lastResetDate.getDate() === now.getDate() &&
                lastResetDate.getMonth() === now.getMonth() &&
                lastResetDate.getFullYear() === now.getFullYear();

            if (isSameDay) {
                dailySpent = BigInt(spending.dailySpent);
            }
        }

        const limitAmount = BigInt(tokenLimit.limitAmount);

        return {
            tokenAddress,
            dailySpent,
            totalSpent,
            dailyLimit: limitAmount,
            remainingDaily: limitAmount - dailySpent,
            lastResetDate,
        };
    }

    /**
     * Reset daily limits for all cards (cron job)
     */
    public async resetDailyLimits() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const result = await prisma.smartCardSpending.updateMany({
            where: {
                lastResetDate: {
                    lt: startOfDay,
                },
            },
            data: {
                dailySpent: "0",
                lastResetDate: now,
            },
        });

        console.log(`[SpendingLimitService] Reset daily limits for ${result.count} records`);
        return result.count;
    }
}

export const spendingLimitService = new SpendingLimitService();
