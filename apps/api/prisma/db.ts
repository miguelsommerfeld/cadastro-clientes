import postgres from '@prisma/orm-postgres/runtime';
import { Contract } from './contract';
import contractJson from './contract.json' with { type: "json" };

export const db = postgres<Contract>({
    contractJson,
    url: process.env.DB_URL,
});