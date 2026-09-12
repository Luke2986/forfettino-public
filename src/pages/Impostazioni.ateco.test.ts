/**
 * Impostazioni.ateco.test.ts — Story 13.14
 * Test per la persistenza del codice ATECO nelle Impostazioni.
 * Verifica: handleSelectAteco, handleSave payload, selectedPresetLabel,
 * manualAtecoMode inference, handleCopyFromPrevYear, dirty-state tracking,
 * backward compatibility (ateco_code NULL).
 */
import { describe, it, expect } from "vitest";

// ===== TYPES =====

interface AtecoPreset {
  id: string;
  ateco_code: string;
  description: string;
  coefficient: number;
  category: string;
}

interface FormData {
  profitCoefficient: number;
  atecoCode: string | null;
}

// ===== MOCK PRESETS (simulating profit_coeff_presets table) =====

const MOCK_PRESETS: AtecoPreset[] = [
  { id: "1", ateco_code: "62.01.00", description: "Attività di produzione di software non connesso all'edizione", coefficient: 78, category: "professionisti" },
  { id: "2", ateco_code: "62.10.00", description: "Produzione di software, consulenza informatica", coefficient: 78, category: "professionisti" },
  { id: "3", ateco_code: "69.20.11", description: "Servizi forniti da dottori commercialisti", coefficient: 78, category: "professionisti" },
  { id: "4", ateco_code: "43.21.01", description: "Installazione di impianti di illuminazione e fotovoltaici", coefficient: 86, category: "artigiani" },
  { id: "5", ateco_code: "43.91.00", description: "Lavori di muratura", coefficient: 86, category: "artigiani" },
  { id: "6", ateco_code: "47.11.02", description: "Commercio al dettaglio non specializzato", coefficient: 40, category: "commercianti" },
  { id: "7", ateco_code: "95.10.10", description: "Riparazione e manutenzione di computer", coefficient: 67, category: "artigiani" },
];

// ===== HELPER: handleSelectAteco (mirrors Impostazioni.tsx logic — Story 13.14) =====

function handleSelectAteco(
  currentFormData: FormData,
  preset: { ateco_code: string; coefficient: number },
): FormData {
  return {
    ...currentFormData,
    profitCoefficient: preset.coefficient,
    atecoCode: preset.ateco_code,
  };
}

// ===== HELPER: handleManualAtecoConfirm (mirrors Impostazioni.tsx logic — Story 13.14) =====

function handleManualAtecoConfirm(
  currentFormData: FormData,
  manualAtecoCode: string,
  manualCoefficient: number,
): FormData {
  return {
    ...currentFormData,
    profitCoefficient: manualCoefficient,
    atecoCode: manualAtecoCode || null,
  };
}

// ===== HELPER: buildFormDataFromSettings with atecoCode (Story 13.14) =====

function buildFormDataWithAteco(settings: {
  profit_coefficient: number;
  ateco_code?: string | null;
}): FormData {
  return {
    profitCoefficient: Number(settings.profit_coefficient),
    atecoCode: settings.ateco_code ?? null,
  };
}

// ===== HELPER: buildUpsertPayloadAteco (Story 13.14) =====

function buildUpsertPayloadAteco(formData: FormData) {
  return {
    profit_coefficient: formData.profitCoefficient,
    ateco_code: formData.atecoCode,
  };
}

// ===== HELPER: selectedPresetLabel (mirrors useMemo logic — Story 13.14) =====

function computeSelectedPresetLabel(
  presets: AtecoPreset[] | null,
  formData: FormData,
  manualAtecoMode: boolean,
): string {
  if (manualAtecoMode) return `Inserimento manuale (${formData.profitCoefficient}%)`;
  if (!presets) return `${formData.profitCoefficient}%`;
  // Primary match: by ateco_code (Story 13.14)
  if (formData.atecoCode) {
    const preset = presets.find((p) => p.ateco_code === formData.atecoCode);
    if (preset) {
      return `${preset.ateco_code} - ${preset.description} (${preset.coefficient}%)`;
    }
  }
  // Fallback: by coefficient (backward compat — ateco_code NULL)
  const preset = presets.find((p) => p.coefficient === formData.profitCoefficient);
  if (preset) {
    return `${preset.ateco_code} - ${preset.description} (${preset.coefficient}%)`;
  }
  return `${formData.profitCoefficient}%`;
}

