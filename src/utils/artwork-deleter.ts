import { readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { COMFYUI_CONFIG } from '../config/constants';
import { logger } from '../config/logger';

/**
 * Result of a deletion pass over the art folder.
 */
export interface ArtworkDeleteResult {
    /** Filenames (not full paths) that were removed. */
    deleted: string[];
    /** Number of files removed. */
    count: number;
}

/**
 * Characters we allow in a batch/prompt id. We validate the id instead of
 * building a path from it, so it can never be used for path traversal.
 */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Deletes generated images from the configured art folder.
 *
 * @param target Either the string `all` (clear the whole folder) or a prompt
 * id such as `8cc05ada-6698-4c4c-9262-adda0f0addb4` (remove only that batch,
 * matching `<id>_0.webp`, `<id>_1.webp`, ...).
 * @returns The list and count of files actually removed.
 * @throws Error if the folder is not configured or the id is invalid.
 */
export function deleteArtworkTarget(target: string): ArtworkDeleteResult {
    if (!COMFYUI_CONFIG.FOLDER_PATH) {
        throw new Error('Image folder is not configured (FOLDER_PATH missing).');
    }
    const folder = COMFYUI_CONFIG.FOLDER_PATH;
    const names = readdirSync(folder);

    let candidates: string[];
    if (target === 'all') {
        candidates = names;
    } else {
        if (!SAFE_ID.test(target)) {
            throw new Error(`Invalid id "${target}". Use a prompt id or "all".`);
        }
        const pattern = new RegExp(`^${target}_\\d+\\.[A-Za-z0-9]+$`);
        candidates = names.filter((name) => pattern.test(name));
    }

    const deleted: string[] = [];
    for (const name of candidates) {
        const filepath = join(folder, name);
        try {
            // Never follow into subdirectories, even in "all" mode.
            if (!statSync(filepath).isFile()) {
                continue;
            }
            unlinkSync(filepath);
            deleted.push(name);
            logger.debug(`Deleted artwork file: ${name}`);
        } catch (error) {
            logger.warn(`Could not delete ${filepath}: ${error instanceof Error ? error.message : error}`);
        }
    }

    return { deleted, count: deleted.length };
}
