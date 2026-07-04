import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Fonts } from "../constants/Fonts";
import { Theme } from "../constants/theme";
import { API_URL } from "../constants/Config";
import { addToCartGlobal } from "../stores/cartStore";

interface ComboOption {
  mappingId: string;
  dishId: string;
  name: string;
  description?: string;
  image?: string;
  surcharge: number;
  dishPrice: number;
  isDefault: boolean;
  sortOrder: number;
}

interface ComboGroup {
  comboGroupId: string;
  groupName: string;
  displayOrder: number;
  minSelection: number;
  maxSelection: number;
  isMultiSelect: boolean;
  options: ComboOption[];
}

interface ComboConfig {
  dishId: string;
  name: string;
  basePrice: number;
  description?: string;
  groups: ComboGroup[];
}

export default function ComboCustomizer({
  visible,
  onClose,
  dish,
  kitchenName,
  kitchenCode,
}: {
  visible: boolean;
  onClose: () => void;
  dish: any | null;
  kitchenName: string;
  kitchenCode: string;
}) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ComboConfig | null>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && dish) {
      loadComboConfig();
    } else {
      setConfig(null);
      setSelections({});
      setError(null);
    }
  }, [visible, dish?.DishId]);

  const loadComboConfig = async () => {
    if (!dish) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/combo/config/${dish.DishId}`);
      if (!res.ok) throw new Error("Failed to load combo options.");
      const payload = await res.json();
      if (payload.success && payload.data) {
        setConfig(payload.data);
        
        // Auto-select defaults
        const initialSelections: Record<string, string[]> = {};
        payload.data.groups.forEach((group: ComboGroup) => {
          const defaults = group.options.filter(o => o.isDefault).map(o => o.dishId);
          initialSelections[group.comboGroupId] = defaults;
        });
        setSelections(initialSelections);
      } else {
        throw new Error(payload.error || "Failed to load combo config.");
      }
    } catch (err: any) {
      console.error("Combo config fetch error:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (groupId: string, option: ComboOption, isMulti: boolean, maxSelect: number) => {
    setSelections(prev => {
      const current = prev[groupId] || [];
      if (current.includes(option.dishId)) {
        // Toggle off
        return {
          ...prev,
          [groupId]: current.filter(id => id !== option.dishId)
        };
      } else {
        // Toggle on
        if (isMulti) {
          if (current.length >= maxSelect) {
            // Reached limit, replace oldest/first selection or reject
            return prev;
          }
          return {
            ...prev,
            [groupId]: [...current, option.dishId]
          };
        } else {
          // Single select: replace active choice
          return {
            ...prev,
            [groupId]: [option.dishId]
          };
        }
      }
    });
  };

  const handleAddToCart = () => {
    if (!config || !dish) return;

    // Validate minimum selections
    for (const group of config.groups) {
      const selectedIds = selections[group.comboGroupId] || [];
      if (selectedIds.length < group.minSelection) {
        setError(`Please pick at least ${group.minSelection} choice(s) for "${group.groupName}"`);
        return;
      }
    }

    // Build the selection details payload with surcharge calculations
    const chosenSelections = config.groups.map(group => {
      const selectedIds = selections[group.comboGroupId] || [];
      const selectedOptions = group.options.filter(o => selectedIds.includes(o.dishId));
      return {
        groupId: group.comboGroupId,
        groupName: group.groupName,
        items: selectedOptions.map(o => ({
          dishId: o.dishId,
          name: o.name,
          surcharge: o.surcharge,
          dishPrice: o.dishPrice || 0,
        }))
      };
    });

    // Sum surcharges and dish prices
    let totalSurcharge = 0;
    chosenSelections.forEach(grp => {
      grp.items.forEach(opt => {
        totalSurcharge += opt.surcharge + (opt.dishPrice || 0);
      });
    });

    const finalPrice = config.basePrice + totalSurcharge;

    addToCartGlobal({
      id: dish.DishId,
      name: dish.Name,
      price: finalPrice,
      basePrice: config.basePrice,
      isCombo: true,
      comboSelections: chosenSelections,
      categoryName: kitchenName,
      KitchenTypeName: dish.KitchenTypeName || kitchenName,
      PrinterIP: dish.PrinterIP,
      KitchenTypeCode: dish.KitchenTypeCode || kitchenCode,
      isServiceCharge: dish.isServiceCharge,
      IsOpenItem: dish.IsOpenItem,
    } as any);

    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="fast-food-outline" size={18} color={Theme.primary} />
              </View>
              <Text style={styles.title} numberOfLines={1}>
                Customize {dish?.Name || "Combo"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Theme.primary} />
              <Text style={styles.loadingText}>Loading combo options...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={Theme.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadComboConfig}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={config?.groups || []}
              keyExtractor={(item) => item.comboGroupId}
              contentContainerStyle={styles.body}
              renderItem={({ item: group }) => {
                const selectedIds = selections[group.comboGroupId] || [];
                return (
                  <View style={styles.groupSection}>
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupTitle}>{group.groupName}</Text>
                      <Text style={styles.groupRules}>
                        (Pick {group.minSelection === group.maxSelection ? group.minSelection : `${group.minSelection}-${group.maxSelection}`})
                      </Text>
                    </View>
                    <View style={styles.optionsGrid}>
                      {group.options.map((option) => {
                        const isSelected = selectedIds.includes(option.dishId);
                        return (
                          <TouchableOpacity
                            key={option.mappingId}
                            style={[
                              styles.optionCard,
                              isSelected && styles.optionCardSelected,
                            ]}
                            onPress={() =>
                              handleSelectOption(
                                group.comboGroupId,
                                option,
                                group.isMultiSelect,
                                group.maxSelection
                              )
                            }
                          >
                            <Text style={[styles.optionName, isSelected && styles.optionTextSelected]}>
                              {option.name}
                            </Text>
                            {(option.surcharge > 0 || option.dishPrice > 0) && (
                              <Text style={[styles.optionSurcharge, isSelected && styles.optionTextSelected]}>
                                +${(option.surcharge + (option.dishPrice || 0)).toFixed(2)}
                              </Text>
                            )}
                            {isSelected && (
                              <View style={styles.checkmarkWrap}>
                                <Ionicons name="checkmark-circle" size={18} color={Theme.primary} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={(() => {
                let currentTotal = config?.basePrice || 0;
                config?.groups?.forEach(group => {
                  const selectedIds = selections[group.comboGroupId] || [];
                  const selectedOptions = group.options.filter(o => selectedIds.includes(o.dishId));
                  selectedOptions.forEach(opt => {
                    currentTotal += (opt.surcharge || 0) + (opt.dishPrice || 0);
                  });
                });

                return (
                  <View style={styles.footer}>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleAddToCart}>
                      <Text style={styles.confirmButtonText}>
                        Add Combo to Cart - ${currentTotal.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "80%",
    maxWidth: 650,
    maxHeight: "85%",
    backgroundColor: Theme.bgCard || "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border || "#E5E5E5",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.primaryLight || "#FFF5EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Theme.textPrimary || "#1E1E1E",
  },
  closeBtn: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Theme.textSecondary || "#666",
  },
  errorContainer: {
    padding: 40,
    alignItems: "center",
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Theme.danger || "#D32F2F",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFF",
    fontFamily: Fonts.bold,
  },
  body: {
    padding: 20,
  },
  groupSection: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: "#2C3E50",
    letterSpacing: 0.3,
  },
  groupRules: {
    marginLeft: 8,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: "#95A5A6",
    backgroundColor: "#F2F4F4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    textTransform: "uppercase",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  optionCard: {
    minWidth: 140,
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#EAECEE",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    // Premium soft card shadows
    shadowColor: "#17202A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: Theme.primary,
    backgroundColor: "#FFF5EB",
    shadowColor: Theme.primary,
    shadowOpacity: 0.08,
  },
  optionName: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: "#2C3E50",
    textAlign: "center",
  },
  optionSurcharge: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Theme.primary,
    marginTop: 6,
    backgroundColor: "#FFEEDB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  optionTextSelected: {
    color: Theme.primary,
  },
  checkmarkWrap: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  footer: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#EAECEE",
    paddingTop: 20,
    paddingBottom: 10,
  },
  confirmButton: {
    backgroundColor: Theme.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmButtonText: {
    color: "#FFF",
    fontFamily: Fonts.bold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
