/**
 * Type declarations for the `irc-framework` dependency.
 *
 * `irc-framework` (v4) ships only CommonJS JavaScript and no TypeScript
 * definitions, so importing the client fails type-check (TS7016) unless a
 * declaration is provided (P2-1).
 *
 * These declarations are wired in via `tsconfig paths` (see `tsconfig.json`),
 * which maps the bare specifier `'irc-framework'` to this file, so TypeScript
 * loads these types instead of the untyped JS at
 * `node_modules/irc-framework/src/index.js`.
 *
 * The client is deliberately left loose: the FateBot-specific client contract
 * (event payloads, connect options, `say`/`notice`/`join`/`quit`) lives in
 * `./irc.ts` and is applied once at the single construction site (the
 * `as IrcClient` cast in `bot-client.ts`). Keeping this surface minimal
 * avoids duplicating that contract.
 */
declare class Client {
    constructor(options?: unknown);
}

declare const ircFramework: { Client: typeof Client };
export = ircFramework;
