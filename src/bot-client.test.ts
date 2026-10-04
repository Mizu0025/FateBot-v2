import { describe, expect, it } from 'vitest';
import { redactIrcLine } from './bot-client';

/**
 * P1-2 acceptance: the `raw` IRC stream includes the SASL handshake
 * (`AUTH`, `CAP REQ ... account-token=…`, `PASS`, `WEBIRC`) whose payloads are
 * the password/token in plaintext. Before anything is written to the journal,
 * {@link redactIrcLine} must blank those credentials while leaving every other
 * line (chat, NICK, USER, PING) untouched.
 */
describe('redactIrcLine (P1-2)', () => {
    it('redacts a SASL AUTH line', () => {
        expect(redactIrcLine('AUTH dG9rZW4tYWJjZA==')).toBe('AUTH <redacted>');
    });
    it('redacts the account-token in a CAP REQ line, keeping the rest', () => {
        expect(redactIrcLine('CAP REQ :sasl account-token=supersecretpassword')).toBe(
            'CAP REQ :sasl account-token=<redacted>',
        );
    });
    it('redacts a PASS line', () => {
        expect(redactIrcLine('PASS letmein123')).toBe('PASS <redacted>');
    });
    it('redacts the first argument of a WEBIRC line', () => {
        expect(redactIrcLine('WEBIRC webircl33tkey user host 10.0.0.1')).toBe('WEBIRC <redacted> user host 10.0.0.1');
    });
    it('handles each SASL variant independently', () => {
        expect(redactIrcLine('AUTH abc')).not.toContain('abc');
        expect(redactIrcLine('CAP REQ :sasl account-token=xyz')).not.toContain('xyz');
        expect(redactIrcLine('PASS hunter2')).not.toContain('hunter2');
    });
    it('leaves benign chat lines untouched', () => {
        expect(redactIrcLine(':Mizu PRIVMSG #chan :hello world')).toBe(':Mizu PRIVMSG #chan :hello world');
        expect(redactIrcLine('PING 1700000000')).toBe('PING 1700000000');
        expect(redactIrcLine('NICK FateBot')).toBe('NICK FateBot');
    });
    it('does not touch a message that merely contains the word auth mid-line', () => {
        // "AUTH" anchored to start-of-line only; a token value mid-message is kept.
        expect(redactIrcLine(':user PRIVMSG #chan :AUTH is a nice word')).toBe(
            ':user PRIVMSG #chan :AUTH is a nice word',
        );
    });
});
