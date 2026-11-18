import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const development = {
  PUBLIC_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://zbeul:zbeul@localhost:5432/zbeul",
  SESSION_SECRET: "change-me",
  OIDC_ISSUER: "http://localhost:8180/realms/zbeul",
  OIDC_CLIENT_ID: "zbeul-web",
  OIDC_CLIENT_SECRET: "zbeul-web-secret",
};

const production = {
  ...development,
  NODE_ENV: "production",
  PUBLIC_URL: "https://bookings.example.com",
  SESSION_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  it("accepts the development defaults from .env.example", () => {
    expect(parseEnv(development).DATABASE_URL).toBe(development.DATABASE_URL);
  });

  it("lists every missing variable at once", () => {
    expect(() => parseEnv({})).toThrow(
      /PUBLIC_URL[\s\S]*DATABASE_URL[\s\S]*SESSION_SECRET/,
    );
  });

  it("runs without an identity provider, but not with half of one", () => {
    const { OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, ...none } =
      production;
    expect(parseEnv(none).OIDC_ISSUER).toBeUndefined();
    // Left empty in an env file is the same as left out.
    expect(
      parseEnv({ ...none, OIDC_ISSUER: "", OIDC_CLIENT_ID: "" }).OIDC_CLIENT_ID,
    ).toBeUndefined();
    expect(() => parseEnv({ ...none, OIDC_ISSUER })).toThrow(/OIDC_ISSUER/);
    expect(() =>
      parseEnv({ ...none, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET }),
    ).toThrow(/OIDC_ISSUER/);
  });

  it("normalises the admin's email, and wants a setup code worth the name", () => {
    const env = parseEnv({
      ...production,
      ADMIN_EMAIL: " Ada+Zbeul@Example.Test ",
      ADMIN_SETUP_CODE: "a-long-enough-setup-code",
    });
    expect(env.ADMIN_EMAIL).toBe("ada+zbeul@example.test");
    expect(parseEnv(production).ADMIN_EMAIL).toBeUndefined();
    expect(() => parseEnv({ ...production, ADMIN_EMAIL: "ada" })).toThrow(
      /ADMIN_EMAIL/,
    );
    expect(() =>
      parseEnv({ ...production, ADMIN_SETUP_CODE: "short" }),
    ).toThrow(/ADMIN_SETUP_CODE/);
  });

  it("rejects a database URL that isn't Postgres", () => {
    expect(() =>
      parseEnv({ ...development, DATABASE_URL: "mysql://localhost/db" }),
    ).toThrow(/DATABASE_URL/);
  });

  it("drops a trailing slash from the public URL", () => {
    const env = parseEnv({
      ...development,
      PUBLIC_URL: "http://localhost:3000/",
    });
    expect(env.PUBLIC_URL).toBe("http://localhost:3000");
  });

  it("accepts a complete production setup", () => {
    expect(() => parseEnv(production)).not.toThrow();
  });

  it("requires a real secret in production", () => {
    expect(() =>
      parseEnv({ ...production, SESSION_SECRET: "change-me" }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("requires https in production, except on localhost", () => {
    expect(() =>
      parseEnv({ ...production, PUBLIC_URL: "http://bookings.example.com" }),
    ).toThrow(/PUBLIC_URL/);
    expect(() =>
      parseEnv({ ...production, PUBLIC_URL: "http://localhost:3100" }),
    ).not.toThrow();
  });

  it("needs credentials and a sender once an SMTP server is set", () => {
    expect(() =>
      parseEnv({ ...development, SMTP_HOST: "smtp.tem.scaleway.com" }),
    ).toThrow(/SMTP_USER[\s\S]*SMTP_PASSWORD[\s\S]*MAIL_FROM/);
    const env = parseEnv({
      ...development,
      SMTP_HOST: "smtp.tem.scaleway.com",
      SMTP_USER: "project-id",
      SMTP_PASSWORD: "secret-key",
      MAIL_FROM: "no-reply@acme.example",
    });
    expect(env.SMTP_PORT).toBe(465);
  });

  it("treats an empty SMTP_HOST as unset", () => {
    expect(
      parseEnv({ ...development, SMTP_HOST: "" }).SMTP_HOST,
    ).toBeUndefined();
  });
});
