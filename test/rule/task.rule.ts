import * as xlsx from "../../";

xlsx.registerStringify("task", (workbook) => {
    return xlsx.simpleSheet(workbook);
});
