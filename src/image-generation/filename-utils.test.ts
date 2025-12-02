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

  it('should return a filename with timestamp format YYYY-MM-DD_HHMMSS_index.extension', () => {
    // Arrange
    const index = 1;
    const extension = 'png';
    const pattern = /^\d{4}-\d{2}-\d{2}_\d{6}_\d+\.png$/;

    // Act
    const filename = getImageFilename(index, extension);

    // Assert
    expect(filename).toMatch(pattern);
    expect(filename).toContain(`_${index}.${extension}`);
  });

  it('should handle multi-digit indices correctly', () => {
    // Arrange
    const index = 123;
    const extension = 'png';
    const pattern = /^\d{4}-\d{2}-\d{2}_\d{6}_123\.png$/;

    // Act
    const filename = getImageFilename(index, extension);

    // Assert
    expect(filename).toMatch(pattern);
    expect(filename).toContain(`_${index}.${extension}`);
  });

  it('should handle different file extensions', () => {
    // Arrange
    const index = 5;
    const extension = 'jpg';
    const expectedPattern = /^\d{4}-\d{2}-\d{2}_\d{6}_5\.jpg$/;
    const extensionPattern = new RegExp(`\\.${extension}$`);

    // Act
    const filename = getImageFilename(index, extension);

    // Assert
    expect(filename).toMatch(expectedPattern);
    expect(filename).toMatch(extensionPattern);
  });

  it('should generate unique filenames for sequential calls', () => {
    // Arrange
    const index1 = 1;
    const index2 = 2;
    const extension = 'png';

    // Act
    const filename1 = getImageFilename(index1, extension);
    const filename2 = getImageFilename(index2, extension);

    // Assert
    expect(filename1).not.toBe(filename2);
    expect(filename1).toContain('_1.png');
    expect(filename2).toContain('_2.png');
  });

  it('should use current date and time in filename', () => {
    // Arrange
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const expectedDatePrefix = `${year}-${month}-${day}`;

    // Act
    const filename = getImageFilename(0, 'png');

    // Assert
    expect(filename).toContain(expectedDatePrefix);
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
    const filepath = '/var/comfyui/output/2024-12-02_123456_1.png';
    const expectedUrl = 'https://example.com/images/2024-12-02_123456_1.png';

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