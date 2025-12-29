"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Token } from "@/types/token"
import { POPULAR_TOKENS } from "@/lib/constants/tokens"

interface TokenSelectorProps {
    selectedToken?: Token
    onSelect: (token: Token) => void
    disabled?: boolean
    tokens?: Token[] // Optional custom token list
}

export function TokenSelector({ selectedToken, onSelect, disabled, tokens }: TokenSelectorProps) {
    const [open, setOpen] = React.useState(false)
    const [searchQuery, setSearchQuery] = React.useState("")
    const [customToken, setCustomToken] = React.useState<Token | null>(null)

    // Use provided tokens or default to POPULAR_TOKENS
    const tokenList = tokens || POPULAR_TOKENS

    // Filter tokens based on search
    const filteredTokens = React.useMemo(() => {
        const query = searchQuery.toLowerCase()
        return tokenList.filter(
            (token) =>
                token.symbol.toLowerCase().includes(query) ||
                token.name.toLowerCase().includes(query) ||
                token.address.toLowerCase() === query
        )
    }, [searchQuery, tokenList])

    const handleSelect = (token: Token) => {
        onSelect(token)
        setOpen(false)
        setSearchQuery("")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-12 px-3 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-accent/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    disabled={disabled}
                >
                    {selectedToken ? (
                        <div className="flex items-center gap-2">
                            {selectedToken.symbol !== "All" && selectedToken.logoURI && (
                                <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-6 h-6 rounded-full object-cover" />
                            )}
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-sm leading-tight">{selectedToken.symbol}</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">{selectedToken.name}</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-muted-foreground font-medium text-sm">Select Token</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] p-0 gap-0 overflow-hidden border-border/50 bg-background/80 backdrop-blur-xl shadow-2xl">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
                    <DialogTitle className="text-xl font-bold tracking-tight">Select Token</DialogTitle>
                </DialogHeader>

                <div className="p-4 border-b border-border/40 bg-accent/5">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or paste address"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-background/50 border-border/40 focus-visible:ring-primary/20 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    <div className="grid gap-1">
                        <AnimatePresence mode="popLayout">
                            {filteredTokens.length > 0 ? (
                                filteredTokens.map((token, index) => (
                                    <motion.button
                                        key={token.address}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: index * 0.05, duration: 0.2 }}
                                        onClick={() => handleSelect(token)}
                                        className={cn(
                                            "flex items-center justify-between w-full p-3 rounded-xl transition-all group",
                                            selectedToken?.address === token.address
                                                ? "bg-primary/10 hover:bg-primary/15"
                                                : "hover:bg-accent/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            {token.symbol !== "All" && (
                                                <div className="w-10 h-10 rounded-full bg-background border border-border/50 flex items-center justify-center overflow-hidden shadow-sm group-hover:scale-110 transition-transform">
                                                    {token.logoURI ? (
                                                        <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm font-bold">{token.symbol[0]}</span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold text-sm">{token.symbol}</span>
                                                <span className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">{token.name}</span>
                                            </div>
                                        </div>
                                        {selectedToken?.address === token.address && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="text-primary"
                                            >
                                                <Check className="h-5 w-5" />
                                            </motion.div>
                                        )}
                                    </motion.button>
                                ))
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="py-12 text-center text-muted-foreground"
                                >
                                    <p>No tokens found.</p>
                                    <p className="text-xs mt-1">Try pasting a mint address.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
