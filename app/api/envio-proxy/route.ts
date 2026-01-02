import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Forward the GraphQL query to the Envio indexer (Local or Production)
        //const ENVIO_URL = process.env.NEXT_PUBLIC_ENVIO_API_URL || 'http://127.0.0.1:8080/v1/graphql';
        const ENVIO_URL = process.env.NEXT_PUBLIC_ENVIO_API_URL  || 'https://indexer.dev.hyperindex.xyz/a30dacf/v1/graphql'


        const response = await fetch(ENVIO_URL, {
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
