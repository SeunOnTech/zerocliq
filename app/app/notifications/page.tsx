"use client";

import { motion } from "framer-motion";
import { Bell, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotificationsPage() {
    return (
        <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
            >
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                >
                    <Link href="/app">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-xl font-bold">Notifications</h1>
                    <p className="text-xs text-muted-foreground">
                        Activity updates will appear here
                    </p>
                </div>
            </motion.div>

            {/* Empty State */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
            >
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1">
                    Check back after executing some DCA trades!
                </p>
            </motion.div>
        </div>
    );
}