// ===== HELPER: inferManualAtecoMode (mirrors useEffect logic — Story 13.14) =====

function inferManualAtecoMode(
  presets: AtecoPreset[],
  settings: { profit_coefficient: number; ateco_code?: string | null },
): { manualAtecoMode: boolean; manualAtecoCode: string } {
  const savedAtecoCode = settings.ateco_code ?? null;
  if (savedAtecoCode) {
    const matchesPreset = presets.some((p) => p.ateco_code === savedAtecoCode);
    if (!matchesPreset) {
      return { manualAtecoMode: true, manualAtecoCode: savedAtecoCode };
    }
    return { manualAtecoMode: false, manualAtecoCode: "" };
  }
  // Backward compat: no ateco_code → match by coefficient
  const coeff = Number(settings.profit_coefficient);
  const matchesPreset = presets.some((p) => p.coefficient === coeff);
  if (!matchesPreset) {
    return { manualAtecoMode: true, manualAtecoCode: "" };
  }
  return { manualAtecoMode: false, manualAtecoCode: "" };
}

// ===== HELPER: handleCopyFromPrevYear with atecoCode (Story 13.14) =====

function copyAtecoFromPrevYear(prevYearSettings: {
  profit_coefficient: number;
  ateco_code?: string | null;
}): FormData {
  return {
    profitCoefficient: Number(prevYearSettings.profit_coefficient),
    atecoCode: prevYearSettings.ateco_code ?? null,
  };
}

// ===== HELPER: dirty-state detection (Story 13.14) =====

function isFiscaleDirty(
  currentFormData: FormData,
  savedFormData: FormData,
): boolean {
  const fiscaleFields: (keyof FormData)[] = ["profitCoefficient", "atecoCode"];
  return fiscaleFields.some((k) => currentFormData[k] !== savedFormData[k]);
}

// ===== TESTS =====

describe("Story 13.14: handleSelectAteco — riceve preset intero", () => {
  it("should update both profitCoefficient AND atecoCode from catalog preset", () => {
    const initial: FormData = { profitCoefficient: 78, atecoCode: null };
    const result = handleSelectAteco(initial, { ateco_code: "62.10.00", coefficient: 78 });
    expect(result.profitCoefficient).toBe(78);
    expect(result.atecoCode).toBe("62.10.00");
  });

  it("should correctly switch between two presets with same coefficient", () => {
    const initial: FormData = { profitCoefficient: 78, atecoCode: "62.01.00" };
    const result = handleSelectAteco(initial, { ateco_code: "62.10.00", coefficient: 78 });
    expect(result.atecoCode).toBe("62.10.00");
    expect(result.profitCoefficient).toBe(78);
  });

  it("should handle switching to a preset with different coefficient", () => {
    const initial: FormData = { profitCoefficient: 78, atecoCode: "62.01.00" };
    const result = handleSelectAteco(initial, { ateco_code: "43.21.01", coefficient: 86 });
    expect(result.atecoCode).toBe("43.21.01");
    expect(result.profitCoefficient).toBe(86);
  });
});

describe("Story 13.14: handleSave includes ateco_code in upsert payload", () => {
  it("should include ateco_code from catalog selection", () => {
    const payload = buildUpsertPayloadAteco({ profitCoefficient: 78, atecoCode: "62.10.00" });
    expect(payload.profit_coefficient).toBe(78);
    expect(payload.ateco_code).toBe("62.10.00");
  });

  it("should include ateco_code null for backward compat", () => {
    const payload = buildUpsertPayloadAteco({ profitCoefficient: 78, atecoCode: null });
    expect(payload.profit_coefficient).toBe(78);
    expect(payload.ateco_code).toBeNull();
  });

  it("should include manual ateco_code", () => {
    const payload = buildUpsertPayloadAteco({ profitCoefficient: 50, atecoCode: "99.99.99" });
    expect(payload.profit_coefficient).toBe(50);
    expect(payload.ateco_code).toBe("99.99.99");
  });
});

