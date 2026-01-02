
import { NextRequest, NextResponse } from "next/server"
import { dcaService } from "@/lib/server/services/dca.service"
import { getChainById } from "@/lib/server/config/chains"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { userAddress, permissionsContext, intent, chainId = 11155111 } = body

        if (!userAddress || !permissionsContext || !intent) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
        }

        const chainConfig = getChainById(chainId)
        if (!chainConfig) {
            return NextResponse.json({ error: "Invalid chain ID" }, { status: 400 })
        }

        // Resolve Source Token
        // Intent usually has symbol, we need address/decimals
        const sourceToken = chainConfig.tokens.find(
            t => t.symbol.toUpperCase() === (intent.tokenSymbol || "USDC").toUpperCase()
                || t.address.toLowerCase() === (intent.tokenAddress || "").toLowerCase()
        )

        if (!sourceToken) {
            return NextResponse.json({ error: `Token ${intent.tokenSymbol} not supported on this chain` }, { status: 400 })
        }

        // Resolve Target Token (Default to WETH if not specified)
        const targetSymbol = intent.targetTokenSymbol || "WETH"
        const targetToken = chainConfig.tokens.find(t => t.symbol.toUpperCase() === targetSymbol.toUpperCase())

        if (!targetToken) {
            return NextResponse.json({ error: `Target token ${targetSymbol} not supported` }, { status: 400 })
        }

        const result = await dcaService.executeDemoDCA({
            userAddress,
            permissionsContext,
            sourceTokenAddress: sourceToken.address,
            sourceTokenSymbol: sourceToken.symbol,
            sourceTokenDecimals: sourceToken.decimals,
            targetTokenAddress: targetToken.address,
            targetTokenSymbol: targetToken.symbol,
            amount: (intent.amount || 0.01).toString(), // Default to small amount if 0 (e.g. infinite DCA)
        })

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            transferTxHash: result.transferTxHash,
            swapTxHash: result.swapTxHash,
            data: result
        })

    } catch (error: any) {
        console.error("[Execute Demo API] Error:", error)
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
    }
}
