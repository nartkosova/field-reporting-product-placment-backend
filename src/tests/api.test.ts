// End-to-end API tests through the real routes, middleware and queries.
// Needs a migrated throwaway database: run them with `make test-db`.
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import db from "../models/db";
import {
  addStoreVisitPhoto,
  todayInAppTimezone,
} from "../services/attendanceService";
const app = require("../app");

if (!process.env.DB_NAME?.endsWith("_test")) {
  throw new Error("Refusing to run: DB_NAME must be a *_test database.");
}

const suffix = Date.now();
let server: Server;
let baseUrl: string;

const insertUser = async (name: string, role: string, fieldAccess = false) => {
  const [result] = await db
    .promise()
    .execute<ResultSetHeader>(
      "INSERT INTO users (user, password, role, field_access) VALUES (?, 'x', ?, ?)",
      [`${name}-${suffix}`, role, fieldAccess]
    );
  return result.insertId;
};

const insertStore = async (code: string) => {
  const [result] = await db.promise().execute<ResultSetHeader>(
    `INSERT INTO stores (store_name, store_code, store_channel, store_category, sales_rep, location)
     VALUES (?, ?, 'MT', 'A', 'rep', 'Prishtine')`,
    [`Store ${code}`, `${code}-${suffix}`]
  );
  return result.insertId;
};

