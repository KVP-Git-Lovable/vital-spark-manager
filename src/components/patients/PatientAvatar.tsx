interface PatientAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  className?: string;
}

/**
 * Patient display picture — uses the best photo linked to the patient,
 * falling back to initials when no photo exists.
 */
export function PatientAvatar({ firstName, lastName, photoUrl, className = "h-10 w-10" }: PatientAvatarProps) {
  const initials = `${firstName?.[0] || "?"}${lastName?.[0] || ""}`.toUpperCase();
  const name = `${firstName || ""} ${lastName || ""}`.trim() || "Patient";

  return (
    <div
      className={`${className} rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-display font-semibold text-sm shrink-0 ring-1 ring-border`}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`${name} photo`}
          loading="lazy"
          className="h-full w-full object-cover object-top"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        initials
      )}
    </div>
  );
}
