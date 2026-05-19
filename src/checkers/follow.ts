import { CheckerParser } from "../core/contracts";
import { type TCell } from "../core/schema";

export const FollowCheckerParser: CheckerParser = (ctx, arg) => {
    return ({ cell, row }) => {
        const follow = row[arg] as TCell;
        if (follow.v !== null) {
            return cell.v !== null;
        } else {
            return cell.v === null;
        }
    };
};
