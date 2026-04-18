import { describe, expect, it } from "vitest";
import { dropsToXrp, formatXrp, xrpToDrops } from "./drops";

describe("dropsToXrp", () => {
  it("drops round-trip through xrpToDrops", () => {
    expect(xrpToDrops("2.5")).toBe("2500000");
    expect(dropsToXrp("2500000")).toBe("2.5");
  });

  it("handles whole XRP amounts", () => {
    expect(dropsToXrp("1000000")).toBe("1");
    expect(formatXrp("1000000")).toBe("1 XRP");
  });

  it("preserves 6-decimal precision", () => {
    expect(dropsToXrp("1")).toBe("0.000001");
    expect(xrpToDrops("0.000001")).toBe("1");
  });

  it("rejects non-positive amounts", () => {
    expect(() => xrpToDrops("0")).toThrow();
    expect(() => xrpToDrops("-1")).toThrow();
    expect(() => xrpToDrops("abc")).toThrow();
  });
});
