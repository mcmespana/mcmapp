import { Uniwind } from 'uniwind';
import type { ThemeScheme } from '@/contexts/AppSettingsContext';

const lightThemeVars = {
  '--color-background': '#ffffff',
  '--color-foreground': '#11181c',
  '--color-surface': '#ffffff',
  '--color-surface-foreground': '#11181c',
  '--color-surface-hover': 'rgba(17, 24, 28, 0.04)',
  '--color-overlay': '#ffffff',
  '--color-overlay-foreground': '#11181c',
  '--color-muted': '#687076',
  '--color-accent': '#253883',
  '--color-accent-foreground': '#ffffff',
  '--color-segment': '#ffffff',
  '--color-segment-foreground': '#11181c',
  '--color-border': '#e0e0e0',
  '--color-separator': '#d6d6da',
  '--color-focus': '#253883',
  '--color-link': '#253883',
  '--color-default': '#f2f2f7',
  '--color-default-foreground': '#11181c',
  '--color-success': '#a3bd31',
  '--color-success-foreground': '#11181c',
  '--color-warning': '#fcd200',
  '--color-warning-foreground': '#11181c',
  '--color-danger': '#e15c62',
  '--color-danger-foreground': '#ffffff',
  '--color-field': '#ffffff',
  '--color-field-foreground': '#11181c',
  '--color-field-placeholder': '#687076',
  '--color-field-border': '#e0e0e0',
  '--color-background-secondary': '#f5f5f7',
  '--color-background-tertiary': '#ececf0',
  '--color-background-inverse': '#11181c',
  '--color-default-hover': '#e5e6eb',
  '--color-accent-hover': '#31489f',
  '--color-success-hover': '#92ab28',
  '--color-warning-hover': '#e4bd00',
  '--color-danger-hover': '#cf5056',
  '--color-field-hover': '#f8f8fa',
  '--color-field-focus': '#ffffff',
  '--color-field-border-hover': '#cfcfd4',
  '--color-field-border-focus': '#9aa4c9',
  '--color-accent-soft': 'rgba(37, 56, 131, 0.15)',
  '--color-accent-soft-foreground': '#253883',
  '--color-accent-soft-hover': 'rgba(37, 56, 131, 0.2)',
  '--color-danger-soft': 'rgba(225, 92, 98, 0.15)',
  '--color-danger-soft-foreground': '#e15c62',
  '--color-danger-soft-hover': 'rgba(225, 92, 98, 0.2)',
  '--color-warning-soft': 'rgba(252, 210, 0, 0.18)',
  '--color-warning-soft-foreground': '#7b5c00',
  '--color-warning-soft-hover': 'rgba(252, 210, 0, 0.24)',
  '--color-success-soft': 'rgba(163, 189, 49, 0.18)',
  '--color-success-soft-foreground': '#4e6110',
  '--color-success-soft-hover': 'rgba(163, 189, 49, 0.24)',
  '--color-surface-secondary': '#f5f5f7',
  '--color-surface-tertiary': '#ececf0',
  '--color-on-surface': 'rgba(17, 24, 28, 0.04)',
  '--color-on-surface-foreground': '#11181c',
  '--color-on-surface-hover': 'rgba(17, 24, 28, 0.08)',
  '--color-on-surface-focus': 'rgba(17, 24, 28, 0.12)',
  '--color-on-surface-secondary': 'rgba(17, 24, 28, 0.08)',
  '--color-on-surface-secondary-foreground': '#11181c',
  '--color-on-surface-secondary-hover': 'rgba(17, 24, 28, 0.12)',
  '--color-on-surface-secondary-focus': 'rgba(17, 24, 28, 0.16)',
  '--color-on-surface-tertiary': 'rgba(17, 24, 28, 0.12)',
  '--color-on-surface-tertiary-foreground': '#11181c',
  '--color-on-surface-tertiary-hover': 'rgba(17, 24, 28, 0.16)',
  '--color-on-surface-tertiary-focus': 'rgba(17, 24, 28, 0.2)',
  '--color-separator-secondary': '#cfcfd4',
  '--color-separator-tertiary': '#bfc0c7',
  '--color-border-secondary': '#cfcfd4',
  '--color-border-tertiary': '#b6b8c2',
} as const;

