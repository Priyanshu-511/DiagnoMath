import React, { useState } from 'react';
import { View, TouchableOpacity, Image, Platform, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export default function FileUploader({ uploadUrl }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        setFile(result.assets[0]);
        setStatusMsg('');
      }
    } catch (err) {
      console.error('pickDocument error:', err);
    }
  };

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setStatusMsg('Gallery permission denied');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled) {
        setFile(result.assets[0]);
        setStatusMsg('');
      }
    } catch (err) {
      console.error('pickImage error:', err);
    }
  };

  const captureImage = async () => {
    if (Platform.OS !== 'web') {
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setStatusMsg('Camera permission denied');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (!result.canceled) {
          setFile(result.assets[0]);
          setStatusMsg('');
        }
      } catch (err) {
        console.error('captureImage error:', err);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const f = e.target.files[0];
        if (f) {
          setFile({
            uri: URL.createObjectURL(f),
            name: f.name,
            mimeType: f.type,
            file: f,
          });
          setStatusMsg('');
        }
      };
      input.click();
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);
    setStatusMsg('');
    try {
      const formData = new FormData();

      if (Platform.OS === 'web' && file.file) {
        formData.append('file', file.file, file.name);
      } else {
        formData.append('file', {
          uri: file.uri,
          name: file.name || 'upload.jpg',
          type: file.mimeType || 'image/jpeg',
        });
      }

      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      setStatusMsg('Upload successful ✅');
    } catch (err) {
      console.error('uploadFile error:', err);
      setStatusMsg('Upload failed ❌');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>File Upload</Text>

      <TouchableOpacity style={styles.buttonBlue} onPress={pickDocument}>
        <Text style={styles.buttonText}>📄 Pick Document</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonLime} onPress={pickImage}>
        <Text style={styles.buttonTextDark}>🖼️ Pick Image from Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonBlue} onPress={captureImage}>
        <Text style={styles.buttonText}>📷 Capture Photo</Text>
      </TouchableOpacity>

      {file && (
        <View style={styles.preview}>
          <Text style={styles.fileName}>{file.name}</Text>
          {file.mimeType?.startsWith('image') && (
            <Image source={{ uri: file.uri }} style={styles.image} />
          )}
        </View>
      )}

      {uploading ? (
        <ActivityIndicator style={{ marginTop: 12 }} color="#3B82F6" />
      ) : (
        <TouchableOpacity
          style={[styles.buttonUpload, !file && styles.buttonDisabled]}
          onPress={uploadFile}
          disabled={!file}
        >
          <Text style={styles.buttonText}>⬆️ Upload</Text>
        </TouchableOpacity>
      )}

      {statusMsg ? <Text style={styles.status}>{statusMsg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 14,
    backgroundColor: '#F0FDF4', // very light lime background
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E3A8A', // deep blue
    marginBottom: 8,
  },
  buttonBlue: {
    backgroundColor: '#3B82F6', // blue
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  buttonLime: {
    backgroundColor: '#A3E635', // lime green
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#A3E635',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  buttonUpload: {
    backgroundColor: '#22C55E', // green-blue blend accent
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    backgroundColor: '#BBF7D0',
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonTextDark: {
    color: '#1E3A8A',
    fontWeight: '600',
    fontSize: 15,
  },
  preview: {
    marginVertical: 10,
    padding: 12,
    backgroundColor: '#ECFCCB', // pale lime card
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BEF264',
  },
  fileName: {
    color: '#1E3A8A',
    fontWeight: '500',
    marginBottom: 6,
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 10,
  },
  status: {
    marginTop: 10,
    fontWeight: '600',
    color: '#166534',
  },
});