import { getImageFilename } from './filename-utils';

describe('getImageFilename', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => { });
    jest.spyOn(console, 'log').mockImplementation(() => { });
  });
  it('should return a filename with the client ID and a zero-padded index', () => {
    const index = 1;
    const expectedFilename = '1.png';
    const actualFilename = getImageFilename(index, 'png');
    expect(actualFilename).toBe(expectedFilename);
  });

  it('should handle multi-digit indices correctly', () => {
    const index = 123;
    const expectedFilename = '123.png';
    const actualFilename = getImageFilename(index, 'png');
    expect(actualFilename).toBe(expectedFilename);
  });
});