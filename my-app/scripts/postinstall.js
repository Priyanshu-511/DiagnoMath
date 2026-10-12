const fs = require('fs');
const path = require('path');

// Candidate paths for @react-native-ml-kit/text-recognition build.gradle
const candidatePaths = [
  path.join(process.cwd(), 'node_modules/@react-native-ml-kit/text-recognition/android/build.gradle'),
  path.join(__dirname, '..', 'node_modules/@react-native-ml-kit/text-recognition/android/build.gradle'),
];

const buildGradlePath = candidatePaths.find((p) => fs.existsSync(p));

if (buildGradlePath) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');

  let modified = false;

  // 1. Replace old react-native:+ dependency with modern react-android
  if (content.includes('react-native:+')) {
    content = content.replace(
      /\/\/noinspection GradleDynamicVersion\s*\n\s*implementation\s+['"]com\.facebook\.react:react-native:\+['"].*/,
      'implementation("com.facebook.react:react-android")'
    );
    // Fallback simple replace if regex didn't match full comment
    content = content.replace(
      /implementation\s+['"]com\.facebook\.react:react-native:\+['"].*/,
      'implementation("com.facebook.react:react-android")'
    );
    modified = true;
  }

  // 2. Remove outdated standalone buildscript block
  if (content.includes('classpath \'com.android.tools.build:gradle:3.4.1\'')) {
    content = content.replace(
      /buildscript \{[\s\S]*?if \(project == rootProject\) \{[\s\S]*?\}\s*\}\n*/,
      ''
    );
    modified = true;
  }

  // 3. Update default SDK versions
  content = content.replace(/def DEFAULT_COMPILE_SDK_VERSION = \d+/, 'def DEFAULT_COMPILE_SDK_VERSION = 35');
  content = content.replace(/def DEFAULT_BUILD_TOOLS_VERSION = '[\d.]+'/, "def DEFAULT_BUILD_TOOLS_VERSION = '35.0.0'");
  content = content.replace(/def DEFAULT_MIN_SDK_VERSION = \d+/, 'def DEFAULT_MIN_SDK_VERSION = 24');
  content = content.replace(/def DEFAULT_TARGET_SDK_VERSION = \d+/, 'def DEFAULT_TARGET_SDK_VERSION = 35');

  // 4. Ensure namespace is set correctly to 'com.rnmlkit.textrecognition' (matching Java package)
  if (content.includes("namespace 'com.reactnativemlkittextrecognition'")) {
    content = content.replace(
      "namespace 'com.reactnativemlkittextrecognition'",
      "namespace 'com.rnmlkit.textrecognition'"
    );
    modified = true;
  } else if (!content.includes("namespace 'com.rnmlkit.textrecognition'")) {
    content = content.replace(
      'android {',
      "android {\n    namespace 'com.rnmlkit.textrecognition'"
    );
    modified = true;
  }

  // 5. Remove outdated repositories block
  if (content.includes('$rootDir/../node_modules/react-native/android')) {
    content = content.replace(
      /\nrepositories \{[\s\S]*?google\(\)\n\}\n*/,
      '\n'
    );
    modified = true;
  }

  fs.writeFileSync(buildGradlePath, content, 'utf8');
  console.log('[postinstall] ✓ Verified @react-native-ml-kit/text-recognition build.gradle');
} else {
  console.log('[postinstall] Note: @react-native-ml-kit/text-recognition not found, skipping patch.');
}
