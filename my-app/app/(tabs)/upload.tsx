import React from 'react';
import { SafeAreaView } from 'react-native';
import FileUploader from '../../components/FileUploader';

export default function UploadScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FileUploader uploadUrl="https://your-api.com/upload" />
    </SafeAreaView>
  );
}