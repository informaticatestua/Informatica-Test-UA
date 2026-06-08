import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export function loadQuizParserCore() {
    const scriptPath = path.resolve("public/resources/js/quiz-parser-core.js");
    const source = fs.readFileSync(scriptPath, "utf8");

    const context = {
        console,
        Math,
        globalThis: {},
        window: {},
    };

    context.globalThis = context;
    context.window = context;

    vm.runInNewContext(source, context, { filename: scriptPath });

    return context.QuizParserCore;
}
