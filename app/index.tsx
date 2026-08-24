import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// 👇 NOTE: Imported from /legacy for modern Expo compatibility
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

// --- INTERFACES ---
interface VideoFormat {
  itag: number;
  quality: string;
  container: string;
}

interface VideoData {
  title: string;
  thumbnail: string;
  duration: string;
  formats: VideoFormat[];
}

interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
}

// Replace with your local machine's Wi-Fi IP (e.g., http://192.168.1.100:5000)
const API_URL = 'http://10.162.146.244:5000';

export default function App() {
  const [url, setUrl] = useState<string>('');
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [selectedItag, setSelectedItag] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  // 1. Fetch Video Metadata
  const handleFetchInfo = async (): Promise<void> => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a valid YouTube link.');
      return;
    }

    setLoading(true);
    setVideoData(null);
    setSelectedItag(null);

    try {
      const response = await fetch(`${API_URL}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data: VideoData & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch details');
      }

      setVideoData(data);
      if (data.formats.length > 0) {
        setSelectedItag(data.formats[0].itag);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 2. Download and Save to Device Gallery
  const handleDownload = async (): Promise<void> => {
    if (!selectedItag || !videoData) {
      Alert.alert('Error', 'Please select a quality option first.');
      return;
    }

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      Alert.alert('Error', 'Storage directory is not accessible.');
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Storage access is required to save the video.');
        setDownloading(false);
        return;
      }

      const downloadUrl = `${API_URL}/api/download?url=${encodeURIComponent(
        url
      )}&itag=${selectedItag}&title=${encodeURIComponent(videoData.title)}`;

      const localFileUri = `${baseDir}${Date.now()}.mp4`;

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localFileUri,
        {},
        (progress: DownloadProgress) => {
          if (progress.totalBytesExpectedToWrite > 0) {
            const percent = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
            setDownloadProgress(Math.round(percent * 100) || 0);
          }
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (result && result.uri) {
        await MediaLibrary.saveToLibraryAsync(result.uri);
        Alert.alert('Success 🎉', 'Video saved directly to your Photos/Gallery!');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      Alert.alert('Download Error', errorMessage);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>YouTube Downloader</Text>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Paste YouTube link here..."
            placeholderTextColor="#888"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.fetchBtn} onPress={handleFetchInfo} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.fetchBtnText}>Fetch</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Video Preview & Download Options */}
        {videoData && (
          <View style={styles.card}>
            <Image source={{ uri: videoData.thumbnail }} style={styles.thumbnail} />
            <Text style={styles.title} numberOfLines={2}>
              {videoData.title}
            </Text>

            {/* Quality Selector */}
            <Text style={styles.sectionLabel}>Select Quality:</Text>
            <View style={styles.qualityList}>
              {videoData.formats.map((item: VideoFormat) => {
                const isSelected = selectedItag === item.itag;
                return (
                  <TouchableOpacity
                    key={item.itag}
                    style={[styles.qualityPill, isSelected && styles.qualityPillSelected]}
                    onPress={() => setSelectedItag(item.itag)}
                  >
                    <Text style={[styles.qualityText, isSelected && styles.qualityTextSelected]}>
                      {item.quality.toUpperCase()} ({item.container})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Download Button */}
            <TouchableOpacity
              style={[styles.downloadBtn, downloading && styles.disabledBtn]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.downloadBtnText}>Downloading... {downloadProgress}%</Text>
                </View>
              ) : (
                <Text style={styles.downloadBtnText}>Download to Gallery</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  scroll: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginVertical: 20 },
  inputContainer: { flexDirection: 'row', marginBottom: 20 },
  input: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 10,
  },
  fetchBtn: { backgroundColor: '#ff0000', paddingHorizontal: 18, justifyContent: 'center', borderRadius: 8 },
  fetchBtnText: { color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 15, marginTop: 10 },
  thumbnail: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  sectionLabel: { color: '#aaa', fontSize: 14, marginBottom: 8, fontWeight: '600' },
  qualityList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  qualityPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  qualityPillSelected: { backgroundColor: '#ff0000', borderColor: '#ff0000' },
  qualityText: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  qualityTextSelected: { color: '#fff' },
  downloadBtn: {
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { backgroundColor: '#555' },
  downloadBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});