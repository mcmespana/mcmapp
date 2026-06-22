import { logger, setReporter } from '@/utils/logger';

type DevGlobal = { __DEV__?: boolean };

describe('logger', () => {
  const dev = globalThis as DevGlobal;
  const originalDev = dev.__DEV__;

  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setReporter(null);
    dev.__DEV__ = originalDev;
  });

  describe('en desarrollo (__DEV__ = true)', () => {
    beforeEach(() => {
      dev.__DEV__ = true;
    });

    it('imprime debug/info/log', () => {
      logger.debug('a');
      logger.info('b');
      logger.log('c');
      expect(debugSpy).toHaveBeenCalledWith('a');
      expect(infoSpy).toHaveBeenCalledWith('b');
      expect(logSpy).toHaveBeenCalledWith('c');
    });
  });

  describe('en producción (__DEV__ = false)', () => {
    beforeEach(() => {
      dev.__DEV__ = false;
    });

    it('silencia debug/info/log', () => {
      logger.debug('a');
      logger.info('b');
      logger.log('c');
      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('sigue imprimiendo warn/error', () => {
      logger.warn('w');
      logger.error('e');
      expect(warnSpy).toHaveBeenCalledWith('w');
      expect(errorSpy).toHaveBeenCalledWith('e');
    });
  });

  describe('reporter', () => {
    it('reenvía warn/error al reporter configurado', () => {
      const reporter = { warn: jest.fn(), error: jest.fn() };
      setReporter(reporter);
      logger.warn('w', 1);
      logger.error('e', 2);
      expect(reporter.warn).toHaveBeenCalledWith('w', 1);
      expect(reporter.error).toHaveBeenCalledWith('e', 2);
    });

    it('no reenvía debug/info/log al reporter', () => {
      const reporter = { warn: jest.fn(), error: jest.fn() };
      setReporter(reporter);
      dev.__DEV__ = true;
      logger.debug('a');
      logger.info('b');
      logger.log('c');
      expect(reporter.warn).not.toHaveBeenCalled();
      expect(reporter.error).not.toHaveBeenCalled();
    });

    it('no falla si el reporter no implementa los métodos', () => {
      setReporter({});
      expect(() => {
        logger.warn('w');
        logger.error('e');
      }).not.toThrow();
    });
  });
});
