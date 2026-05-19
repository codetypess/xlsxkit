import { Processor } from "../core/contracts";
import { output } from "../io";

export const GenTypeProcessor: Processor = async (workbook) => {
    output(workbook, "gen-type", null!);
};
