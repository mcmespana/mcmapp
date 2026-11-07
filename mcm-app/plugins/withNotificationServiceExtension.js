/**
 * Config plugin: Notification Service Extension de iOS.
 *
 * La app es "managed": no hay carpeta `ios/` en el repo, la genera `prebuild`
 * en cada build. Por eso un target nuevo de Xcode no se puede añadir a mano —
 * hay que crearlo con código en cada prebuild, y eso es lo que hace esto.
 *
 * Qué monta, en orden:
 *   1. Copia `targets/notification-service/` a `ios/MCMNotificationService/`.
 *   2. Crea el target `MCMNotificationService` de tipo `app_extension`. El
 *      paquete `xcode` ya se encarga, para ese tipo, de crear la fase "Copy
 *      Files" que EMPOTRA la extensión dentro del .app y de añadir la
 *      dependencia del target principal (sin eso, la extensión se compila pero
 *      no viaja en el binario).
 *   3. Le pone sus fases de build y los ajustes que no puede adivinar
 *      (bundle id, Info.plist, versión de Swift, equipo de firma…).
 *
 * ⚠️ **Credenciales**: la extensión es un bundle id NUEVO
 * (`<app>.MCMNotificationService`) y necesita su propio perfil de
 * aprovisionamiento. EAS lo detecta y lo crea solo, pero la primera vez
 * PREGUNTA por terminal: no lances ese build y te vayas.
 */

const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TARGET_NAME = 'MCMNotificationService';
const SOURCE_DIR = path.join('targets', 'notification-service');
const SWIFT_FILE = 'NotificationService.swift';
const PLIST_FILE = `${TARGET_NAME}-Info.plist`;
/** Fallback si no se puede leer el del target principal. */
const FALLBACK_DEPLOYMENT_TARGET = '15.1';

/** Copia los fuentes de la extensión dentro del proyecto iOS generado. */
function withExtensionSources(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const from = path.join(projectRoot, SOURCE_DIR);
      const to = path.join(platformRoot, TARGET_NAME);

      fs.mkdirSync(to, { recursive: true });
      for (const file of [SWIFT_FILE, PLIST_FILE]) {
        const source = path.join(from, file);
        if (!fs.existsSync(source)) {
          throw new Error(
            `[withNotificationServiceExtension] falta ${path.join(SOURCE_DIR, file)}`,
          );
        }
        fs.copyFileSync(source, path.join(to, file));
      }
      return cfg;
    },
  ]);
}

/** Lee el deployment target del target principal para no desalinearlos. */
function mainDeploymentTarget(project) {
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configurations)) {
    const settings = configurations[key]?.buildSettings;
    if (settings?.IPHONEOS_DEPLOYMENT_TARGET) {
      return settings.IPHONEOS_DEPLOYMENT_TARGET;
    }
  }
  return FALLBACK_DEPLOYMENT_TARGET;
}

function withExtensionTarget(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;

    // `prebuild` sin `--clean` reutiliza el proyecto: sin esto, cada pasada
    // añadiría un target duplicado.
    if (project.pbxTargetByName(TARGET_NAME)) return cfg;

    const appBundleId = cfg.ios?.bundleIdentifier;
    if (!appBundleId) {
      throw new Error(
        '[withNotificationServiceExtension] falta ios.bundleIdentifier en la config',
      );
    }
    const bundleId = `${appBundleId}.${TARGET_NAME}`;
    const teamId = cfg.ios?.appleTeamId;
    const deploymentTarget = mainDeploymentTarget(project);

    // Grupo del navegador de Xcode con los dos ficheros.
    const group = project.addPbxGroup(
      [SWIFT_FILE, PLIST_FILE],
      TARGET_NAME,
      TARGET_NAME,
    );

    // Colgarlo del grupo raíz (el único sin `name` ni `path`).
    const groups = project.hash.project.objects.PBXGroup;
    for (const key of Object.keys(groups)) {
      if (
        typeof groups[key] === 'object' &&
        groups[key].name === undefined &&
        groups[key].path === undefined
      ) {
        project.addToPbxGroup(group.uuid, key);
      }
    }

    // `addTarget` da por hecho que estas secciones existen; en un proyecto sin
    // extensiones todavía no están y peta. Es un bug conocido del paquete.
    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency || {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};

    const target = project.addTarget(
      TARGET_NAME,
      'app_extension',
      TARGET_NAME,
      bundleId,
    );

    project.addBuildPhase(
      [SWIFT_FILE],
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid,
    );
    project.addBuildPhase(
      [],
      'PBXResourcesBuildPhase',
      'Resources',
      target.uuid,
    );
    project.addBuildPhase(
      [],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      target.uuid,
    );

    // Ajustes de build del target nuevo. Se localizan por PRODUCT_NAME, que es
    // lo único que `addTarget` deja marcado de forma fiable.
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key]?.buildSettings;
      if (!settings || settings.PRODUCT_NAME !== `"${TARGET_NAME}"`) continue;

      settings.CLANG_ENABLE_MODULES = 'YES';
      settings.INFOPLIST_FILE = `"${TARGET_NAME}/${PLIST_FILE}"`;
      settings.PRODUCT_BUNDLE_IDENTIFIER = `"${bundleId}"`;
      settings.IPHONEOS_DEPLOYMENT_TARGET = deploymentTarget;
      settings.SWIFT_VERSION = '5.0';
      settings.TARGETED_DEVICE_FAMILY = '"1,2"';
      settings.CODE_SIGN_STYLE = 'Automatic';
      // Versión y build TIENEN que coincidir con las del target principal o
      // App Store Connect rechaza el paquete al subirlo. Se leen de la misma
      // config de la que Expo saca las del target principal (y que EAS ya ha
      // resuelto con `autoIncrement` cuando llega aquí), en vez de referenciar
      // `$(MARKETING_VERSION)`, que dentro de su propia definición sería
      // circular y se quedaría vacío.
      settings.MARKETING_VERSION = `"${cfg.version ?? '1.0.0'}"`;
      settings.CURRENT_PROJECT_VERSION = `"${cfg.ios?.buildNumber ?? '1'}"`;
      if (teamId) settings.DEVELOPMENT_TEAM = teamId;
    }

    if (teamId) {
      project.addTargetAttribute('DevelopmentTeam', teamId, target);
      project.addTargetAttribute('DevelopmentTeam', teamId);
    }

    return cfg;
  });
}

module.exports = function withNotificationServiceExtension(config) {
  return withExtensionTarget(withExtensionSources(config));
};
