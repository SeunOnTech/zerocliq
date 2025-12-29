/**
 * Delegation Builder Service
 * 
 * Creates Smart Card delegations using MetaMask Smart Accounts Kit.
 */

import { getSmartAccountsEnvironment, createDelegation } from "@metamask/smart-accounts-kit";
import type { Address } from "viem";
import { getSmartCardChainConfig } from "@/lib/server/config/smart-card-chains";
import { getDelegationScopeForType } from "@/lib/server/config/smart-card-types";
import { STANDARD_DELEGATION_SELECTORS } from "@/lib/server/config/delegation-constants";
import type { BuildDelegationParams, BuildDelegationResult, BuildDelegationForTypeParams } from "@/lib/server/types/delegation.types";

/**
 * Service responsible for creating Smart Card delegations.
 */
export class DelegationBuilderService {

    constructor() { }

    /**
     * Build a delegation using the SDK's createDelegation helper.
     * @deprecated Use buildDelegationForType for type-based delegations
     */
    public async buildDelegation(params: BuildDelegationParams): Promise<BuildDelegationResult> {
        const { chainId, delegatorAddress, delegateAddress } = params;

        // 1. Get Chain Configuration & Environment
        const chainConfig = getSmartCardChainConfig(chainId);
        const environment = getSmartAccountsEnvironment(chainId);

        // 2. Build Dynamic Targets List (Routers + Tokens)
        const whitelistedRouters = chainConfig.getWhitelistedRouters();
        const supportedTokens = chainConfig.getSupportedTokens().map(t => t.address as Address);

        const targets: Address[] = [
            ...whitelistedRouters,
            ...supportedTokens
        ];

        // Ensure unique targets
        const uniqueTargets = Array.from(new Set(targets));

        console.log(`[DelegationBuilder] Building delegation for Chain ${chainId}`);
        console.log(`[DelegationBuilder] Delegator: ${delegatorAddress}`);
        console.log(`[DelegationBuilder] Delegate: ${delegateAddress}`);
        console.log(`[DelegationBuilder] Targets (${uniqueTargets.length}):`, uniqueTargets.slice(0, 5), "...");

        // 3. Create Delegation using SDK Helper
        const delegation = createDelegation({
            scope: {
                type: "functionCall",
                targets: uniqueTargets,
                selectors: STANDARD_DELEGATION_SELECTORS
            },
            to: delegateAddress,
            from: delegatorAddress,
            environment: environment,
        });

        console.log("[DelegationBuilder] Delegation struct created!");
        console.log(`[DelegationBuilder] Caveats: ${delegation.caveats.length}`);

        return {
            delegation,
            chainId,
            whitelistedRouters,
        };
    }

    /**
     * Build a delegation based on Smart Card type.
     */
    public async buildDelegationForType(params: BuildDelegationForTypeParams): Promise<BuildDelegationResult> {
        const { chainId, delegatorAddress, delegateAddress, type } = params;

        // 1. Get delegation scope from type config
        const scope = getDelegationScopeForType(type, chainId);
        const environment = getSmartAccountsEnvironment(chainId);

        // Ensure unique targets
        const uniqueTargets = Array.from(new Set(scope.targets)) as Address[];

        console.log(`[DelegationBuilder] Building ${type} delegation for Chain ${chainId}`);
        console.log(`[DelegationBuilder] Delegator: ${delegatorAddress}`);
        console.log(`[DelegationBuilder] Delegate: ${delegateAddress}`);
        console.log(`[DelegationBuilder] Targets: ${uniqueTargets.length} contracts`);
        console.log(`[DelegationBuilder] Selectors: ${scope.selectors.length} functions`);

        // 2. Create Delegation using SDK Helper
        const delegation = createDelegation({
            scope: {
                type: "functionCall",
                targets: uniqueTargets,
                selectors: scope.selectors
            },
            to: delegateAddress,
            from: delegatorAddress,
            environment: environment,
        });

        // PATCH: Ensure ValueLte allows native value spending (required for component swaps)
        // The SDK might default to 0 value, which causes "ValueLteEnforcer:value-too-high"
        const envAny = environment as any;
        // Enforcers are nested in 'caveatEnforcers' property
        const enforcers = envAny.caveatEnforcers || {};
        const valueLteEnforcer = enforcers.ValueLteEnforcer || enforcers.valueLteEnforcer;

        if (valueLteEnforcer) {
            console.log(`[DelegationBuilder] Found ValueLteEnforcer: ${valueLteEnforcer}`);
            // ... (rest is same)
            // Max Uint256 to allow any value
            const maxVal = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

            const existingIdx = delegation.caveats.findIndex(
                c => c.enforcer.toLowerCase() === (valueLteEnforcer as string).toLowerCase()
            );

            if (existingIdx !== -1) {
                console.log(`[DelegationBuilder] Upgrading ValueLte limit to MAX`);
                delegation.caveats[existingIdx].terms = maxVal;
            } else {
                console.log(`[DelegationBuilder] Adding ValueLte with MAX limit`);
                // @ts-ignore
                delegation.caveats.push({
                    enforcer: valueLteEnforcer,
                    terms: maxVal
                });
            }
        }

        console.log(`[DelegationBuilder] ${type} delegation created with ${delegation.caveats.length} caveats`);

        // Extract whitelisted routers from targets
        const chainConfig = getSmartCardChainConfig(chainId);
        const whitelistedRouters = chainConfig.getWhitelistedRouters();

        return {
            delegation,
            chainId,
            whitelistedRouters,
        };
    }

    /**
     * Get whitelisted routers for a specific chain
     */
    public getWhitelistedRouters(chainId: number): Address[] {
        return getSmartCardChainConfig(chainId).getWhitelistedRouters();
    }

    /**
     * Get supported tokens for a specific chain
     */
    public getSupportedTokens(chainId: number) {
        return getSmartCardChainConfig(chainId).getSupportedTokens();
    }
}

// Export singleton instance
export const delegationBuilderService = new DelegationBuilderService();
