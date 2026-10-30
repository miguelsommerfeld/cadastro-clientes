import { z } from 'zod';
import { FastifyInstance } from 'fastify'
import { db } from '@db';

export default async (fastify: FastifyInstance) => {
    fastify.get('/health', {
        schema: {
            response: {
                200: z.object({
                    status: z.number(),
                }),
                503: z.object({
                    status: z.number(),
                    message: z.string()
                })
            },
        },
    }, async (req, res) => {
        try {
            await db.orm.public.Tenants.limit(1).all();

            return {
                status: 200
            }
        } catch (err) {
            return res.status(503).send({
                status: 503,
                message: "Serviço indisponível"
            })
        }
    })
}