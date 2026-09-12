import type { AxeResults } from "axe-core";

interface NoViolationsMatcherResult {
  message(): string;
  pass: boolean;
  actual: AxeResults[];
}

declare module "vitest" {
  interface Assertion<T = any> {
    toHaveNoViolations(): NoViolationsMatcherResult;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): NoViolationsMatcherResult;
  }
}
