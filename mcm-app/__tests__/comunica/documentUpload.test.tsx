/**
 * Subir títulos y certificados (plan 09, tarea 6), con el selector simulado y
 * el servidor falso de verdad:
 *
 *   · Lo grande o HEIC se rechaza ANTES de subir (y se borra su copia).
 *   · Lo que vale sube en el acto, pone «Ya subido» en la ficha y borra la
 *     copia local.
 *   · Sin conexión, «no se ha subido» y «Reintentar» con el mismo `clientId`.
 *   · Salir borra las copias de lo que quedara y lo en vuelo ya no escribe.
 *   · Guardarraíles: los archivos no pasan por la cola; solo el adaptador
 *     carga `expo-file-system`; ni `yo/` ni `comun/form/` suben por su cuenta.
 */
/* eslint-disable import/first */
import fs from 'fs';
import path from 'path';
import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockDelete = jest.fn();
jest.mock('@/services/comunica/localFiles', () => ({
  deleteLocalCopy: (uri: string) => mockDelete(uri),
  localFileSize: () => null,
}));
const mockGetDocument = jest.fn();
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (o: unknown) => mockGetDocument(o),
}));
const mockLibrary = jest.fn();
const mockCamera = jest.fn();
const mockCameraPerm = jest.fn(async () => ({ granted: true }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (o: unknown) => mockLibrary(o),
  launchCameraAsync: (o: unknown) => mockCamera(o),
  requestCameraPermissionsAsync: () => mockCameraPerm(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));
jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
  },
}));

import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type { FakeServer } from '@/services/comunica/fake';
import {
  __resetSessionForTests,
  signIn,
  signOut,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { clearUploads, getUpload } from '@/services/comunica/uploads';
import type {
  DocumentKind,
  MonitorProfile,
} from '@/services/comunica/contract';
import { areaKey } from '@/hooks/comunica/useAreaQuery';
import { useDocumentUpload } from '@/hooks/comunica/useDocumentUpload';
import { MONITOR_PROFILE_KEY } from '@/hooks/comunica/useMonitorProfile';
import { DOCUMENT_MAX_BYTES } from '@/utils/comunica/monitorProfile';

const ROOT = path.join(__dirname, '..', '..');
const wait = (ms = 20) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

type Hook = ReturnType<typeof useDocumentUpload>;

async function setup(kind: DocumentKind = 'sex_offence_certificate') {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(memoryBackend());
  getComunicaApi();
  const fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0 });
  const s = fake.issueSession('monitor');
  await signIn(s, s.me);
  const qc = new QueryClient();
  qc.setQueryData(
    areaKey([...MONITOR_PROFILE_KEY]),
    await getComunicaApi().getMyMonitorProfile(),
  );
  const probe: { hook: Hook | null } = { hook: null };
  function Probe() {
    const hook = useDocumentUpload(kind);
    useEffect(() => {
      probe.hook = hook;
    });
    return null;
  }
  await act(async () => {
    create(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return { fake, qc, probe };
}

const doc = (name: string, size: number, mimeType: string) => ({
  canceled: false,
  assets: [
    { uri: `file:///cache/DocumentPicker/${name}`, name, size, mimeType },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  clearUploads();
});
afterEach(() => {
  __resetComunicaApiForTests();
  __resetSessionForTests();
});

describe('subir un archivo', () => {
  it('lo de más de 4 MB y una foto HEIC no se suben', async () => {
    const { fake, probe } = await setup();
    mockGetDocument.mockResolvedValueOnce(
      doc('cert.pdf', DOCUMENT_MAX_BYTES + 1, 'application/pdf'),
    );
    await act(async () => probe.hook!.choose('file'));
    expect(probe.hook!.problem).toBe('Ese archivo pesa más de 4 MB.');
    expect(mockDelete).toHaveBeenCalledWith(
      'file:///cache/DocumentPicker/cert.pdf',
    );
    mockLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/ImagePicker/IMG_1.HEIC',
          fileName: 'IMG_1.HEIC',
          fileSize: 1000,
          mimeType: 'image/heic',
        },
      ],
    });
    await act(async () => probe.hook!.choose('library'));
    expect(probe.hook!.problem).toBe('Tiene que ser PDF, JPG o PNG.');
    expect(fake.uploads()).toEqual([]);
    expect(probe.hook!.upload).toBeNull();
  });

  it('lo que vale sube, marca «Ya subido» y borra la copia', async () => {
    const { fake, qc, probe } = await setup();
    mockCamera.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/ImagePicker/foto.jpg',
          fileName: null,
          fileSize: 200_000,
          mimeType: 'image/jpeg',
        },
      ],
    });
    await act(async () => probe.hook!.choose('camera'));
    await wait();
    expect(probe.hook!.upload).toMatchObject({
      name: 'certificado-delitos-sexuales.jpg',
      state: 'applied',
    });
    expect(fake.uploads()).toEqual([
      expect.objectContaining({
        kind: 'sex_offence_certificate',
        mimeType: 'image/jpeg',
        size: 200_000,
      }),
    ]);
    expect(
      qc.getQueryData<MonitorProfile>(areaKey([...MONITOR_PROFILE_KEY]))!.files
        .sexOffenceCertificate,
    ).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith(
      'file:///cache/ImagePicker/foto.jpg',
    );
  });

  it('sin permiso de cámara lo dice; cancelar no hace nada', async () => {
    const { probe } = await setup();
    mockCameraPerm.mockResolvedValueOnce({ granted: false });
    await act(async () => probe.hook!.choose('camera'));
    expect(probe.hook!.problem).toMatch(/permiso a la cámara/);
    mockGetDocument.mockResolvedValueOnce({ canceled: true, assets: null });
    await act(async () => probe.hook!.choose('file'));
    expect(probe.hook!.problem).toBeNull();
    expect(probe.hook!.upload).toBeNull();
  });

  it('sin conexión no sube; «Reintentar» va con el mismo clientId', async () => {
    const { fake, probe } = await setup('mat');
    fake.setControls({ offline: true });
    mockGetDocument.mockResolvedValueOnce(
      doc('mat.pdf', 1000, 'application/pdf'),
    );
    await act(async () => probe.hook!.choose('file'));
    await wait();
    expect(probe.hook!.upload).toMatchObject({ state: 'failed' });
    expect(probe.hook!.upload!.message).toMatch(/Sin conexión/);
    // La copia sigue mientras se pueda reintentar.
    expect(mockDelete).not.toHaveBeenCalled();
    const clientId = getUpload('mat')!.clientId;
    fake.setControls({ offline: false });
    await act(async () => probe.hook!.retry());
    await wait();
    expect(getUpload('mat')).toMatchObject({ clientId, phase: 'applied' });
    expect(fake.uploads()).toHaveLength(1);
  });

  it('salir borra las copias y lo que vuelva después no escribe', async () => {
    const { fake, probe } = await setup('dat');
    fake.setControls({ latencyMs: 200 });
    mockGetDocument.mockResolvedValueOnce(
      doc('dat.pdf', 1000, 'application/pdf'),
    );
    await act(async () => probe.hook!.choose('file'));
    expect(probe.hook!.uploading).toBe(true);
    await act(async () => {
      await signOut();
    });
    expect(mockDelete).toHaveBeenCalledWith(
      'file:///cache/DocumentPicker/dat.pdf',
    );
    expect(getUpload('dat')).toBeUndefined();
    await wait(300);
    expect(getUpload('dat')).toBeUndefined();
  });
});

