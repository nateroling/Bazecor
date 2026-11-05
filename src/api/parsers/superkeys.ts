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

/** One 0/1 per Superkey, in slot order, for `superkeys.holdOnOtherKey`. */
export const serializeHoldOnOtherKey = (superkeys: SuperkeysType[]) =>
  superkeys.map(sk => (sk.holdOnOtherKey === false ? "0" : "1")).join(" ");
