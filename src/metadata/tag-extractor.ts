/**
 * Utilities for extracting tags from image prompts (danbooru-style and plaintext)
 * and from image content via OCR.
 */

const DANBOORU_DELIMITERS = /[,\s]+/;
const DANBOORU_CAMELCASE_BOUNDARY = /(?<=[a-z])(?=[A-Z])/g;

// Common English words to filter out from plaintext prompts
const PLAINTEXT_STOP_WORDS = new Set([
    'i', 'a', 'an', 'the', 'in', 'on', 'at', 'by', 'to', 'for', 'of', 'and', 'or',
    'but', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
    'this', 'that', 'these', 'those', 'it', 'its', 'he', 'she', 'they', 'we', 'you',
    'my', 'your', 'his', 'her', 'our', 'their', 'then', 'there', 'here', 'when',
    'where', 'how', 'what', 'which', 'who', 'with', 'from', 'not', 'no', 'if',
    'about', 'other', 'some', 'such', 'into', 'also', 'just', 'very', 'too', 'all',
    'more', 'most', 'much', 'up', 'down', 'out', 'so', 'as', 'than', 'only',
    'like', 'each', 'after', 'before', 'between', 'through', 'during', 'above',
    'below', 'over', 'under', 'again', 'further', 'once', 'now', 'since', 'because',
    'while', 'which', 'who', 'how', 'what', 'when', 'where', 'why', 'how', 'can',
    'will', 'shall', 'should', 'would', 'could', 'might', 'may', 'must', 'need',
    'very', 'so', 'too', 'just', 'only', 'even', 'still', 'already', 'always',
    'never', 'sometimes', 'often', 'rarely', 'usually', 'sometimes', 'yet',
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'has', 'have', 'had',
    'do', 'does', 'did', 'will', 'shall', 'can', 'could', 'would', 'should',
    'may', 'might', 'must', 'need', 'ought', 'dare', 'used', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will',
    'just', 'don', 'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
    'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their',
    'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
    'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'having', 'do', 'does', 'did', 'having', 'will', 'would', 'shall', 'should',
    'may', 'might', 'must', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'now',
]);

interface TagExtractionResult {
    rawPrompt: string;
    tags: Set<string>;
    sourceTags: string[];
}

export class TagExtractor {
    /**
     * Extract tags from a danbooru-style or plaintext prompt.
     * Danbooru: comma-separated camelCase/pascalCase tags (e.g., "1girl,blue_hair,looking_at")
     * Plaintext: space-separated words (e.g., "a beautiful girl wearing a blue dress")
     */
    public static extractFromPrompt(prompt: string): TagExtractionResult {
        if (!prompt || !prompt.trim()) {
            return { rawPrompt: '', tags: new Set(), sourceTags: [] };
        }

        const cleanPrompt = prompt.trim();
        const sourceTags: string[] = [];

        // Detect if the prompt is danbooru-style (contains commas followed by lowercase)
        // or has multiple words that look like tags
        const isDanbooru = DANBOORU_DELIMITERS.test(cleanPrompt) && 
            (cleanPrompt.includes(',') || this.detectCamelCaseTags(cleanPrompt));

        let tags: Set<string> = new Set();

        if (isDanbooru) {
            // Danbooru-style: split by comma, then by underscore within each tag
            const parts = cleanPrompt.split(',').map(tag => tag.trim()).filter(Boolean);
            for (const part of parts) {
                // Split compound tags by underscore: "blue_hair_dress" -> ["blue_hair_dress", "blue", "hair", "dress"]
                const subTags = this.splitCompoundTag(part);
                tags = new Set([...tags, ...subTags]);
            }
            sourceTags.push(...parts);
        } else {
            // Plaintext: extract meaningful words
            const words = this.extractPlaintextKeywords(cleanPrompt);
            tags = new Set(words);
            sourceTags.push(...words);
        }

        return {
            rawPrompt: cleanPrompt,
            tags,
            sourceTags
        };
    }

    /**
     * Detects if a string contains multiple camelCase words that look like tags
     */
    private static detectCamelCaseTags(text: string): boolean {
        // Count words that are at least 3 chars long and not common stop words
        const words = text.split(/\s+/);
        const camelWords = words.filter(w => 
            w.length >= 3 && 
            w.match(/[a-z]+[A-Z]/) && 
            !PLAINTEXT_STOP_WORDS.has(w.toLowerCase())
        );
        return camelWords.length > 2;
    }

    /**
     * Splits a compound tag by underscore, returning full tag and all prefixes
     * e.g., "blue_hair_dress" -> ["blue_hair_dress", "blue", "hair", "dress"]
     */
    private static splitCompoundTag(tag: string): string[] {
        const results: string[] = [tag];
        const parts = tag.split('_');
        
        // Add full compound as tag
        if (parts.length > 0) {
            results.push(parts.join('_'));
        }

        return results;
    }

    /**
     * Extracts meaningful keywords from a plaintext prompt.
     * Filters out stop words and keeps words >= 2 characters.
     */
    private static extractPlaintextKeywords(text: string): string[] {
        const stopWords = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'being',
                          'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                          'could', 'should', 'may', 'might', 'can', 'need', 'to',
                          'for', 'of', 'with', 'by', 'in', 'on', 'at', 'from',
                          'into', 'through', 'during', 'before', 'after', 'above',
                          'below', 'between', 'under', 'against', 'and', 'but', 'or',
                          'if', 'than', 'so', 'because', 'when', 'where', 'how',
                          'like'];

        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s\-_]/g, ' ')  // Remove special chars except hyphen and underscore
            .split(/\s+/)
            .filter(word => 
                word.length >= 2 &&                     // At least 2 characters
                !stopWords.includes(word) &&            // Not a stop word
                !/^\d+$/.test(word) &&                  // Not purely numeric
                !word.includes('_') &&                  // No underscores in plaintext
                !word.includes('-')                     // No hyphens in plaintext
            )
            .concat(
                // Also extract words with hyphens separately
                text
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(word => word.includes('-'))
                    .map(word => word.replace(/-/g, '_'))
            );
    }

    /**
     * Extracts text from an image using OCR (placeholder - would use Tesseract.js at runtime)
     */
    public static async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
        // Temporary: return empty string
        // Will use @tesseract/tesseract.js or @popperjs/core at runtime
        return '';
    }

    /**
     * Combines prompt tags with OCR tags, deduplicating
     */
    public static combineTags(imageText: string, promptResult: TagExtractionResult): TagExtractionResult {
        const combined = new Set<string>();
        
        // Add prompt tags
        promptResult.tags.forEach(tag => combined.add(tag));
        
        // Add OCR tags
        if (imageText) {
            const ocrResult = this.extractFromPrompt(imageText);
            ocrResult.tags.forEach(tag => combined.add(tag));
        }

        return {
            rawPrompt: [promptResult.rawPrompt, imageText].filter(Boolean).join(' | '),
            tags: combined,
            sourceTags: [
                ...promptResult.sourceTags,
                ...this.extractFromPrompt(imageText).sourceTags
            ]
        };
    }
}
