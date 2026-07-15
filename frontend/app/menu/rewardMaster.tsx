import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { API_URL } from "@/constants/Config";
import { useAuthStore } from "@/stores/authStore";
import { Theme } from "@/constants/theme";
import { Fonts } from "@/constants/Fonts";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RewardMasterScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Rule configuration states
  const [spendAmount, setSpendAmount] = useState("100");
  const [creditAmount, setCreditAmount] = useState("1");
  const [description, setDescription] = useState("");
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Member search states
  const [searchText, setSearchText] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);

  // Selected member history states
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch active rule on load
  useEffect(() => {
    fetchActiveRule();
  }, []);

  const fetchActiveRule = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/rewards/master`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        setSpendAmount(String(res.data.SpendAmount || 100));
        setCreditAmount(String(res.data.CreditAmount || 1));
        setDescription(res.data.Description || "");
      }
    } catch (err: any) {
      console.error("Error fetching reward rule:", err);
      Alert.alert("Error", "Failed to load active reward configurations.");
    }
  };

  const handleSaveRule = async () => {
    const spend = parseFloat(spendAmount);
    const credit = parseFloat(creditAmount);
    if (isNaN(spend) || spend <= 0 || isNaN(credit) || credit <= 0) {
      Alert.alert("Invalid Input", "Please enter positive numbers for spend and credit amounts.");
      return;
    }

    setIsSavingRule(true);
    try {
      await axios.put(
        `${API_URL}/api/rewards/master`,
        { spendAmount: spend, creditAmount: credit, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Success", "Reward earn configurations updated successfully.");
      fetchActiveRule();
    } catch (err: any) {
      console.error("Error updating rule:", err);
      Alert.alert("Error", "Failed to update reward rule configurations.");
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleSearchMembers = async (text: string) => {
    setSearchText(text);
    const clean = text.trim();
    if (!clean) {
      setMembers([]);
      return;
    }

    setIsSearchingMembers(true);
    try {
      const res = await axios.get(`${API_URL}/api/rewards/members/search?q=${encodeURIComponent(clean)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMembers(res.data || []);
    } catch (err: any) {
      console.error("Error searching members:", err);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  const handleSelectMember = async (member: any) => {
    setSelectedMember(member);
    setIsLoadingHistory(true);
    try {
      const res = await axios.get(`${API_URL}/api/rewards/history/${member.MemberId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data || []);
    } catch (err: any) {
      console.error("Error fetching history:", err);
      Alert.alert("Error", "Failed to load history.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Theme.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reward Points Master</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          
          {/* Rule Configuration Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reward Configuration Rule</Text>
            <Text style={styles.cardSubtitle}>
              Configure how much reward wallet cashback points members earn.
            </Text>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Every spent amount ($)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={spendAmount}
                  onChangeText={setSpendAmount}
                  placeholder="e.g. 100"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 15 }]}>
                <Text style={styles.inputLabel}>Earns credit reward ($)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={creditAmount}
                  onChangeText={setCreditAmount}
                  placeholder="e.g. 1.00"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description / Notes</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Standard 1% Loyalty Cashback Points"
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRule} disabled={isSavingRule}>
              {isSavingRule ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Update Reward Config Rule</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Member Search & History Section */}
          <View style={[styles.row, { marginTop: 20, alignItems: "flex-start" }]}>
            
            {/* Left Column: Member Search */}
            <View style={{ flex: isTablet ? 1 : undefined, width: isTablet ? undefined : "100%" }}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Member Reward Wallet Lookup</Text>
                
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={handleSearchMembers}
                    placeholder="Search by member name or phone..."
                  />
                  {isSearchingMembers && <ActivityIndicator size="small" color={Theme.primary} />}
                </View>

                <FlatList
                  data={members}
                  keyExtractor={(item) => item.MemberId}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.memberItem,
                        selectedMember?.MemberId === item.MemberId && styles.memberItemSelected
                      ]}
                      onPress={() => handleSelectMember(item)}
                    >
                      <View>
                        <Text style={styles.memberName}>{item.Name}</Text>
                        <Text style={styles.memberPhone}>{item.Phone}</Text>
                      </View>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          ${(parseFloat(item.RewardCredit) || 0).toFixed(2)} pts
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={() => (
                    <Text style={styles.emptyText}>
                      {searchText ? "No matching members found." : "Search to check member reward points."}
                    </Text>
                  )}
                />
              </View>
            </View>

            {/* Right Column: Reward History Logs */}
            {isTablet && (
              <View style={{ flex: 1, marginLeft: 20 }}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Point History & Logs</Text>
                  {selectedMember ? (
                    <View>
                      <View style={styles.memberSummary}>
                        <Text style={styles.summaryName}>{selectedMember.Name}</Text>
                        <Text style={styles.summaryPhone}>{selectedMember.Phone}</Text>
                        <View style={styles.walletRow}>
                          <Text style={styles.walletLabel}>Reward Wallet Balance:</Text>
                          <Text style={styles.walletValue}>
                            ${(parseFloat(selectedMember.RewardCredit) || 0).toFixed(2)} Credits
                          </Text>
                        </View>
                      </View>

                      {isLoadingHistory ? (
                        <ActivityIndicator size="large" color={Theme.primary} style={{ marginTop: 20 }} />
                      ) : (
                        <FlatList
                          data={history}
                          keyExtractor={(item) => item.Id || String(Math.random())}
                          scrollEnabled={false}
                          renderItem={({ item }) => {
                            const isRedeemed = item.TransType === "REDEEM" || parseFloat(item.PointsUsed) > 0;
                            return (
                              <View style={styles.historyItem}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.historyBill}>Bill: {item.BillNo || "N/A"}</Text>
                                  <Text style={styles.historyRemarks}>{item.Remarks || (isRedeemed ? "Redeemed points" : "Earned points")}</Text>
                                  <Text style={styles.historyDate}>
                                    {new Date(item.CreatedOn).toLocaleString()}
                                  </Text>
                                </View>
                                <Text 
                                  style={[
                                    styles.historyPoints, 
                                    isRedeemed ? { color: "#EA580C" } : { color: Theme.success }
                                  ]}
                                >
                                  {isRedeemed ? "-" : "+"}${isRedeemed ? (parseFloat(item.PointsUsed) || 0).toFixed(2) : (parseFloat(item.PointsEarned) || 0).toFixed(2)}
                                </Text>
                              </View>
                            );
                          }}
                          ListEmptyComponent={() => (
                            <Text style={styles.emptyText}>No transaction history logs found.</Text>
                          )}
                        />
                      )}
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>Select a member to view reward history logs.</Text>
                  )}
                </View>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  backBtn: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.black,
    color: Theme.textPrimary,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: Fonts.black,
    color: Theme.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: "#6B7280",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Theme.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.medium,
    backgroundColor: "#F9FAFB",
    color: Theme.textPrimary,
  },
  saveBtn: {
    backgroundColor: Theme.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: Fonts.black,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    marginBottom: 16,
    marginTop: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Theme.textPrimary,
  },
  memberItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  memberItemSelected: {
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
  },
  memberName: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Theme.textPrimary,
  },
  memberPhone: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: "#6B7280",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: "#1D4ED8",
  },
  emptyText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 13,
    fontFamily: Fonts.medium,
    marginVertical: 20,
  },
  memberSummary: {
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryName: {
    fontSize: 15,
    fontFamily: Fonts.black,
    color: Theme.textPrimary,
  },
  summaryPhone: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: "#6B7280",
  },
  walletRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  walletLabel: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Theme.textSecondary,
  },
  walletValue: {
    fontSize: 13,
    fontFamily: Fonts.black,
    color: Theme.success,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  historyBill: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Theme.textPrimary,
  },
  historyRemarks: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: "#6B7280",
    marginTop: 2,
  },
  historyDate: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: "#9CA3AF",
    marginTop: 2,
  },
  historyPoints: {
    fontSize: 14,
    fontFamily: Fonts.black,
    color: Theme.success,
  }
});
