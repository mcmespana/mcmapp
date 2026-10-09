import {
  CANTORAL_ONBOARDING_VERSION,
  FALLBACK_PREVIEW,
  hasRepeatedChorus,
  onboardingSteps,
  pickPreviewSong,
  previewScore,
  shouldAutoOpenOnboarding,
} from '@/utils/cantoralOnboarding';

const CHORUS = `{soc}
[C]Seas quien seas y como [G]seas
[F]esta es tu [C]casa, acérca[G]te.
{eoc}`;

const GOOD = `{title: Buena}
Hay muchas [C]formas de o[G]rar, tan[Am]tas como per[Em]sonas
nos reu[F]nimos a la [C]mesa y cele[F]bramos [G]juntas.
Si le[C]vantas la mi[G]rada, ver[Am]ás a quien te ro[Em]dea.
Abre el [F]corazón.

${CHORUS}

Porque [C]juntas somos [G]más.
El Es[C]píritu nos [F]llena.
Ningún [C]cabo está [G]suelto.
Él nos [F]llama todo el [C]tiempo.

${CHORUS}
`;

describe('onboardingSteps', () => {
  it('sin etiquetas no pregunta por ellas', () => {
    expect(onboardingSteps({ hasTags: false })).toEqual([
      'role',
      'repeats',
      'chorus',
      'text',
    ]);
  });
  it('con etiquetas, las deja para el final', () => {
    expect(onboardingSteps({ hasTags: true }).at(-1)).toBe('tags');
  });
});

describe('shouldAutoOpenOnboarding', () => {
  it('se abre solo si no se ha visto esta versión', () => {
    expect(shouldAutoOpenOnboarding(0, false)).toBe(true);
    expect(shouldAutoOpenOnboarding(undefined, false)).toBe(true);
    expect(shouldAutoOpenOnboarding(CANTORAL_ONBOARDING_VERSION, false)).toBe(
      false,
    );
  });
  it('nunca mientras cargan los ajustes (sabríamos si ya se vio)', () => {
    expect(shouldAutoOpenOnboarding(0, true)).toBe(false);
  });
});

describe('hasRepeatedChorus', () => {
  it('dos {soc} con la misma letra (aunque cambien los acordes)', () => {
    const other = CHORUS.replace('[G]seas', '[Am]seas');
    expect(hasRepeatedChorus(`${CHORUS}\n\n${other}`)).toBe(true);
  });
  it('un {chorus} cuenta como repetición', () => {
    expect(hasRepeatedChorus(`${CHORUS}\n\n{chorus}`)).toBe(true);
  });
  it('dos estribillos distintos no son una repetición', () => {
    const other = `{soc}\n[D]Es tu [A]paz una huella\n{eoc}`;
    expect(hasRepeatedChorus(`${CHORUS}\n\n${other}`)).toBe(false);
  });
});

describe('previewScore', () => {
  it('vale una canción corta con estrofas, acordes y estribillo repetido', () => {
    expect(previewScore(GOOD)).toBeGreaterThan(0);
  });
  it('no vale sin estribillo repetido, ni con acordes por revisar', () => {
    expect(previewScore(GOOD.replace(/\{soc\}|\{eoc\}/g, ''))).toBe(0);
    expect(previewScore(`{c: REVISAR ACORDES}\n${GOOD}`)).toBe(0);
  });
});

describe('pickPreviewSong', () => {
  it('prefiere las canciones de la lista', () => {
    const data = {
      entrada: {
        songs: [
          { filename: 'otra.cho', title: '02. Otra', content: GOOD },
          {
            filename: '17.seas_quien_seas.cho',
            title: '17. Seas Quien Seas',
            author: 'TSNC',
            key: 'C',
            capo: '2',
            content: GOOD,
          },
        ],
      },
    };
    expect(pickPreviewSong(data)).toEqual({
      content: GOOD,
      title: 'Seas Quien Seas',
      author: 'TSNC',
      key: 'C',
      capo: 2,
    });
  });
  it('si no están, la que mejor enseña cada opción', () => {
    const data = {
      a: { songs: [{ filename: 'mala.cho', content: 'Una línea' }] },
      b: {
        songs: [{ filename: 'buena.cho', title: '3. Buena', content: GOOD }],
      },
    };
    expect(pickPreviewSong(data)?.title).toBe('Buena');
  });
  it('sin ninguna que valga, la de muestra (que sí tiene de todo)', () => {
    const song = pickPreviewSong({ a: { songs: [] } });
    expect(song?.content).toBe(FALLBACK_PREVIEW);
    expect(hasRepeatedChorus(FALLBACK_PREVIEW)).toBe(true);
  });
  it('sin datos, nada', () => {
    expect(pickPreviewSong(null)).toBeNull();
  });
});
