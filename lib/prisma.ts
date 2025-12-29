import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Parse the connection string to get individual components
const connectionString = process.env.DATABASE_URL as string;

// Create a Pool with SSL configuration
const pool = new Pool({
    connectionString: connectionString ? connectionString.replace(/\?.*$/, '') : '', // Remove query params from connection string
    ssl: {
        rejectUnauthorized: true, // Must be true for Aiven cloud
        ca: process.env.CA_CERTIFICATE, // Your inline certificate here!
    },
});

const adapter = new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: ["error", "warn"],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

