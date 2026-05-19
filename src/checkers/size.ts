import { CheckerParser } from "../core/contracts";

export const SizeCheckerParser: CheckerParser = (ctx, arg) => {
    const length = Number(arg);
    if (isNaN(length)) {
        throw new Error(`Invalid length: '${length}'`);
    }
    return ({ cell }) => {
        if (cell.v instanceof Array) {
            return cell.v.length === length;
        }
        return false;
    };
};
