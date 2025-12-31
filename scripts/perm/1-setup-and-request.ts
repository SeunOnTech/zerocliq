/**
 * ERC-7715 Step 1-5: Setup Session Account and Create Delegation
 * 
 * Following official MetaMask Smart Accounts Kit docs 100%:
 * https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/
 * 
 * This script:
 * - Step 2: Set up Public Client
 * - Step 3: Set up Session Account (Smart Account)
 * - Creates and signs a delegation using the Delegation Framework
 * - Generates permissionsContext for redemption (using redeemDelegations utility per docs)
 * - Saves to permissions.json
 * 
 * Usage:
 *   npx tsx scripts/perm/1-setup-and-request.ts
 */

import { createPublicClient, http, type Hex, type Address, parseUnits, parseAbiParameters, encodeAbiParameters } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { sepolia as chain } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import {
    toMetaMaskSmartAccount,
    Implementation,
    getSmartAccountsEnvironment,
    createDelegation,
    createExecution,
    ExecutionMode,
} from "@metamask/smart-accounts-kit"
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"
import * as fs from "fs"
import * as path from "path"
import * as dotenv from "dotenv"
import * as crypto from "crypto"

dotenv.config()

// Helper to create a random salt
function createSalt(): Hex {
    return ("0x" + crypto.randomBytes(32).toString("hex")) as Hex
}

async function main() {
    console.log("=".repeat(60))
    console.log("ERC-7715 Steps 1-5: Setup & Create Delegation")
    console.log("Following official docs guide (Periodic Permission)")
    console.log("=".repeat(60))

    // Load configs
    const sessionConfigPath = path.join(__dirname, "session-account.json")
    const userConfigPath = path.join(__dirname, "user-config.json")
    const sessionConfig = JSON.parse(fs.readFileSync(sessionConfigPath, "utf-8"))
    const userConfig = JSON.parse(fs.readFileSync(userConfigPath, "utf-8"))

    // Per docs Step 2: Set up Public Client
    const publicClient = createPublicClient({ chain, transport: http() })
    console.log("✅ Public Client ready")

    const environment = getSmartAccountsEnvironment(chain.id)

    // Per docs Step 3: Set up Session Account
    const sessionEOA = privateKeyToAccount(sessionConfig.privateKey as Hex)
    const sessionAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [sessionEOA.address, [], [], []],
        deploySalt: sessionConfig.deploySalt as Hex,
        signer: { account: sessionEOA },
    })
    console.log("✅ Session Smart Account:", sessionAccount.address)

    // Set up User Account
    const userEOA = privateKeyToAccount(userConfig.userPrivateKey as Hex)
    const userSmartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [userEOA.address, [], [], []],
        deploySalt: "0x" as Hex,
        signer: { account: userEOA },
    })
    console.log("✅ User Smart Account:", userSmartAccount.address)

    // Token configuration (Sepolia USDC)
    const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address

    // Check Deployment
    const userCode = await publicClient.getBytecode({ address: userSmartAccount.address })
    if (!userCode) {
        console.log("🚀 Deploying User Smart Account...")
        const userBundlerClient = createBundlerClient({
            client: publicClient,
            transport: http(`https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`),
            paymaster: true,
            account: userSmartAccount,
        })
        try {
            const hash = await userBundlerClient.sendUserOperation({
                calls: [{ to: userSmartAccount.address, value: 0n, data: "0x" }],
                maxFeePerGas: 50000000000n,
                maxPriorityFeePerGas: 5000000000n,
            })
            await userBundlerClient.waitForUserOperationReceipt({ hash })
            console.log("✅ User Smart Account Deployed!")
        } catch (e: any) {
            console.error("❌ Deployment failed:", e.message)
            process.exit(1)
        }
    }

    // Step 5: Create Delegation
    console.log("\n📝 Creating delegation (erc20-token-periodic)...")

    // Per User Reference Guide: Use erc20-token-periodic
    const unsignedDelegation = createDelegation({
        to: sessionAccount.address,
        from: userSmartAccount.address,
        environment: userSmartAccount.environment,
        scope: {
            type: "erc20-token-periodic",
            tokenAddress,
            periodAmount: parseUnits("10", 6), // 10 USDC
            periodDuration: 86400, // 1 Day
        },
        caveats: [],
        salt: createSalt(), // CRITICAL FIX: Ensure 32-byte salt
    })

    const signature = await userSmartAccount.signDelegation({ delegation: unsignedDelegation })
    const signedDelegation = { ...unsignedDelegation, signature }
    console.log("✅ Delegation signed")

    // Generate permissionsContext via redeemDelegations utility
    // But we need to Fix the Encoding for sendUserOperationWithDelegation
    // As discovered, it likely wants the SignedDelegation[] array, NOT the call data.
    // However, the docs say: "use redeemDelegations utility function to generate the calldata manually"
    // This implies permissionsContext == CallData.
    // I will stick to CallData because the docs explicitly say so.
    // "Encoded calldata for redeeming permissions"

    console.log("\n🔧 Generating permissionsContext (using utility)...")
    const permissionsContext = DelegationManager.encode.redeemDelegations({
        delegations: [[signedDelegation]],
        modes: [ExecutionMode.SingleDefault],
        executions: [[createExecution({
            target: tokenAddress,
            value: 0n,
            callData: "0x" as Hex,
        })]],
    })
    console.log("✅ permissionsContext generated")

    // Need to save the delegation structure clearly for Script 2?
    // Script 2 just reads context.

    const permissionsData = {
        sessionAccount: {
            smartAccount: sessionAccount.address,
            privateKey: sessionConfig.privateKey
        },
        userAccount: { smartAccount: userSmartAccount.address },
        permission: { tokenAddress },
        permissionsContext,
        delegationManager: environment.DelegationManager,
        signedDelegation // Save for debugging
    }

    fs.writeFileSync(path.join(process.cwd(), "permissions.json"), JSON.stringify(permissionsData, null, 2))
    console.log("✅ Saved permissions.json")
}

main().catch((err) => {
    console.error("❌ Error:", err.message)
    process.exit(1)
})
