import { describe, it, expect } from "vitest";
import {
  strongPasswordSchema,
  getPasswordStrength,
  PASSWORD_REQUIREMENTS,
} from "./password-validation";

describe("strongPasswordSchema", () => {
  it("rejects empty password", () => {
    const result = strongPasswordSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = strongPasswordSchema.safeParse("Abc1!x");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("8 caratteri"))).toBe(true);
    }
  });

  it("rejects 7-character password even with all complexity", () => {
    const result = strongPasswordSchema.safeParse("Abc1!xy");
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = strongPasswordSchema.safeParse("abcdefg1!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("maiuscola"))).toBe(true);
    }
  });

  it("rejects password without lowercase", () => {
    const result = strongPasswordSchema.safeParse("ABCDEFG1!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("minuscola"))).toBe(true);
    }
  });

  it("rejects password without number", () => {
    const result = strongPasswordSchema.safeParse("Abcdefgh!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("numero"))).toBe(true);
    }
  });

  it("rejects password without symbol", () => {
    const result = strongPasswordSchema.safeParse("Abcdefg1x");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("simbolo"))).toBe(true);
    }
  });

  it("rejects password longer than 100 characters", () => {
    const long = "A".repeat(95) + "bcde1!";
    expect(long.length).toBeGreaterThan(100);
    const result = strongPasswordSchema.safeParse(long);
    expect(result.success).toBe(false);
  });

  it("accepts password that meets all requirements", () => {
    const result = strongPasswordSchema.safeParse("Abcdefg1!");
    expect(result.success).toBe(true);
  });

  it("accepts password with exactly 8 characters meeting all requirements", () => {
    const result = strongPasswordSchema.safeParse("Abcdef1!");
    expect(result.success).toBe(true);
  });

  it("accepts password at exactly 100 characters", () => {
    // 1 uppercase + 97 lowercase + 1 digit + 1 symbol = 100
    const pw = "A" + "b".repeat(97) + "1!";
    expect(pw.length).toBe(100);
    const result = strongPasswordSchema.safeParse(pw);
    expect(result.success).toBe(true);
  });

  it("accepts unicode/accented characters as letters", () => {
    // è counts as lowercase, Ñ counts as uppercase via the regex
    // but our regex uses [A-Z] and [a-z], so accented chars don't count
    // The password still needs explicit A-Z and a-z
    const result = strongPasswordSchema.safeParse("Abcèñü1!x");
    expect(result.success).toBe(true);
  });

  it("rejects password with only symbols", () => {
    const result = strongPasswordSchema.safeParse("!@#$%^&*()");
    expect(result.success).toBe(false);
  });

  it("reports multiple errors at once via superRefine", () => {
    // "abcdefgh" passes min(8) but fails uppercase, number, symbol
    const result = strongPasswordSchema.safeParse("abcdefgh");
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("La password deve contenere almeno una lettera maiuscola");
      expect(messages).toContain("La password deve contenere almeno un numero");
      expect(messages).toContain("La password deve contenere almeno un simbolo speciale");
      // lowercase is satisfied, so should NOT be in errors
      expect(messages).not.toContain("La password deve contenere almeno una lettera minuscola");
    }
  });
});

describe("getPasswordStrength", () => {
  it("returns score 0 and weak for empty password", () => {
    const result = getPasswordStrength("");
    expect(result.score).toBe(0);
    expect(result.level).toBe("weak");
    expect(result.checks.minLength).toBe(false);
    expect(result.checks.hasUppercase).toBe(false);
    expect(result.checks.hasLowercase).toBe(false);
    expect(result.checks.hasNumber).toBe(false);
    expect(result.checks.hasSymbol).toBe(false);
  });

  it("returns score 2 for only lowercase 8+ chars (minLength + lowercase)", () => {
    const result = getPasswordStrength("abcdefgh");
    expect(result.score).toBe(2); // minLength + hasLowercase
    expect(result.level).toBe("weak");
    expect(result.checks.minLength).toBe(true);
    expect(result.checks.hasLowercase).toBe(true);
    expect(result.checks.hasUppercase).toBe(false);
  });

  it("returns weak for less than 3 checks", () => {
    const result = getPasswordStrength("abcdefgh"); // minLength + lowercase = 2
    expect(result.level).toBe("weak");
  });

  it("returns medium for 3 checks", () => {
    const result = getPasswordStrength("Abcdefgh"); // minLength + upper + lower = 3
    expect(result.score).toBe(3);
    expect(result.level).toBe("medium");
  });

  it("returns medium for 4 checks", () => {
    const result = getPasswordStrength("Abcdefg1"); // minLength + upper + lower + number = 4
    expect(result.score).toBe(4);
    expect(result.level).toBe("medium");
  });

  it("returns strong for all 5 checks", () => {
    const result = getPasswordStrength("Abcdefg1!");
    expect(result.score).toBe(5);
    expect(result.level).toBe("strong");
    expect(result.checks.minLength).toBe(true);
    expect(result.checks.hasUppercase).toBe(true);
    expect(result.checks.hasLowercase).toBe(true);
    expect(result.checks.hasNumber).toBe(true);
    expect(result.checks.hasSymbol).toBe(true);
  });

  it("handles short password correctly", () => {
    const result = getPasswordStrength("Ab1!");
    expect(result.score).toBe(4); // upper + lower + number + symbol, but no minLength
    expect(result.checks.minLength).toBe(false);
    expect(result.level).toBe("medium");
  });

  it("returns correct checks for only numbers 8+ chars", () => {
    const result = getPasswordStrength("12345678");
    expect(result.score).toBe(2); // minLength + hasNumber
    expect(result.checks.minLength).toBe(true);
    expect(result.checks.hasNumber).toBe(true);
    expect(result.checks.hasUppercase).toBe(false);
    expect(result.checks.hasLowercase).toBe(false);
    expect(result.checks.hasSymbol).toBe(false);
  });
});

describe("PASSWORD_REQUIREMENTS", () => {
  it("has 5 requirements with Italian messages", () => {
    expect(PASSWORD_REQUIREMENTS).toHaveLength(5);
    PASSWORD_REQUIREMENTS.forEach((req) => {
      expect(req.key).toBeDefined();
      expect(req.label).toBeDefined();
      expect(typeof req.label).toBe("string");
    });
  });
});
