import { Converter } from "../core/contracts";

const bools: Record<string, boolean> = {
    ["true"]: true,
    ["1"]: true,
    ["✔︎"]: true,
    ["false"]: false,
    ["0"]: false,
    ["✖︎"]: false,
    ["x"]: false,
};

export const boolConverter: Converter = (str) => {
    return bools[str] ?? null;
};
