import Fastify from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import {
    serializerCompiler,
    validatorCompiler,
    type ZodTypeProvider
} from "@fastify/type-provider-zod";
import { expect, vi } from "vitest";
import type { AccessTokenClaims } from "@packages/contracts/auth.schema";
import { problemDetailsSchema } from "@packages/contracts/problem-details.schema";

const jwtSecret = "route-tests-only-secret-with-sufficient-length";
export const requestId = "a".repeat(32);

export function expectProblemDetails(
    response: {
        headers: { "content-type"?: unknown; "x-request-id"?: unknown };
        json: () => unknown;
    },
    expected?: Record<string, unknown>
) {
    expect(response.headers["content-type"]).toEqual(
        expect.stringMatching(/^application\/problem\+json(?:;|$)/)
    );
    const problem = problemDetailsSchema.parse(response.json());
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(problem.requestId).toBe(response.headers["x-request-id"]);
    if (expected) expect(problem).toMatchObject(expected);
    return problem;
}

type MockFunction = ReturnType<typeof vi.fn>;
type CustomerControllerDoubles = Record<
    | "getCustomer"
    | "getAllCustomers"
    | "getDeletedCustomer"
    | "getAllDeletedCustomers"
    | "isDocumentUnique"
    | "isEmailRegistered"
    | "registerCustomer"
    | "updateCustomer"
    | "restoreCustomer"
    | "deleteCustomer"
    | "permanentDeleteCustomer",
    MockFunction
>;
type AuthControllerDoubles = Record<
    "register" | "login" | "refresh" | "logout" | "getSession" | "verifyAccessToken",
    MockFunction
>;
type UserControllerDoubles = Record<
    "getAllUsers" | "registerUser" | "updateUser" | "deleteUser",
    MockFunction
>;
type ControllerDoubles = {
    customerController: CustomerControllerDoubles;
    authController: AuthControllerDoubles;
    userController: UserControllerDoubles;
};

function controllerDoubles(): ControllerDoubles {
    return {
        customerController: {
            getCustomer: vi.fn(),
            getAllCustomers: vi.fn(),
            getDeletedCustomer: vi.fn(),
            getAllDeletedCustomers: vi.fn(),
            isDocumentUnique: vi.fn(),
            isEmailRegistered: vi.fn(),
            registerCustomer: vi.fn(),
            updateCustomer: vi.fn(),
            restoreCustomer: vi.fn(),
            deleteCustomer: vi.fn(),
            permanentDeleteCustomer: vi.fn()
        },
        authController: {
            register: vi.fn(),
            login: vi.fn(),
            refresh: vi.fn(),
            logout: vi.fn(),
            getSession: vi.fn(),
            verifyAccessToken: vi.fn()
        },
        userController: {
            getAllUsers: vi.fn(),
            registerUser: vi.fn(),
            updateUser: vi.fn(),
            deleteUser: vi.fn()
        }
    };
}

export async function createRouteApp(
    route: unknown,
    options: {
        prefix?: string;
        doubles?: Partial<ControllerDoubles>;
    } = {}
) {
    const app = Fastify({
        logger: false,
        genReqId: (request) => {
            const incomingRequestId = request.headers["x-request-id"];
            return typeof incomingRequestId === "string" && /^[a-f\d]{32}$/i.test(incomingRequestId)
                ? incomingRequestId
                : requestId;
        }
    }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.addHook("onRequest", (request, reply, done) => {
        reply.header("x-request-id", request.id);
        done();
    });

    const defaults = controllerDoubles();
    const doubles = {
        customerController: options.doubles?.customerController ?? defaults.customerController,
        authController: options.doubles?.authController ?? defaults.authController,
        userController: options.doubles?.userController ?? defaults.userController
    };

    app.decorate("customerController", doubles.customerController as never);
    app.decorate("authController", doubles.authController as never);
    app.decorate("userController", doubles.userController as never);

    await app.register(cookie);
    await app.register(jwt, {
        secret: jwtSecret,
        sign: { algorithm: "HS256" },
        verify: { algorithms: ["HS256"], clockTolerance: 0 },
        cookie: { cookieName: "access_token", signed: false }
    });
    await app.register(rateLimit, { global: false, hook: "preHandler" });
    const registerPlugin = app.register as unknown as (
        plugin: unknown,
        pluginOptions?: { prefix: string }
    ) => Promise<unknown>;
    await registerPlugin(route, options.prefix ? { prefix: options.prefix } : undefined);
    await app.ready();

    return { app, ...doubles };
}

export async function accessCookie(
    app: Awaited<ReturnType<typeof createRouteApp>>["app"],
    role: "ADMIN" | "OPERATOR" | "VIEWER" = "ADMIN",
    expiresIn: string | number = "5m"
) {
    const payload = {
        sub: "11111111-1111-4111-8111-111111111111",
        tid: "22222222-2222-4222-8222-222222222222",
        role,
        sid: "33333333-3333-4333-8333-333333333333"
    } as Omit<AccessTokenClaims, "iat" | "exp">;
    const token = app.jwt.sign(payload, { expiresIn });

    return `access_token=${token}`;
}

export function tamperCookie(cookieHeader: string) {
    const [name, token] = cookieHeader.split("=");
    const last = token?.at(-1) === "a" ? "b" : "a";
    return `${name}=${token?.slice(0, -1)}${last}`;
}
