import { describe, expect, it } from "vitest";
import { parseHoldOnOtherKeyRaw, serializeHoldOnOtherKey } from "./superkeys";

describe("parseHoldOnOtherKeyRaw", () => {
  it("reads one flag per slot", () => {
    expect(parseHoldOnOtherKeyRaw("1 0 1\r\n")).toEqual([true, false, true]);
  });

  it("treats an empty reply as unsupported", () => {
    expect(parseHoldOnOtherKeyRaw("")).toBeUndefined();
    expect(parseHoldOnOtherKeyRaw("  \n")).toBeUndefined();
  });

  it("treats anything but 0/1 as unsupported", () => {
    expect(parseHoldOnOtherKeyRaw("1 2 0")).toBeUndefined();
    expect(parseHoldOnOtherKeyRaw(undefined)).toBeUndefined();
  });
});

describe("serializeHoldOnOtherKey", () => {
  it("writes 0 only for Superkeys turned off", () => {
    const sk = (holdOnOtherKey?: boolean) => ({ actions: [] as number[], name: "", id: 0, holdOnOtherKey });
    expect(serializeHoldOnOtherKey([sk(true), sk(false), sk(undefined)])).toBe("1 0 1");
  });
});