const darkThemeVars = {
  '--color-background': '#2c2c2e',
  '--color-foreground': '#ffffff',
  '--color-surface': '#2c2c2e',
  '--color-surface-foreground': '#ffffff',
  '--color-surface-hover': 'rgba(255, 255, 255, 0.05)',
  '--color-overlay': '#2c2c2e',
  '--color-overlay-foreground': '#ffffff',
  '--color-muted': '#c5c5c7',
  '--color-accent': '#4b67d1',
  '--color-accent-foreground': '#ffffff',
  '--color-segment': '#3a3a3c',
  '--color-segment-foreground': '#ffffff',
  '--color-border': '#4a4a4d',
  '--color-separator': '#5a5a5f',
  '--color-focus': '#95d2f2',
  '--color-link': '#95d2f2',
  '--color-default': '#3a3a3c',
  '--color-default-foreground': '#ffffff',
  '--color-success': '#a3bd31',
  '--color-success-foreground': '#11181c',
  '--color-warning': '#fcd200',
  '--color-warning-foreground': '#11181c',
  '--color-danger': '#ff6b6b',
  '--color-danger-foreground': '#ffffff',
  '--color-field': '#3a3a3c',
  '--color-field-foreground': '#ffffff',
  '--color-field-placeholder': '#c5c5c7',
  '--color-field-border': '#4a4a4d',
  '--color-background-secondary': '#343437',
  '--color-background-tertiary': '#3a3a3c',
  '--color-background-inverse': '#ffffff',
  '--color-default-hover': '#4a4a4d',
  '--color-accent-hover': '#5f7bf0',
  '--color-success-hover': '#b1ca40',
  '--color-warning-hover': '#ffe14d',
  '--color-danger-hover': '#ff7f7f',
  '--color-field-hover': '#444447',
  '--color-field-focus': '#3a3a3c',
  '--color-field-border-hover': '#66666b',
  '--color-field-border-focus': '#95d2f2',
  '--color-accent-soft': 'rgba(149, 210, 242, 0.18)',
  '--color-accent-soft-foreground': '#95d2f2',
  '--color-accent-soft-hover': 'rgba(149, 210, 242, 0.24)',
  '--color-danger-soft': 'rgba(255, 107, 107, 0.18)',
  '--color-danger-soft-foreground': '#ff9d9d',
  '--color-danger-soft-hover': 'rgba(255, 107, 107, 0.24)',
  '--color-warning-soft': 'rgba(252, 210, 0, 0.2)',
  '--color-warning-soft-foreground': '#ffe14d',
  '--color-warning-soft-hover': 'rgba(252, 210, 0, 0.26)',
  '--color-success-soft': 'rgba(163, 189, 49, 0.2)',
  '--color-success-soft-foreground': '#c7dd68',
  '--color-success-soft-hover': 'rgba(163, 189, 49, 0.26)',
  '--color-surface-secondary': '#343437',
  '--color-surface-tertiary': '#3a3a3c',
  '--color-on-surface': 'rgba(255, 255, 255, 0.08)',
  '--color-on-surface-foreground': '#ffffff',
  '--color-on-surface-hover': 'rgba(255, 255, 255, 0.12)',
  '--color-on-surface-focus': 'rgba(255, 255, 255, 0.16)',
  '--color-on-surface-secondary': 'rgba(255, 255, 255, 0.12)',
  '--color-on-surface-secondary-foreground': '#ffffff',
  '--color-on-surface-secondary-hover': 'rgba(255, 255, 255, 0.16)',
  '--color-on-surface-secondary-focus': 'rgba(255, 255, 255, 0.2)',
  '--color-on-surface-tertiary': 'rgba(255, 255, 255, 0.16)',
  '--color-on-surface-tertiary-foreground': '#ffffff',
  '--color-on-surface-tertiary-hover': 'rgba(255, 255, 255, 0.2)',
  '--color-on-surface-tertiary-focus': 'rgba(255, 255, 255, 0.24)',
  '--color-separator-secondary': '#66666b',
  '--color-separator-tertiary': '#7a7a80',
  '--color-border-secondary': '#66666b',
  '--color-border-tertiary': '#7a7a80',
} as const;

