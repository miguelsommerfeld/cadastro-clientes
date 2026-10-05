import { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { z } from 'zod';

const healthCheck: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get('/health', {
        schema: {
            response: {
                200: z.object({
                    status: z.number().int(),
                }),
            },
        },
    }, async (request, reply) => {
        return { status: 200 };
    })
}

export default healthCheck;