describe("Story 13.14: selectedPresetLabel — match by ateco_code first", () => {
  it("should match by ateco_code when present (core bug fix)", () => {
    const label = computeSelectedPresetLabel(
      MOCK_PRESETS,
      { profitCoefficient: 78, atecoCode: "62.10.00" },
      false,
    );
    expect(label).toContain("62.10.00");
    expect(label).toContain("Produzione di software");
  });

  it("should NOT return wrong preset when multiple share same coefficient", () => {
    // This is the core bug scenario: 62.01.00 and 62.10.00 both have coefficient 78
    const label = computeSelectedPresetLabel(
      MOCK_PRESETS,
      { profitCoefficient: 78, atecoCode: "62.10.00" },
      false,
    );
    expect(label).not.toContain("62.01.00"); // Must NOT match first preset with same coefficient
    expect(label).toContain("62.10.00"); // Must match the exact selected preset
  });

  it("should fallback to coefficient match when atecoCode is null (backward compat)", () => {
    const label = computeSelectedPresetLabel(
      MOCK_PRESETS,
      { profitCoefficient: 78, atecoCode: null },
      false,
    );
    // Should find SOME preset with coefficient 78 (first one)
    expect(label).toContain("78%");
    expect(label).toContain(" - "); // Should have format "code - description (coeff%)"
  });

  it("should show manual mode label when manualAtecoMode is true", () => {
    const label = computeSelectedPresetLabel(
      MOCK_PRESETS,
      { profitCoefficient: 50, atecoCode: "99.99.99" },
      true,
    );
    expect(label).toBe("Inserimento manuale (50%)");
  });

  it("should show coefficient-only when presets not loaded", () => {
    const label = computeSelectedPresetLabel(
      null,
      { profitCoefficient: 78, atecoCode: "62.10.00" },
      false,
    );
    expect(label).toBe("78%");
  });

  it("should handle artigiani with same coefficient correctly", () => {
    const label = computeSelectedPresetLabel(
      MOCK_PRESETS,
      { profitCoefficient: 86, atecoCode: "43.91.00" },
      false,
    );
    expect(label).toContain("43.91.00");
    expect(label).toContain("Lavori di muratura");
    expect(label).not.toContain("43.21.01"); // Not the first 86% preset
  });
});

describe("Story 13.14: manualAtecoMode inference from DB", () => {
  it("should detect manual mode when ateco_code does not match any preset", () => {
    const result = inferManualAtecoMode(MOCK_PRESETS, {
      profit_coefficient: 50,
      ateco_code: "99.99.99",
    });
    expect(result.manualAtecoMode).toBe(true);
    expect(result.manualAtecoCode).toBe("99.99.99");
  });

  it("should NOT trigger manual mode when ateco_code matches a preset", () => {
    const result = inferManualAtecoMode(MOCK_PRESETS, {
      profit_coefficient: 78,
      ateco_code: "62.10.00",
    });
    expect(result.manualAtecoMode).toBe(false);
  });

  it("should fallback to coefficient match when ateco_code is null (backward compat)", () => {
    const result = inferManualAtecoMode(MOCK_PRESETS, {
      profit_coefficient: 78,
      ateco_code: null,
    });
    expect(result.manualAtecoMode).toBe(false); // 78 matches presets
  });

  it("should detect manual mode when coefficient doesn't match and no ateco_code", () => {
    const result = inferManualAtecoMode(MOCK_PRESETS, {
      profit_coefficient: 55,
      ateco_code: null,
    });
    expect(result.manualAtecoMode).toBe(true);
  });

  it("should handle undefined ateco_code (backward compat)", () => {
    const result = inferManualAtecoMode(MOCK_PRESETS, {
      profit_coefficient: 78,
    });
    expect(result.manualAtecoMode).toBe(false);
  });
});

