# Make colour themes stick permanently

## What's happening

The theme feature is fully built (picker in My Profile, in User Management > Appearance, and the palette icon in the header), but the saved choice keeps getting overwritten. Two confirmed causes:

1. **The database always answers "amber".** The `theme_preference` field on staff records is required and defaults to `amber`. Right now 19 of 20 staff rows still hold `amber` and only 1 holds a different theme — so whenever your pick isn't written successfully, the next page load reads `amber` back and repaints everything.
2. **The save is fire-and-forget.** The code that writes your theme choice ignores any failure — no error, no toast. It reports "Theme changed" even when nothing was stored. There is also a reload effect that re-reads the database whenever the signed-in profile object refreshes, which can revert your pick mid-session without a refresh (matches "it disappears after some time").

## The fix

- **Verify and confirm every save.** Write the theme to the staff record, check the response, and confirm a row was actually updated. Only show success when the write is confirmed; otherwise show a clear warning that the theme is applied locally only.
- **Stop the silent revert.** The reload effect runs once per signed-in staff member (keyed on staff id, not the whole profile object) and never overwrites a theme the user picked during the current session.
- **Treat a fresh pick as authoritative.** The locally stored choice wins over the database default until the database confirms a stored value, so a slow or failed write never snaps the UI back to amber.
- **No flash on load.** Apply the last known theme immediately at app startup, before the sign-in check finishes, so the correct palette paints on first render of every page (including login).
- **Persist across devices.** Once the write is confirmed, signing in anywhere picks up the same theme from the profile.

No changes to the picker UI, palette list, or where the picker lives — those stay as they are.

## Technical notes

- `src/hooks/useTheme.tsx`: rework `setTheme` to await the update with `.select("id")`, surface errors via toast, and guard the load effect with a ref of the staff id plus a "changed this session" flag.
- Add an eager `applyTheme(localStorage value)` at provider init so the palette is set before the auth round-trip resolves.
- Optional small migration: allow `theme_preference` to be null so "never chosen" is distinguishable from "chose amber".