import { describe, expect, it } from "vitest";
import { buildDeepLink, buildLaunchUrl } from "./qr";

describe("buildLaunchUrl", () => {
  it("encodes session id into an HTTPS short URL", () => {
    expect(buildLaunchUrl("s_abc", "https://example.com")).toBe("https://example.com/s/s_abc");
  });

  it("strips trailing slashes from the base", () => {
    expect(buildLaunchUrl("s_abc", "https://example.com//")).toBe(
      "https://example.com/s/s_abc",
    );
  });
});

describe("buildDeepLink", () => {
  it("encodes api as a URL-safe query parameter", () => {
    expect(buildDeepLink("s_abc", "https://a.b")).toBe(
      "coldtap://session/s_abc?api=https%3A%2F%2Fa.b",
    );
  });
});
