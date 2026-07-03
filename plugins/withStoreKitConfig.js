const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const {
  addResourceFileToGroup,
} = require("@expo/config-plugins/build/ios/utils/Xcodeproj");
const fs = require("fs");
const path = require("path");

const STOREKIT_FILENAME = "Blyss.storekit";
const CONFIG_DIR = path.join(__dirname, "..", "ios-config");

function findSchemeFiles(iosDir) {
  const projDirs = fs
    .readdirSync(iosDir)
    .filter((f) => f.endsWith(".xcodeproj"))
    .map((f) => path.join(iosDir, f, "xcshareddata", "xcschemes"));

  return projDirs
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".xcscheme"))
        .map((f) => path.join(dir, f))
    );
}

function patchScheme(schemePath, projectName) {
  let contents = fs.readFileSync(schemePath, "utf8");
  if (contents.includes("storeKitConfigurationFileReference")) return;

  contents = contents.replace(
    /(<LaunchAction\b[^>]*)>/,
    `$1\n      storeKitConfigurationFileReference = "container:${projectName}/${STOREKIT_FILENAME}">`
  );
  fs.writeFileSync(schemePath, contents);
}

const withStoreKitFiles = (config) => {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const iosDir = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;
      const targetDir = path.join(iosDir, projectName);

      fs.copyFileSync(
        path.join(CONFIG_DIR, STOREKIT_FILENAME),
        path.join(targetDir, STOREKIT_FILENAME)
      );

      for (const schemePath of findSchemeFiles(iosDir)) {
        patchScheme(schemePath, projectName);
      }

      return config;
    },
  ]);
};

const withStoreKitXcodeProject = (config) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;
    const target = project.getFirstTarget().uuid;

    addResourceFileToGroup({
      filepath: `${projectName}/${STOREKIT_FILENAME}`,
      groupName: projectName,
      project,
      isBuildFile: true,
      targetUuid: target,
    });

    return config;
  });
};

const withStoreKitConfig = (config) => {
  config = withStoreKitFiles(config);
  config = withStoreKitXcodeProject(config);
  return config;
};

module.exports = withStoreKitConfig;
