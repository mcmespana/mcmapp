import {
  __resetPermissionReportsForTests,
  guardPermission,
  isPermissionDenied,
  reportIfPermissionDenied,
} from '@/utils/firebaseErrors';
import { logger } from '@/utils/logger';

describe('isPermissionDenied', () => {
  it('reconoce el `code` del SDK', () => {
    const err = Object.assign(new Error('nope'), { code: 'PERMISSION_DENIED' });
    expect(isPermissionDenied(err)).toBe(true);
  });

  it('reconoce el código dentro del mensaje, en minúsculas', () => {
    // Es la forma real que llega de RTDB en web/RN.
    const err = new Error(
      "permission_denied at /surveys/enc1: Client doesn't have permission to access the desired data.",
    );
    expect(isPermissionDenied(err)).toBe(true);
  });

  it('reconoce el code en minúsculas', () => {
    const err = Object.assign(new Error('x'), { code: 'permission_denied' });
    expect(isPermissionDenied(err)).toBe(true);
  });

  it('NO confunde un fallo de red con uno de reglas', () => {
    expect(isPermissionDenied(new Error('Network request failed'))).toBe(false);
    expect(isPermissionDenied(new Error('timeout'))).toBe(false);
    expect(isPermissionDenied(null)).toBe(false);
    expect(isPermissionDenied(undefined)).toBe(false);
  });
});

describe('reportIfPermissionDenied', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetPermissionReportsForTests();
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => errorSpy.mockRestore());

  const denied = () =>
    Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' });

  it('reporta con la marca, la operación y el path', () => {
    expect(reportIfPermissionDenied(denied(), 'write', 'surveys/enc1')).toBe(
      true,
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = String(errorSpy.mock.calls[0][0]);
    expect(message).toContain('[firebase-rules]');
    expect(message).toContain('PERMISSION_DENIED');
    expect(message).toContain('write');
    expect(message).toContain('surveys/enc1');
  });

  it('deduplica por path+operación: un despliegue malo no revienta la cuota', () => {
    for (let i = 0; i < 50; i += 1) {
      reportIfPermissionDenied(denied(), 'read', 'activities/x/evaluacion');
    }
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('distingue paths y operaciones distintas', () => {
    reportIfPermissionDenied(denied(), 'read', 'a');
    reportIfPermissionDenied(denied(), 'write', 'a');
    reportIfPermissionDenied(denied(), 'read', 'b');
    expect(errorSpy).toHaveBeenCalledTimes(3);
  });

  it('ignora los errores que no son de reglas', () => {
    expect(reportIfPermissionDenied(new Error('offline'), 'read', 'a')).toBe(
      false,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('guardPermission', () => {
  beforeEach(() => {
    __resetPermissionReportsForTests();
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('devuelve el valor cuando todo va bien', async () => {
    await expect(guardPermission('read', 'a', async () => 42)).resolves.toBe(
      42,
    );
  });

  it('devuelve null si las reglas lo deniegan', async () => {
    const run = async () => {
      throw Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' });
    };
    await expect(guardPermission('read', 'a', run)).resolves.toBeNull();
  });

  it('relanza cualquier otro error', async () => {
    const run = async () => {
      throw new Error('Network request failed');
    };
    await expect(guardPermission('read', 'a', run)).rejects.toThrow(
      'Network request failed',
    );
  });
});
