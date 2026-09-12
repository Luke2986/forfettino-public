import { z } from "zod";

const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /\d/;
const HAS_SYMBOL = /[!@#$%^&*()_+\-=[\]{}|;:',.<>?/\\]/;

export const PASSWORD_REQUIREMENTS = [
  { key: "minLength" as const, label: "Almeno 8 caratteri" },
  { key: "hasUppercase" as const, label: "Almeno una lettera maiuscola" },
  { key: "hasLowercase" as const, label: "Almeno una lettera minuscola" },
  { key: "hasNumber" as const, label: "Almeno un numero" },
  { key: "hasSymbol" as const, label: "Almeno un simbolo speciale" },
] as const;

export type PasswordChecks = Record<typeof PASSWORD_REQUIREMENTS[number]["key"], boolean>;

export type PasswordStrengthLevel = "weak" | "medium" | "strong";

export interface PasswordStrength {
  score: number;
  level: PasswordStrengthLevel;
  checks: PasswordChecks;
}

export function getPasswordStrength(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    hasUppercase: HAS_UPPERCASE.test(password),
    hasLowercase: HAS_LOWERCASE.test(password),
    hasNumber: HAS_NUMBER.test(password),
    hasSymbol: HAS_SYMBOL.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  let level: PasswordStrengthLevel;
  if (score >= 5) {
    level = "strong";
  } else if (score >= 3) {
    level = "medium";
  } else {
    level = "weak";
  }

  return { score, level, checks };
}

export const strongPasswordSchema = z
  .string()
  .min(8, "La password deve avere almeno 8 caratteri")
  .max(100, "Password troppo lunga")
  .superRefine((val, ctx) => {
    if (!HAS_UPPERCASE.test(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La password deve contenere almeno una lettera maiuscola" });
    }
    if (!HAS_LOWERCASE.test(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La password deve contenere almeno una lettera minuscola" });
    }
    if (!HAS_NUMBER.test(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La password deve contenere almeno un numero" });
    }
    if (!HAS_SYMBOL.test(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La password deve contenere almeno un simbolo speciale" });
    }
  });
