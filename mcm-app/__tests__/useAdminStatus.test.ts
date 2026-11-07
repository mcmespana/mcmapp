/**
 * Tests de `useAdminStatus`: el flag `isAdmin` viene SIEMPRE de
 * `users/{uid}/isAdmin` en RTDB — nunca de estado local ni de la
 * contraseña del panel secreto. Lo importante:
 *
 *  - Sin sesión (o mientras `AuthContext` sigue cargando), no es admin y no
 *    se suscribe a nada.
 *  - Al cambiar de usuario, el resultado del uid anterior deja de contar
 *    inmediatamente (vuelve a `loading: true`) en vez de arrastrar un
 *    `isAdmin: true` de otra cuenta hasta que llegue la primera respuesta
 *    del nuevo uid — esa rendija de seguridad es la razón de ser del hook.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { onValue } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminStatus } from '@/hooks/useAdminStatus';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

let onSuccess: ((snap: { val: () => unknown }) => void) | null = null;
let onError: (() => void) | null = null;
let unsub: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  onSuccess = null;
  onError = null;
  unsub = jest.fn();
  (onValue as jest.Mock).mockImplementation((_ref, next, error) => {
    onSuccess = next;
    onError = error;
    return unsub;
  });
});

describe('sin sesión / cargando', () => {
  it('mientras AuthContext carga, loading=true y no se suscribe', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, loading: true });
    const { result } = await renderHook(() => useAdminStatus());
    expect(result.current.loading).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(onValue).not.toHaveBeenCalled();
  });

  it('sin usuario y ya resuelto, no es admin y no se suscribe', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, loading: false });
    const { result } = await renderHook(() => useAdminStatus());
    expect(result.current.loading).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(onValue).not.toHaveBeenCalled();
  });
});

describe('con sesión', () => {
  it('se suscribe a users/{uid}/isAdmin y refleja true', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'u1' },
      loading: false,
    });
    const { result } = await renderHook(() => useAdminStatus());
    expect(result.current.loading).toBe(true);
    await act(async () => onSuccess!({ val: () => true }));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('cualquier valor que no sea exactamente true cuenta como no-admin', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'u1' },
      loading: false,
    });
    const { result } = await renderHook(() => useAdminStatus());
    await act(async () => onSuccess!({ val: () => 'true' }));
    expect(result.current.isAdmin).toBe(false);
  });

  it('un error de la suscripción resuelve a no-admin, no se queda cargando', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'u1' },
      loading: false,
    });
    const { result } = await renderHook(() => useAdminStatus());
    await act(async () => onError!());
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('se desuscribe al desmontar', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'u1' },
      loading: false,
    });
    const { unmount } = await renderHook(() => useAdminStatus());
    await unmount();
    expect(unsub).toHaveBeenCalled();
  });
});

describe('cambio de usuario', () => {
  it('el resultado del uid anterior no cuenta para el nuevo (vuelve a loading)', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'u1' },
      loading: false,
    });
    const { result, rerender } = await renderHook(() => useAdminStatus());
    await act(async () => onSuccess!({ val: () => true }));
    expect(result.current.isAdmin).toBe(true);

    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'u2' },
      loading: false,
    });
    await rerender({});

    // El u1 ya no cuenta: mientras no llega la respuesta de u2, ni loading
    // ni isAdmin pueden seguir reflejando la cuenta anterior.
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.loading).toBe(true);

    await act(async () => onSuccess!({ val: () => false }));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});
