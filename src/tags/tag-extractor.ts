import keywordExtractor, { Options } from 'keyword-extractor';

const DANBOORU_DELIMITERS = /[,\\s]+/;
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
    'while', 'who', 'how', 'what', 'where', 'why', 'can', 'will', 'shall',
    'should', 'would', 'could', 'might', 'may', 'must', 'need', 'used',
    'dare', 'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'has', 'have', 'had',
    'do', 'does', 'did', 'will', 'shall', 'can', 'could', 'would', 'should',
    'may', 'might', 'must', 'need', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'against', 'another', 'also',
    'because', 'being', 'but', 'each', 'few', 'for', 'from', 'further', 'had',
    'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
    'his', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
    'might', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on',
    'or', 'other', 'our', 'ours', 'ourselves', 'out', 'own', 'same', 'she', 'should',
    'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves',
    'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
    'until', 'up', 'us', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
    'while', 'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours',
    'yourself', 'yourselves'
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
            // Plaintext: extract meaningful words using keyword-extractor
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
        const words = text.split(/\\s+/);
        const camelWords = words.filter(w =>
            w.length >= 3 &&
            w.match(/[a-z]+[A-Z]/) &&
            !PLAINTEXT_STOP_WORDS.has(w.toLowerCase())
        );
        return camelWords.length > 2;
    }

    /**
     * Splits a compound tag by underscore, returning full tag and all sub-tags
     * e.g., "blue_hair_dress" -> ["blue", "blue_hair", "blue_hair_dress", "hair", "hair_dress", "dress"]
     */
    private static splitCompoundTag(tag: string): string[] {
        const results: string[] = [tag];
        const parts = tag.split('_');

        // Add all prefixes (blue, blue_hair)
        for (let i = 1; i < parts.length; i++) {
            results.push(parts.slice(0, i + 1).join('_'));
        }

        // Add all individual parts
        for (const part of parts) {
            results.push(part);
        }

        return results;
    }

    /**
     * Extracts meaningful keywords from a plaintext prompt.
     * Uses keyword-extractor for English text, filters out stop words and keeps words >= 2 characters.
     */
    private static extractPlaintextKeywords(text: string): string[] {
        // Use keyword-extractor for English text
        const extractorOptions: Options = {
            language: 'english',
            ignorePunctuation: true,
            removeDuplicateWords: true,
            maxKeywords: 50
        };

        const extractedKeywords = keywordExtractor(text, extractorOptions);

        // Filter and normalize the keywords
        const stopWords = new Set([
            'i', 'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'can', 'need', 'to',
            'for', 'of', 'with', 'by', 'in', 'on', 'at', 'from',
            'into', 'through', 'during', 'before', 'after', 'above',
            'below', 'between', 'under', 'against', 'and', 'but', 'or',
            'if', 'than', 'so', 'because', 'when', 'where', 'how',
            'like'
        ]);

        return extractedKeywords
            .map(word => word.toLowerCase())
            .filter(word =>
                word.length >= 2 &&                   // At least 2 characters
                !stopWords.has(word) &&               // Not a stop word
                !/^\\d+$/.test(word) &&               // Not purely numeric
                !word.includes('_') &&               // No underscores in plaintext
                !word.includes('-')                  // No hyphens in plaintext
            )
            .concat(
                // Also extract words with hyphens separately
                text
                    .toLowerCase()
                    .split(/\\s+/)
                    .filter(word => word.includes('-'))
                    .map(word => word.replace(/-/g, '_'))
            );
    }

    /**
     * Extracts text from an image (placeholder - would use OCR at runtime)
     */
    public static async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
        // Temporary: return empty string
        // Will use Tesseract.js or similar at runtime
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
