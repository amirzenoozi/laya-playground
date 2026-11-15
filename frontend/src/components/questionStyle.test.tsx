import { expect, it } from "vitest";
import { QUESTION_TYPES } from "../lib/questions";
import { QUESTION_STYLE } from "./questionStyle";

it("gives every answer type its own style", () => {
  for (const type of QUESTION_TYPES) expect(QUESTION_STYLE[type.value]).toBeDefined();
  expect(new Set(Object.values(QUESTION_STYLE).map((style) => style.stripe)).size).toBe(QUESTION_TYPES.length);
});
