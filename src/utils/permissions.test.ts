import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canHoldStores,
  canManageAllWorkDays,
  hasAllStoresAccess,
  hasFieldAccess,
  hasRoleAccess,
} from "./permissions";

const fieldAdmin = { role: "admin", field_access: 1 };
const admin = { role: "admin", field_access: 0 };
const employee = { role: "employee", field_access: 0 };
const viewer = { role: "viewer", field_access: 0 };

describe("permissions", () => {
  it("gives every admin access to all stores, and nobody else", () => {
    assert.equal(hasAllStoresAccess(fieldAdmin), true);
    assert.equal(hasAllStoresAccess(admin), true);
    assert.equal(hasAllStoresAccess(employee), false);
    assert.equal(hasAllStoresAccess(viewer), false);
  });

  it("lets a field admin use employee-only routes", () => {
    assert.equal(hasRoleAccess(fieldAdmin, ["employee"]), true);
    assert.equal(hasRoleAccess(admin, ["employee"]), false);
    assert.equal(hasRoleAccess(employee, ["employee"]), true);
    assert.equal(hasRoleAccess(viewer, ["employee"]), false);
  });

  it("does not raise anyone above their role", () => {
    assert.equal(hasRoleAccess(employee, ["admin"]), false);
    assert.equal(hasRoleAccess({ role: "employee", field_access: 1 }, ["admin"]), false);
    assert.equal(hasRoleAccess({ role: "viewer", field_access: 1 }, ["employee"]), false);
    assert.equal(hasRoleAccess(undefined, ["employee"]), false);
  });

  it("depends on the flag, never on the username", () => {
    const named = { role: "admin", user: "Florina", field_access: 0 };
    assert.equal(hasFieldAccess(named), false);
    assert.equal(hasRoleAccess(named, ["employee"]), false);
    assert.equal(canManageAllWorkDays(named), true);
  });

  it("scopes a field admin's day picker to their own days", () => {
    assert.equal(canManageAllWorkDays(fieldAdmin), false);
    assert.equal(canManageAllWorkDays(admin), true);
    assert.equal(canManageAllWorkDays(employee), false);
  });

  it("allows admins and employees to hold stores, but not viewers", () => {
    assert.equal(canHoldStores("admin"), true);
    assert.equal(canHoldStores("employee"), true);
    assert.equal(canHoldStores("viewer"), false);
    assert.equal(canHoldStores(null), false);
  });
});
