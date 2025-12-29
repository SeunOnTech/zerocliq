"use client"

import * as React from "react"
import { Token } from "@/types/token"
import { POPULAR_TOKENS } from "@/lib/constants/tokens"
import { TokenSelector } from "@/components/ui/token-selector"

interface PaymentMethodSelectorProps {
    value: string
    onSelect: (value: string) => void
}

export function PaymentMethodSelector({ value, onSelect }: PaymentMethodSelectorProps) {
    // Find the selected token from POPULAR_TOKENS
    const selectedToken = POPULAR_TOKENS.find(t => t.symbol === value) || POPULAR_TOKENS[0]

    // Handle token selection and convert to string value
    const handleSelect = (token: Token) => {
        onSelect(token.symbol)
    }

    return (
        <TokenSelector
            selectedToken={selectedToken}
            onSelect={handleSelect}
            tokens={POPULAR_TOKENS}
        />
    )
}
