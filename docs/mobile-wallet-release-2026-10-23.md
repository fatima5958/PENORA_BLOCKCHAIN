# Mobile wallet and creator transfer release

Changes are based on main `bcbd7af` and incorporate the wallet review branch without reverting the newer creator economy work.

- Creator username lookup routes Test PNR and Test USDT only to a signed, verified linked wallet on Polygon Amoy (80002). The recipient binding is checked again before signing. Missing bindings and expired sessions show errors.
- Mobile wallet opens with a balance and four quick actions. Wallet verification, connection and voting information, staking and rewards guides expand on demand. All desktop tools remain available.
- Mobile navigation highlights Exchange within Wallet and discovery screens within Explore. Viewing somebody else's profile no longer highlights My Profile.
- Restored the mobile feed menu so Exchange and the rest of the navigation remain reachable.
- Increased desktop creator profile spacing and responsive column widths.
- Removed the extra website footer on creator profiles, preserving bottom navigation.
- Increased phone navigation tap areas, added focus indicators, and kept the fixed dock underneath open dialogs.
- Fixed cleanup of the cross-tab profile-photo refresh listener.

## Validation

- TypeScript: passed (`npm run lint`).
- Static production build: passed, 43 pages.
- Targeted automated tests: 72 passed (creator recipient lookup, wallet transfers, hybrid wallet, profile durability).
- `git diff --check`: passed.

## Verification limits

- No real Polygon Amoy transfer was signed or sent. Token contract configuration, sender funds, gas and recipient wallet verification are required for a real transaction.
- Signed-in production profile save/reload and every application screen have not been verified end to end.
- Browser visual checks were blocked by an unavailable Chromium download in this execution environment.
- Broader database integration tests require permitted network access to the connected Supabase project. They are not represented as passing by this release.

This is a scoped release of the listed changes, not a certification that the entire application has no defects.
