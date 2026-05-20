export const splitTopLevel = (value: string, delimiter: string) => {
    const tokens: string[] = [];
    let current = "";
    let quote = "";
    let depth = 0;

    for (let i = 0; i < value.length; i++) {
        const char = value[i]!;
        if (quote) {
            current += char;
            if (char === quote && value[i - 1] !== "\\") {
                quote = "";
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            current += char;
            continue;
        }

        if (char === "[" || char === "{" || char === "(") {
            depth++;
            current += char;
            continue;
        }

        if (char === "]" || char === "}" || char === ")") {
            depth--;
            current += char;
            continue;
        }

        if (char === delimiter && depth === 0) {
            const token = current.trim();
            if (token) {
                tokens.push(token);
            }
            current = "";
            continue;
        }

        current += char;
    }

    const tail = current.trim();
    if (tail) {
        tokens.push(tail);
    }

    return tokens;
};

export const splitTypename = (typename: string) => {
    const optional = typename.endsWith("?");
    const clean = optional ? typename.slice(0, -1) : typename;
    const rawArray = clean.match(/(?:\[\d*\])+$/)?.[0] ?? "";
    const array = rawArray.replace(/\d+/g, "");
    const base = clean.slice(0, clean.length - rawArray.length);
    return {
        base,
        array,
        optional,
    };
};

export const splitTupleTypename = (typename: string) => {
    const base = splitTypename(typename).base.trim();
    if (!base.startsWith("[") || !base.endsWith("]")) {
        return [];
    }
    const members = splitTopLevel(base.slice(1, -1), ",");
    return members.length > 1 ? members : [];
};

export const removeLastArraySuffix = (typename: string) => {
    const optional = typename.endsWith("?");
    const clean = optional ? typename.slice(0, -1) : typename;
    return clean.replace(/\[\d*\]$/, "") + (optional ? "?" : "");
};
