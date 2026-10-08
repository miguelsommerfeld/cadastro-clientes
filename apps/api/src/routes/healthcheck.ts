import { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { z } from 'zod';

export default async (fastify: any) => {
    fastify.get('/health', {
        schema: {
            response: {
                200: z.object({
                    status: z.number().int(),
                }),
            },
        },
    }, async (request: any, reply: any) => {
        return { status: 200 };
    })
}