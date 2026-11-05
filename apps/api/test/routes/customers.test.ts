import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import customersRoute from "../../src/routes/customers";
import {
    customersResponseSchema,
    type CustomerResponse
} from "@packages/contracts/customer.schema";
import {
    accessCookie,
    createRouteApp,
    expectProblemDetails,
    requestId,
    tamperCookie
} from "../support/route-app";

const customer: CustomerResponse = {
    id: "customer-123",
    personType: "INDIVIDUAL",
    name: "Ana Pessoa",
    document: "52998224725",
    birthDate: "1990-01-01",
    email: "ana@example.com",
    phone: "11987654321",
    createdAt: "2024-01-01T10:00:00.000Z",
    createdBy: "11111111-1111-4111-8111-111111111111",
    updatedBy: null,
    deletedAt: null,
    deletedBy: null
};

const newCustomer = {
    personType: "INDIVIDUAL",
    name: "Ana Pessoa",
    document: "529.982.247-25",
    birthDate: "1990-01-01",
    email: "ana@example.com",
    phone: "11987654321",
    address: {
        zipCode: "01001-000",
        street: "Praça da Sé",
        number: "1",
        district: "Sé",
        city: "São Paulo",
        state: "SP"
    }
};

const protectedRequests = [
    { method: "GET", url: "/api/v1/customers" },
    { method: "GET", url: "/api/v1/customers/deleted" },
    { method: "POST", url: "/api/v1/customers" },
    { method: "POST", url: "/api/v1/customers/restore" },
    { method: "PATCH", url: "/api/v1/customers" },
    { method: "DELETE", url: "/api/v1/customers" },
    { method: "DELETE", url: "/api/v1/customers/permanent" }
] as const;

