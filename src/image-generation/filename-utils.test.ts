import { getImageFilename, getDomainPath } from './filename-utils';
import { COMFYUI_CONFIG } from '../config/constants';

// Mock the logger to prevent console output during tests
jest.mock('../config/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('getImageFilename', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return a filename with format promptId_index.extension', () => {
    // Arrange
    const promptId = 'test-prompt-id';
    const index = 1;
    const extension = 'png';
    const expectedFilename = `${promptId}_${index}.${extension}`;

    // Act
    const filename = getImageFilename(promptId, index, extension);

    // Assert
    expect(filename).toBe(expectedFilename);
  });

  it('should handle multi-digit indices correctly', () => {
    // Arrange
    const promptId = 'test-prompt-id';
    const index = 123;
    const extension = 'png';
    const expectedFilename = `${promptId}_${index}.${extension}`;

    // Act
    const filename = getImageFilename(promptId, index, extension);

    // Assert
    expect(filename).toBe(expectedFilename);
  });

  it('should handle different file extensions', () => {
    // Arrange
    const promptId = 'test-prompt-id';
    const index = 5;
    const extension = 'jpg';
    const expectedFilename = `${promptId}_${index}.${extension}`;

    // Act
    const filename = getImageFilename(promptId, index, extension);

    // Assert
    expect(filename).toBe(expectedFilename);
  });

  it('should generate unique filenames for sequential calls with different indices', () => {
    // Arrange
    const promptId = 'test-prompt-id';
    const index1 = 1;
    const index2 = 2;
    const extension = 'png';

    // Act
    const filename1 = getImageFilename(promptId, index1, extension);
    const filename2 = getImageFilename(promptId, index2, extension);

    // Assert
    expect(filename1).not.toBe(filename2);
    expect(filename1).toBe(`${promptId}_1.png`);
    expect(filename2).toBe(`${promptId}_2.png`);
  });
});

describe('getDomainPath', () => {
  const originalDomainPath = COMFYUI_CONFIG.DOMAIN_PATH;
  const originalFolderPath = COMFYUI_CONFIG.FOLDER_PATH;

  beforeEach(() => {
    jest.resetAllMocks();
    // Reset config to known state
    (COMFYUI_CONFIG as any).DOMAIN_PATH = 'https://example.com/images/';
    (COMFYUI_CONFIG as any).FOLDER_PATH = '/var/comfyui/output/';
  });

  afterEach(() => {
    // Restore original config
    (COMFYUI_CONFIG as any).DOMAIN_PATH = originalDomainPath;
    (COMFYUI_CONFIG as any).FOLDER_PATH = originalFolderPath;
  });

  it('should return domain path with filename extracted from filepath', () => {
    // Arrange
    const filepath = '/var/comfyui/output/test-prompt-id_1.png';
    const expectedUrl = 'https://example.com/images/test-prompt-id_1.png';

    // Act
    const result = getDomainPath(filepath);

    // Assert
    expect(result).toBe(expectedUrl);
  });

  it('should handle filepath with multiple directory separators', () => {
    // Arrange
    const filepath = '/path/to/nested/directory/image.jpg';
    const expectedUrl = 'https://example.com/images/image.jpg';

    // Act
    const result = getDomainPath(filepath);

    // Assert
    expect(result).toBe(expectedUrl);
  });

  it('should throw error when DOMAIN_PATH is not configured', () => {
    // Arrange
    (COMFYUI_CONFIG as any).DOMAIN_PATH = '';
    const filepath = '/some/path/file.png';
    const expectedError = 'Domain path not configured.';

    // Act & Assert
    expect(() => {
      getDomainPath(filepath);
    }).toThrow(expectedError);
  });

  it('should throw error when FOLDER_PATH is not configured', () => {
    // Arrange
    (COMFYUI_CONFIG as any).FOLDER_PATH = '';
    const filepath = '/some/path/file.png';
    const expectedError = 'Folder path not configured.';

    // Act & Assert
    expect(() => {
      getDomainPath(filepath);
    }).toThrow(expectedError);
  });

  it('should handle filepath with no directory separators', () => {
    // Arrange
    const filepath = 'image.png';
    const expectedUrl = 'https://example.com/images/image.png';

    // Act
    const result = getDomainPath(filepath);

    // Assert
    expect(result).toBe(expectedUrl);
  });
});