describe("Story 13.14: handleManualAtecoConfirm — persiste codice manuale", () => {
  it("should save manual ateco code and coefficient", () => {
    const initial: FormData = { profitCoefficient: 78, atecoCode: "62.01.00" };
    const result = handleManualAtecoConfirm(initial, "99.99.99", 50);
    expect(result.profitCoefficient).toBe(50);
    expect(result.atecoCode).toBe("99.99.99");
  });

  it("should set atecoCode to null when manual code is empty", () => {
    const initial: FormData = { profitCoefficient: 78, atecoCode: "62.01.00" };
    const result = handleManualAtecoConfirm(initial, "", 50);
    expect(result.profitCoefficient).toBe(50);
    expect(result.atecoCode).toBeNull();
  });
});

describe("Story 13.14: handleCopyFromPrevYear — copia ateco_code", () => {
  it("should copy ateco_code from previous year", () => {
    const result = copyAtecoFromPrevYear({
      profit_coefficient: 78,
      ateco_code: "62.10.00",
    });
    expect(result.profitCoefficient).toBe(78);
    expect(result.atecoCode).toBe("62.10.00");
  });

  it("should handle previous year without ateco_code (backward compat)", () => {
    const result = copyAtecoFromPrevYear({
      profit_coefficient: 78,
    });
    expect(result.profitCoefficient).toBe(78);
    expect(result.atecoCode).toBeNull();
  });

  it("should handle previous year with null ateco_code", () => {
    const result = copyAtecoFromPrevYear({
      profit_coefficient: 86,
      ateco_code: null,
    });
    expect(result.profitCoefficient).toBe(86);
    expect(result.atecoCode).toBeNull();
  });
});

describe("Story 13.14: dirty-state tracking — atecoCode changes detected", () => {
  it("should detect dirty when atecoCode changes", () => {
    const saved: FormData = { profitCoefficient: 78, atecoCode: "62.01.00" };
    const current: FormData = { profitCoefficient: 78, atecoCode: "62.10.00" };
    expect(isFiscaleDirty(current, saved)).toBe(true);
  });

  it("should NOT detect dirty when atecoCode is unchanged", () => {
    const saved: FormData = { profitCoefficient: 78, atecoCode: "62.10.00" };
    const current: FormData = { profitCoefficient: 78, atecoCode: "62.10.00" };
    expect(isFiscaleDirty(current, saved)).toBe(false);
  });

  it("should detect dirty when atecoCode goes from null to value", () => {
    const saved: FormData = { profitCoefficient: 78, atecoCode: null };
    const current: FormData = { profitCoefficient: 78, atecoCode: "62.10.00" };
    expect(isFiscaleDirty(current, saved)).toBe(true);
  });

  it("should detect dirty when coefficient changes even if atecoCode same", () => {
    const saved: FormData = { profitCoefficient: 78, atecoCode: "62.10.00" };
    const current: FormData = { profitCoefficient: 86, atecoCode: "62.10.00" };
    expect(isFiscaleDirty(current, saved)).toBe(true);
  });
});

describe("Story 13.14: buildFormDataWithAteco — load from settings", () => {
  it("should load ateco_code from settings", () => {
    const result = buildFormDataWithAteco({
      profit_coefficient: 78,
      ateco_code: "62.10.00",
    });
    expect(result.profitCoefficient).toBe(78);
    expect(result.atecoCode).toBe("62.10.00");
  });

  it("should default atecoCode to null when not in settings", () => {
    const result = buildFormDataWithAteco({
      profit_coefficient: 78,
    });
    expect(result.profitCoefficient).toBe(78);
    expect(result.atecoCode).toBeNull();
  });

  it("should handle null ateco_code explicitly", () => {
    const result = buildFormDataWithAteco({
      profit_coefficient: 40,
      ateco_code: null,
    });
    expect(result.profitCoefficient).toBe(40);
    expect(result.atecoCode).toBeNull();
  });
});
