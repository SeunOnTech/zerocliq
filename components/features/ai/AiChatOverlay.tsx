"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowRight, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { IntentConfirmationCard } from "./IntentConfirmationCard"
import { useStreamPermission } from "@/lib/hooks/useStreamPermission"
import { IntentExecutionModal } from "./IntentExecutionModal"
import { ZeroSlipLogo } from "@/components/ZeroSlipLogo"
import type { ParsedIntent } from "@/lib/types/intents"

interface AiChatOverlayProps {
    isOpen: boolean
    onClose: () => void
}

type Message = {
    id: string
    role: "system" | "user" | "assistant"
    text: string
    timestamp: number
    intent?: ParsedIntent
}

/**
 * Simple markdown renderer for chat messages
 * Supports: **bold**, line breaks, paragraphs
 */
function renderMarkdownText(text: string): React.ReactNode {
    // First, replace escaped newlines with actual newlines
    const normalizedText = text.replace(/\\n/g, '\n');

    // Split into paragraphs (double newline)
    const paragraphs = normalizedText.split(/\n\n+/);

    return paragraphs.map((paragraph, pIndex) => {
        // Split paragraph by bold markers and single newlines
        const parts = paragraph.split(/(\*\*[^*]+\*\*|\n)/g);

        const renderedParts = parts.map((part, index) => {
            // Bold: **text**
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
            }
            // Single line break
            if (part === '\n') {
                return <br key={index} />;
            }
            // Regular text
            return part;
        });

        // Wrap each paragraph in a div with margin
        return (
            <span key={pIndex} className={pIndex > 0 ? "block mt-3" : ""}>
                {renderedParts}
            </span>
        );
    });
}

const SUGGESTIONS = [
    { label: "Streaming DCA", prompt: "DCA $500 into ETH over 2 weeks" },
    { label: "TWAP Sell", prompt: "Sell 1000 LINK over 24 hours" },
    { label: "Trailing Stop", prompt: "Set a 10% trailing stop on my ETH" },
]