describe('guardarraíles de los archivos', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const walk = (dir: string): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) return walk(p);
          return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
        })
      : [];
  const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

  it('los archivos no pasan por la cola del móvil', () => {
    const src = read('services/comunica/uploads.ts');
    expect(src).not.toMatch(/from '\.\/outbox'/);
    expect(read('hooks/comunica/useDocumentUpload.ts')).not.toMatch(
      /useOutbox|enqueue/,
    );
  });

  it('solo los adaptadores (copias locales y archivos de eventos) cargan expo-file-system en el área, y tienen su .web', () => {
    const users = [
      'app/(tabs)/comunica',
      'components/comunica',
      'hooks/comunica',
      'services/comunica',
      'utils/comunica',
    ]
      .flatMap((d) => walk(path.join(ROOT, d)))
      .filter((f) => /from 'expo-file-system/.test(fs.readFileSync(f, 'utf8')))
      .map(rel);
    expect(users).toEqual([
      'services/comunica/eventFiles.ts',
      'services/comunica/localFiles.ts',
    ]);
    for (const web of [
      'services/comunica/localFiles.web.ts',
      'services/comunica/eventFiles.web.ts',
    ])
      expect(read(web)).not.toMatch(/expo-file-system'/);
  });

  it('ni yo/ ni comun/form/ suben nada por su cuenta', () => {
    const files = [
      ...walk(path.join(ROOT, 'components/comunica/yo')),
      ...walk(path.join(ROOT, 'components/comunica/comun/form')),
    ];
    expect(files.length).toBeGreaterThan(0);
    const offenders = files
      .filter((f) =>
        /\bfetch\s*\(|getComunicaApi|uploadMyDocument|FormData|expo-(image|document)-picker/.test(
          fs.readFileSync(f, 'utf8'),
        ),
      )
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
