"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDown, ArrowRight, Info, Settings } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TokenSelector } from "@/components/ui/token-selector"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createOrderSchema, CreateOrderFormValues } from "@/lib/schemas/order"
import { Token } from "@/types/token"
import { cn } from "@/lib/utils"

export function CreateOrderForm() {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<CreateOrderFormValues>({
        resolver: zodResolver(createOrderSchema),
        defaultValues: {
            expiration: "24h",
            offerAmount: "",
            receiveAmount: "",
        },
    })

    const { watch, setValue } = form
    const offerToken = watch("offerToken")
    const receiveToken = watch("receiveToken")
    const offerAmount = watch("offerAmount")
    const receiveAmount = watch("receiveAmount")

    // Mock exchange rate calculation
    const exchangeRate =
        offerAmount && receiveAmount && !isNaN(Number(offerAmount)) && !isNaN(Number(receiveAmount)) && Number(offerAmount) > 0
            ? (Number(receiveAmount) / Number(offerAmount)).toFixed(6)
            : null

    const onSubmit = async (data: CreateOrderFormValues) => {
        setIsSubmitting(true)
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000))
        console.log("Order created:", data)
        setIsSubmitting(false)
        // Here we would trigger a success modal or redirect
    }

    const handleSwitch = () => {
        const currentOffer = form.getValues("offerToken")
        const currentReceive = form.getValues("receiveToken")
        const currentOfferAmount = form.getValues("offerAmount")
        const currentReceiveAmount = form.getValues("receiveAmount")

        setValue("offerToken", currentReceive)
        setValue("receiveToken", currentOffer)
        setValue("offerAmount", currentReceiveAmount)
        setValue("receiveAmount", currentOfferAmount)
    }

    return (
        <div className="max-w-2xl mx-auto">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                    {/* Offer Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-muted-foreground">You Pay</h3>
                            <div className="text-xs font-medium px-2 py-1 rounded-full bg-accent text-accent-foreground">
                                Balance: 0.00
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <FormField
                                    control={form.control}
                                    name="offerAmount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    placeholder="0.00"
                                                    className="text-4xl font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/20"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="w-[180px]">
                                <FormField
                                    control={form.control}
                                    name="offerToken"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <TokenSelector
                                                    selectedToken={field.value}
                                                    onSelect={(token) => field.onChange(token)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Switch Button */}
                    <div className="flex justify-center -my-10 relative z-10">
                        <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="rounded-full h-12 w-12 bg-background border-border shadow-lg hover:rotate-180 transition-transform duration-500"
                            onClick={handleSwitch}
                        >
                            <ArrowDown className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Receive Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="p-6 rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-muted-foreground">You Receive</h3>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <FormField
                                    control={form.control}
                                    name="receiveAmount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    placeholder="0.00"
                                                    className="text-4xl font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/20"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="w-[180px]">
                                <FormField
                                    control={form.control}
                                    name="receiveToken"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <TokenSelector
                                                    selectedToken={field.value}
                                                    onSelect={(token) => field.onChange(token)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Settings & Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-6"
                    >
                        <div className="flex items-center gap-4">
                            <FormField
                                control={form.control}
                                name="expiration"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>Expiration</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select expiration" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="1h">1 Hour</SelectItem>
                                                <SelectItem value="24h">24 Hours</SelectItem>
                                                <SelectItem value="7d">7 Days</SelectItem>
                                                <SelectItem value="custom">Custom</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Summary Card */}
                        {offerToken && receiveToken && (
                            <div className="p-4 rounded-xl bg-accent/10 border border-border/50 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Rate</span>
                                    <span className="font-medium">
                                        1 {offerToken.symbol} = {exchangeRate || "-"} {receiveToken.symbol}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Network Fee</span>
                                    <span className="font-medium">~0.000005 SOL</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Slippage</span>
                                    <span className="font-medium text-green-500">0% (Guaranteed)</span>
                                </div>
                            </div>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full text-lg h-14 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Creating Order..." : "Create Order"}
                        </Button>
                    </motion.div>

                </form>
            </Form>
        </div>
    )
}
