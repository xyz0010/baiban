import { describe, it, expect } from "vitest";
import { ElementsDelta } from "../src/delta";

describe("ElementsDelta", () => {
  it("should handle elements with version 0", () => {
    const prevElements = new Map();
    const nextElements = new Map();
    const element = {
      id: "1",
      version: 0,
      versionNonce: 123,
      isDeleted: false,
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: 0,
      strokeColor: "#000000",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: 1,
      link: null,
      locked: false,
    };
    // Cast to any to avoid full type compliance if strict
    nextElements.set("1", element as any);

    const delta = ElementsDelta.calculate(prevElements, nextElements);
    
    // Check if it didn't throw and produced valid delta
    expect(delta.added["1"]).toBeDefined();
    expect(delta.added["1"].inserted.version).toBe(1);
    expect(delta.added["1"].deleted.version).toBe(0);
  });
});
