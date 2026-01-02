
import { NextResponse } from "next/server"
import { getChainById, getViemChain } from "@/lib/server/config/chains"
import { getPaymasterUrl, AGENT_SMART_ACCOUNT_DEPLOY_SALT } from "@/lib/server/config/pimlico"
import { createPublicClient, http, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit"

export async function GET() {
    try {
        const chainId = 11155111
        const viemChain = getViemChain(chainId)
        const chainConfig = getChainById(chainId)

        if (!chainConfig) {
            return NextResponse.json({ error: "Chain not supported" }, { status: 500 })
        }

        const agentPrivateKey = process.env.AGENT_EOA_PRIVATE_KEY as Hex
        if (!agentPrivateKey) {
            return NextResponse.json({ error: "Agent private key not found" }, { status: 500 })
        }

        const agentEOA = privateKeyToAccount(agentPrivateKey)
        const publicClient = createPublicClient({ chain: viemChain, transport: http(chainConfig.rpcUrl) })

        const agentSmartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [agentEOA.address, [], [], []],
            deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
            signer: { account: agentEOA },
        })

        return NextResponse.json({
            address: agentSmartAccount.address
        })

    } catch (error: any) {
        console.error("[Agent Address API] Error:", error)
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
    }
}
