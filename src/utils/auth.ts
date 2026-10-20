import { Request, Response } from "express";

export const SESSION_COOKIE = "session";

const COMMON_PASSWORDS = new Set([
  "password1",
  "password123",
  "1234567890",
  "12345678910",
  "qwerty1234",
  "qwertyuiop1",
  "podravka123",
  "podravka2024",
  "podravka2025",
  "podravka2026",
  "admin12345",
  "employee123",
  "fjalekalimi1",
]);

// Returns an error message, or null when the password is acceptable.
export const validatePassword = (password: unknown, username?: unknown): string | null => {
  if (typeof password !== "string") {
    return "Fjalëkalimi është i detyrueshëm";
  }
  if (password.length < 10) {
    return "Fjalëkalimi duhet të ketë së paku 10 karaktere";
  }
  if (password.length > 128) {
    return "Fjalëkalimi është shumë i gjatë";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Fjalëkalimi duhet të ketë shkronja dhe numra";
  }
  if (
    typeof username === "string" &&
    username.trim().length >= 3 &&
    password.toLowerCase().includes(username.trim().toLowerCase())
  ) {
    return "Fjalëkalimi nuk duhet të përmbajë emrin e përdoruesit";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Ky fjalëkalim është shumë i zakonshëm";
  }
  return null;
};

const parseCookies = (header: string | undefined): Record<string, string> =>
  Object.fromEntries(
    (header || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1
          ? [part, ""]
          : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );

export const readSessionCookie = (req: Request): string | undefined =>
  parseCookies(req.headers.cookie)[SESSION_COOKIE] || undefined;

// httpOnly keeps the token out of reach of page scripts (XSS). Strict
// same-site blocks other sites from riding on the session (CSRF); the
// frontend reaches the API on its own origin, so it is never cross-site.
export const setSessionCookie = (req: Request, res: Response, token: string, maxAgeMs: number) => {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: req.secure,
    sameSite: "strict",
    path: "/api",
    maxAge: maxAgeMs,
  });
};

export const clearSessionCookie = (req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: req.secure,
    sameSite: "strict",
    path: "/api",
  });
};
