import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="shield-check" size={60} color="#FFF" />
        </View>
        <Text style={styles.title}>Welcome to Arogyasathi</Text>
        <Text style={styles.desc}>
          Your personal health records, secured and always with you.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.replace("Login")}
        >
          <Text style={styles.btnText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "white",
    padding: 30,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
    elevation: 5,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: "#2E75B6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a365d",
    marginBottom: 10,
  },
  desc: {
    textAlign: "center",
    color: "#64748b",
    lineHeight: 22,
    marginBottom: 30,
  },
  btn: {
    backgroundColor: "#2E75B6",
    padding: 15,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  btnText: { color: "white", fontWeight: "bold", fontSize: 16 },
});
