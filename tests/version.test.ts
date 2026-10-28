import { describe, expect, it } from "vitest";
import { isNewer, shortVersion } from "../src/ui/update";

describe("release numbers", () => {
  it("shows the patch number only when it is set", () => {
    expect(shortVersion("1.15.0")).toBe("1.15");
    expect(shortVersion("1.15.2")).toBe("1.15.2");
  });

  it("compares numerically", () => {
    expect(isNewer("1.16.0", "1.15.0")).toBe(true);
    expect(isNewer("1.10.0", "1.9.0")).toBe(true);
    expect(isNewer("1.15.0", "1.15.0")).toBe(false);
    expect(isNewer("1.14.3", "1.15.0")).toBe(false);
  });
});
