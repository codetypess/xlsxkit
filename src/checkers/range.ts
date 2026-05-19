import { CheckerParser } from "../core/contracts";

export const RangeCheckerParser: CheckerParser = (ctx, arg) => {
    let values: unknown[] = [];
    try {
        values = JSON.parse(arg);
    } catch (e) {
        throw new Error(`Invalid range: '${arg}'`);
    }
    return ({ cell }) => {
        return values.includes(cell.v);
    };
};
