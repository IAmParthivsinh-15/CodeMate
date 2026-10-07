import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, registerUser } from "../helpers.js";
import User from "../../src/modules/users/user.model.js";

let t;
beforeAll(async () => { t = await startTestServer("cm_auth", { workers: false }); });
afterAll(async () => { await t.stop(); });

describe("auth", () => {
  it("registers, returns legacy + new fields, sets cookies, and hides secrets", async () => {
    const res = await t.api().post("/api/auth/register").send({ username: "alice", email: "Alice@Example.com", password: "password123", confirmPassword: "password123" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, username: "alice", email: "alice@example.com", message: "User registered successfully" });
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();
    expect(res.headers["set-cookie"].join(";")).toMatch(/jwt=.*HttpOnly/);
    const stored = await User.findOne({ email: "alice@example.com" }).lean();
    expect(stored.refreshTokens[0].token).not.toBe(res.body.refreshToken); // hashed at rest
  });

  it("validates input with a consistent error format", async () => {
    const res = await t.api().post("/api/auth/register").send({ username: "b", email: "nope", password: "short", confirmPassword: "x" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" }, message: "Validation failed" });
    expect(res.body.requestId).toBeTruthy();
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["body.username", "body.email", "body.password", "body.confirmPassword"]));
  });

  it("rejects duplicates and bad credentials without revealing which", async () => {
    await registerUser(t.api, "bob");
    const dup = await t.api().post("/api/auth/register").send({ username: "bob2", email: "bob@example.com", password: "password123", confirmPassword: "password123" });
    expect(dup.status).toBe(409);
    const wrong = await t.api().post("/api/auth/login").send({ email: "bob@example.com", password: "wrongpass" });
    const unknown = await t.api().post("/api/auth/login").send({ email: "nobody@example.com", password: "wrongpass" });
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.code).toBe(wrong.body.error.code);
  });

  it("supports me, refresh rotation and logout", async () => {
    const { auth, refreshToken } = await registerUser(t.api, "carol");
    const me = await t.api().get("/api/auth/me").set(auth);
    expect(me.body.user.username).toBe("carol");

    const r1 = await t.api().post("/api/auth/refresh").send({ refreshToken });
    expect(r1.status).toBe(200);
    const reuse = await t.api().post("/api/auth/refresh").send({ refreshToken });
    expect(reuse.status).toBe(401); // rotated: old token no longer valid

    const out = await t.api().post("/api/auth/logout").send({ refreshToken: r1.body.refreshToken });
    expect(out.status).toBe(200);
    expect((await t.api().post("/api/auth/refresh").send({ refreshToken: r1.body.refreshToken })).status).toBe(401);
  });

  it("guards protected routes and returns JSON 404s", async () => {
    expect((await t.api().get("/api/auth/me")).body.error.code).toBe("NO_TOKEN");
    expect((await t.api().get("/api/auth/me").set({ Authorization: "Bearer garbage" })).status).toBe(401);
    const nf = await t.api().get("/api/nope");
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("does not accept a user token on admin routes", async () => {
    const { auth } = await registerUser(t.api, "dave");
    expect((await t.api().post("/api/admin/add-admin").set(auth).send({})).status).toBe(401);
  });

  it("updates profile preferences", async () => {
    const { auth } = await registerUser(t.api, "erin");
    const res = await t.api().patch("/api/users/me").set(auth).send({ preferences: { boardTheme: "green" }, preferredLanguage: "python" });
    expect(res.body.user.preferences.boardTheme).toBe("green");
    expect(res.body.user.codingStats.preferredLanguage).toBe("python");
    expect((await t.api().patch("/api/users/me").set(auth).send({ role: "admin" })).status).toBe(400);
  });
});
