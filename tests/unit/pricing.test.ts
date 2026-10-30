import { describe, expect, it } from "vitest";
import { formatPrice, parsePriceToCents } from "@/lib/money";
import { formatDuration, formatTime } from "@/lib/datetime";

describe("precios", () => {
  it("convierte euros con coma o punto a céntimos", () => {
    expect(parsePriceToCents("12,50")).toBe(1250);
    expect(parsePriceToCents("12.5")).toBe(1250);
    expect(parsePriceToCents(" 7 ")).toBe(700);
  });

  it("rechaza importes inválidos o con más de dos decimales", () => {
    expect(parsePriceToCents("abc")).toBeNull();
    expect(parsePriceToCents("1,234")).toBeNull();
    expect(parsePriceToCents("-2")).toBeNull();
  });

  it("formatea en euros españoles", () => {
    expect(formatPrice(1250)).toContain("12,50");
    expect(formatPrice(1250)).toContain("€");
  });
});

describe("duraciones y horas", () => {
  it("formatea minutos y horas", () => {
    expect(formatDuration(0)).toBe("menos de 1 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(135)).toBe("2 h 15 min");
  });

  it("respeta la zona horaria del restaurante", () => {
    expect(formatTime("2026-10-29T11:05:00.000Z", "Europe/Madrid")).toBe("12:05");
  });
});
