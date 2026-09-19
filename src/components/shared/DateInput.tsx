import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { displayToIso, isoToDisplay, maskTyping } from "@/lib/dateInput";

interface DateInputProps {
  /** The stored date, ISO yyyy-MM-dd, or "" when there isn't one. */
  value: string;
  /** Called with a complete ISO date, or "" when the box is emptied. */
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}

/**
 * A date field that reads and accepts dd/MM/yyyy on every machine.
 *
 * Replaces `<input type="date">`, which the browser paints in the viewer's own
 * region setting - the reason one clinic PC showed a patient as 07/31/1982 and
 * another 31/07/1982. It speaks the same ISO yyyy-MM-dd to its caller that the
 * native input did, so nothing downstream changes.
 *
 * The typed text is held locally and only handed upwards once it parses. Writing
 * the converted value straight back on every keystroke is what makes a field of
 * this kind impossible to type in: the text is reformatted mid-edit and the
 * caret jumps to the end. (Same shape of bug as the Paid Amount zero-trap that
 * `@/lib/numberInput` exists to avoid.)
 */
export function DateInput({ value, onChange, id, className, placeholder = "dd/mm/yyyy" }: DateInputProps) {
  const [text, setText] = useState(() => isoToDisplay(value));

  // Re-sync only when the incoming date is not the one already on screen, so a
  // reset from outside still lands while a half-typed date is never yanked out
  // from under the caret.
  useEffect(() => {
    if (displayToIso(text) !== (value || null)) setText(isoToDisplay(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Input
      id={id}
      className={className}
      value={text}
      inputMode="numeric"
      placeholder={placeholder}
      onChange={(e) => {
        const next = maskTyping(e.target.value);
        setText(next);
        const iso = displayToIso(next);
        if (iso) onChange(iso);
        else if (next === "") onChange("");
      }}
      onBlur={() => {
        // A date left half-typed would show one thing while a different one got
        // saved, so on leaving the field the text snaps back to what is stored.
        if (text !== "" && displayToIso(text) === null) setText(isoToDisplay(value));
      }}
    />
  );
}
