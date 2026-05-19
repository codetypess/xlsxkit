import { ExprCheckerParser } from "./checkers/expr";
import { FollowCheckerParser } from "./checkers/follow";
import { IndexCheckerParser } from "./checkers/index-checker";
import { OneOfCheckerParser } from "./checkers/oneof";
import { RangeCheckerParser } from "./checkers/range";
import { ReferCheckerParser } from "./checkers/refer";
import { SheetCheckerParser } from "./checkers/sheet";
import { SizeCheckerParser } from "./checkers/size";
import { UniqueCheckerParser } from "./checkers/unique";
import { boolConverter } from "./converters/bool";
import { floatConverter } from "./converters/float";
import { intConverter } from "./converters/int";
import { jsonConverter } from "./converters/json";
import { stringConverter } from "./converters/string";
import { BuiltinChecker } from "./core/contracts";
import { registerChecker, registerProcessor, registerType } from "./core/registry";
import { tableConverter } from "./core/table";
import { AutoRegisterProcessor } from "./processors/auto-register";
import { CollapseProcessor } from "./processors/collapse";
import { ColumnProcessor } from "./processors/column";
import { ConfigProcessor } from "./processors/config";
import { DefineProcessor } from "./processors/define";
import { GenTypeProcessor } from "./processors/gen-type";
import { MapProcessor } from "./processors/map";
import {
    mergeSheets,
    registerStringifyRule,
    simpleSheets,
    StringifyProcessor,
} from "./processors/stringify";
import { TypedefProcessor } from "./processors/typedef";
import { TypedefWriteProcessor } from "./processors/typedef-write";

let registered = false;

export const registerBuiltins = () => {
    if (registered) {
        return;
    }
    registered = true;

    registerType("auto", intConverter);
    registerType("bool", boolConverter);
    registerType("float", floatConverter);
    registerType("int", intConverter);
    registerType("json", jsonConverter);
    registerType("string", stringConverter);
    registerType("table", tableConverter);

    registerChecker(BuiltinChecker.Expr, ExprCheckerParser);
    registerChecker(BuiltinChecker.Follow, FollowCheckerParser);
    registerChecker(BuiltinChecker.Index, IndexCheckerParser);
    registerChecker(BuiltinChecker.OneOf, OneOfCheckerParser);
    registerChecker(BuiltinChecker.Range, RangeCheckerParser);
    registerChecker(BuiltinChecker.Refer, ReferCheckerParser);
    registerChecker(BuiltinChecker.Sheet, SheetCheckerParser);
    registerChecker(BuiltinChecker.Size, SizeCheckerParser);
    registerChecker(BuiltinChecker.Unique, UniqueCheckerParser);

    registerProcessor("define", DefineProcessor, { stage: "pre-stringify" });
    registerProcessor("config", ConfigProcessor, { stage: "pre-stringify", priority: 800 });
    registerProcessor("map", MapProcessor, { stage: "pre-stringify", priority: 800 });
    registerProcessor("collapse", CollapseProcessor, { stage: "pre-stringify", priority: 800 });
    registerProcessor("column", ColumnProcessor, { stage: "pre-stringify", priority: 800 });
    registerProcessor("typedef", TypedefProcessor, { stage: "after-read" });
    registerProcessor("typedef-write", TypedefWriteProcessor, {
        stage: "pre-stringify",
        priority: -100,
    });
    registerProcessor("stringify", StringifyProcessor, {
        stage: "stringify",
        priority: 900,
        required: true,
    });
    registerProcessor("gen-type", GenTypeProcessor, {
        stage: "stringify",
        priority: 999,
        required: true,
    });
    registerProcessor("auto-register", AutoRegisterProcessor, {
        required: true,
        stage: "after-read",
        priority: 999,
    });

    registerStringifyRule("merge", mergeSheets);
    registerStringifyRule("simple", simpleSheets);
};
