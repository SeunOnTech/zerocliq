import { CreateOrderForm } from "@/components/features/CreateOrderForm"

export default function CreateOrderPage() {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Create Order</h1>
                <p className="text-muted-foreground">
                    Set your price and trade directly with other users. Zero slippage, guaranteed.
                </p>
            </div>
            <CreateOrderForm />
        </div>
    )
}
