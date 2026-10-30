import Fastify from "fastify";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, ZodTypeProvider } from "@fastify/type-provider-zod";
import { fastifySwagger } from "@fastify/swagger";
import { fastifySwaggerUi } from "@fastify/swagger-ui";
import { config as loadEnv } from "dotenv";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { fileURLToPath } from "node:url";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const { env } = await import("../config/env.ts");
const [{ default: dependencies }, { default: healthcheck }, { default: customersRoutes }, { default: authRoutes }] =
    await Promise.all([
        import("../config/dependencies.ts"),
        import("./routes/healthcheck.ts"),
        import("./routes/customers.ts"),
        import("./routes/auth.ts")
    ]);

const server = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(fastifySwagger, {
    openapi: {
        info: {
            title: "Cadastro de Clientes",
            version: "1.0.0"
        },
        components: {
            securitySchemes: {
              accessToken: {
                type: "apiKey",
                in: "cookie",
                name: "access_token"
              }
            }
        }
    },
    transform: jsonSchemaTransform
});
server.register(fastifySwaggerUi, {
    routePrefix: "/docs"
});

server.register(cookie);
server.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { algorithm: "HS256" },
    verify: { algorithms: ["HS256"], clockTolerance: 5 },
    cookie: { cookieName: "access_token", signed: false }
});
server.register(rateLimit, { global: false, hook: "preHandler" });
server.register(cors, {
    origin: process.env["CORS_ORIGIN"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
});
server.register(dependencies);
server.register(healthcheck);
server.register(customersRoutes, { prefix: "/api/v1/" });
server.register(authRoutes, { prefix: "/api/v1" });

await server.listen({ port: 3333, host: "0.0.0.0" });
