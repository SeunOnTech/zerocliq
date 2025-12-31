/**
 * ERC-7715 Step 6-7: Redeem Permission and Execute Transfer
 * 
 * Following official MetaMask Smart Accounts Kit docs 100%:
 * https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/
 */

import { createBundlerClient } from "viem/account-abstraction"
import { createPublicClient, http, parseAbi, encodeFunctionData, type Hex, type Address } from "viem"
import { sepolia as chain } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit"
import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions"
import * as fs from "fs"
import * as path from "path"
import * as dotenv from "dotenv"

dotenv.config()

const ERC20_TRANSFER_ABI = parseAbi([
    "function transfer(address to, uint256 amount) external returns (bool)"
])

const BUNDLER_URL = `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`

async function main() {
    console.log("=".repeat(60))
    console.log("ERC-7715 Steps 6-7: Redeem Permission & Execute Transfer")
    console.log("Strict adherence to official docs using sendUserOperationWithDelegation")
    console.log("=".repeat(60))

    // Load permissions.json
    const permissionsPath = path.join(process.cwd(), "permissions.json")
    if (!fs.existsSync(permissionsPath)) {
        console.error("❌ permissions.json not found!")
        process.exit(1)
    }

    const permissions = JSON.parse(fs.readFileSync(permissionsPath, "utf-8"))
    console.log("\n📄 Loaded permissions.json")

    // Per docs Step 2: Set up Public Client
    console.log("\n📡 Step 2: Setting up Public Client...")
    const publicClient = createPublicClient({
        chain,
        transport: http(),
    })
    console.log("   ✅ Public Client ready")

    // Per docs Step 3: Set up Session Account (using saved private key)
    console.log("\n🔐 Step 3: Setting up Session Account...")
    const sessionEOA = privateKeyToAccount(permissions.sessionAccount.privateKey as Hex)

    // Per docs: toMetaMaskSmartAccount
    const sessionAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [sessionEOA.address, [], [], []],
        deploySalt: "0x" as Hex,
        signer: { account: sessionEOA },
    })
    console.log("   ✅ Session Smart Account:", sessionAccount.address)

    // Per docs Step 6: Set up Bundler Client with erc7710BundlerActions
    console.log("\n🔧 Step 6: Setting up Bundler Client...")
    const bundlerClient = createBundlerClient({
        client: publicClient,
        transport: http(BUNDLER_URL),
        paymaster: true,
    }).extend(erc7710BundlerActions())
    console.log("   ✅ Bundler Client ready")

    // Prepare transfer calldata
    const tokenAddress = permissions.permission.tokenAddress as Address
    const recipient = "0x5153d9734b24715943036527279cbff18a4493ea" as Address // Test recipient
    const amount = BigInt(10000) // 0.01 USDC

    // Check balance first
    console.log("\n💰 Checking balance...")
    const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
        functionName: "balanceOf",
        args: [permissions.userAccount.smartAccount as Address],
    })
    console.log(`   Balance: ${balance.toString()} (Needs ${amount.toString()})`)

    if (balance < amount) {
        console.error("❌ Insufficient USDC balance!")
        process.exit(1)
    }

    console.log("\n📦 Preparing transfer...")
    const calldata = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [recipient, amount],
    })

    // Per docs Step 7: Redeem using sendUserOperationWithDelegation
    console.log("\n🚀 Step 7: Redeeming permission with sendUserOperationWithDelegation...")

    const permissionsContext = permissions.permissionsContext as Hex
    const delegationManager = permissions.delegationManager as Address

    try {
        const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({
            publicClient,
            account: sessionAccount as any,
            calls: [
                {
                    to: tokenAddress,
                    data: calldata,
                    value: 0n,
                    permissionsContext,
                    delegationManager,
                },
            ],
            // Suggested gas limits
            maxFeePerGas: 50000000000n,
            maxPriorityFeePerGas: 5000000000n,
        })

        console.log("\n✅ SUCCESS!")
        console.log("   UserOperation Hash:", userOperationHash)

        console.log("\n⏳ Waiting for transaction receipt...")
        const receipt = await bundlerClient.waitForUserOperationReceipt({
            hash: userOperationHash,
        })

        console.log("   ✅ Transaction confirmed!")
        console.log("   TX Hash:", receipt.receipt.transactionHash)

    } catch (error: any) {
        console.error("\n❌ Error:", error.message)
        if (error.cause) console.error("   Cause:", error.cause)
        process.exit(1)
    }
}

main().catch((err) => {
    console.error("❌ Error:", err.message)
    process.exit(1)
})
