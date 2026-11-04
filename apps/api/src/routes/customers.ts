import { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { FastifyTypedInstance } from '../../config/dependencies';
import {
    customersRequestSchema,
    customersResponseSchema,
    customerUpdateSchema
} from '@packages/contracts/customer.schema';
import { problemDetailsSchema } from "@packages/contracts/problem-details.schema";
import { stateValidator } from '@/helpers/state.validator';
import z from 'zod';
import {
    getHttpErrorMessage,
    getHttpErrorStatus,
    sendProblem,
    validationProblemErrors
} from "@/helpers/problem-details";
import { authenticate } from '@/middlewares/auth.middleware';

const protectedResponseSchemas = {
    401: problemDetailsSchema,
    403: problemDetailsSchema,
    500: problemDetailsSchema
};

const customersRoutes: FastifyPluginAsyncZod = async function (server: FastifyTypedInstance) {
    server.addHook("onRequest", authenticate);

    server.setErrorHandler((error, request, reply) => {
        const statusCode = getHttpErrorStatus(error) ?? 500;

        if (statusCode >= 500) {
            request.log.error({ err: error }, "Unhandled request error");
            return sendProblem(
                reply,
                request,
                statusCode === 503 ? 503 : 500,
                "Não foi possível concluir a solicitação."
            );
        }

        const detail = getHttpErrorMessage(error) ?? "Requisição inválida.";
        return sendProblem(reply, request, statusCode, detail, validationProblemErrors(error));
    });

    // Get all customers or get a customer by its id
    server.get('/customers', {
        config: { permission: "customer:read" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            response: {
                200: z.union([
                    customersResponseSchema,
                    customersResponseSchema.array()
                ]),
                ...protectedResponseSchemas,
                400: problemDetailsSchema,
                404: problemDetailsSchema,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            const id = req.query.id;

            if (id) {
                const customer = await this.customerController.getCustomer(req.user, id);

                if ("code" in customer) {
                    return sendProblem(res, req, customer.code, customer.message);
                }

                return res.status(200).send(customer);
            }

            const customers = await this.customerController.getAllCustomers(req.user);

            if (!Array.isArray(customers)) {
                return sendProblem(res, req, customers.code, customers.message);
            }

            return res.status(200).send(customers);
        }
    });

    // Get all deleted customers
    server.get('/customers/deleted', {
        config: { permission: "customer:read" },
        schema: {
            security: [{ accessToken: [] }],
            response: {
                200: customersResponseSchema.array(),
                ...protectedResponseSchemas,
                400: problemDetailsSchema,
                404: problemDetailsSchema,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            const customers = await this.customerController.getAllDeletedCustomers(req.user);

            if (!Array.isArray(customers)) {
                return sendProblem(res, req, customers.code, customers.message);
            }

            return res.status(200).send(customers);
        }
    });

    // Register customer
    server.post('/customers', {
        config: { permission: "customer:write" },
        schema: {
            security: [{ accessToken: [] }],
            body: customersRequestSchema,
            response: {
                201: customersResponseSchema,
                400: problemDetailsSchema,
                404: problemDetailsSchema,
                409: problemDetailsSchema,
                ...protectedResponseSchemas,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            // Validation
            const isDocumentUnique = await this.customerController.isDocumentUnique(
                req.user,
                req.body.document
            );

            if ("code" in isDocumentUnique) {
                return sendProblem(res, req, isDocumentUnique.code, isDocumentUnique.message);
            }

            if (isDocumentUnique.status === 409 || isDocumentUnique.status === 400) {
                return sendProblem(res, req, isDocumentUnique.status, isDocumentUnique.message ?? "");
            }

            const isEmailRegistered = await this.customerController.isEmailRegistered(
                req.user,
                req.body.email
            );

            if (isEmailRegistered.status === 409) {
                return sendProblem(res, req, 409, isEmailRegistered.message ?? "");
            }

            const stateResponse = await stateValidator(req.body.address.state);

            if (stateResponse.status !== 200) {
                return sendProblem(res, req, stateResponse.status, stateResponse.message ?? "");
            }

            try {
                const { address, ...customerData } = req.body;
                const response = await this.customerController.registerCustomer(
                    req.user,
                    customerData,
                    address
                );

                if ("code" in response) {
                    return sendProblem(res, req, response.code, response.message);
                }

                return res
                    .header("Location", `/api/v1/customers?id=${encodeURIComponent(response.id)}`)
                    .status(201)
                    .send(response);
            } catch (err) {
                req.log.error({ err }, "Customer registration failed");
                return sendProblem(
                    res,
                    req,
                    503,
                    "Não foi possível concluir a solicitação."
                );
            }
        }
    });

    // Restore a deleted customer
    server.post('/customers/restore', {
        config: { permission: "customer:trash" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            response: {
                200: z.void(),
                ...protectedResponseSchemas,
                404: problemDetailsSchema,
                409: problemDetailsSchema,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            if (req.query.id === undefined) {
                return sendProblem(res, req, 404, "Insira o ID do usuário que deseja restaurar.");
            }

            const id = req.query.id;
            const customer = await this.customerController.getDeletedCustomer(req.user, id);

            if (customer && "code" in customer) {
                return sendProblem(res, req, customer.code, customer.message);
            }

            if (customer === null) {
                return sendProblem(res, req, 404, "Usuário não encontrado na lixeira.");
            }

            const result = await this.customerController.restoreCustomer(req.user, id);
            if (result !== undefined && "code" in result) {
                return sendProblem(res, req, result.code, result.message);
            }

            return res.status(200).send();
        }
    });

    // Update a customer
    server.patch('/customers', {
        config: { permission: "customer:write" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            body: customerUpdateSchema,
            response: {
                200: z.void(),
                400: problemDetailsSchema,
                404: problemDetailsSchema,
                ...protectedResponseSchemas,
                409: problemDetailsSchema,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            if (req.query.id === undefined) {
                return sendProblem(res, req, 400, "Insira o ID do usuário que deseja atualizar.");
            }
            
            const id = req.query.id;
            const customer = await this.customerController.getCustomer(req.user, id);

            if ("code" in customer) {
                return sendProblem(res, req, customer.code, customer.message);
            }

            const userEmail = req.body.email;
            if (customer.email !== userEmail && typeof userEmail === 'string') {
                const isEmailAlreadyRegistered = await this.customerController.isEmailRegistered(
                    req.user,
                    userEmail
                );

                if (isEmailAlreadyRegistered.status !== 200 && isEmailAlreadyRegistered.message !== null) {
                    return sendProblem(res, req, isEmailAlreadyRegistered.status, isEmailAlreadyRegistered.message);
                }
            }

            await this.customerController.updateCustomer(req.user, id, req.body);
            return res.status(200).send();
        }
    });

    // Send a customer to the bin
    server.delete('/customers', {
        config: { permission: "customer:trash" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            response: {
                204: z.void(),
                404: problemDetailsSchema,
                ...protectedResponseSchemas,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            if (req.query.id === undefined) {
                return sendProblem(res, req, 404, "Insira o ID do usuário que deseja deletar.");
            }

            const id = req.query.id;
            const customer = await this.customerController.getCustomer(req.user, id);

            if ("code" in customer) {
                return sendProblem(res, req, customer.code, customer.message);
            }

            const result = await this.customerController.deleteCustomer(req.user, id);
            if (result !== undefined && "code" in result) {
                return sendProblem(res, req, result.code, result.message);
            }

            return res.status(204).send();
        }
    });

    // Delete permanently a customer
    server.delete('/customers/permanent', {
        config: { permission: "customer:delete-permanent" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            response: {
                204: z.void(),
                404: problemDetailsSchema,
                ...protectedResponseSchemas,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            if (req.query.id === undefined) {
                return sendProblem(res, req, 404, "Insira o ID do usuário que deseja deletar.");
            }

            const id = req.query.id;
            const deletedCustomer = await this.customerController.getDeletedCustomer(req.user, id);
            if (deletedCustomer && "code" in deletedCustomer) {
                return sendProblem(res, req, deletedCustomer.code, deletedCustomer.message);
            }
            if (deletedCustomer === null) {
                const activeCustomer = await this.customerController.getCustomer(req.user, id);
                if (activeCustomer && "code" in activeCustomer) {
                    return sendProblem(res, req, activeCustomer.code, activeCustomer.message);
                }
                if (!activeCustomer) {
                    return sendProblem(res, req, 404, "Usuário não encontrado.");
                }
            }

            const result = await this.customerController.permanentDeleteCustomer(req.user, id);
            if (typeof result !== "boolean" && result !== undefined) {
                return sendProblem(res, req, result.code, result.message);
            }

            return res.status(204).send();
        }
    });
}

export default customersRoutes;