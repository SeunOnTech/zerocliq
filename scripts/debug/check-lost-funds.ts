
// @ts-nocheck
import { createPublicClient, http, parseAbi, formatUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit"
import { AGENT_SMART_ACCOUNT_DEPLOY_SALT } from "../../lib/server/config/pimlico"
import dotenv from "dotenv"

const sepolia = {
    id: 11155111,
    name: 'Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.ankr.com/eth_sepolia'] } }
}

dotenv.config()

async function main() {
    const chainId = 11155111 // Sepolia
    const publicClient = createPublicClient({
        chain: sepolia as any,
        transport: http("https://rpc.ankr.com/eth_sepolia"), // Hardcoded for reliability
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

    console.log("--- DEBUG: FUNDS LOCATOR ---")
    console.log("Agent Smart Account:", agentSmartAccount.address)

    // 2. User Info (Hardcoded from previous logs/context for speed)
    const userSmartAccount = "0xab9E4c4228D0dbF07076506d1F6135cDC5A46e62" // From logs
    const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" // Sepolia USDC

    console.log("User Smart Account: ", userSmartAccount)

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

    console.log("\n--- BALANCES ---")
    console.log(`Agent ETH: ${formatUnits(agentEth, 18)} ETH`)
    console.log(`Agent USDC: ${formatUnits(agentUsdc, 6)} USDC (Expect ~4 here if stuck)`)
    console.log(`User USDC: ${formatUnits(userUsdc, 6)} USDC`)

    if (agentUsdc > 0n) {
        console.log("\n✅ FOUND IT! The funds are stuck in the Agent Smart Account.")
        console.log("This happened because the 'Pull' (User->Agent) worked, but the 'Swap' failed.")
    } else {
        console.log("\n❌ Funds not found in Agent Account. Marking as mystery.")
    }
}

main()
