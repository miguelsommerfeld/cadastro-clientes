import { FastifyInstance } from 'fastify'
import { db } from '@db';
import { healthResponseSchema } from "@packages/contracts/health.schema";
import { problemDetailsSchema } from "@packages/contracts/problem-details.schema";
import { sendProblem } from "@/helpers/problem-details";

export default async (fastify: FastifyInstance) => {
    fastify.get('/health', {
        schema: {
            response: {
                200: healthResponseSchema,
                503: problemDetailsSchema
            },
        },
    }, async (req, res) => {
        try {
            await db.orm.public.Tenants.limit(1).all();

            return {
                status: 200
            }
        } catch (err) {
            req.log.error({ err }, "Health check failed");
            return sendProblem(res, req, 503, "Serviço indisponível.");
        }
    })
}