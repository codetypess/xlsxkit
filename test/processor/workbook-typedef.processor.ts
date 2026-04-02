import * as xlsx from "../../index.js";
let done = false;

export const makeTypename = (name: string) => {
    if (name === "items") {
        return "Items";
    }
    return name;
};

xlsx.registerProcessor(
    "workbook-typedef",
    async (workbook) => {
        if (done) {
            return;
        }
        done = true;
        xlsx.writeFile(
            "test/output/workbook-typedef.ts",
            xlsx.genXlsxType(workbook.context, (typename) => {
                if (typename === "TCell") {
                    return {
                        type: "TCell as _TCell",
                        path: "../../index.js",
                    };
                }
                return {
                    type: makeTypename(typename),
                    path: "./client/define/index.js",
                };
            })
        );
    },
    {
        required: true,
        stage: "pre-parse",
    }
);
