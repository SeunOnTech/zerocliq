import { NextResponse } from 'next/server'
import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit"

export async function GET() {
    try {
        const env = getSmartAccountsEnvironment(1) as any

        return NextResponse.json({
            keys: Object.keys(env.caveatEnforcers || {})
        })
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
