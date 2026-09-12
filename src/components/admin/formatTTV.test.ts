import { describe, it, expect } from "vitest";
import { formatTTV } from "./formatTTV";

describe("formatTTV", () => {
  it("formats 0 minutes as < 1 min", () => {
    expect(formatTTV(0)).toBe("< 1 min");
  });

  it("formats fractional minutes below 1 as < 1 min", () => {
    expect(formatTTV(0.5)).toBe("< 1 min");
  });

  it("formats 1 minute", () => {
    expect(formatTTV(1)).toBe("1 min");
  });

  it("formats 47 minutes", () => {
    expect(formatTTV(47)).toBe("47 min");
  });

  it("formats 59 minutes", () => {
    expect(formatTTV(59)).toBe("59 min");
  });

  it("formats exactly 60 minutes as 1h", () => {
    expect(formatTTV(60)).toBe("1h");
  });

  it("formats 61 minutes as 1h 1min", () => {
    expect(formatTTV(61)).toBe("1h 1min");
  });

  it("formats 195 minutes as 3h 15min", () => {
    expect(formatTTV(195)).toBe("3h 15min");
  });

  it("formats exactly 1440 minutes as 24h", () => {
    expect(formatTTV(1440)).toBe("24h");
  });

  it("formats 1441 minutes as days (Italian format)", () => {
    expect(formatTTV(1441)).toBe("1,0 giorni");
  });

  it("formats 3456 minutes as 2,4 giorni", () => {
    expect(formatTTV(3456)).toBe("2,4 giorni");
  });

  it("formats 10000 minutes as 6,9 giorni", () => {
    expect(formatTTV(10000)).toBe("6,9 giorni");
  });

  it("rounds minutes to nearest integer in min range", () => {
    expect(formatTTV(47.6)).toBe("48 min");
  });

  it("rounds minutes in hour range", () => {
    expect(formatTTV(90.4)).toBe("1h 30min");
  });
});
