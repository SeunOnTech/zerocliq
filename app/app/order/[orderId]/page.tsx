import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";

type Props = {
    params: { orderId: string };
    searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    // In a real app, you would fetch order details here
    const { orderId } = await params;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zero-slip-psi.vercel.app";
    const actionUrl = `${baseUrl}/api/actions/take-order?orderId=${orderId}`;

    return {
        title: "ZeroSlip Instant Order",
        description: "Take this P2P limit order instantly with 0% slippage. Verified by ZeroSlip.",
        openGraph: {
            title: "ZeroSlip Instant Order",
            description: "Take this P2P limit order instantly with 0% slippage.",
            images: [
                {
                    url: "https://r4.wallpaperflare.com/wallpaper/106/256/928/minimalism-abstract-blue-gradient-wallpaper-preview.jpg", // Replace with dynamic OG image if possible
                    width: 1200,
                    height: 630,
                    alt: "ZeroSlip Order",
                },
            ],
        },
        other: {
            "solana-action": actionUrl,
        },
    };
}

export default async function OrderPage({ params }: Props) {
    const { orderId } = await params;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
                <div className="flex justify-center">
                    <div className="h-16 w-16 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Zap className="h-8 w-8 text-blue-500" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">ZeroSlip P2P Order</h1>
                    <p className="text-zinc-400">
                        You've found a direct P2P Limit Order.
                    </p>
                </div>

                <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm break-all text-zinc-500">
                    Order ID: {orderId}
                </div>

                <div className="pt-4">
                    <p className="text-sm text-zinc-500 mb-4">
                        If you have a Solana wallet enabling Blinks, you should see an Action card above.
                        Otherwise, launch the app to trade.
                    </p>

                    <Link
                        href="/market"
                        className="inline-flex items-center justify-center gap-2 w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
                    >
                        Launch App <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
