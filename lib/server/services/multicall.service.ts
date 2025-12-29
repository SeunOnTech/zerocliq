/**
 * Multicall Service
 * 
 * Executes multiple read calls in a single RPC request using Multicall3.
 */

import { type PublicClient, type ContractFunctionParameters } from "viem";

export class MulticallService {
    /**
     * Execute multiple read calls in a single RPC request using the chain's Multicall3 contract.
     * @param client Viem PublicClient
     * @param contracts Array of contract calls (address, abi, functionName, args)
     * @returns Array of results
     */
    static async multicall(
        client: PublicClient,
        contracts: ContractFunctionParameters[]
    ): Promise<any[]> {
        try {
            const results = await client.multicall({
                contracts,
                allowFailure: true, // Allow individual calls to fail without reverting the whole batch
            });

            return results.map((r) => {
                if (r.status === "success") return r.result;
                return null;
            });
        } catch (error) {
            console.error("Multicall failed:", error);
            throw error;
        }
    }
}
