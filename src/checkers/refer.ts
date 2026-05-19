import { CheckerParser } from "../core/contracts";

export const ReferCheckerParser: CheckerParser = (ctx, arg) => {
    return ({ cell, row, field, errors }) => {
        return true;
    };
};
