import { z } from "zod"

export const createOrderSchema = z.object({
    offerToken: z.object({
        address: z.string(),
        symbol: z.string(),
        decimals: z.number(),
        logoURI: z.string().optional(),
        name: z.string(),
    }, { required_error: "Please select a token to offer" }),
    offerAmount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Amount must be greater than 0",
    }),
    receiveToken: z.object({
        address: z.string(),
        symbol: z.string(),
        decimals: z.number(),
        logoURI: z.string().optional(),
        name: z.string(),
    }, { required_error: "Please select a token to receive" }),
    receiveAmount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Amount must be greater than 0",
    }),
    expiration: z.enum(["1h", "24h", "7d", "custom"]),
    notes: z.string().optional(),
})

export type CreateOrderFormValues = z.infer<typeof createOrderSchema>
