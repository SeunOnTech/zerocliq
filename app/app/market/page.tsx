"use client"

import { useState } from "react";
import { MarketStatsBar } from "@/components/market/MarketStatsBar";
import { OrderBook } from "@/components/market/OrderBook";
import { CreateOrderForm } from "@/components/market/CreateOrderForm";
import { MyOrders } from "@/components/market/MyOrders";
import { motion, AnimatePresence } from "framer-motion";

export default function MarketPage() {
    const [activeView, setActiveView] = useState<'market' | 'create' | 'profile'>('market');

    return (
        <div className="container mx-auto px-2 md:px-4 py-4 lg:py-12">
            <div className="max-w-6xl mx-auto">
                <AnimatePresence mode="wait">
                    {activeView === 'market' && (
                        <motion.div
                            key="market"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold tracking-tight mb-2">P2P Market</h1>
                                <p className="text-muted-foreground">Buy and sell crypto directly with other users. Zero slippage, zero fees.</p>
                            </div>

                            {/* Real-time Market Stats */}
                            <div className="mb-8">
                                <MarketStatsBar />
                            </div>

                            <OrderBook onCreateOrder={() => setActiveView('create')} />
                        </motion.div>
                    )}

                    {activeView === 'create' && (
                        <motion.div
                            key="create"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <CreateOrderForm onBack={() => setActiveView('market')} />
                        </motion.div>
                    )}

                    {activeView === 'profile' && (
                        <motion.div
                            key="profile"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="mb-6 flex items-center gap-4">
                                <button
                                    onClick={() => setActiveView('market')}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    &larr; Back to Market
                                </button>
                                <h2 className="text-2xl font-bold">My Orders</h2>
                            </div>
                            <MyOrders />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
