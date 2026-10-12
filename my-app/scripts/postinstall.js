const fs = require('fs');
const path = require('path');

// Fix @react-native-ml-kit/text-recognition build.gradle for RN 0.73+
const buildGradlePath = path.join(
  process.cwd(),
  'node_modules/@react-native-ml-kit/text-recognition/android/build.gradle'
);

if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');

  // Only patch if it still has the old incompatible react-native:+ dependency
  if (content.includes("implementation 'com.facebook.react:react-native:+'")) {
    console.log('[postinstall] Patching @react-native-ml-kit/text-recognition build.gradle...');
    
    // Replace old react-native:+ with new react-android
    content = content.replace(
      "    //noinspection GradleDynamicVersion\n    implementation 'com.facebook.react:react-native:+'  // From node_modules",
      "    implementation(\"com.facebook.react:react-android\")"
    );

    // Remove the outdated buildscript block (not needed when included as a subproject)
    content = content.replace(
      /buildscript \{[\s\S]*?if \(project == rootProject\) \{[\s\S]*?\}\s*\}\n\n/,
      ''
    );

    // Update compileSdkVersion to use a modern default via safeExtGet
    content = content.replace(
      /def DEFAULT_COMPILE_SDK_VERSION = \d+\n/,
      'def DEFAULT_COMPILE_SDK_VERSION = 35\n'
    );
    content = content.replace(
      /def DEFAULT_BUILD_TOOLS_VERSION = '[\d.]+'\n/,
      "def DEFAULT_BUILD_TOOLS_VERSION = '35.0.0'\n"
    );
    content = content.replace(
      /def DEFAULT_MIN_SDK_VERSION = \d+\n/,
      'def DEFAULT_MIN_SDK_VERSION = 24\n'
    );
    content = content.replace(
      /def DEFAULT_TARGET_SDK_VERSION = \d+\n/,
      'def DEFAULT_TARGET_SDK_VERSION = 35\n'
    );

    // Add namespace if not present
    if (!content.includes('namespace')) {
      content = content.replace(
        'android {',
        "android {\n    namespace 'com.reactnativemlkittextrecognition'"
      );
    }

    // Remove the outdated repositories block referencing old RN paths
    content = content.replace(
      /\nrepositories \{[\s\S]*?google\(\)\n\}\n/,
      '\n'
    );

    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log('[postinstall] ✓ Patched @react-native-ml-kit/text-recognition build.gradle');
  } else {
    console.log('[postinstall] @react-native-ml-kit/text-recognition already patched, skipping.');
  }
} else {
  console.log('[postinstall] @react-native-ml-kit/text-recognition not found, skipping patch.');
}
