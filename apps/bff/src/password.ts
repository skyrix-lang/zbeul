import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Password hashing with scrypt, from Node itself: no dependency. The settings
// follow OWASP's password storage guidance (N=2^15, r=8, p=3, about 32 MB per
// hash) and are stored with each hash, so they can be raised later without
// locking anyone out.

const PARAMS = { N: 2 ** 15, r: 8, p: 3 };
const KEY_LENGTH = 32;

function derive(
  password: string,
  salt: Buffer,
  { N, r, p }: typeof PARAMS,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      // NFKC: the same password typed on another keyboard hashes the same.
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N, r, p, maxmem: 256 * N * r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

const encode = (
  { N, r, p }: typeof PARAMS,
  salt: Buffer,
  key: Buffer,
): string =>
  ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join(
    "$",
  );

/** `scrypt$N$r$p$salt$key`, the last two in base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return encode(PARAMS, salt, await derive(password, salt, PARAMS));
}

// Checked when there is no account, so a wrong email takes as long as a wrong
// password and the two can't be told apart by timing.
const DUMMY = encode(PARAMS, Buffer.alloc(16), Buffer.alloc(KEY_LENGTH));

/** Whether `password` matches `hash`. Never throws on a malformed hash. */
export async function verifyPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  const [scheme, N, r, p, salt, key] = (hash ?? DUMMY).split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  try {
    const expected = Buffer.from(key, "base64");
    const actual = await derive(password, Buffer.from(salt, "base64"), {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return (
      hash != null &&
      expected.length === actual.length &&
      timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
