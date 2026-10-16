import type { DocumentValidation } from "@packages/contracts/document.schema";

const BRAZILIAN_STATE_CODES = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
    "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
    "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]);

type StateValidation = (
    | { status: 200; message: null }
    | { status: 400; message: string }
) & DocumentValidation;

export const stateValidator = async (state: string): Promise<StateValidation> => {
    if (!BRAZILIAN_STATE_CODES.has(state.trim().toUpperCase())) {
        return {
            status: 400,
            message: "Insira um estado válido"
        };
    }

    return {
        status: 200,
        message: null
    };
};