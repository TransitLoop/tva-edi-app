import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRecentImports,
  detectKind,
  loadRecentImports,
  pushRecentImport,
} from "../recentFiles";

describe("recent imports", () => {
  beforeEach(() => {
    clearRecentImports();
  });

  it("keeps only the last 4 imports and dedupes by name", () => {
    for (let i = 1; i <= 5; i += 1) {
      pushRecentImport({
        name: `file-${i}.csv`,
        kind: "csv",
        payload: `a,b\n${i},x`,
        modeHint: "non_residents",
      });
    }
    pushRecentImport({
      name: "file-5.csv",
      kind: "csv",
      payload: "a,b\nupdated,x",
      modeHint: "non_residents",
    });
    const list = loadRecentImports();
    expect(list).toHaveLength(4);
    expect(list[0].name).toBe("file-5.csv");
    expect(list[0].payload).toContain("updated");
    expect(list.map((f) => f.name)).not.toContain("file-1.csv");
  });

  it("detects file kinds", () => {
    expect(detectKind("a.XML")).toBe("xml");
    expect(detectKind("b.csv")).toBe("csv");
    expect(detectKind("c.xlsx")).toBe("xlsx");
    expect(detectKind("d.txt")).toBeNull();
  });
});
