import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Forward the GraphQL query to the local Envio indexer
        const response = await fetch('http://127.0.0.1:8080/v1/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Envio Proxy Error:', error);
        return NextResponse.json({ error: 'Failed to connect to Envio indexer' }, { status: 500 });
    }
}
