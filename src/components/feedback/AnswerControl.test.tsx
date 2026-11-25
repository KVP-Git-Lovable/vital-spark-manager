import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AnswerControl } from "./AnswerControl";
import { feedbackQuestionSchema, type FeedbackQuestion } from "@/lib/feedbackQuestions";

/**
 * The scale, in a DOM.
 *
 * This control is drawn on the clinic's Feedback tab, in the patient portal,
 * in the admin preview and on a root-cause case, from this one file. It had no
 * render test at all, so the restyling is the moment to hold its behaviour
 * down: a strip that looks right and reports the wrong number, or that a
 * screen reader cannot read, fails silently on every one of those screens.
 */

const question = (over: Partial<FeedbackQuestion> = {}): FeedbackQuestion =>
  feedbackQuestionSchema.parse({
    id: "q1",
    question_text: "How likely are you to recommend us to a friend or colleague?",
    question_type: "scale_10",
    options: { min: 0, max: 10 },
    builtin: "nps",
    ...over,
  });

const segments = () => screen.getAllByRole("button");

describe("AnswerControl: the 0-10 scale", () => {
  it("offers every number from 0 to 10, in order", () => {
    render(<AnswerControl question={question()} value={null} onChange={() => {}} />);
    expect(segments().map((b) => b.textContent)).toEqual(
      ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    );
  });

  it("names each answer for a screen reader", () => {
    render(<AnswerControl question={question()} value={null} onChange={() => {}} />);
    expect(screen.getByLabelText("7 out of 10")).toBeInTheDocument();
  });

  it("reports the number that was pressed", () => {
    const onChange = vi.fn();
    render(<AnswerControl question={question()} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("9 out of 10"));
    expect(onChange).toHaveBeenCalledWith(9);
  });

  it("reports zero as an answer, not as nothing", () => {
    const onChange = vi.fn();
    render(<AnswerControl question={question()} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("0 out of 10"));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("marks only the chosen number as pressed", () => {
    render(<AnswerControl question={question()} value={8} onChange={() => {}} />);
    const pressed = segments().filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed.map((b) => b.textContent)).toEqual(["8"]);
  });

  it("leaves every other segment its own colour when one is chosen", () => {
    render(<AnswerControl question={question()} value={8} onChange={() => {}} />);
    const positions = segments().map((b) => b.style.backgroundPosition);
    expect(new Set(positions).size).toBe(11);
    expect(positions.every((p) => p !== "")).toBe(true);
  });

  it("runs the ramp from one end of the strip to the other", () => {
    render(<AnswerControl question={question()} value={null} onChange={() => {}} />);
    const positions = segments().map((b) => b.style.backgroundPosition);
    expect(positions[0]).toBe("0% 50%");
    expect(positions[positions.length - 1]).toBe("100% 50%");
  });

  it("writes the words under the two ends of the recommend question", () => {
    render(<AnswerControl question={question()} value={null} onChange={() => {}} />);
    expect(screen.getByText("Not at all likely")).toBeInTheDocument();
    expect(screen.getByText("Extremely likely")).toBeInTheDocument();
  });

  it("writes no wording under a question it was not written for", () => {
    render(
      <AnswerControl
        question={question({ builtin: null, question_text: "How clean was the room?" })}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText("Not at all likely")).not.toBeInTheDocument();
  });

  it("follows the bounds the clinic configured", () => {
    render(
      <AnswerControl
        question={question({ builtin: null, options: { min: 1, max: 7 } })}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(segments().map((b) => b.textContent)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  it("paints the numbers from the ramp's own ink token", () => {
    /* Read from the source, because jsdom drops any declaration whose value
       is a var() - the rendered style attribute here keeps the size and the
       position and silently loses the colour and the gradient. A browser
       applies all four. What matters is that the numerals are not switched to
       text-foreground, which would be white on amber in dark mode. */
    const source = readFileSync("src/components/feedback/AnswerControl.tsx", "utf8");
    expect(source).toContain('color: "hsl(var(--scale-ink))"');
  });

  it("falls back to the plain buttons when a scale is too long to be a strip", () => {
    render(
      <AnswerControl
        question={question({ builtin: null, options: { min: 0, max: 100 } })}
        value={null}
        onChange={() => {}}
      />,
    );
    // 101 three-pixel segments would be worse than what the strip replaced.
    expect(segments()).toHaveLength(101);
    expect(segments().every((b) => b.style.backgroundPosition === "")).toBe(true);
  });

  it("still answers from the fallback buttons", () => {
    const onChange = vi.fn();
    render(
      <AnswerControl
        question={question({ builtin: null, options: { min: 0, max: 100 } })}
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("42 out of 100"));
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("draws nothing rather than crashing when the bounds are not a scale", () => {
    render(
      <AnswerControl
        question={question({ builtin: null, options: { min: 5, max: 2 } })}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("takes no answer while disabled, which is how the admin preview is drawn", () => {
    const onChange = vi.fn();
    render(<AnswerControl question={question()} value={null} onChange={onChange} disabled />);
    expect(segments().every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    fireEvent.click(screen.getByLabelText("5 out of 10"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("AnswerControl: the questions the strip did not touch", () => {
  const stars = question({ id: "q2", question_type: "stars", options: { max: 5 }, builtin: "service_rating" });

  it("still draws five stars for the quality question", () => {
    render(<AnswerControl question={stars} value={null} onChange={() => {}} />);
    expect(segments().map((b) => b.getAttribute("aria-label"))).toEqual(
      ["1 star", "2 stars", "3 stars", "4 stars", "5 stars"],
    );
    expect(segments().some((b) => b.style.backgroundPosition !== "")).toBe(false);
  });

  it("still reports a star rating", () => {
    const onChange = vi.fn();
    render(<AnswerControl question={stars} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("4 stars"));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("still draws the faces", () => {
    render(
      <AnswerControl
        question={question({ id: "q3", question_type: "emoji", builtin: null })}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(segments().map((b) => b.textContent)).toEqual(["😞", "🙁", "😐", "🙂", "😀"]);
  });
});
