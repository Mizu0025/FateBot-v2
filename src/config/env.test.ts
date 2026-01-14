import { cleanEnv, str, port } from 'envalid';

describe('env validation', () => {
  it('validates all required variables and applies defaults', () => {
    // arrange
    const inputEnv = {
      SERVER: 'testserver',
      PORT: '1234',
    };
    const validators = {
      SERVER: str({ default: 'hayate' }),
      PORT: port({ default: 6667 }),
    };

    // act
    const env = cleanEnv(inputEnv, validators);

    // assert
    expect(env.SERVER).toBe('testserver');
    expect(env.PORT).toBe(1234);
  });

  it('uses defaults when variables are missing', () => {
    // arrange
    const inputEnv = {};
    const validators = {
      SERVER: str({ default: 'hayate' }),
      PORT: port({ default: 6667 }),
    };

    // act
    const env = cleanEnv(inputEnv, validators);

    // assert
    expect(env.SERVER).toBe('hayate');
    expect(env.PORT).toBe(6667);
  });

  it('throws on invalid types', () => {
    // arrange
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    // act & assert
    expect(() => {
      cleanEnv({ PORT: 'notanumber' }, { PORT: port() });
    }).toThrow();
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
