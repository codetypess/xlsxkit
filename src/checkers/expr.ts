import { CheckerParser } from "../core/contracts";

export const ExprCheckerParser: CheckerParser = (ctx, expr) => {
    expr = Array.from(expr.matchAll(/\$?[\w.]+|\d+|[^\w]+/g))
        .map(([v]) => {
            if (/^[a-zA-Z_]/.test(v)) {
                return v.replace(/^(\w+)/, "this.$1.v");
            } else {
                return v;
            }
        })
        .join("");
    const check = new Function("$", "return " + expr);
    return ({ cell, row, errors }) => {
        try {
            return check.call(row, cell.v);
        } catch (e) {
            errors.push(`Expression error: ${expr}`);
            return false;
        }
    };
};
