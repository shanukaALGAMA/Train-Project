import { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    ActivityIndicator,
    Modal,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { API_BASE } from "../constants/api";

type Train = { train_id: number; train_name: string; created_at: string };
type Zone = { zone_id: number; zone_name: string; device_code: string; latitude: string | null; longitude: string | null; status: number };

const STATUS_LABEL: Record<number, string> = { 0: "SAFE", 1: "APPROACHING", 2: "OCCUPIED" };

export default function AdminScreen() {
    const router = useRouter();
    const [token, setToken] = useState<string | null>(null);
    const [tab, setTab] = useState<"trains" | "zones">("trains");

    // Trains State
    const [trains, setTrains] = useState<Train[]>([]);
    const [newTrainName, setNewTrainName] = useState("");
    const [newTrainPass, setNewTrainPass] = useState("");

    // Zones State
    const [zones, setZones] = useState<Zone[]>([]);
    const [zoneModal, setZoneModal] = useState<{ mode: "add" | "edit"; zone?: Zone } | null>(null);
    const [zName, setZName] = useState("");
    const [zCode, setZCode] = useState("");
    const [zLat, setZLat] = useState("");
    const [zLon, setZLon] = useState("");

    // Load admin token on mount
    useEffect(() => {
        SecureStore.getItemAsync("adminToken").then((t) => {
            if (!t) {
                Alert.alert("Session Expired", "Please log in again.");
                router.replace("/admin-login");
            } else {
                setToken(t);
            }
        });
    }, []);

    const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // ── TRAINS ───────────────────────────────────────
    const fetchTrains = useCallback(async () => {
        if (!token) return;
        const res = await fetch(`${API_BASE}/data/admin/trains`, { headers: authHeaders });
        if (res.status === 401 || res.status === 403) { logout(); return; }
        setTrains(await res.json());
    }, [token]);

    const addTrain = async () => {
        if (!newTrainName || !newTrainPass) return Alert.alert("Error", "Fill in all fields.");
        const res = await fetch(`${API_BASE}/data/admin/trains`, {
            method: "POST", headers: authHeaders,
            body: JSON.stringify({ train_name: newTrainName, password: newTrainPass }),
        });
        const d = await res.json();
        if (!res.ok) return Alert.alert("Error", d.message);
        setNewTrainName(""); setNewTrainPass("");
        fetchTrains();
    };

    const deleteTrain = (id: number, name: string) => {
        Alert.alert("Delete Train", `Delete "${name}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    await fetch(`${API_BASE}/data/admin/trains/${id}`, { method: "DELETE", headers: authHeaders });
                    fetchTrains();
                }
            },
        ]);
    };

    // ── ZONES ────────────────────────────────────────
    const fetchZones = useCallback(async () => {
        if (!token) return;
        const res = await fetch(`${API_BASE}/data/admin/zones`, { headers: authHeaders });
        if (res.status === 401 || res.status === 403) { logout(); return; }
        setZones(await res.json());
    }, [token]);

    const openAddZone = () => { setZName(""); setZCode(""); setZLat(""); setZLon(""); setZoneModal({ mode: "add" }); };
    const openEditZone = (z: Zone) => { setZName(z.zone_name); setZCode(z.device_code); setZLat(z.latitude ?? ""); setZLon(z.longitude ?? ""); setZoneModal({ mode: "edit", zone: z }); };

    const saveZone = async () => {
        if (!zName || !zCode) return Alert.alert("Error", "Zone name and device code required.");
        const body = JSON.stringify({ zone_name: zName, device_code: zCode, latitude: zLat || null, longitude: zLon || null });
        let res;
        if (zoneModal?.mode === "add") {
            res = await fetch(`${API_BASE}/data/admin/zones`, { method: "POST", headers: authHeaders, body });
        } else {
            res = await fetch(`${API_BASE}/data/admin/zones/${zoneModal?.zone?.zone_id}`, { method: "PUT", headers: authHeaders, body });
        }
        const d = await res.json();
        if (!res.ok) return Alert.alert("Error", d.message || "Failed");
        setZoneModal(null);
        fetchZones();
    };

    const deleteZone = (id: number, name: string) => {
        Alert.alert("Delete Zone", `Delete "${name}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    await fetch(`${API_BASE}/data/admin/zones/${id}`, { method: "DELETE", headers: authHeaders });
                    fetchZones();
                }
            },
        ]);
    };

    useEffect(() => { if (token) { fetchTrains(); fetchZones(); } }, [token]);

    const logout = async () => {
        await SecureStore.deleteItemAsync("adminToken");
        router.replace("/");
    };

    if (!token) return <View style={styles.container}><ActivityIndicator color="#58a6ff" size="large" /></View>;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>⚙ Admin Panel</Text>
                <TouchableOpacity onPress={logout}><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, tab === "trains" && styles.tabActive]} onPress={() => setTab("trains")}>
                    <Text style={[styles.tabText, tab === "trains" && styles.tabTextActive]}>Trains</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, tab === "zones" && styles.tabActive]} onPress={() => setTab("zones")}>
                    <Text style={[styles.tabText, tab === "zones" && styles.tabTextActive]}>Zones</Text>
                </TouchableOpacity>
            </View>

            {/* ── TRAINS TAB ── */}
            {tab === "trains" && (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    {/* Add train form */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Add Train</Text>
                        <TextInput style={styles.input} placeholder="Train Name" placeholderTextColor="#555" value={newTrainName} onChangeText={setNewTrainName} autoCapitalize="none" />
                        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#555" value={newTrainPass} onChangeText={setNewTrainPass} secureTextEntry />
                        <TouchableOpacity style={styles.addBtn} onPress={addTrain}>
                            <Text style={styles.addBtnText}>+ Add Train</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Train list */}
                    <Text style={styles.sectionTitle}>Registered Trains ({trains.length})</Text>
                    {trains.map((t) => (
                        <View key={t.train_id} style={styles.listRow}>
                            <View>
                                <Text style={styles.listName}>{t.train_name}</Text>
                                <Text style={styles.listSub}>ID: {t.train_id}</Text>
                            </View>
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTrain(t.train_id, t.train_name)}>
                                <Text style={styles.deleteBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* ── ZONES TAB ── */}
            {tab === "zones" && (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity style={styles.addBtn} onPress={openAddZone}>
                        <Text style={styles.addBtnText}>+ Add Zone</Text>
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>Zones ({zones.length})</Text>
                    {zones.map((z) => (
                        <View key={z.zone_id} style={styles.listRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.listName}>{z.zone_name}</Text>
                                <Text style={styles.listSub}>{z.device_code}  •  {STATUS_LABEL[z.status]}</Text>
                                <Text style={styles.listSub}>
                                    {z.latitude && z.longitude
                                        ? `${parseFloat(z.latitude).toFixed(5)}, ${parseFloat(z.longitude).toFixed(5)}`
                                        : "No GPS"}
                                </Text>
                            </View>
                            <View style={styles.rowActions}>
                                <TouchableOpacity style={styles.editBtn} onPress={() => openEditZone(z)}>
                                    <Text style={styles.editBtnText}>✎</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteZone(z.zone_id, z.zone_name)}>
                                    <Text style={styles.deleteBtnText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* ── ZONE ADD/EDIT MODAL ── */}
            <Modal visible={!!zoneModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>{zoneModal?.mode === "add" ? "Add Zone" : "Edit Zone"}</Text>
                        <TextInput style={styles.input} placeholder="Zone Name" placeholderTextColor="#555" value={zName} onChangeText={setZName} />
                        <TextInput style={styles.input} placeholder="Device Code (e.g. ZONE_1)" placeholderTextColor="#555" value={zCode} onChangeText={setZCode} autoCapitalize="characters" />
                        <TextInput style={styles.input} placeholder="Latitude (optional)" placeholderTextColor="#555" value={zLat} onChangeText={setZLat} keyboardType="numeric" />
                        <TextInput style={styles.input} placeholder="Longitude (optional)" placeholderTextColor="#555" value={zLon} onChangeText={setZLon} keyboardType="numeric" />
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={[styles.addBtn, { flex: 1, marginRight: 8 }]} onPress={saveZone}>
                                <Text style={styles.addBtnText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setZoneModal(null)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0d1117" },
    header: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12,
        backgroundColor: "#161b22", borderBottomWidth: 1, borderBottomColor: "#30363d",
    },
    headerTitle: { color: "#58a6ff", fontSize: 18, fontWeight: "bold", letterSpacing: 1 },
    logoutText: { color: "#f85149", fontSize: 14 },
    tabs: { flexDirection: "row", backgroundColor: "#161b22" },
    tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabActive: { borderBottomColor: "#58a6ff" },
    tabText: { color: "#8b949e", fontSize: 14, fontWeight: "bold" },
    tabTextActive: { color: "#58a6ff" },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: { backgroundColor: "#161b22", borderRadius: 10, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#30363d" },
    cardTitle: { color: "#c9d1d9", fontSize: 14, fontWeight: "bold", marginBottom: 10 },
    input: {
        backgroundColor: "#0d1117", borderWidth: 1, borderColor: "#30363d",
        borderRadius: 8, color: "#fff", paddingHorizontal: 14, paddingVertical: 10,
        fontSize: 14, marginBottom: 10,
    },
    addBtn: { backgroundColor: "#238636", borderRadius: 8, paddingVertical: 11, alignItems: "center" },
    addBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
    cancelBtn: { backgroundColor: "#30363d", borderRadius: 8, paddingVertical: 11, alignItems: "center" },
    cancelBtnText: { color: "#c9d1d9", fontSize: 14 },
    sectionTitle: { color: "#8b949e", fontSize: 12, letterSpacing: 1, marginBottom: 8, marginTop: 4 },
    listRow: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        backgroundColor: "#161b22", borderRadius: 8, padding: 14,
        marginBottom: 8, borderWidth: 1, borderColor: "#30363d",
    },
    listName: { color: "#fff", fontSize: 14, fontWeight: "bold" },
    listSub: { color: "#8b949e", fontSize: 12, marginTop: 2 },
    rowActions: { flexDirection: "row", gap: 8 },
    editBtn: {
        width: 34, height: 34, borderRadius: 6, backgroundColor: "#1f6feb",
        alignItems: "center", justifyContent: "center",
    },
    editBtnText: { color: "#fff", fontSize: 16 },
    deleteBtn: {
        width: 34, height: 34, borderRadius: 6, backgroundColor: "#da3633",
        alignItems: "center", justifyContent: "center",
    },
    deleteBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    modalCard: {
        backgroundColor: "#161b22", borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: 24, borderWidth: 1, borderColor: "#30363d",
    },
    modalTitle: { color: "#58a6ff", fontSize: 16, fontWeight: "bold", marginBottom: 16 },
    modalBtns: { flexDirection: "row", marginTop: 4 },
});
