import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const hasMinLength = password.length >= 9;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const criteria = [
    { label: "More than 8 characters (min. 9)", valid: hasMinLength },
    { label: "At least one uppercase letter (A-Z)", valid: hasUpper },
    { label: "At least one lowercase letter (a-z)", valid: hasLower },
    { label: "At least one special character (e.g. !@#$)", valid: hasSpecial },
  ];

  if (!password) {
    return (
      <div className="space-y-1 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground border border-border/50">
        <p className="font-semibold text-foreground/80 mb-1">
          Password requirements:
        </p>
        <ul className="space-y-1">
          {criteria.map((c, i) => (
            <li key={i} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-md bg-muted/40 p-2.5 text-xs border border-border/50">
      <p className="font-semibold text-foreground/80 mb-1">
        Password requirements:
      </p>
      <ul className="space-y-1">
        {criteria.map((c, i) => (
          <li
            key={i}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              c.valid
                ? "text-emerald-600 dark:text-emerald-400 font-medium"
                : "text-muted-foreground"
            )}
          >
            {c.valid ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            )}
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
