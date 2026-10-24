import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { emptyDonations, requestTotals } from "../src/utils/donations.js";
import { changeOrganization } from "./organizationRules.js";
import { validatePersonalProfile } from "./personalProfile.js";
const deriveKey = promisify(scrypt);
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function problem(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export class CommunityStore {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES accounts(id),expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS personal_profiles(user_id TEXT PRIMARY KEY REFERENCES accounts(id),data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workspaces(owner_id TEXT PRIMARY KEY REFERENCES accounts(id),data TEXT NOT NULL);`);
  }
  close() {
    this.db.close();
  }
  async authenticate(email, password, register = false) {
    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      email.length > 254
    )
      throw problem("Enter a valid email address.");
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    )
      throw problem("Use a password between 12 and 128 characters.");
    email = email.trim().toLowerCase();
    const account = this.db
      .prepare("SELECT * FROM accounts WHERE email=?")
      .get(email);
    const salt = register
      ? randomBytes(16).toString("hex")
      : account?.salt || "00000000000000000000000000000000";
    const key = await deriveKey(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    if (register) {
      if (account)
        throw problem("An account with this email already exists.", 409);
      const id = randomUUID();
      try {
        this.db.exec("BEGIN IMMEDIATE");
        this.db
          .prepare("INSERT INTO accounts VALUES(?,?,?,?)")
          .run(id, email, key.toString("hex"), salt);
        this.db
          .prepare("INSERT INTO workspaces VALUES(?,?)")
          .run(id, JSON.stringify({ ...emptyDonations(), resources: [] }));
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw problem(
          "Could not create this account. Try a different email.",
          409,
        );
      }
      return { id, email };
    }
    if (
      !account ||
      !timingSafeEqual(key, Buffer.from(account.password_hash, "hex"))
    )
      throw problem("Email or password is incorrect.", 401);
    return { id: account.id, email: account.email };
  }
  createSession(user) {
    const token = randomBytes(32).toString("hex");
    this.db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(digest(token), user.id, Date.now() + 7 * 86400000);
    return token;
  }
  user(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return (
      this.db
        .prepare(
          "SELECT a.id,a.email FROM accounts a JOIN sessions s ON a.id=s.user_id WHERE s.token_hash=? AND s.expires>?",
        )
        .get(digest(token), Date.now()) || null
    );
  }
  logout(token) {
    if (token)
      this.db
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(digest(token));
  }
  profile(user) {
    if (!user) return null;
    const row = this.db
      .prepare("SELECT data FROM personal_profiles WHERE user_id=?")
      .get(user.id);
    return row ? JSON.parse(row.data) : null;
  }
  saveProfile(user, input) {
    if (!user) throw problem("Sign in to save your answers.", 401);
    const profile = {
      ...validatePersonalProfile(input),
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        "INSERT INTO personal_profiles(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data",
      )
      .run(user.id, JSON.stringify(profile));
    return this.view(user);
  }
  workspaces() {
    return this.db
      .prepare("SELECT * FROM workspaces")
      .all()
      .map((row) => ({ owner: row.owner_id, state: JSON.parse(row.data) }));
  }
  view(user) {
    const rows = this.workspaces(),
      mine = rows.find((row) => row.owner === user?.id);
    return {
      user: user ? { email: user.email } : null,
      profile: this.profile(user),
      organization: mine?.state.organization || null,
      resources: mine?.state.resources || [],
      requests: rows.flatMap(({ owner, state }) =>
        state.requests.map((request) => ({
          ...request,
          organization: state.organization,
          managed: owner === user?.id,
          hasHistory: state.pledges.some(
            (pledge) => pledge.requestId === request.id,
          ),
          totals: requestTotals(state, request.id),
        })),
      ),
      pledges: rows.flatMap(({ owner, state }) =>
        state.pledges
          .filter(
            (pledge) =>
              user && (owner === user.id || pledge.donorId === user.id),
          )
          .map(({ donorId, ...pledge }) => ({
            ...pledge,
            mine: donorId === user?.id,
            canCancel: owner === user?.id || donorId === user?.id,
          })),
      ),
    };
  }
  act(user, action) {
    if (!user) throw problem("Sign in to continue.", 401);
    if (!this.profile(user))
      throw problem("Complete account setup before continuing.", 409);
    if (!action || typeof action.type !== "string")
      throw problem("Choose a valid action.");
    const allowed = [
      "organization",
      "import-device",
      "request",
      "edit-request",
      "close-request",
      "resource",
      "pledge",
      "receive",
      "cancel",
    ];
    if (!allowed.includes(action.type)) throw problem("Unknown action.");
    // The database transaction covers lookup, authorization, validation, and save.
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const rows = this.workspaces();
      let target = rows.find((row) => row.owner === user.id);
      if (
        [
          "pledge",
          "receive",
          "cancel",
          "edit-request",
          "close-request",
        ].includes(action.type)
      ) {
        target = rows.find((row) =>
          action.type === "pledge" || action.type.endsWith("request")
            ? row.state.requests.some(
                (item) => item.id === (action.requestId || action.id),
              )
            : row.state.pledges.some((item) => item.id === action.pledgeId),
        );
      }
      if (!target) throw problem("Record not found.", 404);
      const owner = target.owner === user.id;
      const pledge = target.state.pledges.find(
        (item) => item.id === action.pledgeId,
      );
      if (
        action.type === "cancel"
          ? !owner && pledge?.donorId !== user.id
          : action.type !== "pledge" && !owner
      )
        throw problem("You can only manage your own organization.", 403);
      const trusted = { ...action };
      if (action.type === "request") trusted.id = randomUUID();
      if (action.type === "resource") {
        if (
          action.id &&
          !(target.state.resources || []).some((item) => item.id === action.id)
        )
          throw problem("Resource not found.", 404);
        trusted.id = action.id || `org-${randomUUID()}`;
      }
      if (action.type === "pledge") trusted.id = randomUUID();
      const next = changeOrganization(target.state, trusted);
      if (action.type === "import-device")
        next.pledges.forEach((pledge) => {
          pledge.donorId = user.id;
        });
      if (action.type === "pledge")
        next.pledges.find((item) => item.id === trusted.id).donorId = user.id;
      this.db
        .prepare("UPDATE workspaces SET data=? WHERE owner_id=?")
        .run(JSON.stringify(next), target.owner);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.view(user);
  }
  publicResources() {
    return this.workspaces().flatMap(({ state }) =>
      (state.resources || [])
        .filter((resource) => resource.published)
        .map((resource) => ({
          ...resource,
          sourceUrl: resource.website || state.organization?.website || "",
          organizationName: state.organization?.name,
        })),
    );
  }
}
