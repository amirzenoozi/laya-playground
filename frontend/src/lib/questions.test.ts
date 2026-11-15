import { describe, expect, it } from "vitest";
import { askBody, askProblem, blankQuestion, parseLevel, parseOption, questionProblem, type QuestionDraft } from "./questions";

const question = (fields: Partial<QuestionDraft>): QuestionDraft => ({ ...blankQuestion(), instruction: "Is it urgent?", ...fields });
const option = (label: string) => ({ label, description: "" });

describe("parseOption", () => {
  it("splits a label from its description at the first colon", () => {
    expect(parseOption(" delivery : shipping: parcels ")).toEqual({ label: "delivery", description: "shipping: parcels" });
    expect(parseOption("billing")).toEqual({ label: "billing", description: "" });
    expect(parseOption(" : nothing")).toBeNull();
  });

  it("keeps a colon in a score level", () => {
    expect(parseLevel("level: high")).toEqual({ label: "level: high", description: "" });
  });
});

describe("questionProblem", () => {
  it("asks for the question, then for enough distinct options", () => {
    expect(questionProblem(question({ instruction: " " }))).toBe("Write the question");
    expect(questionProblem(question({ type: "choice", options: [option("a")] }))).toBe("Add at least two options");
    expect(questionProblem(question({ type: "choice", options: [option("A"), option("a")] }))).toMatch(/own label/);
    expect(questionProblem(question({ type: "score", levels: ["low", "high"] }))).toBeNull();
    expect(questionProblem(question({ type: "noul" }))).toBeNull();
  });
});

describe("askProblem", () => {
  it("names the first question with a problem", () => {
    expect(askProblem("", [question({})])).toBe("Write the text to judge");
    expect(askProblem("Hi", [])).toBe("Add a question");
    expect(askProblem("Hi", [question({}), question({ type: "score" })])).toBe("Question 2: Add at least two levels");
  });
});

describe("askBody", () => {
  it("sends only each type's own fields, and yes/no meanings only when written", () => {
    const body = askBody(" Hello ", [
      question({ type: "noul", yes: " they ask ", options: [option("ignored")] }),
      question({ type: "choice", options: [option("a"), option("b")], levels: ["ignored"] }),
      question({ type: "score", levels: ["low", "high"] }),
    ]);

    expect(body).toEqual({
      text: "Hello",
      questions: [
        { type: "noul", instruction: "Is it urgent?", yes: "they ask" },
        { type: "choice", instruction: "Is it urgent?", options: [option("a"), option("b")] },
        { type: "score", instruction: "Is it urgent?", levels: ["low", "high"] },
      ],
    });
  });
});
