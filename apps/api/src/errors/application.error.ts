export type ApplicationErrorCode = 403 | 404 | 503;

export class ApplicationError
{
    private readonly httpCode: ApplicationErrorCode;
    private readonly message: string;

    constructor(code: ApplicationErrorCode, message: string)
    {
        this.httpCode = code;
        this.message = message;
    }

    public getCode(): ApplicationErrorCode
    {
        return this.httpCode;
    }

    public getMessage(): string
    {
        return this.message;
    }
}