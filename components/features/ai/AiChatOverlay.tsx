"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Send, ArrowRight, Zap, RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface AiChatOverlayProps {
    isOpen: boolean
    onClose: () => void
}

type Message = {
    id: string
    role: "system" | "user" | "assistant"
    text: string
    timestamp: number
}

const SUGGESTIONS = [
    { label: "Instant Swap", icon: Zap, prompt: "I want to swap 100 USDC for MON instantly." },
    { label: "Rebalance Portfolio", icon: RefreshCw, prompt: "Analyze my portfolio and suggest a rebalance." },
    { label: "Find Opportunities", icon: Search, prompt: "Scan the market for high yield opportunities." },
]

export function AiChatOverlay({ isOpen, onClose }: AiChatOverlayProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Initial Greeting
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setIsTyping(true)
            setTimeout(() => {
                setMessages([
                    {
                        id: "welcome",
                        role: "assistant",
                        text: "I am your ZeroSlip Intelligent Agent. capable of executing complex DeFi intents with zero slippage. How can I assist you today?",
                        timestamp: Date.now()
                    }
                ])
                setIsTyping(false)
            }, 800)
        }
    }, [isOpen])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isTyping])

    const handleSend = (text: string = inputValue) => {
        if (!text.trim()) return

        // User Message
        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            text: text,
            timestamp: Date.now()
        }
        setMessages(prev => [...prev, userMsg])
        setInputValue("")
        setIsTyping(true)

        // Mock AI Response
        setTimeout(() => {
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                text: "I'm analyzing the optimal execution path for your request...",
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, aiMsg])
            setIsTyping(false)
        }, 1500)
    }

    const ZeroSlipLogo = ({ className }: { className?: string }) => (
        <img
            src="/icon.png"
            alt="ZeroSlip"
            className={className}
        />
    )

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
                        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-background/50 border border-border/50 hover:bg-muted transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </motion.button>

                    {/* Main Content Container - Full Height Page Mode */}
                    <div className="w-full max-w-2xl flex flex-col h-full relative bg-transparent">

                        {/* Header Branding */}
                        <div className="text-center pt-8 pb-4 shrink-0 relative z-10">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-12 h-12 bg-background text-foreground border border-border/50 rounded-xl mx-auto flex items-center justify-center mb-3"
                            >
                                <ZeroSlipLogo className="w-6 h-6 animate-pulse" />
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
                                        <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 self-end mb-1">
                                            <ZeroSlipLogo className="w-4 h-4" />
                                        </div>
                                    )}

                                    {/* Bubble */}
                                    <div className={cn(
                                        "px-5 py-3 text-sm md:text-base font-medium leading-relaxed",
                                        msg.role === "assistant"
                                            ? "bg-muted text-foreground rounded-2xl rounded-bl-sm border border-border/40" // Assistant: Light Gray, bot-left distinct
                                            : "bg-primary text-primary-foreground rounded-2xl rounded-br-sm" // User: Primary, bot-right distinct
                                    )}>
                                        {msg.text}
                                    </div>
                                </motion.div>
                            ))}

                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex gap-3 mr-auto max-w-[90%]"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-background text-foreground border border-border/50 flex items-center justify-center shrink-0">
                                        <ZeroSlipLogo className="w-3.5 h-3.5" />
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

                        {/* Suggestions */}
                        {messages.length < 2 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 px-2 py-4 shrink-0">
                                {SUGGESTIONS.map((s, i) => (
                                    <motion.button
                                        key={s.label}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 + (i * 0.1) }}
                                        onClick={() => handleSend(s.prompt)}
                                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:bg-muted/50 transition-all group text-center"
                                    >
                                        <div className="p-1.5 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                                            <s.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">{s.label}</span>
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
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={!inputValue.trim()}
                                    className="absolute right-2 top-2 h-10 w-10 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all"
                                >
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