/*
 * Modo CARISMOCHITO (easter egg): tiñe la familia de colores "de marca" de
 * heroui-native con varios verdes distintos, reutilizando el mismo mecanismo
 * de variables CSS que usa el modo claro/oscuro. Se aplica fusionando estos
 * overrides sobre el mapa base de cada esquema, así no se pierde ninguna
 * variable. Al salir se restaura el mapa base.
 */
const carismochitoOverridesLight = {
  '--color-accent': '#1b9e4b',
  '--color-accent-foreground': '#ffffff',
  '--color-accent-hover': '#16823e',
  '--color-accent-soft': 'rgba(27, 158, 75, 0.15)',
  '--color-accent-soft-foreground': '#15823c',
  '--color-accent-soft-hover': 'rgba(27, 158, 75, 0.22)',
  '--color-focus': '#1b9e4b',
  '--color-link': '#1b9e4b',
  '--color-success': '#7ac943',
  '--color-success-foreground': '#11321a',
  '--color-success-hover': '#6bb838',
  '--color-success-soft': 'rgba(122, 201, 67, 0.2)',
  '--color-success-soft-foreground': '#3f6110',
  '--color-danger': '#2bb673',
  '--color-danger-foreground': '#ffffff',
  '--color-danger-hover': '#23a165',
  '--color-danger-soft': 'rgba(43, 182, 115, 0.16)',
  '--color-danger-soft-foreground': '#1c7a4d',
  '--color-warning': '#aecf2f',
  '--color-warning-foreground': '#11321a',
} as const;

const carismochitoOverridesDark = {
  '--color-accent': '#27c25c',
  '--color-accent-foreground': '#06210f',
  '--color-accent-hover': '#33d268',
  '--color-accent-soft': 'rgba(39, 194, 92, 0.2)',
  '--color-accent-soft-foreground': '#8de8a8',
  '--color-accent-soft-hover': 'rgba(39, 194, 92, 0.26)',
  '--color-focus': '#27c25c',
  '--color-link': '#7ee29a',
  '--color-success': '#8edb52',
  '--color-success-foreground': '#06210f',
  '--color-success-hover': '#9fe863',
  '--color-danger': '#2fd189',
  '--color-danger-foreground': '#06210f',
  '--color-danger-hover': '#3fe098',
  '--color-warning': '#c4e25a',
  '--color-warning-foreground': '#06210f',
} as const;

let runtimeThemeRegistered = false;

export function registerHeroUIRuntimeTheme() {
  if (runtimeThemeRegistered) {
    return;
  }

  Uniwind.updateCSSVariables('light', lightThemeVars);
  Uniwind.updateCSSVariables('dark', darkThemeVars);
  runtimeThemeRegistered = true;
}

export function syncHeroUITheme(theme: ThemeScheme) {
  registerHeroUIRuntimeTheme();
  Uniwind.setTheme(theme);
}

/**
 * Activa (`true`) o restaura (`false`) la paleta verde del modo carismochito
 * sobre la capa de componentes heroui-native. Reactivo, sin recargar nada.
 */
export function setCarismochitoTheme(active: boolean) {
  registerHeroUIRuntimeTheme();
  if (active) {
    Uniwind.updateCSSVariables('light', {
      ...lightThemeVars,
      ...carismochitoOverridesLight,
    });
    Uniwind.updateCSSVariables('dark', {
      ...darkThemeVars,
      ...carismochitoOverridesDark,
    });
  } else {
    Uniwind.updateCSSVariables('light', lightThemeVars);
    Uniwind.updateCSSVariables('dark', darkThemeVars);
  }
}
