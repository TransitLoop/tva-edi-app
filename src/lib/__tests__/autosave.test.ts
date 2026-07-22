import { beforeEach, describe, expect, it } from "vitest";
import { clearAutosave, loadAutosave, writeAutosave } from "../autosave";
import { DEFAULT_HEADER, createEmptyNonResidentRow } from "../../types";

describe("autosave", () => {
  beforeEach(() => {
    clearAutosave();
  });

  it("persists and restores a draft", () => {
    writeAutosave({
      mode: "non_residents",
      header: { ...DEFAULT_HEADER, idf: "123" },
      rows: [],
      nrRows: [createEmptyNonResidentRow(1)],
      showAdvanced: false,
    });
    const loaded = loadAutosave();
    expect(loaded?.header.idf).toBe("123");
    expect(loaded?.mode).toBe("non_residents");
    expect(loaded?.nrRows).toHaveLength(1);
  });
});
