import * as xlsx from "../..";
import { makeTypename } from "./workbook-typedef.processor";

let done = false;

xlsx.registerProcessor(
    "workbook-indexer",
    async (workbook) => {
        if (done) {
            return;
        }
        done = true;
        const content = xlsx.genWorkbookIndexer(workbook.context, (typename) => {
            if (["ColumnIndexer", "RowIndexer", "Context"].includes(typename)) {
                return {
                    type: typename,
                    path: "../../",
                };
            } else {
                return {
                    type: makeTypename(typename),
                    path: "./workbook-typedef",
                };
            }
        });
        xlsx.writeFile("test/output/workbook-indexer.ts", content);
    },
    {
        required: true,
        stage: "pre-parse",
    }
);