export function AiChatOverlay({ isOpen, onClose }: AiChatOverlayProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const [pendingIntent, setPendingIntent] = useState<ParsedIntent | null>(null)
    const [isExecuting, setIsExecuting] = useState(false)
    const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false)
    const [permissionContext, setPermissionContext] = useState<string | undefined>(undefined)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // MetaMask permission hook
    const { requestPermission } = useStreamPermission()

    // Initial Greeting
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setIsTyping(true)
            setTimeout(() => {
                setMessages([
                    {
                        id: "welcome",
                        role: "assistant",
                        text: "I am your ZeroSlip Intelligent Agent, capable of executing complex DeFi intents. Try saying something like:\n\n• \"DCA $500 into ETH over 2 weeks\"\n• \"Sell 1000 LINK over 24 hours\"\n• \"Set a 10% trailing stop on my ETH\"",
                        timestamp: Date.now()
                    }
                ])
                setIsTyping(false)
            }, 500)
        }
    }, [isOpen])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isTyping, pendingIntent])

    const handleSend = async (text: string = inputValue) => {
        if (!text.trim() || isTyping) return

        // Add user message
        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            text: text,
            timestamp: Date.now()
        }
        setMessages(prev => [...prev, userMsg])
        setInputValue("")
        setIsTyping(true)

        try {
            // Call parse-intent API
            const response = await fetch('/api/ai/parse-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    chainId: 11155111 // Sepolia
                })
            })

            const data = await response.json()

            if (data.success && data.intent) {
                const intent = data.intent as ParsedIntent

                // Check if clarification is needed
                if (intent.clarificationNeeded) {
                    const aiMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        text: intent.clarificationNeeded,
                        timestamp: Date.now()
                    }
                    setMessages(prev => [...prev, aiMsg])
                } else {
                    // Show confirmation card
                    const aiMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        text: intent.humanReadableSummary || "I understand your intent. Please confirm:",
                        intent: intent,
                        timestamp: Date.now()
                    }
                    setMessages(prev => [...prev, aiMsg])
                    setPendingIntent(intent)
                }
            } else {
                // Error response
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    text: data.error || "I couldn't understand that. Could you rephrase?",
                    timestamp: Date.now()
                }
                setMessages(prev => [...prev, aiMsg])
            }
        } catch (error) {
            console.error('[AI Chat] Error:', error)
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                text: "Sorry, I encountered an error. Please try again.",
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, aiMsg])
        } finally {
            setIsTyping(false)
        }
    }

    const handleConfirmIntent = async () => {
        if (!pendingIntent) return

        setIsExecuting(true)

        try {
            // Check if intent type supports stream permissions
            const streamPermissionIntents = ['STREAMING_DCA', 'TWAP_ORDER']

            if (streamPermissionIntents.includes(pendingIntent.intentType)) {
                // Request MetaMask Stream Permission (ERC-7715)
                const result = await requestPermission(pendingIntent)

                if (result.success) {
                    setPermissionContext(result.permissionsContext)
                    setIsExecutionModalOpen(true)
                    // We don't clear pendingIntent yet so card stays visible until modal closes
                } else {
                    const errorMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        text: `❌ ${result.error || 'Permission request failed'}. Please try again.`,
                        timestamp: Date.now()
                    }
                    setMessages(prev => [...prev, errorMsg])
                }
            } else if (pendingIntent.intentType === 'TRAILING_STOP' || pendingIntent.intentType === 'LIMIT_ORDER') {
                // These use the Card Stacks system, not stream permissions
                const successMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    text: `✅ ${pendingIntent.intentType === 'TRAILING_STOP' ? 'Trailing Stop' : 'Limit Order'} configured! Visit Card Stacks to monitor and manage your order.`,
                    timestamp: Date.now()
                }
                setMessages(prev => [...prev, successMsg])
                setPendingIntent(null)
            } else {
                // Unknown intent type
                const errorMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    text: "⚠️ This intent type is not yet supported for automatic execution.",
                    timestamp: Date.now()
                }
                setMessages(prev => [...prev, errorMsg])
                setPendingIntent(null)
            }
        } catch (error) {
            console.error('[AI Chat] Permission error:', error)
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                text: "❌ Failed to request permission. Make sure MetaMask is connected.",
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setIsExecuting(false)
        }
    }

    const handleCancelIntent = () => {
        setPendingIntent(null)
        const cancelMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            text: "Intent cancelled. What else can I help you with?",
            timestamp: Date.now()
        }
        setMessages(prev => [...prev, cancelMsg])
    }



    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: "10%" }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed inset-0 z-[100] bg-background bg-grid-pattern flex flex-col items-center justify-center p-0 md:p-6 overflow-hidden"
                >
                    {/* Close Button */}
                    <motion.button
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        onClick={onClose}
                        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-background/50 border border-border/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                        <X className="w-6 h-6" />
                    </motion.button>

                    {/* Main Content Container */}
                    <div className="w-full max-w-2xl flex flex-col h-full relative bg-transparent">

                        {/* Header Branding */}
                        <div className="text-center pt-8 pb-4 shrink-0 relative z-10">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-12 h-12 bg-background text-foreground border border-border/50 rounded-xl mx-auto flex items-center justify-center mb-3 overflow-hidden"
                            >
                                <img src="/icon.png" alt="Logo" className="w-full h-full object-cover" />
                            </motion.div>
                            <motion.h2
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xl md:text-2xl font-bold tracking-tight"
                            >
                                ZeroSlip Intelligence
                            </motion.h2>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] mask-gradient-b relative z-10">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        "flex gap-3 max-w-[85%]",
                                        msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                    )}
                                >
                                    {/* Avatar - Only for assistant */}
                                    {msg.role === "assistant" && (
                                        <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 self-end mb-1 overflow-hidden">
                                            <img src="/icon.png" alt="AI Agent" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    {/* Bubble or Intent Card */}
                                    <div className="flex flex-col gap-3 w-full">
                                        <div className={cn(
                                            "px-5 py-3 text-sm md:text-base font-medium leading-relaxed",
                                            msg.role === "assistant"
                                                ? "bg-muted text-foreground rounded-2xl rounded-bl-sm border border-border/40"
                                                : "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                                        )}>
                                            {msg.role === "assistant" ? renderMarkdownText(msg.text) : msg.text}
                                        </div>

                                        {/* Show Intent Confirmation Card if this message has an intent */}
                                        {msg.intent && pendingIntent && msg.intent === pendingIntent && (
                                            <IntentConfirmationCard
                                                intent={msg.intent}
                                                onConfirm={handleConfirmIntent}
                                                onCancel={handleCancelIntent}
                                                isExecuting={isExecuting}
                                            />
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex gap-3 mr-auto max-w-[90%]"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-background text-foreground border border-border/50 flex items-center justify-center shrink-0 overflow-hidden">
                                        <img src="/icon.png" alt="AI" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex gap-1 items-center p-3.5 bg-muted/30 border border-border/50 rounded-2xl h-[52px]">
                                        <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" />
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Suggestions - Show only at start */}
                        {messages.length <= 1 && !isTyping && (
                            <div className="flex flex-wrap gap-2 px-4 py-2 justify-center shrink-0">
                                {SUGGESTIONS.map((s, i) => (
                                    <motion.button
                                        key={s.label}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.6 + (i * 0.1) }}
                                        onClick={() => handleSend(s.prompt)}
                                        className="px-4 py-2 rounded-full bg-muted/50 border border-border/50 hover:border-primary/50 hover:bg-muted transition-all text-sm font-medium cursor-pointer"
                                    >
                                        {s.label}
                                    </motion.button>
                                ))}
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-2 shrink-0 relative">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="relative max-w-2xl mx-auto"
                            >
                                <Input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Tell me what you want to do..."
                                    className="h-14 pl-5 pr-14 bg-muted/30 border-2 border-border/50 focus:border-foreground/50 text-base rounded-full transition-all"
                                    autoFocus
                                    disabled={isTyping}
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={!inputValue.trim() || isTyping}
                                    className="absolute right-2 top-2 h-10 w-10 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer"
                                >
                                    {isTyping ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <ArrowRight className="w-4 h-4" />
                                    )}
                                </Button>
                            </form>
                        </div>

                    </div>
                </motion.div>
            )}

            {/* Demo Execution Modal */}
            <IntentExecutionModal
                isOpen={isExecutionModalOpen}
                onClose={() => {
                    setIsExecutionModalOpen(false)
                    setPendingIntent(null) // Clear intent when modal closes
                    const successMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        text: "🎉 Demo complete! The agent simulated the execution of your recursive intent.",
                        timestamp: Date.now()
                    }
                    setMessages(prev => [...prev, successMsg])
                }}
                intentSummary={pendingIntent?.humanReadableSummary || "Streaming Intent"}
                permissionContext={permissionContext}
                intent={pendingIntent}
            />
        </AnimatePresence>
    )
}
