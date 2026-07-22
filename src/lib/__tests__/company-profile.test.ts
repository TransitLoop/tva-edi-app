import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCompanyProfile,
  hasCompanyProfile,
  headerFromCompanyProfile,
  loadCompanyProfile,
  saveCompanyProfile,
} from "../companyProfile";
import { DEFAULT_HEADER } from "../../types";

describe("company profile", () => {
  beforeEach(() => {
    clearCompanyProfile();
  });

  it("persists company information", () => {
    saveCompanyProfile({
      idf: "66264953",
      raisonSociale: "TransitLoop SARL",
      adresse: "Casablanca",
    });
    const loaded = loadCompanyProfile();
    expect(loaded.idf).toBe("66264953");
    expect(loaded.raisonSociale).toBe("TransitLoop SARL");
    expect(loaded.adresse).toBe("Casablanca");
    expect(hasCompanyProfile(loaded)).toBe(true);
  });

  it("prefills IF without locking the declaration header", () => {
    const header = headerFromCompanyProfile(
      { idf: "66264953", raisonSociale: "X", adresse: "Y" },
      DEFAULT_HEADER,
    );
    expect(header.idf).toBe("66264953");
    expect({ ...header, idf: "999" }.idf).toBe("999");
  });
});
