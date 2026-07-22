import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildZipBlob } from "../zip";

describe("zip export", () => {
  it("packs text and binary entries into a readable archive", async () => {
    const blob = await buildZipBlob([
      { name: "a.xml", data: "<root/>" },
      { name: "b.csv", data: "col\n1\n" },
      { name: "c.bin", data: new Uint8Array([1, 2, 3]) },
    ]);
    expect(blob.type).toBe("application/zip");
    expect(blob.size).toBeGreaterThan(0);

    const unzipped = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(unzipped).sort()).toEqual(["a.xml", "b.csv", "c.bin"]);
    expect(strFromU8(unzipped["a.xml"])).toBe("<root/>");
    expect(strFromU8(unzipped["b.csv"])).toBe("col\n1\n");
    expect([...unzipped["c.bin"]]).toEqual([1, 2, 3]);
  });
});
