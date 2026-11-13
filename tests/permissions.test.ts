import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

describe("role permissions", () => {
  it("HR can raise requests but not see assets, employees or admin", () => {
    expect(can("HR", "requests:create")).toBe(true);
    expect(can("HR", "requests:work")).toBe(false);
    expect(can("HR", "assets:view")).toBe(false);
    expect(can("HR", "employees:view")).toBe(false);
    expect(can("HR", "audit:view")).toBe(false);
    expect(can("HR", "users:manage")).toBe(false);
  });
  it("IT staff work requests and assets but can't manage users or delete", () => {
    expect(can("IT_STAFF", "requests:work")).toBe(true);
    expect(can("IT_STAFF", "assets:edit")).toBe(true);
    expect(can("IT_STAFF", "assets:delete")).toBe(false);
    expect(can("IT_STAFF", "users:manage")).toBe(false);
  });
  it("only admins manage users", () => {
    expect(can("ADMIN", "users:manage")).toBe(true);
    expect(can("READ_ONLY", "users:manage")).toBe(false);
    expect(can(null, "assets:view")).toBe(false);
  });
  it("read-only can view but never edit", () => {
    expect(can("READ_ONLY", "assets:view")).toBe(true);
    expect(can("READ_ONLY", "assets:edit")).toBe(false);
    expect(can("READ_ONLY", "requests:create")).toBe(false);
  });
});
