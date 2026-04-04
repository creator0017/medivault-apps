import { Dimensions, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

export default function TrendChart({ reports = [] }) {
  // Filter for reports that actually contain a value (assuming AI will save this in future)
  // We'll use 'value' and 'uploadedAt' fields to construct the graph
  const validReports = reports
    .filter((r) => r.value !== undefined && r.value !== null)
    .sort((a, b) => {
      const timeA = a.uploadedAt?.seconds || 0;
      const timeB = b.uploadedAt?.seconds || 0;
      return timeA - timeB;
    });

  if (validReports.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Upload at least 2 Lab reports with analyzed values to see your health trend.
        </Text>
      </View>
    );
  }

  const chartData = {
    labels: validReports.map((r) => {
      if (r.uploadedAt?.seconds) {
        return new Date(r.uploadedAt.seconds * 1000).toLocaleDateString("en-GB", {
          month: "short",
        });
      }
      return "N/A";
    }),
    datasets: [
      {
        data: validReports.map((r) => Number(r.value)),
      },
    ],
  };

  const lastValue = validReports[validReports.length - 1].value;
  const prevValue = validReports[validReports.length - 2].value;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Health Trend Graph</Text>

      <LineChart
        data={chartData}
        width={screenWidth - 40}
        height={220}
        chartConfig={{
          backgroundColor: "#2E75B6",
          backgroundGradientFrom: "#2E75B6",
          backgroundGradientTo: "#4CAF50",
          decimalPlaces: 1,
          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          style: {
            borderRadius: 16,
          },
        }}
        bezier
        style={styles.chart}
      />

      <View style={styles.alertBox}>
        <Text style={styles.alertText}>
          {lastValue > prevValue
            ? "⚠️ Your tracked levels have increased since last test"
            : "✅ Your tracked levels are improving"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#FFF",
    borderRadius: 12,
    marginVertical: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 15,
    color: "#1E293B",
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  alertBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  alertText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    marginVertical: 10,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    fontWeight: "500",
  },
});
