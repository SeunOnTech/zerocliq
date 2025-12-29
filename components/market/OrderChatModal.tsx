"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, PanInfo } from "framer-motion"
import { Send, ShieldCheck, Search, ArrowLeft, X, ArrowRightLeft, MessageSquare, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { POPULAR_TOKENS } from "@/lib/constants/tokens"
import { useMediaQuery } from "@/hooks/use-media-query"

interface NegotiationModalProps {
    isOpen: boolean
    onClose: () => void
    order: any
}

// Mock Active Chats List
const ACTIVE_CHATS = [
    { id: "1", user: "CryptoKing", lastMessage: "Let's settle this at 145.50", time: "10:05 AM", unread: 2, online: true, avatar: "CK" },
    { id: "2", user: "SolanaWhale", lastMessage: "Waiting for confirmation...", time: "Yesterday", unread: 0, online: false, avatar: "SW" },
    { id: "3", user: "FastTrader_99", lastMessage: "Thanks for the trade!", time: "Mon", unread: 0, online: true, avatar: "FT" },
]

// Mock Chat Messages
const INITIAL_MESSAGES = [
    { id: 1, sender: "system", text: "Secure escrow initialized. Please agree on terms.", time: "10:00 AM", type: "system" },
    { id: 2, sender: "them", text: "Hi, I'm online and ready to trade. Can you do it quickly?", time: "10:01 AM", type: "text" },
    { id: 3, sender: "me", text: "Yes, I have the funds ready.", time: "10:02 AM", type: "text" },
    { id: 4, sender: "them", text: "Great. I see you want to buy 50 SOL.", time: "10:03 AM", type: "text" },
]

export function OrderChatModal({ isOpen, onClose, order }: NegotiationModalProps) {
    const [activeTab, setActiveTab] = useState<"swap" | "chat">("swap")
    const [amount, setAmount] = useState("")
    const [messages, setMessages] = useState(INITIAL_MESSAGES)
    const [newMessage, setNewMessage] = useState("")
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const isDesktop = useMediaQuery("(min-width: 768px)")

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSendMessage = () => {
        if (!newMessage.trim()) return

        const msg = {
            id: messages.length + 1,
            sender: "me",
            text: newMessage,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: "text"
        }

        setMessages([...messages, msg])
        setNewMessage("")

        // Simulate reply
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: prev.length + 1,
                sender: "them",
                text: "Okay, checking the terms...",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: "text"
            }])
        }, 2000)
    }

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > 100) {
            onClose()
        }
    }

    if (!order) return null

    // Find token logos
    const tokenLogo = POPULAR_TOKENS.find(t => t.symbol === order.token)?.logoURI
    const currencyLogo = POPULAR_TOKENS.find(t => t.symbol === order.currency)?.logoURI

    const Content = () => (
        <div className="flex-1 flex flex-col bg-background relative w-full h-full md:h-auto overflow-hidden">
            {/* Header */}
            <div className="h-16 border-b border-border flex items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-sm z-10 sticky top-0 shrink-0">
                <div className="flex items-center gap-3">
                    {isDesktop && (
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    )}
                    <Avatar className="h-9 w-9 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {order.advertiser[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="font-bold text-sm flex items-center gap-2">
                            {order.advertiser}
                            {order.verified && <ShieldCheck className="w-4 h-4 text-green-500" />}
                        </h2>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Online
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {activeTab === "swap" ? (
                        <Button variant="outline" size="sm" onClick={() => setActiveTab("chat")} className="hidden md:flex">
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Chat
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => setActiveTab("swap")} className="hidden md:flex">
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            Swap
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* CONTENT: SWAP FORM or CHAT */}
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/5 relative">
                {/* Subtle Grid Pattern */}
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

                <AnimatePresence mode="wait">
                    {activeTab === "swap" ? (
                        <motion.div
                            key="swap"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex-1 flex items-center justify-center p-4 overflow-y-auto"
                        >
                            <div className="w-full max-w-lg space-y-6 md:space-y-8 bg-card p-6 md:p-10 rounded-2xl border border-border shadow-sm relative z-10">

                                {/* Token Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex -space-x-3">
                                            <div className="w-12 h-12 rounded-full border-4 border-card bg-white flex items-center justify-center shadow-sm z-10">
                                                {currencyLogo ? (
                                                    <img src={currencyLogo} alt={order.currency} className="w-full h-full object-cover rounded-full" />
                                                ) : (
                                                    <span className="text-xs font-bold">{order.currency}</span>
                                                )}
                                            </div>
                                            <div className="w-12 h-12 rounded-full border-4 border-card bg-white flex items-center justify-center shadow-sm z-0">
                                                {tokenLogo ? (
                                                    <img src={tokenLogo} alt={order.token} className="w-full h-full object-cover rounded-full" />
                                                ) : (
                                                    <span className="text-xs font-bold">{order.token}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold flex items-center gap-2">
                                                {order.type === 'buy' ? 'Sell' : 'Buy'} {order.token}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                1 {order.token} ≈ {order.price} {order.currency}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="px-3 py-1 bg-background hidden sm:flex">
                                        Available: {order.available}
                                    </Badge>
                                </div>

                                <Separator />

                                {/* Input Section */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">You Pay</label>
                                        <div className="relative group">
                                            <Input
                                                type="number"
                                                placeholder="0.00"
                                                className="h-16 pl-4 pr-20 text-2xl font-bold bg-muted/30 border-border focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                                <span className="font-bold text-muted-foreground">{order.currency}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-center -my-2 relative z-10">
                                        <div className="bg-card border border-border rounded-full p-2 shadow-sm text-muted-foreground">
                                            <ArrowRightLeft className="w-4 h-4 rotate-90" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">You Receive</label>
                                        <div className="relative">
                                            <Input
                                                readOnly
                                                value={amount ? (parseFloat(amount) / parseFloat(order.price)).toFixed(4) : "0.00"}
                                                className="h-16 pl-4 pr-20 text-2xl font-bold bg-muted/10 border-border text-muted-foreground rounded-xl"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                                <span className="font-bold text-muted-foreground">{order.token}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <Button
                                    className="w-full h-14 font-bold text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all rounded-xl"
                                >
                                    {order.type === 'buy' ? 'Sell' : 'Buy'} {order.token} Now
                                    <ChevronRight className="w-5 h-5 ml-1 opacity-80" />
                                </Button>

                                <div className="text-center md:hidden">
                                    <Button variant="link" className="text-muted-foreground md:hidden" onClick={() => setActiveTab("chat")}>
                                        <MessageSquare className="w-4 h-4 mr-2" />
                                        Chat with Advertiser
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        /* CHAT INTERFACE */
                        <motion.div
                            key="chat"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="flex-1 flex flex-col overflow-hidden h-full"
                        >
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex flex-col max-w-[85%]",
                                            msg.sender === "me" ? "ml-auto items-end" : "mr-auto items-start",
                                            msg.sender === "system" ? "mx-auto items-center max-w-full" : ""
                                        )}
                                    >
                                        {msg.sender === "system" ? (
                                            <div className="flex items-center justify-center gap-3 w-full my-4 opacity-70">
                                                <Separator className="flex-1 max-w-[60px]" />
                                                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full border text-center whitespace-nowrap">
                                                    {msg.text}
                                                </span>
                                                <Separator className="flex-1 max-w-[60px]" />
                                            </div>
                                        ) : (
                                            <>
                                                <div
                                                    className={cn(
                                                        "px-4 py-3 rounded-2xl text-sm shadow-sm relative group max-w-full break-words",
                                                        msg.sender === "me"
                                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                                            : "bg-card border text-card-foreground rounded-bl-none"
                                                    )}
                                                >
                                                    {msg.text}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                                    {msg.sender === "me" ? "Sent" : "Received"} • {msg.time}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-background border-t border-border shrink-0 pb-8 md:pb-4">
                                <div className="flex gap-3 items-end max-w-4xl mx-auto">
                                    <div className="flex-1 relative">
                                        <Input
                                            placeholder="Type a message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                            className="bg-muted/30 border-border rounded-xl pr-12 py-6"
                                        />
                                        <Button
                                            size="icon"
                                            onClick={handleSendMessage}
                                            className="absolute right-2 top-2 h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )

    if (isDesktop) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent
                    className="max-w-full w-screen h-screen p-0 gap-0 bg-background border-none rounded-none flex overflow-hidden sm:max-w-none !translate-x-0 !translate-y-0 !top-0 !left-0"
                    showCloseButton={false}
                >
                    {activeTab === "chat" && (
                        <div className="w-80 border-r border-border flex flex-col bg-card hidden md:flex">
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <h2 className="font-bold text-lg">Messages</h2>
                                <Button variant="ghost" size="icon" onClick={() => setActiveTab("swap")}>
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            </div>
                            <div className="p-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search..." className="pl-9 bg-muted/50 border-border" />
                                </div>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="flex flex-col">
                                    {ACTIVE_CHATS.map((chat) => (
                                        <button
                                            key={chat.id}
                                            className={cn(
                                                "flex items-center gap-3 p-4 hover:bg-accent transition-colors text-left",
                                                chat.user === order.advertiser ? "bg-accent border-l-2 border-primary" : "border-l-2 border-transparent"
                                            )}
                                        >
                                            <div className="relative">
                                                <Avatar>
                                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{chat.avatar}</AvatarFallback>
                                                </Avatar>
                                                {chat.online && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                                                )}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-semibold text-sm truncate">{chat.user}</span>
                                                    <span className="text-[10px] text-muted-foreground">{chat.time}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">{chat.lastMessage}</p>
                                            </div>
                                            {chat.unread > 0 && (
                                                <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-[10px]">
                                                    {chat.unread}
                                                </Badge>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                    <Content />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.2}
                        onDragEnd={handleDragEnd}
                        className="fixed bottom-0 left-0 right-0 h-[92vh] bg-background rounded-t-[2rem] z-50 flex flex-col shadow-2xl overflow-hidden"
                    >
                        {/* Drag Handle */}
                        <div className="h-1.5 w-12 bg-muted-foreground/20 rounded-full mx-auto mt-4 mb-2 shrink-0" />

                        <Content />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
