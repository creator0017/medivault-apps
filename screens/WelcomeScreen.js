import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>Welcome to MediVault</Text>
        <Text style={styles.desc}>Your transition worked perfectly. Ready to build the Login design?</Text>
        
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.btnText}>Let's Design This Page Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: 'white', padding: 30, borderRadius: 20, width: '100%', alignItems: 'center', elevation: 5 },
  emoji: { fontSize: 50, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a365d', marginBottom: 10 },
  desc: { textAlign: 'center', color: '#64748b', lineHeight: 22, marginBottom: 30 },
  btn: { backgroundColor: '#2E75B6', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});