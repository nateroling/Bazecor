/* eslint-disable no-bitwise */
import log from "electron-log/renderer";
import { SuperkeysType } from "@Renderer/types/superkeys";

export const parseSuperkeysRaw = (raw: string, stored: SuperkeysType[]) => {
  const superArray = raw.split(" 0 0")[0].split(" ").map(Number);

  let superkey: number[] = [];
  const superkeys: SuperkeysType[] = [];
  let iter = 0;
  let superindex = 0;

  if (superArray.length < 1) {
    log.warn("Discarded Superkeys due to short length of string", raw, raw.length);
    return [];
  }
  // log.info(raw, raw.length);
  while (superArray.length > iter) {
    // log.info(iter, raw[iter], superkey);
    if (superArray[iter] === 0) {
      superkeys[superindex] = { actions: superkey, name: "", id: superindex };
      superindex += 1;
      superkey = [];
    } else {
      superkey.push(superArray[iter]);
    }
    iter += 1;
  }
  superkeys[superindex] = { actions: superkey, name: "", id: superindex };

  if (superkeys[0].actions.length === 0 || superkeys[0].actions.length > 5) {
    log.warn(`Superkeys were empty`);
    return [];
  }
  // log.info(`Got Superkeys:${JSON.stringify(superkeys)} from ${raw}`);
  // TODO: Check if stored superKeys match the received ones, if they match, retrieve name and apply it to current superKeys
  let finalSuper: SuperkeysType[] = [];
  finalSuper = superkeys.map((superky, i) => {
    const superk = superky;
    if (stored.length > i && stored.length > 0) {
      const aux = superk;
      aux.name = stored[i].name;
      return aux;
    }
    return superk;
  });
  log.info("final superkeys", finalSuper);
  return finalSuper;
};

export const serializeSuperkeys = (superkeys: SuperkeysType[]) => {
  if (
    superkeys.length === 0 ||
    (superkeys.length === 1 && superkeys[0].actions.length === 0) ||
    (superkeys.length === 1 && superkeys[0].actions.length === 1 && superkeys[0].actions[0] === 0)
  ) {
    return Array(512).fill("65535").join(" ");
  }
  let keyMap = JSON.parse(JSON.stringify(superkeys));
  // log.info("First", JSON.stringify(keyMap));
  keyMap = keyMap.map((sky: SuperkeysType) => {
    const sk = sky;
    sk.actions = sk.actions.map(act => {
      if (act === 0 || act === null || act === undefined) return 1;
      return act;
    });
    if (sk.actions.length < 5) sk.actions = sk.actions.concat(Array(5 - sk.actions.length).fill(1));
    return sk;
  });
  // log.info("Third", JSON.parse(JSON.stringify(keyMap)));
  const mapped = keyMap
    .map((superkey: SuperkeysType) => superkey.actions.filter(act => act !== 0).concat([0]))
    .flat()
    .concat([0])
    .join(" ")
    .split(",")
    .join(" ");
  log.info("Mapped superkeys: ", mapped, keyMap);
  return mapped;
};

/**
 * Parses the reply to `superkeys.holdOnOtherKey` (custom firmware only): one
 * 0/1 per Superkey slot. Returns undefined when the firmware doesn't have the
 * command, which it shows by answering with an empty string.
 */
export const parseHoldOnOtherKeyRaw = (raw: unknown): boolean[] | undefined => {
  if (typeof raw !== "string") return undefined;
  const values = raw
    .trim()
    .split(/\s+/)
    .filter(v => v.length > 0);
  if (values.length === 0 || values.some(v => v !== "0" && v !== "1")) return undefined;
  return values.map(v => v === "1");
};

// Key ranges the firmware uses to decide whether a Superkey becomes a
// tap-hold (qukey) key. See KeyRoleManager in the Sonsei firmware.
const IDLE_ACTION = 1;
const LAYER_SHIFT_FIRST = 17450;
const LAYER_SHIFT_LAST = 17459;
const LAYER_LOCK_FIRST = 17492;
const LAYER_LOCK_LAST = 17501;

const isIdleAction = (action: number | null | undefined) =>
  action === undefined || action === null || action === 0 || action === IDLE_ACTION;
const isModifierCode = (raw: number) => (raw & 0xff) >= 0xe0 && (raw & 0xff) <= 0xe7;

/**
 * For a Superkey the firmware turns into a tap-hold key, returns the key code
 * it becomes, as a string; Superkeys that return the same string become the
 * same key, so they share one hold-on-other-key-press setting. Returns
 * undefined for Superkeys the setting doesn't apply to: anything but exactly a
 * Tap and a Hold, a Hold that isn't a modifier or layer, or a Tap that is a
 * bare modifier or a layer lock. Mirrors KeyRoleManager::search_and_replace()
 * and calculate_qukey_code().
 */
export const holdOnOtherKeyGroup = (actions: Array<number | null | undefined>): string | undefined => {
  const [tap, hold, ...rest] = actions;
  if (isIdleAction(tap) || isIdleAction(hold) || rest.slice(0, 3).some(a => !isIdleAction(a))) return undefined;
  if (tap >= LAYER_LOCK_FIRST && tap <= LAYER_LOCK_LAST) return undefined;
  if (isModifierCode(tap)) return undefined;

  // Same encoding as the firmware: tap keycode (7 bits) and whether the tap has modifiers.
  const tapPart = `${tap & 0x7f}:${tap >> 8 !== 0 ? 1 : 0}`;

  if (hold >= LAYER_SHIFT_FIRST && hold <= LAYER_SHIFT_LAST) return `L${hold - LAYER_SHIFT_FIRST}:${tapPart}`;
  if (hold >= LAYER_LOCK_FIRST && hold <= LAYER_LOCK_LAST) return `L${hold - LAYER_LOCK_FIRST}:${tapPart}`;
  if (isModifierCode(hold)) {
    const hid = hold & 0x1ff;
    const low = hid & 0xff;
    let index: number;
    if (low >= 0xe4) index = low - 0xe0;
    else index = (hid & 0x100 ? 4 : 0) + (low - 0xe0);
    return `M${index}:${tapPart}`;
  }
  return undefined;
};

/** Indexes of the Superkeys that share a hold-on-other-key-press setting with `index` (itself included), in order. */
export const holdOnOtherKeyTwins = (superkeys: SuperkeysType[], index: number): number[] => {
  const group = superkeys[index] ? holdOnOtherKeyGroup(superkeys[index].actions) : undefined;
  if (group === undefined) return [];
  return superkeys.reduce<number[]>((twins, sk, i) => (holdOnOtherKeyGroup(sk.actions) === group ? [...twins, i] : twins), []);
};

/**
 * The hold-on-other-key-press setting the keyboard will actually use for a
 * Superkey: Superkeys that become the same key all use the first one's.
 */
export const effectiveHoldOnOtherKey = (superkeys: SuperkeysType[], index: number): boolean => {
  const twins = holdOnOtherKeyTwins(superkeys, index);
  const source = superkeys[twins.length > 0 ? twins[0] : index];
  return source?.holdOnOtherKey !== false;
};

/** One 0/1 per Superkey, in slot order, for `superkeys.holdOnOtherKey`. */
export const serializeHoldOnOtherKey = (superkeys: SuperkeysType[]) =>
  superkeys.map((_sk, i) => (effectiveHoldOnOtherKey(superkeys, i) ? "1" : "0")).join(" ");
