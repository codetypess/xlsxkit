import { Processor } from "../core/contracts";
import { type TObject } from "../core/schema";
import { output } from "../io";
import { getTypedefWorkbook } from "../typedef";

export const TypedefWriteProcessor: Processor = async (workbook, sheet) => {
    const typedefWorkbook = getTypedefWorkbook(workbook, sheet.name);
    if (!typedefWorkbook) {
        return;
    }
    output(workbook, "typedef", typedefWorkbook as unknown as TObject);
};