describe("customer routes", () => {
    let fixture: Awaited<ReturnType<typeof createRouteApp>>;
    let app: Awaited<ReturnType<typeof createRouteApp>>["app"];
    let customerController: Awaited<ReturnType<typeof createRouteApp>>["customerController"];

    beforeEach(async () => {
        fixture = await createRouteApp(customersRoute, { prefix: "/api/v1" });
        ({ app, customerController } = fixture);
    });

    afterEach(async () => {
        await app.close();
    });

    it("returns all active customers in the response contract", async () => {
        customerController.getAllCustomers.mockResolvedValueOnce([customer]);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(200);
        expect(customersResponseSchema.array().parse(response.json())).toEqual([customer]);
        expect(customerController.getAllCustomers).toHaveBeenCalledOnce();
    });

    it("returns a customer selected by its query ID", async () => {
        customerController.getCustomer.mockResolvedValueOnce(customer);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/customers?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(200);
        expect(customersResponseSchema.parse(response.json())).toEqual(customer);
        expect(customerController.getCustomer).toHaveBeenCalledWith(
            expect.objectContaining({ sub: "11111111-1111-4111-8111-111111111111" }),
            "customer-123"
        );
    });

    it("returns a Problem Details 404 when the requested customer is not found", async () => {
        customerController.getCustomer.mockResolvedValueOnce({
            code: 404,
            message: "Cliente não encontrado."
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/customers?id=missing",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(404);
        expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
        expectProblemDetails(response, {
            status: 404,
            detail: "Cliente não encontrado.",
            requestId
        });
    });

    it.each([400, 503])("converts a %i customer lookup result to Problem Details", async (code) => {
        customerController.getCustomer.mockResolvedValueOnce({
            code,
            message: "Customer lookup unavailable."
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/customers?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, { status: code });
    });

    it("rejects unknown customer-list query parameters with a validation problem", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/customers?unexpected=yes",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(400);
        expectProblemDetails(response, {
            status: 400,
            requestId
        });
        expect(response.json().errors).toBeDefined();
    });

    it.each([400, 404, 503])("converts a %i customer-list controller result to Problem Details", async (code) => {
        customerController.getAllCustomers.mockResolvedValueOnce({
            code,
            message: "Customer listing unavailable."
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, {
            status: code,
            detail: "Customer listing unavailable."
        });
    });

    it("lists deleted customers using the customer response schema", async () => {
        customerController.getAllDeletedCustomers.mockResolvedValueOnce([customer]);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/customers/deleted",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(200);
        expect(customersResponseSchema.array().parse(response.json())).toEqual([customer]);
    });

    it.each([400, 404, 503])("converts a %i deleted-customer listing result to Problem Details", async (code) => {
        customerController.getAllDeletedCustomers.mockResolvedValueOnce({
            code,
            message: "Deleted-customer listing unavailable."
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/customers/deleted",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, { status: code });
    });

    it("registers a customer, normalizes request data, and returns its Location", async () => {
        customerController.isDocumentUnique.mockResolvedValueOnce({ status: 200, message: null });
        customerController.isEmailRegistered.mockResolvedValueOnce({ status: 200, message: null });
        customerController.registerCustomer.mockResolvedValueOnce(customer);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) },
            payload: newCustomer
        });

        expect(response.statusCode).toBe(201);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        expect(response.headers.location).toBe("/api/v1/customers?id=customer-123");
        expect(customersResponseSchema.parse(response.json())).toEqual(customer);
        expect(customerController.registerCustomer).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ document: "52998224725" }),
            expect.objectContaining({ zipCode: "01001000" })
        );
    });

    it("rejects malformed registration data with a 400 validation problem", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) },
            payload: { ...newCustomer, personType: "OTHER" }
        });

        expect(response.statusCode).toBe(400);
        expectProblemDetails(response, {
            status: 400,
            requestId
        });
        expect(response.json().errors).toBeDefined();
        expect(customerController.registerCustomer).not.toHaveBeenCalled();
    });

    it("converts a duplicate document result into a 409 Problem Details response", async () => {
        customerController.isDocumentUnique.mockResolvedValueOnce({
            status: 409,
            message: "Documento já cadastrado."
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) },
            payload: newCustomer
        });

        expect(response.statusCode).toBe(409);
        expectProblemDetails(response, {
            status: 409,
            detail: "Documento já cadastrado."
        });
        expect(customerController.registerCustomer).not.toHaveBeenCalled();
    });

    it("converts a document-validation 404 result into Problem Details", async () => {
        customerController.isDocumentUnique.mockResolvedValueOnce({
            code: 404,
            message: "Documento não encontrado."
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) },
            payload: newCustomer
        });

        expect(response.statusCode).toBe(404);
        expectProblemDetails(response, {
            status: 404,
            detail: "Documento não encontrado."
        });
    });

    it("converts a registered-email result into a 409 conflict", async () => {
        customerController.isDocumentUnique.mockResolvedValueOnce({ status: 200, message: null });
        customerController.isEmailRegistered.mockResolvedValueOnce({
            status: 409,
            message: "E-mail já cadastrado."
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) },
            payload: newCustomer
        });

        expect(response.statusCode).toBe(409);
        expectProblemDetails(response, { status: 409 });
        expect(customerController.registerCustomer).not.toHaveBeenCalled();
    });

    it("requires a Brazilian state code before registering a customer", async () => {
        customerController.isDocumentUnique.mockResolvedValueOnce({ status: 200, message: null });
        customerController.isEmailRegistered.mockResolvedValueOnce({ status: 200, message: null });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) },
            payload: {
                ...newCustomer,
                address: { ...newCustomer.address, state: "XX" }
            }
        });

        expect(response.statusCode).toBe(400);
        expectProblemDetails(response, {
            status: 400,
            detail: "Insira um estado válido"
        });
        expect(customerController.registerCustomer).not.toHaveBeenCalled();
    });

    it("returns 503 when customer registration throws", async () => {
        customerController.isDocumentUnique.mockResolvedValueOnce({ status: 200, message: null });
        customerController.isEmailRegistered.mockResolvedValueOnce({ status: 200, message: null });
        customerController.registerCustomer.mockRejectedValueOnce(new Error("private failure"));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) },
            payload: newCustomer
        });

        expect(response.statusCode).toBe(503);
        expectProblemDetails(response, { status: 503 });
        expect(response.body).not.toContain("private failure");
    });

    it("returns 500 when the pre-registration controller fails unexpectedly", async () => {
        customerController.isDocumentUnique.mockRejectedValueOnce(new Error("private failure"));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) },
            payload: newCustomer
        });

        expect(response.statusCode).toBe(500);
        expectProblemDetails(response, {
            status: 500,
            detail: "Não foi possível concluir a solicitação."
        });
        expect(response.body).not.toContain("private failure");
    });

    it("restores a deleted customer and responds without a body", async () => {
        customerController.getDeletedCustomer.mockResolvedValueOnce(customer);
        customerController.restoreCustomer.mockResolvedValueOnce(undefined);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers/restore?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe("");
    });

    it("returns 404 when restore is requested without a customer ID", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers/restore",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(404);
        expectProblemDetails(response, {
            status: 404,
            detail: "Insira o ID do usuário que deseja restaurar."
        });
    });

    it("returns 404 when the requested customer is not in the deleted list", async () => {
        customerController.getDeletedCustomer.mockResolvedValueOnce(null);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers/restore?id=missing",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(404);
        expectProblemDetails(response, { status: 404 });
    });

    it.each([409, 503])("converts a %i restore result to Problem Details", async (code) => {
        customerController.getDeletedCustomer.mockResolvedValueOnce(customer);
        customerController.restoreCustomer.mockResolvedValueOnce({
            code,
            message: "Restore unavailable."
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/customers/restore?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, { status: code });
    });

    it("updates a customer and responds without a body", async () => {
        customerController.getCustomer.mockResolvedValueOnce(customer);
        customerController.updateCustomer.mockResolvedValueOnce(undefined);

        const response = await app.inject({
            method: "PATCH",
            url: "/api/v1/customers?id=customer-123",
            headers: { cookie: await accessCookie(app) },
            payload: { name: "Ana Atualizada" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe("");
        expect(customerController.updateCustomer).toHaveBeenCalledWith(
            expect.any(Object),
            "customer-123",
            { name: "Ana Atualizada" }
        );
    });

    it("converts an update service error into Problem Details", async () => {
        customerController.getCustomer.mockResolvedValueOnce(customer);
        customerController.updateCustomer.mockResolvedValueOnce({
            code: 503,
            message: "Customer update unavailable."
        });

        const response = await app.inject({
            method: "PATCH",
            url: "/api/v1/customers?id=customer-123",
            headers: { cookie: await accessCookie(app) },
            payload: { name: "Ana Atualizada" }
        });

        expect(response.statusCode).toBe(503);
        expectProblemDetails(response, {
            status: 503,
            detail: "Customer update unavailable."
        });
    });

    it("requires a customer ID for updates", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) },
            payload: { name: "Ana Atualizada" }
        });

        expect(response.statusCode).toBe(400);
        expectProblemDetails(response, {
            status: 400,
            detail: "Insira o ID do usuário que deseja atualizar."
        });
    });

    it("converts a missing customer during update into a 404 response", async () => {
        customerController.getCustomer.mockResolvedValueOnce({
            code: 404,
            message: "Cliente não encontrado."
        });

        const response = await app.inject({
            method: "PATCH",
            url: "/api/v1/customers?id=missing",
            headers: { cookie: await accessCookie(app) },
            payload: { name: "Ana Atualizada" }
        });

        expect(response.statusCode).toBe(404);
        expectProblemDetails(response, { status: 404 });
    });

    it("converts an email collision during update into a 409 conflict", async () => {
        customerController.getCustomer.mockResolvedValueOnce(customer);
        customerController.isEmailRegistered.mockResolvedValueOnce({
            status: 409,
            message: "E-mail já cadastrado."
        });

        const response = await app.inject({
            method: "PATCH",
            url: "/api/v1/customers?id=customer-123",
            headers: { cookie: await accessCookie(app) },
            payload: { email: "other@example.com" }
        });

        expect(response.statusCode).toBe(409);
        expectProblemDetails(response, { status: 409 });
        expect(customerController.updateCustomer).not.toHaveBeenCalled();
    });

    it("converts an unavailable customer lookup during update into 503", async () => {
        customerController.getCustomer.mockResolvedValueOnce({
            code: 503,
            message: "Customer lookup unavailable."
        });

        const response = await app.inject({
            method: "PATCH",
            url: "/api/v1/customers?id=customer-123",
            headers: { cookie: await accessCookie(app) },
            payload: { name: "Ana Atualizada" }
        });

        expect(response.statusCode).toBe(503);
        expectProblemDetails(response, { status: 503 });
    });

    it("moves a customer to the deleted list and returns 204", async () => {
        customerController.getCustomer.mockResolvedValueOnce(customer);
        customerController.deleteCustomer.mockResolvedValueOnce(undefined);

        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/customers?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
    });

    it("returns 404 when a soft-delete request has no customer ID", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/customers",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(404);
        expectProblemDetails(response, { status: 404 });
    });

    it("converts a soft-delete service outage into 503", async () => {
        customerController.getCustomer.mockResolvedValueOnce(customer);
        customerController.deleteCustomer.mockResolvedValueOnce({
            code: 503,
            message: "Delete unavailable."
        });

        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/customers?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(503);
        expectProblemDetails(response, { status: 503 });
    });

    it("permanently deletes a customer from the deleted list and returns 204", async () => {
        customerController.getDeletedCustomer.mockResolvedValueOnce(customer);
        customerController.permanentDeleteCustomer.mockResolvedValueOnce(true);

        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/customers/permanent?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
    });

    it("returns 404 when permanent deletion has no ID or no deleted customer", async () => {
        const missingId = await app.inject({
            method: "DELETE",
            url: "/api/v1/customers/permanent",
            headers: { cookie: await accessCookie(app) }
        });
        customerController.getDeletedCustomer.mockResolvedValueOnce(null);
        customerController.getCustomer.mockResolvedValueOnce(null);
        const missingCustomer = await app.inject({
            method: "DELETE",
            url: "/api/v1/customers/permanent?id=missing",
            headers: { cookie: await accessCookie(app) }
        });

        expect(missingId.statusCode).toBe(404);
        expectProblemDetails(missingId, { status: 404 });
        expect(missingCustomer.statusCode).toBe(404);
        expectProblemDetails(missingCustomer, { status: 404 });
    });

    it("permanently deletes an active customer as required by RN09", async () => {
        customerController.getDeletedCustomer.mockResolvedValueOnce(null);
        customerController.getCustomer.mockResolvedValueOnce(customer);
        customerController.permanentDeleteCustomer.mockResolvedValueOnce(true);

        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/customers/permanent?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(204);
        expect(customerController.permanentDeleteCustomer).toHaveBeenCalledWith(
            expect.objectContaining({ role: "ADMIN" }),
            "customer-123"
        );
    });

    it("converts a permanent-delete lookup failure into 503", async () => {
        customerController.getDeletedCustomer.mockResolvedValueOnce({
            code: 503,
            message: "Deleted customer lookup unavailable."
        });

        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/customers/permanent?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(503);
        expectProblemDetails(response, { status: 503 });
    });

    it("maps permanent-delete domain conflicts to Problem Details", async () => {
        customerController.getDeletedCustomer.mockResolvedValueOnce(customer);
        customerController.permanentDeleteCustomer.mockResolvedValueOnce({
            code: 409,
            message: "Cliente possui vínculos."
        });

        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/customers/permanent?id=customer-123",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(409);
        expectProblemDetails(response, {
            status: 409,
            detail: "Cliente possui vínculos."
        });
    });

    it.each(["missing", "expired", "tampered"] as const)(
        "rejects every protected customer endpoint with a %s access token",
        async (tokenState) => {
            const cookieHeader = tokenState === "missing"
                ? undefined
                : await accessCookie(app, "ADMIN", tokenState === "expired" ? -1 : "5m");
            const headers = tokenState === "tampered" && cookieHeader
                ? { cookie: tamperCookie(cookieHeader) }
                : cookieHeader ? { cookie: cookieHeader } : {};

            for (const request of protectedRequests) {
                const response = await app.inject({ ...request, headers });
                expect(response.statusCode, `${request.method} ${request.url}`).toBe(401);
                expectProblemDetails(response, { status: 401 });
            }
        }
    );

    it.each([
        {
            label: "customer creation",
            role: "VIEWER" as const,
            request: { method: "POST", url: "/api/v1/customers", payload: newCustomer }
        },
        {
            label: "permanent customer deletion",
            role: "OPERATOR" as const,
            request: { method: "DELETE", url: "/api/v1/customers/permanent?id=customer-123" }
        },
        {
            label: "customer restoration",
            role: "VIEWER" as const,
            request: { method: "POST", url: "/api/v1/customers/restore?id=customer-123" }
        },
        {
            label: "customer update",
            role: "VIEWER" as const,
            request: { method: "PATCH", url: "/api/v1/customers?id=customer-123", payload: { name: "Ana" } }
        },
        {
            label: "customer soft deletion",
            role: "VIEWER" as const,
            request: { method: "DELETE", url: "/api/v1/customers?id=customer-123" }
        }
    ] as const)("forbids $label for a role without that permission", async ({ role, request }) => {
        const response = await app.inject({
            ...request,
            headers: { cookie: await accessCookie(app, role) }
        });

        expect(response.statusCode).toBe(403);
        expectProblemDetails(response, { status: 403 });
    });

    it.each([
        {
            label: "customer listing",
            controllerMethod: "getAllCustomers",
            request: { method: "GET", url: "/api/v1/customers" }
        },
        {
            label: "deleted-customer listing",
            controllerMethod: "getAllDeletedCustomers",
            request: { method: "GET", url: "/api/v1/customers/deleted" }
        },
        {
            label: "customer registration validation",
            controllerMethod: "isDocumentUnique",
            request: { method: "POST", url: "/api/v1/customers", payload: newCustomer }
        },
        {
            label: "customer restoration lookup",
            controllerMethod: "getDeletedCustomer",
            request: { method: "POST", url: "/api/v1/customers/restore?id=customer-123" }
        },
        {
            label: "customer update lookup",
            controllerMethod: "getCustomer",
            request: { method: "PATCH", url: "/api/v1/customers?id=customer-123", payload: { name: "Ana" } }
        },
        {
            label: "customer deletion lookup",
            controllerMethod: "getCustomer",
            request: { method: "DELETE", url: "/api/v1/customers?id=customer-123" }
        },
        {
            label: "permanent deletion lookup",
            controllerMethod: "getDeletedCustomer",
            request: { method: "DELETE", url: "/api/v1/customers/permanent?id=customer-123" }
        }
    ] as const)("returns a sanitized 500 when $label fails unexpectedly", async ({ controllerMethod, request }) => {
        customerController[controllerMethod].mockRejectedValueOnce(new Error("private controller failure"));

        const response = await app.inject({
            ...request,
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(500);
        expectProblemDetails(response, {
            status: 500,
            detail: "Não foi possível concluir a solicitação."
        });
        expect(response.body).not.toContain("private controller failure");
    });
});
