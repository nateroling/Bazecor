/* eslint-disable no-bitwise */
import { describe, expect, it } from "vitest";
import {
  effectiveHoldOnOtherKey,
  holdOnOtherKeyGroup,
  holdOnOtherKeyTwins,
  parseHoldOnOtherKeyRaw,
  serializeHoldOnOtherKey,
} from "./superkeys";

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

const ENTER_ALT = [40, 226, 1, 1, 1];
const ENTER_RALT = [40, 230, 1, 1, 1];
const sk = (holdOnOtherKey?: boolean, actions: number[] = []) => ({ actions, name: "", id: 0, holdOnOtherKey });

describe("serializeHoldOnOtherKey", () => {
  it("writes 0 only for Superkeys turned off", () => {
    expect(serializeHoldOnOtherKey([sk(true), sk(false), sk(undefined)])).toBe("1 0 1");
  });

  it("writes the first twin's setting for every twin", () => {
    expect(serializeHoldOnOtherKey([sk(false, ENTER_ALT), sk(true, ENTER_RALT), sk(true, ENTER_ALT)])).toBe("0 1 0");
  });
});

describe("holdOnOtherKeyTwins / effectiveHoldOnOtherKey", () => {
  const superkeys = [sk(true, ENTER_ALT), sk(false, ENTER_RALT), sk(false, ENTER_ALT), sk(false, [40, 1, 1, 1, 1])];

  it("finds Superkeys with the same Tap and Hold", () => {
    expect(holdOnOtherKeyTwins(superkeys, 2)).toEqual([0, 2]);
    expect(holdOnOtherKeyTwins(superkeys, 1)).toEqual([1]);
    expect(holdOnOtherKeyTwins(superkeys, 3)).toEqual([]);
  });

  it("uses the first twin's setting", () => {
    expect(effectiveHoldOnOtherKey(superkeys, 2)).toBe(true);
    expect(effectiveHoldOnOtherKey(superkeys, 1)).toBe(false);
  });
});

describe("holdOnOtherKeyGroup", () => {
  const ENTER = 40;
  const F = 9;
  const LCTRL = 224;
  const LALT = 226;
  const RALT = 230;
  const SHIFT_F = (2 << 8) | F; // F with a modifier flag
  const LAYER_SHIFT_1 = 17451;
  const LAYER_LOCK_1 = 17493;

  it("applies to a Tap with a modifier or layer on Hold", () => {
    expect(holdOnOtherKeyGroup([ENTER, LALT, 1, 1, 1])).toBeDefined();
    expect(holdOnOtherKeyGroup([ENTER, LAYER_SHIFT_1, 0, 0, 0])).toBeDefined();
    expect(holdOnOtherKeyGroup([ENTER, LALT])).toBeDefined();
  });

  it("doesn't apply to other Superkeys", () => {
    expect(holdOnOtherKeyGroup([ENTER, 1, 1, 1, 1])).toBeUndefined(); // no Hold
    expect(holdOnOtherKeyGroup([ENTER, LALT, ENTER, 1, 1])).toBeUndefined(); // a third action
    expect(holdOnOtherKeyGroup([ENTER, F, 1, 1, 1])).toBeUndefined(); // Hold isn't a modifier or layer
    expect(holdOnOtherKeyGroup([LCTRL, LALT, 1, 1, 1])).toBeUndefined(); // Tap is a bare modifier
    expect(holdOnOtherKeyGroup([LAYER_LOCK_1, LALT, 1, 1, 1])).toBeUndefined(); // Tap is a layer lock
  });

  it("groups Superkeys that become the same key", () => {
    expect(holdOnOtherKeyGroup([ENTER, LALT])).toBe(holdOnOtherKeyGroup([ENTER, LALT, 1, 1, 1]));
    expect(holdOnOtherKeyGroup([F, LAYER_SHIFT_1])).toBe(holdOnOtherKeyGroup([F, LAYER_LOCK_1]));
    // Different modifier flags on the Tap still share a code.
    expect(holdOnOtherKeyGroup([SHIFT_F, LALT])).toBe(holdOnOtherKeyGroup([(1 << 8) | F, LALT]));
  });

  it("keeps Left and Right modifiers apart", () => {
    expect(holdOnOtherKeyGroup([ENTER, LALT])).not.toBe(holdOnOtherKeyGroup([ENTER, RALT]));
    expect(holdOnOtherKeyGroup([F, LALT])).not.toBe(holdOnOtherKeyGroup([SHIFT_F, LALT]));
  });
});
