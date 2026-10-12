const fs = require('fs');
const path = require('path');

// Candidate paths for @react-native-ml-kit/text-recognition build.gradle
const candidatePaths = [
  path.join(process.cwd(), 'node_modules/@react-native-ml-kit/text-recognition/android/build.gradle'),
  path.join(__dirname, '..', 'node_modules/@react-native-ml-kit/text-recognition/android/build.gradle'),
];

const buildGradlePath = candidatePaths.find((p) => fs.existsSync(p));

const fixedBuildGradle = `// Fixed for React Native 0.73+ and AGP 8+
def DEFAULT_COMPILE_SDK_VERSION = 35
def DEFAULT_BUILD_TOOLS_VERSION = '35.0.0'
def DEFAULT_MIN_SDK_VERSION = 24
def DEFAULT_TARGET_SDK_VERSION = 35

def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

apply plugin: 'com.android.library'

android {
    namespace 'com.rnmlkit.textrecognition'
    compileSdkVersion safeExtGet('compileSdkVersion', DEFAULT_COMPILE_SDK_VERSION)
    buildToolsVersion safeExtGet('buildToolsVersion', DEFAULT_BUILD_TOOLS_VERSION)
    defaultConfig {
        minSdkVersion safeExtGet('minSdkVersion', DEFAULT_MIN_SDK_VERSION)
        targetSdkVersion safeExtGet('targetSdkVersion', DEFAULT_TARGET_SDK_VERSION)
        versionCode 1
        versionName "1.0"
    }
    lintOptions {
        abortOnError false
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
    // To recognize Latin script
    implementation 'com.google.mlkit:text-recognition:16.0.1'
    // To recognize Chinese script
    implementation 'com.google.mlkit:text-recognition-chinese:16.0.1'
    // To recognize Devanagari script
    implementation 'com.google.mlkit:text-recognition-devanagari:16.0.1'
    // To recognize Japanese script
    implementation 'com.google.mlkit:text-recognition-japanese:16.0.1'
    // To recognize Korean script
    implementation 'com.google.mlkit:text-recognition-korean:16.0.1'
}
`;

if (buildGradlePath) {
  fs.writeFileSync(buildGradlePath, fixedBuildGradle, 'utf8');
  console.log('[postinstall] ✓ Successfully wrote clean build.gradle for @react-native-ml-kit/text-recognition');
} else {
  console.log('[postinstall] Note: @react-native-ml-kit/text-recognition not found, skipping patch.');
}
