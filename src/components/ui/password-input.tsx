import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A password box you can look at.
 *
 * Staff mistype a password they cannot see, and on a phone keyboard that is
 * most of the failed sign-ins. The eye shows what was typed.
 *
 * ── Two things it has to get right ──
 *
 * Revealing means flipping the input to type="text", and a text input in
 * this app gets spellcheck and the autocorrect engine - which could rewrite
 * the password as it is typed. Both are turned off explicitly here, and
 * stay off whether it is shown or hidden.
 *
 * The eye is NOT in the tab order. Tab from a password box should reach the
 * Sign In button, the way it always has; somebody who wants the eye can
 * click it, and a screen reader still reaches it by name.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type"> & { containerClassName?: string }
>(({ className, containerClassName, disabled, ...props }, ref) => {
  const [shown, setShown] = React.useState(false);
  const Icon = shown ? EyeOff : Eye;

  return (
    <div className={cn("relative", containerClassName)}>
      <Input
        {...props}
        ref={ref}
        disabled={disabled}
        type={shown ? "text" : "password"}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        // Room for the eye, so a long password never runs under it.
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