const api = async (userId: number, method: string, path: string, body?: unknown) => {
  const token = jwt.sign({ user_id: userId }, process.env.JWT_SECRET as string);
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

const startDay = async (userId: number) => {
  const day = await api(userId, "POST", "/work-days", { work_date: todayInAppTimezone() });
  assert.equal(day.status, 201);
  const id = day.body.work_log_day_id;
  assert.equal((await api(userId, "POST", `/work-days/${id}/check-in`)).status, 200);
  return id as number;
};

describe("API", () => {
  let adminId: number;
  let fieldAdminId: number;
  let employeeId: number;
  let secondEmployeeId: number;
  let viewerId: number;
  let storeA: number;
  let storeB: number;

  before(async () => {
    adminId = await insertUser("admin", "admin");
    fieldAdminId = await insertUser("field-admin", "admin", true);
    employeeId = await insertUser("employee", "employee");
    secondEmployeeId = await insertUser("employee-2", "employee");
    viewerId = await insertUser("viewer", "viewer");
    storeA = await insertStore("A");
    storeB = await insertStore("B");

    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.promise().end();
  });

  describe("all-stores access", () => {
    it("gives a user with no assignments only an empty list, not an error", async () => {
      const response = await api(employeeId, "GET", `/stores/user/${employeeId}`);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body, []);
    });

    it("shows a field admin every store without any assignment", async () => {
      const response = await api(fieldAdminId, "GET", `/stores/user/${fieldAdminId}`);
      assert.equal(response.status, 200);
      const ids = response.body.map((store: { store_id: number }) => store.store_id);
      assert.ok(ids.includes(storeA) && ids.includes(storeB));
    });

    it("lets a field admin use employee-only actions and check in anywhere", async () => {
      const dayId = await startDay(fieldAdminId);
      const entry = await api(fieldAdminId, "POST", `/work-days/${dayId}/visits`, {
        store_id: storeB,
      });
      assert.equal(entry.status, 201);
      assert.equal(entry.body.open_visit.store_id, storeB);
      await api(
        fieldAdminId,
        "POST",
        `/work-days/${dayId}/visits/${entry.body.open_visit.store_visit_id}/check-out`
      );
    });

    it("includes unassigned stores in an admin's report filter list only", async () => {
      const unassigned = await insertStore("UNASSIGNED");
      const asAdmin = await api(adminId, "GET", "/stores/user");
      const asEmployee = await api(employeeId, "GET", "/stores/user");
      const has = (rows: Array<{ store_id: number }>) =>
        rows.some((store) => store.store_id === unassigned);
      assert.ok(has(asAdmin.body));
      assert.ok(!has(asEmployee.body));
    });
  });

  describe("employee list", () => {
    it("includes admins and employees but not viewers", async () => {
      const response = await api(adminId, "GET", "/users");
      const ids = response.body.map((user: { user_id: number }) => user.user_id);
      assert.ok(ids.includes(fieldAdminId));
      assert.ok(ids.includes(adminId));
      assert.ok(ids.includes(employeeId));
      assert.ok(!ids.includes(viewerId));
    });
  });

  describe("store assignments", () => {
    it("keeps several users on one store", async () => {
      for (const userId of [employeeId, secondEmployeeId, fieldAdminId]) {
        const response = await api(adminId, "POST", `/stores/${storeA}/users/${userId}`);
        assert.equal(response.status, 200);
      }

      const users = await api(adminId, "GET", `/stores/${storeA}/users`);
      assert.deepEqual(
        users.body.map((user: { user_id: number }) => user.user_id).sort(),
        [employeeId, secondEmployeeId, fieldAdminId].sort()
      );
    });

    it("treats a repeated assignment as a no-op", async () => {
      assert.equal((await api(adminId, "POST", `/stores/${storeA}/users/${employeeId}`)).status, 200);
      const users = await api(adminId, "GET", `/stores/${storeA}/users`);
      assert.equal(
        users.body.filter((user: { user_id: number }) => user.user_id === employeeId).length,
        1
      );
    });

    it("removes one user and leaves the others", async () => {
      await api(adminId, "DELETE", `/stores/${storeA}/users/${secondEmployeeId}`);
      const users = await api(adminId, "GET", `/stores/${storeA}/users`);
      const ids = users.body.map((user: { user_id: number }) => user.user_id);
      assert.ok(!ids.includes(secondEmployeeId));
      assert.ok(ids.includes(employeeId) && ids.includes(fieldAdminId));
    });

    it("shows an employee only their assigned stores", async () => {
      const stores = await api(employeeId, "GET", `/stores/user/${employeeId}`);
      assert.deepEqual(stores.body.map((store: { store_id: number }) => store.store_id), [storeA]);
    });

    it("lists only real assignments for an admin, not implicit access", async () => {
      const stores = await api(adminId, "GET", `/stores/user/${fieldAdminId}/assigned`);
      assert.deepEqual(stores.body.map((store: { store_id: number }) => store.store_id), [storeA]);
    });

    it("returns every user id per store for the report filters", async () => {
      const stores = await api(viewerId, "GET", "/stores/user");
      const store = stores.body.find((row: { store_id: number }) => row.store_id === storeA);
      assert.deepEqual([...store.user_ids].sort(), [employeeId, fieldAdminId].sort());
    });

    it("refuses to assign a viewer, an unknown user or an unknown store", async () => {
      assert.equal((await api(adminId, "POST", `/stores/${storeA}/users/${viewerId}`)).status, 400);
      assert.equal((await api(adminId, "POST", `/stores/${storeA}/users/99999999`)).status, 404);
      assert.equal((await api(adminId, "POST", `/stores/99999999/users/${employeeId}`)).status, 404);
    });

    it("only lets admins manage assignments", async () => {
      assert.equal((await api(employeeId, "POST", `/stores/${storeB}/users/${employeeId}`)).status, 403);
      assert.equal((await api(employeeId, "DELETE", `/stores/${storeA}/users/${employeeId}`)).status, 403);
      assert.equal((await api(viewerId, "GET", `/stores/${storeA}/users`)).status, 403);
    });

    it("creates a store with several users, atomically", async () => {
      const store = {
        store_name: "New",
        store_channel: "MT",
        store_category: "A",
        sales_rep: "rep",
        location: "Peje",
      };
      const code = `NEW-${suffix}`;
      const created = await api(adminId, "POST", "/stores", {
        ...store,
        store_code: code,
        user_ids: [employeeId, secondEmployeeId],
      });
      assert.equal(created.status, 201);
      assert.equal((await api(adminId, "GET", `/stores/${created.body.id}/users`)).body.length, 2);

      const rejected = await api(adminId, "POST", "/stores", {
        ...store,
        store_code: `BAD-${suffix}`,
        user_ids: [viewerId],
      });
      assert.equal(rejected.status, 400);
      const [rows] = await db
        .promise()
        .query<RowDataPacket[]>("SELECT store_id FROM stores WHERE store_code = ?", [
          `BAD-${suffix}`,
        ]);
      assert.equal(rows.length, 0);
    });
  });

  describe("work entries", () => {
    it("records other work without a market, with its reason in reports", async () => {
      const dayId = await startDay(employeeId);

      const invalid = await api(employeeId, "POST", `/work-days/${dayId}/visits`, {
        entry_type: "other_work",
        store_id: storeA,
      });
      assert.equal(invalid.status, 400);

      const entry = await api(employeeId, "POST", `/work-days/${dayId}/visits`, {
        entry_type: "other_work",
        reason: "  Takim në zyrë  ",
      });
      assert.equal(entry.status, 201);
      const open = entry.body.open_visit;
      assert.equal(open.entry_type, "other_work");
      assert.equal(open.store_id, null);
      assert.equal(open.store_name, null);
      assert.equal(open.reason, "Takim në zyrë");

      await assert.rejects(
        addStoreVisitPhoto(dayId, employeeId, open.store_visit_id, "url", null),
        /vetëm për vizita në market/
      );

      const overview = await api(adminId, "GET", "/work-days/report/overview");
      const person = overview.body.people.find(
        (row: { user_id: number }) => row.user_id === employeeId
      );
      assert.equal(person.state, "other_work");
      assert.equal(person.current_reason, "Takim në zyrë");
      assert.equal(person.current_store, null);
      assert.equal(person.visit_count, 0);

      const another = await api(employeeId, "POST", `/work-days/${dayId}/visits`, { store_id: storeA });
      assert.equal(another.status, 409);

      await api(employeeId, "POST", `/work-days/${dayId}/visits/${open.store_visit_id}/check-out`);

      const detail = await api(employeeId, "GET", `/work-days/${dayId}`);
      assert.equal(detail.body.store_visits[0].entry_type, "other_work");
      assert.equal(detail.body.store_visits[0].reason, "Takim në zyrë");

      const report = await api(
        adminId,
        "GET",
        `/work-days/report/detailed?user_id=${employeeId}&limit=5`
      );
      const verification = report.body.data[0].verification;
      assert.equal(verification.visit_count, 0);
      assert.equal(verification.visits[0].entry_type, "other_work");
      assert.ok(!verification.flags.includes("no_visits"));
      assert.ok(!verification.flags.includes("no_arrival_photo"));
    });

    it("keeps market visits working as before", async () => {
      const dayId = await startDay(secondEmployeeId);

      const missingStore = await api(secondEmployeeId, "POST", `/work-days/${dayId}/visits`, {
        entry_type: "market",
      });
      assert.equal(missingStore.status, 400);

      const entry = await api(secondEmployeeId, "POST", `/work-days/${dayId}/visits`, {
        store_id: storeB,
      });
      assert.equal(entry.status, 201);
      assert.equal(entry.body.open_visit.entry_type, "market");
      assert.equal(entry.body.visit_count, 1);
    });

  });

  describe("presence photos", () => {
    const addPhoto = async (visitId: number, userId: number) => {
      const [result] = await db.promise().execute<ResultSetHeader>(
        "INSERT INTO store_visit_photos (store_visit_id, user_id, photo_url) VALUES (?, ?, 'url')",
        [visitId, userId]
      );
      return result.insertId;
    };

    it("lets the owner delete during the visit, and only an admin after it", async () => {
      const ownerId = await insertUser("photo-owner", "employee");
      const dayId = await startDay(ownerId);
      const entry = await api(ownerId, "POST", `/work-days/${dayId}/visits`, { store_id: storeA });
      const visitId = entry.body.open_visit.store_visit_id;
      const path = (photoId: number) =>
        `/work-days/${dayId}/visits/${visitId}/photos/${photoId}`;

      const during = await addPhoto(visitId, ownerId);
      assert.equal((await api(employeeId, "DELETE", path(during))).status, 404);
      const deleted = await api(ownerId, "DELETE", path(during));
      assert.equal(deleted.status, 200);
      assert.equal(deleted.body.open_visit.photos.length, 0);

      const after = await addPhoto(visitId, ownerId);
      await api(ownerId, "POST", `/work-days/${dayId}/visits/${visitId}/check-out`);
      assert.equal((await api(ownerId, "DELETE", path(after))).status, 409);
      assert.equal((await api(adminId, "DELETE", path(after))).status, 200);
    });
  });

  describe("store coverage", () => {
    const coveredIds = async (userId: number, query = "") => {
      const response = await api(userId, "GET", `/analytics/store-coverage${query}`);
      assert.equal(response.status, 200);
      return response.body.stores.map((store: { store_id: number }) => store.store_id);
    };

    it("limits an employee to their assigned stores", async () => {
      const ids = await coveredIds(employeeId);
      assert.ok(ids.includes(storeA));
      assert.ok(!ids.includes(storeB));
    });

    it("gives an all-stores user every store when filtered by that user", async () => {
      const ids = await coveredIds(adminId, `?user_ids=${fieldAdminId}`);
      assert.ok(ids.includes(storeA) && ids.includes(storeB));
    });
  });
});
