import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function EditModal({
  visible,
  title,
  placeholder = "",
  initialValue = "",
  onCancel,
  onSave,
  secureTextEntry = false,
  keyboardType = "default",
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            autoFocus
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
          />
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => onSave(value)}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  card: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 25,
    padding: 25,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: "#1E293B",
    fontWeight: "500",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  cancelText: { color: "#64748B", fontWeight: "700", fontSize: 15 },
  saveBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 14,
    backgroundColor: "#2E75B6",
    alignItems: "center",
  },
  saveText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});
