export const USERNAME_AUTH_DOMAIN = "accounts.geoarchive.invalid";

export function normalizeUsername(input: string) {
  return input.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return /^[a-z0-9_]{3,32}$/.test(username);
}

export function usernameAuthEmail(username: string) {
  return `u_${username}@${USERNAME_AUTH_DOMAIN}`;
}
