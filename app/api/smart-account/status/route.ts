import { NextRequest, NextResponse } from "next/server"
import { getSmartAccountStatus } from "@/lib/smart-account"
import { Address } from "viem"

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get("address")
    const chainId = searchParams.get("chainId")

    if (!address || !chainId) {
        return NextResponse.json(
            { error: "Missing address or chainId" },
            { status: 400 }
        )
    }

    try {
        const status = await getSmartAccountStatus(
            address as Address,
            parseInt(chainId)
        )

        return NextResponse.json(status)
    } catch (error: any) {
        console.error("Smart Account Status API Error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to fetch status" },
            { status: 500 }
        )
    }
}
