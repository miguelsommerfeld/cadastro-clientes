import { ApplicationError, type ApplicationErrorCode } from "@/errors/application.error";

export type ApplicationErrorResponse = {
    code: ApplicationErrorCode;
    message: string;
};

export class Service
{
    protected toApplicationErrorResponse<T>(
        result: T
    ): Exclude<T, ApplicationError> | ApplicationErrorResponse
    {
        if (result instanceof ApplicationError) {
            return {
                code: result.getCode(),
                message: result.getMessage()
            };
        }

        return result as Exclude<T, ApplicationError>;
    }
}