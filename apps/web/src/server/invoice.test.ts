import { describe, expect, it } from "vitest";
import { fromHex, invoiceIdFor, sessionMemo, toHex } from "./invoice";

describe("invoiceIdFor", () => {
  it("produces uppercase 64-char hex", () => {
    const id = invoiceIdFor("s_example");
    expect(id).toMatch(/^[0-9A-F]{64}$/);
  });

  it("is deterministic for the same session id", () => {
    expect(invoiceIdFor("s_abc")).toBe(invoiceIdFor("s_abc"));
  });

  it("differs for different session ids", () => {
    expect(invoiceIdFor("s_abc")).not.toBe(invoiceIdFor("s_abd"));
  });
});

describe("sessionMemo", () => {
  it("hex-encodes type/data/format round-trippably", () => {
    const memo = sessionMemo("s_abc");
    expect(fromHex(memo.Memo.MemoType)).toBe("coldtap/session");
    expect(fromHex(memo.Memo.MemoData)).toBe("s_abc");
    expect(fromHex(memo.Memo.MemoFormat)).toBe("text/plain");
  });

  it("toHex is an inverse of fromHex", () => {
    const s = "payload with 💥 unicode";
    expect(fromHex(toHex(s))).toBe(s);
  });
});
