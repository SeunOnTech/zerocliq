/**
 * Shared Session Account Configuration
 * 
 * CRITICAL: This file defines the SHARED parameters for the session account
 * used in ERC-7715 Advanced Permissions flow.
 * 
 * The SAME configuration MUST be used for:
 * 1. Frontend: When requesting permissions (signer.data.address)
 * 2. Backend: When redeeming permissions (bundlerClient.sendUserOperationWithDelegation)
 * 
 * Per MetaMask Smart Accounts Kit docs:
 * https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/
 */

import { Implementation } from "@metamask/smart-accounts-kit";
import type { Hex } from "viem";

/**
 * Session account configuration following official docs Step 3
 */
export const SESSION_ACCOUNT_CONFIG = {
    /**
     * Implementation type for the session account
     * Must be Hybrid for ERC-7715 compatibility
     */
    implementation: Implementation.Hybrid,

    /**
     * Deploy salt - deterministic address generation
     * Using a fixed salt ensures the same address is computed on frontend and backend
     */
    deploySalt: "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex,

    /**
     * Deploy params generator
     * Following docs: [account.address, [], [], []]
     */
    getDeployParams: (signerAddress: `0x${string}`): readonly [string, readonly [], readonly [], readonly []] => {
        return [signerAddress, [], [], []] as const;
    }
} as const;

/**
 * Environment variable name for the agent's private key
 */
export const AGENT_PRIVATE_KEY_ENV = "AGENT_EOA_PRIVATE_KEY";
