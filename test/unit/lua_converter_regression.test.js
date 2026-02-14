import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('Lua converter regressions', () => {
    it('keeps Lua long-string newline semantics stable for des.map', () => {
        // Stability note for contributors:
        // Lua [[...]] strips exactly one leading newline when present.
        // We intentionally encode that as JS template literal line continuation
        // (`\\` right after opening backtick). Do not reintroduce synthetic
        // blank first map rows or auto-indent map body lines.
        const workdir = mkdtempSync(join(tmpdir(), 'webhack-lua-converter-'));
        const inputPath = join(workdir, 'sample.lua');
        const outputPath = join(workdir, 'sample.js');

        const luaSource = `
function test()
    des.map([[
abc
DEF]])
    des.map([[GHI
jkl]])
end
`;
        writeFileSync(inputPath, luaSource, 'utf8');

        const run = spawnSync('python3', ['tools/lualevel_to_js.py', inputPath, outputPath], {
            cwd: process.cwd(),
            stdio: 'pipe',
        });
        // In some CI/sandbox contexts Node reports EPERM despite successful
        // process completion (status 0 and valid output file). Treat that as
        // success, otherwise fail loudly.
        if (!(run.status === 0 || (run.error && run.error.code === 'EPERM' && run.error.status === 0))) {
            throw run.error || new Error(`converter failed: status=${run.status} stderr=${String(run.stderr || '')}`);
        }

        const js = readFileSync(outputPath, 'utf8');
        rmSync(workdir, { recursive: true, force: true });

        // Leading newline case: must use `\\` and start map immediately at "abc".
        assert.match(js, /des\.map\(`\\\nabc\nDEF`\);/);
        assert.doesNotMatch(js, /des\.map\(`\\\n\s+abc\nDEF`\);/);

        // No-leading-newline case: no synthetic blank line and no `\\` continuation.
        assert.match(js, /des\.map\(`GHI\njkl`\);/);
    });
});
