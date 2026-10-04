import { promises as fs } from 'node:fs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { COMFYUI_CONFIG } from '../config/constants';
import { logger } from '../config/logger';
import { deleteArtworkTarget } from './artwork-deleter';

vi.mock('../config/logger');
vi.mock('fs', () => ({
    promises: {
        readdir: vi.fn(),
        stat: vi.fn(),
        unlink: vi.fn(),
    },
}));

const readdirMock = fs.readdir as unknown as Mock;
const statMock = fs.stat as unknown as Mock;
const unlinkMock = fs.unlink as unknown as Mock;

describe('deleteArtworkTarget', () => {
    beforeEach(() => {
        // `resetAllMocks` (not `clearAllMocks`) so a `mockImplementation`
        // left over by a previous test — e.g. a throwing `unlink` — is
        // actually removed, not just its call history wiped.
        vi.resetAllMocks();
        COMFYUI_CONFIG.FOLDER_PATH = '/mnt/ai_data/artwork/';
        // Default: every listed name is a regular file.
        statMock.mockResolvedValue({ isFile: () => true });
        vi.spyOn(logger, 'debug').mockImplementation(() => logger);
        vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    });

    it('should delete only files that match the batch id', async () => {
        readdirMock.mockResolvedValue(['abc_0.webp', 'abc_1.webp', 'def_0.webp', 'def_1.webp', 'notes.txt']);

        const result = await deleteArtworkTarget('abc');

        expect(result).toEqual({ deleted: ['abc_0.webp', 'abc_1.webp'], count: 2 });
        expect(unlinkMock).toHaveBeenCalledTimes(2);
        expect(unlinkMock).toHaveBeenCalledWith('/mnt/ai_data/artwork/abc_0.webp');
        expect(unlinkMock).toHaveBeenCalledWith('/mnt/ai_data/artwork/abc_1.webp');
    });

    it('should skip subdirectories in "all" mode', async () => {
        readdirMock.mockResolvedValue(['abc_0.webp', 'archive']);
        statMock.mockImplementation(async (path: string) => ({ isFile: () => !String(path).endsWith('archive') }));

        const result = await deleteArtworkTarget('all');

        expect(result.deleted).toEqual(['abc_0.webp']);
        expect(unlinkMock).toHaveBeenCalledTimes(1);
    });

    it('should log a warning and continue when a single file fails to unlink', async () => {
        readdirMock.mockResolvedValue(['abc_0.webp', 'abc_1.webp']);
        unlinkMock.mockImplementation(async (path: string) => {
            if (String(path).endsWith('abc_0.webp')) {
                throw new Error('EPERM: operation not permitted');
            }
        });

        const result = await deleteArtworkTarget('abc');

        expect(result.deleted).toEqual(['abc_1.webp']);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Could not delete /mnt/ai_data/artwork/abc_0.webp'),
        );
    });

    it('should reject path-traversal and malformed ids (never even reads the folder)', async () => {
        await expect(deleteArtworkTarget('..')).rejects.toThrow(/Invalid id/);
        await expect(deleteArtworkTarget('../etc/passwd')).rejects.toThrow(/Invalid id/);
        await expect(deleteArtworkTarget('a/b')).rejects.toThrow(/Invalid id/);
        await expect(deleteArtworkTarget('bad id')).rejects.toThrow(/Invalid id/);
        // None of the malformed ids should ever be used to build a real path:
        // the id is validated before any listing happens.
        expect(readdirMock).not.toHaveBeenCalled();
    });

    it('should throw when the folder path is not configured', async () => {
        COMFYUI_CONFIG.FOLDER_PATH = '';
        await expect(deleteArtworkTarget('all')).rejects.toThrow(/Image folder is not configured/);
    });

    it('should return an empty result for an id with no matches', async () => {
        readdirMock.mockResolvedValue(['xyz_0.webp']);
        const result = await deleteArtworkTarget('abc');
        expect(result).toEqual({ deleted: [], count: 0 });
        expect(unlinkMock).not.toHaveBeenCalled();
    });

    it('should delete top-level mixed-index files for a batch (grid _0 included)', async () => {
        readdirMock.mockResolvedValue(['abc_0.webp', 'abc_1.webp', 'abc_2.webp']);
        const result = await deleteArtworkTarget('abc');
        expect(result.count).toBe(3);
    });

    it('should still match files whose numeric index was dropped or renamed', async () => {
        // A non-numeric tail is accepted so externally-renamed files remain
        // addressable by batch id (the id prefix still anchors the match).
        readdirMock.mockResolvedValue(['abc.webp', 'abc_0.webp']);
        const result = await deleteArtworkTarget('abc');
        expect(result.count).toBe(2);
    });

    it('restores a real folder path for later tests', () => {
        expect(COMFYUI_CONFIG.FOLDER_PATH).toBe('/mnt/ai_data/artwork/');
    });
});
