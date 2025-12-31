
import { NextResponse } from 'next/server'
import { createPublicClient, http, parseAbi, formatUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit"

const AGENT_SMART_ACCOUNT_DEPLOY_SALT = "0x42" // Hardcoded from pimlico config
const sepolia = {
    id: 11155111,
    name: 'Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.ankr.com/eth_sepolia'] } }
}

// FORCE DYNAMIC
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const publicClient = createPublicClient({
            chain: sepolia as any,
            transport: http("https://rpc.ankr.com/eth_sepolia"),
        })

        // 1. Setup Agent Smart Account
        const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`
        if (!agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY missing")

        const agentEOA = privateKeyToAccount(agentPrivateKey)
        const agentSmartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [agentEOA.address, [], [], []],
            deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
            signer: { account: agentEOA },
        })

        const userSmartAccount = "0xab9E4c4228D0dbF07076506d1F6135cDC5A46e62"
        const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

        // 3. Check Balances
        const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)'])

        const [
            agentEth,
            agentUsdc,
            userUsdc
        ] = await Promise.all([
            publicClient.getBalance({ address: agentSmartAccount.address }),
            publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: 'balanceOf', args: [agentSmartAccount.address] }),
            publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: 'balanceOf', args: [userSmartAccount] })
        ])

        return NextResponse.json({
            success: true,
            agentSmartAccount: agentSmartAccount.address,
            balances: {
                agentEth: formatUnits(agentEth, 18),
                agentUsdc: formatUnits(agentUsdc, 6),
                userUsdc: formatUnits(userUsdc, 6)
            },
            message: agentUsdc > 0n ? "FUNDS FOUND IN AGENT ACCOUNT" : "Funds not in agent account"
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
    }
}
