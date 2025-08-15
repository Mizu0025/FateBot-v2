import { getImageFilename } from './filename-utils';

describe('getImageFilename', () => {
  it('should return a filename with the client ID and a zero-padded index', () => {
    const clientId = 'test-client';
    const index = 1;
    const expectedFilename = 'test-client_001.png';
    const actualFilename = getImageFilename(clientId, index);
    expect(actualFilename).toBe(expectedFilename);
  });

  it('should handle multi-digit indices correctly', () => {
    const clientId = 'test-client';
    const index = 123;
    const expectedFilename = 'test-client_123.png';
    const actualFilename = getImageFilename(clientId, index);
    expect(actualFilename).toBe(expectedFilename);
  });
});
