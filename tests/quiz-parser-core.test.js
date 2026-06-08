import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadQuizParserCore } from "./utils/loadQuizParserCore.js";

const parser = loadQuizParserCore();
const KNOWN_MALFORMED_BLOCKS = [
    { file: "adaPreguntas.txt", questionNumber: 313, reason: "invalid-remapped-index" },
    { file: "adiPreguntas.txt", questionNumber: 343, reason: "missing-answer-line" },
    { file: "adiPreguntas.txt", questionNumber: 344, reason: "invalid-remapped-index" },
    { file: "ic-p1.txt", questionNumber: 49, reason: "invalid-remapped-index" },
    { file: "stiPreguntas.txt", questionNumber: 13, reason: "multiline-stem-breaks-positional-format" },
];

function inspectParsedQuestion(block) {
    const lines = block.split("\n");
    const [, secondLine = "", thirdLine = ""] = lines;
    const secondLineIsAnswer = /^\d+(?:\s*,\s*\d+)*$/.test(secondLine.trim());
    const thirdLineIsAnswer = /^\d+(?:\s*,\s*\d+)*$/.test(thirdLine.trim());

    try {
        const parsed = parser.parsePregunta(block, {
            shuffleFn: (options) => options,
        });

        const invalidResponses = parsed.respuestas.filter(
            (respuesta) =>
                !Number.isInteger(respuesta) ||
                respuesta < 1 ||
                respuesta > parsed.opciones.length,
        );

        return {
            ok: invalidResponses.length === 0,
            reason:
                invalidResponses.length === 0
                    ? null
                    : !secondLineIsAnswer && thirdLineIsAnswer
                        ? "multiline-stem-breaks-positional-format"
                        : "invalid-remapped-index",
            parsed,
        };
    } catch (error) {
        return {
            ok: false,
            reason: "missing-answer-line",
            error,
        };
    }
}

describe("quiz-parser-core", () => {
    it("shuffle baraja in-place con Fisher-Yates y conserva los elementos", () => {
        const values = [1, 2, 3, 4];
        const randomSequence = [0.75, 0.2, 0.5];
        let cursor = 0;

        const result = parser.shuffle(values, () => randomSequence[cursor++]);

        expect(result).toBe(values);
        expect(result).toEqual([3, 2, 1, 4]);
        expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    });

    it("parsePregunta detecta múltiples respuestas por índices duplicados y remapea tras shuffle", () => {
        const block = [
            "¿Qué opciones son válidas?",
            "2,2,4",
            "Primera",
            "Segunda",
            "Tercera",
            "Cuarta",
        ].join("\n");

        const pregunta = parser.parsePregunta(block, {
            shuffleFn: () => ["Cuarta", "Primera", "Segunda", "Tercera"],
        });

        expect(pregunta.pregunta).toBe("¿Qué opciones son válidas?");
        expect(pregunta.opciones).toEqual(["Cuarta", "Primera", "Segunda", "Tercera"]);
        expect(pregunta.respuestas).toEqual([3, 1]);
        expect(pregunta.multiple).toBe(true);
    });

    it("parsePreguntasTxt delega por bloques y genera ids estables", () => {
        const contenido = [
            "Pregunta A",
            "1",
            "Opción A1",
            "Opción A2",
            "",
            "Pregunta B",
            "2",
            "Opción B1",
            "Opción B2",
        ].join("\n");

        const preguntas = parser.parsePreguntasTxt(contenido, {
            shuffleFn: (options) => options,
        });

        expect(preguntas).toHaveLength(2);
        expect(preguntas[0].pregunta).toBe("Pregunta A");
        expect(preguntas[0].respuestas).toEqual([1]);
        expect(preguntas[0].id).toBe(parser.hashString("Pregunta A\n1\nOpción A1\nOpción A2"));
        expect(preguntas[1].pregunta).toBe("Pregunta B");
        expect(preguntas[1].respuestas).toEqual([2]);
    });

    it("todos los bloques válidos del banco se parsean con respuestas dentro de rango", () => {
        const dataDir = path.resolve("public/resources/data");
        const txtFiles = fs.readdirSync(dataDir).filter((file) => file.endsWith(".txt"));
        const malformedBlocks = [];

        expect(txtFiles.length).toBeGreaterThan(0);

        for (const file of txtFiles) {
            const contenido = fs.readFileSync(path.join(dataDir, file), "utf8")
                .replace(/\r\n/g, "\n")
                .replace(/\r/g, "\n")
                .trim();
            const bloques = contenido.split(/\n{2,}/);

            expect(bloques.length, file).toBeGreaterThan(0);

            bloques.forEach((block, index) => {
                const inspection = inspectParsedQuestion(block);
                if (!inspection.ok) {
                    malformedBlocks.push({
                        file,
                        questionNumber: index + 1,
                        reason: inspection.reason,
                    });
                    return;
                }

                const { parsed: pregunta } = inspection;
                expect(pregunta.pregunta.trim().length, file).toBeGreaterThan(0);
                expect(pregunta.opciones.length, file).toBeGreaterThan(0);
                expect(pregunta.respuestas.length, file).toBeGreaterThan(0);
            });
        }

        expect(malformedBlocks).toEqual(KNOWN_MALFORMED_BLOCKS);
    });
});
