import Fastify from "fastify";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, ZodTypeProvider } from "@fastify/type-provider-zod";
import { fastifySwagger } from "@fastify/swagger";
import { fastifySwaggerUi } from "@fastify/swagger-ui";
import { config as loadEnv } from "dotenv";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
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

const server = Fastify({
    logger: {
        level: "info",
        formatters: { level: (label) => ({ level: label }) },
        redact: {
            paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.cookies.*",
                "req.body.password",
                "req.body.passwordHash",
                "req.body.token",
                "req.body.accessToken",
                "req.body.refreshToken",
                "req.body.access_token",
                "req.body.refresh_token",
                "res.headers['set-cookie']",
                "request.headers.authorization",
                "request.headers.cookie",
                "request.cookies.*",
                "request.body.password",
                "request.body.passwordHash",
                "request.body.token",
                "request.body.accessToken",
                "request.body.refreshToken",
                "request.body.access_token",
                "request.body.refresh_token",
                "password",
                "passwordHash",
                "token",
                "jwt",
                "authorization",
                "cookie",
                "set-cookie",
                "accessToken",
                "refreshToken",
                "access_token",
                "refresh_token",
                "*.password",
                "*.passwordHash",
                "*.token",
                "*.accessToken",
                "*.refreshToken",
                "*.access_token",
                "*.refresh_token",
                "*.jwt",
                "*.authorization",
                "*.cookie",
                "*.set-cookie",
                "cookies.*"
            ],
            censor: "[REDACTED]"
        }
    },
    genReqId: (request) => {
        const requestId = request.headers["x-request-id"];
        return typeof requestId === "string" && /^[a-f\d]{32}$/i.test(requestId)
            ? requestId
            : randomUUID();
    },
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "reqId",
    disableRequestLogging: true
}).withTypeProvider<ZodTypeProvider>();
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.addHook("onRequest", (request, reply, done) => {
    reply.header("x-request-id", request.id);
    done();
});

server.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions.url ?? request.url.split("?")[0] ?? request.url;
    if (route === "/health") return;

    const status = reply.statusCode;
    const logFields = {
        method: request.method,
        route,
        status,
        responseTime: reply.elapsedTime,
        ...(request.user ? { userId: request.user.sub, tenantId: request.user.tid }: {})
    };

    if (status !== 500 && status !== 400) request.log.info(logFields, "Request completed");
    if (status >= 500) request.log.error(logFields, "Request completed");
    if (status >= 400) request.log.warn(logFields, "Request completed");
});

server.setErrorHandler((error, request, reply) => {
    const statusCode =
        error instanceof Error &&
        "statusCode" in error &&
        typeof error.statusCode === "number" ? error.statusCode : 500;

    if (statusCode < 500) return reply.status(statusCode).send(error);

    request.log.error({ err: error }, "Unhandled request error");
    return reply.status(500).send({
        type: "/problems/internal-server-error",
        title: "Internal Server Error",
        status: 500,
        detail: "Não foi possível concluir a solicitação.",
        requestId: request.id
    });
});

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
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["x-request-id"],
    credentials: true
});
server.register(dependencies);
server.register(healthcheck);
server.register(customersRoutes, { prefix: "/api/v1/" });
server.register(authRoutes, { prefix: "/api/v1/" });

await server.listen({ port: 3333, host: "0.0.0.0" });
