// Memory only. Never persist a spending key or send it to an API.
let unlocked: { username: string; key: string } | null = null;
export function unlockAccountWallet(username: string, key: string) { unlocked = { username, key }; }
export function lockAccountWallet() { unlocked = null; }
export function accountWalletKey(username: string) { return unlocked?.username === username ? unlocked.key : null; }
export function unlockedAccountWallet() { return unlocked; }
