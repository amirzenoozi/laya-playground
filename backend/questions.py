"""What the UI asks (a text and up to ten questions), how each question is put to Laya, and how its answer is read.

Laya takes questions keyed by name, each with a type, instructions and criteria, and answers each in its own shape.
Here every answer becomes the same shape: the winning option and every option's probability.
"""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

MAX_TEXT = 10_000
MAX_QUESTIONS = 10

Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
Instruction = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]

LayaQuestion = dict[str, object]


class QuestionType(StrEnum):
    YES_NO = "noul"
    CHOICE = "choice"
    SCORE = "score"


class Option(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: Label
    description: Description = ""


def unique(labels: list[str]) -> None:
    lowered = [label.lower() for label in labels]
    if len(set(lowered)) != len(lowered):
        raise ValueError("each option needs its own label")


class YesNoQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal[QuestionType.YES_NO]
    instruction: Instruction
    yes: Description = ""
    no: Description = ""

    def for_laya(self) -> LayaQuestion:
        criteria = {key: text for key, text in (("true", self.yes), ("false", self.no)) if text}
        return {"type": "noul", "instructions": self.instruction, "criteria": criteria}

    def labels(self) -> list[str]:
        return ["yes", "no"]


class ChoiceQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal[QuestionType.CHOICE]
    instruction: Instruction
    options: list[Option] = Field(min_length=2, max_length=20)

    @field_validator("options")
    @classmethod
    def distinct(cls, options: list[Option]) -> list[Option]:
        unique([option.label for option in options])
        return options

    def for_laya(self) -> LayaQuestion:
        criteria = {option.label: option.description or None for option in self.options}
        return {"type": "choice", "instructions": self.instruction, "criteria": criteria}

    def labels(self) -> list[str]:
        return [option.label for option in self.options]


class ScoreQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal[QuestionType.SCORE]
    instruction: Instruction
    # Lowest first
    levels: list[Label] = Field(min_length=2, max_length=10)

    @field_validator("levels")
    @classmethod
    def distinct(cls, levels: list[str]) -> list[str]:
        unique(levels)
        return levels

    def for_laya(self) -> LayaQuestion:
        return {"type": "score", "instructions": self.instruction, "criteria": list(self.levels)}

    def labels(self) -> list[str]:
        return list(self.levels)


Question = Annotated[YesNoQuestion | ChoiceQuestion | ScoreQuestion, Field(discriminator="type")]


class AskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TEXT)]
    questions: list[Question] = Field(min_length=1, max_length=MAX_QUESTIONS)


class Probability(BaseModel):
    label: str
    probability: float


class Answer(BaseModel):
    index: int
    winner: str
    probabilities: list[Probability]
    confidence: float
    # The expected level, from 0 (the first) up, for a score question only
    score: float | None = None
    ms: int


class AnswerError(ValueError):
    """Laya's answer does not have the shape its question type promises."""


def number(raw: dict[str, object], key: str) -> float:
    value = raw.get(key)
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise AnswerError(f"answer has no number {key!r}")
    return float(value)


def probabilities_of(raw: dict[str, object], labels: list[str]) -> list[Probability]:
    """Choice answers key probabilities by label, score answers by level index; both come back in option order."""
    found = raw.get("probabilities")
    if not isinstance(found, dict):
        raise AnswerError("answer has no probabilities")
    keys = labels if raw.get("type") == "choice" else [str(index) for index in range(len(labels))]
    return [Probability(label=label, probability=number(found, key)) for label, key in zip(labels, keys)]


def read_answer(question: YesNoQuestion | ChoiceQuestion | ScoreQuestion, raw: dict[str, object], index: int, ms: int) -> Answer:
    if isinstance(question, YesNoQuestion):
        yes = number(raw, "noul")
        probabilities = [Probability(label="yes", probability=yes), Probability(label="no", probability=round(1 - yes, 4))]
        score = None
    else:
        probabilities = probabilities_of(raw, question.labels())
        score = number(raw, "score") if isinstance(question, ScoreQuestion) else None
    winner = max(probabilities, key=lambda option: option.probability).label
    return Answer(index=index, winner=winner, probabilities=probabilities, confidence=number(raw, "confidence"), score=score, ms=ms)
