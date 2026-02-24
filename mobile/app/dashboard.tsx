import { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    Alert,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { API_BASE, ESP32_IP } from "../constants/api";

// Status code to label mapping
const STATUS_LABEL: Record<number, string> = {
    0: "SAFE",
    1: "APPROACHING",
    2: "OCCUPIED",
};

type ZoneStatus = {
    zone_name: string;
    device_code: string;
    latitude: number | null;
    longitude: number | null;
    status: number;
    checked_at: string;
};

// Haversine formula — returns distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DashboardScreen() {
    const router = useRouter();

    // Location
    const [location, setLocation] = useState<{
        lat: number;
        lon: number;
        accuracy: number;
    } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const mapRef = useRef<MapView>(null);

    // Zones & distance
    const [allZones, setAllZones] = useState<ZoneStatus[]>([]);
    const [closestZone, setClosestZone] = useState<{ zone: ZoneStatus; distance: string } | null>(null);
    const [notification, setNotification] = useState<ZoneStatus | null>(null);
    const locationRef = useRef<{ lat: number; lon: number; accuracy: number } | null>(null);

    // Relay status
    const [relayStatus, setRelayStatus] = useState("");

    // Polling interval ref
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─────────────────────────────
    // LIVE GPS (1-second updates)
    // ─────────────────────────────
    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                setLocationError("Location permission denied.");
                return;
            }

            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 1000,   // update every 1 second
                    distanceInterval: 0,  // update even if not moved
                },
                (loc) => {
                    const newLoc = {
                        lat: loc.coords.latitude,
                        lon: loc.coords.longitude,
                        accuracy: loc.coords.accuracy ?? 0,
                    };
                    setLocation(newLoc);
                    locationRef.current = newLoc;
                }
            );
        })();

        return () => {
            subscription?.remove();
        };
    }, []);

    // ─────────────────────────────
    // ALL ZONES POLLING (every 5 seconds)
    // ─────────────────────────────
    const fetchAllZones = async () => {
        try {
            const res = await fetch(`${API_BASE}/data/zones/all`);
            if (!res.ok) return;
            const zones: ZoneStatus[] = await res.json();
            setAllZones(zones);

            // Trigger notification if any zone is NOT safe
            const danger = zones.find(z => z.status !== 0);
            if (danger) setNotification(danger);

            // Find closest zone with GPS coordinates
            const current = locationRef.current;
            if (current) {
                let minDist = Infinity;
                let nearest: { zone: ZoneStatus; distance: string } | null = null;

                for (const z of zones) {
                    if (z.latitude == null || z.longitude == null) continue;
                    const lat = parseFloat(z.latitude as any);
                    const lon = parseFloat(z.longitude as any);
                    const d = haversine(current.lat, current.lon, lat, lon);
                    if (d < minDist) {
                        minDist = d;
                        const label = d < 1
                            ? `${Math.round(d * 1000)} m`
                            : `${d.toFixed(2)} km`;
                        nearest = { zone: z, distance: label };
                    }
                }
                setClosestZone(nearest);
            }
        } catch (_) {
            // silent fail
        }
    };

    useEffect(() => {
        fetchAllZones();
        pollRef.current = setInterval(fetchAllZones, 5000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ─────────────────────────────
    // RELAY COMMANDS (direct to ESP32)
    // ─────────────────────────────
    const sendCommand = async (device: "ALARM" | "BRAKE", state: "ON" | "OFF") => {
        setRelayStatus(`Sending ${device} ${state}...`);
        try {
            const res = await fetch(`${ESP32_IP}/command`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ device, state }),
            });
            if (res.ok) {
                setRelayStatus(`✅ ${device} ${state}`);
            } else {
                setRelayStatus(`❌ ESP32 returned ${res.status}`);
            }
        } catch (_) {
            setRelayStatus("❌ Could not reach ESP32");
        }
    };

    // ─────────────────────────────
    // LOGOUT
    // ─────────────────────────────
    const logout = async () => {
        await SecureStore.deleteItemAsync("token");
        router.replace("/");
    };

    // ─────────────────────────────
    // RENDER
    // ─────────────────────────────
    return (
        <View style={styles.container}>
            {/* ── DANGER NOTIFICATION MODAL ── */}
            <Modal visible={!!notification} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalIcon}>⚠️</Text>
                        <Text style={styles.modalTitle}>DANGER DETECTED</Text>
                        <Text style={styles.modalZone}>{notification?.zone_name}</Text>
                        <Text style={styles.modalStatus}>
                            Status:{" "}
                            <Text style={styles.modalStatusValue}>
                                {STATUS_LABEL[notification?.status ?? 0]}
                            </Text>
                        </Text>
                        <Text style={styles.modalTime}>
                            Updated: {notification?.checked_at?.slice(0, 19).replace("T", " ")}
                        </Text>
                        <TouchableOpacity
                            style={styles.dismissBtn}
                            onPress={() => setNotification(null)}
                        >
                            <Text style={styles.dismissBtnText}>DISMISS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── MAP (75%) ── */}
            <View style={styles.mapContainer}>
                {location ? (
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        initialRegion={{
                            latitude: location.lat,
                            longitude: location.lon,
                            latitudeDelta: 0.003,
                            longitudeDelta: 0.003,
                        }}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                    >
                        <Marker
                            coordinate={{ latitude: location.lat, longitude: location.lon }}
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <View style={styles.markerOuter}>
                                <View style={styles.markerInner} />
                            </View>
                        </Marker>

                        {/* All zone markers */}
                        {allZones.map((z) => {
                            if (z.latitude == null || z.longitude == null) return null;
                            return (
                                <Marker
                                    key={z.device_code}
                                    coordinate={{
                                        latitude: parseFloat(z.latitude as any),
                                        longitude: parseFloat(z.longitude as any),
                                    }}
                                    title={z.zone_name}
                                    description={`Status: ${STATUS_LABEL[z.status]}`}
                                    pinColor={z.status === 0 ? "#238636" : z.status === 1 ? "#d29922" : "#da3633"}
                                />
                            );
                        })}
                    </MapView>
                ) : (
                    <View style={styles.mapPlaceholder}>
                        <Text style={styles.mapPlaceholderText}>
                            {locationError ?? "Acquiring GPS signal..."}
                        </Text>
                    </View>
                )}

                {/* Coordinate overlay on map */}
                {location && (
                    <View style={styles.mapOverlay}>
                        <Text style={styles.mapOverlayText}>
                            {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
                        </Text>
                        <Text style={styles.mapOverlayAccuracy}>
                            ±{Math.round(location.accuracy)}m
                        </Text>
                    </View>
                )}

                {/* Recenter button */}
                {location && (
                    <TouchableOpacity
                        style={styles.recenterBtn}
                        onPress={() =>
                            mapRef.current?.animateToRegion({
                                latitude: location.lat,
                                longitude: location.lon,
                                latitudeDelta: 0.003,
                                longitudeDelta: 0.003,
                            }, 600)
                        }
                    >
                        <Text style={styles.recenterBtnText}>⊕</Text>
                    </TouchableOpacity>
                )}

                {/* Header bar on top of map */}
                <View style={styles.headerBar}>
                    <Text style={styles.headerText}>SEIDS</Text>
                    {allZones.some(z => z.status !== 0) && (
                        <View style={[
                            styles.statusBadge,
                            allZones.some(z => z.status === 2) ? styles.badgeOccupied
                                : styles.badgeApproaching,
                        ]}>
                            <Text style={styles.statusBadgeText}>
                                {allZones.some(z => z.status === 2) ? "OCCUPIED" : "APPROACHING"}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* ── BOTTOM PANEL (25%) ── */}
            <View style={styles.bottomPanel}>
                {/* Closest zone name + distance */}
                <View style={styles.zoneRow}>
                    <Text style={styles.zoneName}>
                        {closestZone ? `Nearest: ${closestZone.zone.zone_name}` : "Connecting..."}
                    </Text>
                    {closestZone && (
                        <Text style={styles.zoneDistance}>📍 {closestZone.distance}</Text>
                    )}
                </View>

                {/* Controls row */}
                <View style={styles.controlsRow}>
                    {/* ALARM */}
                    <View style={styles.controlGroup}>
                        <Text style={styles.controlLabel}>ALARM</Text>
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={[styles.relayBtn, styles.btnOn]} onPress={() => sendCommand("ALARM", "ON")}>
                                <Text style={styles.relayBtnText}>ON</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.relayBtn, styles.btnOff]} onPress={() => sendCommand("ALARM", "OFF")}>
                                <Text style={styles.relayBtnText}>OFF</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* BRAKE */}
                    <View style={styles.controlGroup}>
                        <Text style={styles.controlLabel}>BRAKE</Text>
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={[styles.relayBtn, styles.btnOn]} onPress={() => sendCommand("BRAKE", "ON")}>
                                <Text style={styles.relayBtnText}>ON</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.relayBtn, styles.btnOff]} onPress={() => sendCommand("BRAKE", "OFF")}>
                                <Text style={styles.relayBtnText}>OFF</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Logout */}
                    <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                        <Text style={styles.logoutBtnText}>⏻</Text>
                    </TouchableOpacity>
                </View>

                {!!relayStatus && <Text style={styles.relayStatus}>{relayStatus}</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0d1117" },

    // Map — 75% of screen
    mapContainer: {
        flex: 3,
        position: "relative",
        backgroundColor: "#161b22",
    },
    map: { flex: 1 },
    mapPlaceholder: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#161b22",
    },
    mapPlaceholderText: { color: "#8b949e", fontSize: 14 },

    // Header bar (overlaid on top of map)
    headerBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 48,
        paddingHorizontal: 16,
        paddingBottom: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "rgba(13,17,23,0.65)",
    },
    headerText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
        letterSpacing: 3,
    },

    // Coordinate overlay (bottom-left of map)
    mapOverlay: {
        position: "absolute",
        bottom: 8,
        left: 8,
        backgroundColor: "rgba(13,17,23,0.75)",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    mapOverlayText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
    mapOverlayAccuracy: { color: "#8b949e", fontSize: 11 },

    // Recenter button
    recenterBtn: {
        position: "absolute",
        bottom: 12,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(13,17,23,0.85)",
        borderWidth: 1,
        borderColor: "#58a6ff",
        alignItems: "center",
        justifyContent: "center",
    },
    recenterBtnText: {
        color: "#58a6ff",
        fontSize: 22,
        lineHeight: 26,
    },

    // Custom marker
    markerOuter: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#1a3a2a",
        borderWidth: 2,
        borderColor: "#39ff14",
        alignItems: "center",
        justifyContent: "center",
        elevation: 8,
    },
    markerInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#39ff14",
        elevation: 4,
    },

    // Status badge (on header bar)
    statusBadge: {
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 5,
    },
    statusBadgeText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
    badgeSafe: { backgroundColor: "#238636" },
    badgeApproaching: { backgroundColor: "#d29922" },
    badgeOccupied: { backgroundColor: "#da3633" },

    // Bottom panel — 25% of screen
    bottomPanel: {
        flex: 1,
        backgroundColor: "#161b22",
        borderTopWidth: 1,
        borderTopColor: "#30363d",
        paddingHorizontal: 16,
        paddingVertical: 10,
        justifyContent: "space-around",
    },
    zoneName: {
        color: "#8b949e",
        fontSize: 12,
        letterSpacing: 1,
    },
    zoneRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    zoneDistance: {
        color: "#39ff14",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 0.5,
    },
    controlsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    controlGroup: {
        alignItems: "center",
        flex: 1,
    },
    controlLabel: {
        color: "#58a6ff",
        fontSize: 11,
        fontWeight: "bold",
        marginBottom: 6,
        letterSpacing: 1,
    },
    btnRow: { flexDirection: "row", gap: 6 },
    divider: {
        width: 1,
        height: 48,
        backgroundColor: "#30363d",
        marginHorizontal: 4,
    },
    relayBtn: {
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    btnOn: { backgroundColor: "#238636" },
    btnOff: { backgroundColor: "#6e7681" },
    relayBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
    relayStatus: { color: "#8b949e", fontSize: 11, marginTop: 4, textAlign: "center" },

    // Logout (power icon)
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#f85149",
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 8,
    },
    logoutBtnText: { color: "#f85149", fontSize: 18 },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalCard: {
        backgroundColor: "#161b22",
        borderRadius: 16,
        padding: 32,
        width: "100%",
        maxWidth: 400,
        borderWidth: 2,
        borderColor: "#da3633",
        alignItems: "center",
    },
    modalIcon: { fontSize: 48, marginBottom: 12 },
    modalTitle: {
        color: "#f85149",
        fontSize: 22,
        fontWeight: "bold",
        letterSpacing: 2,
        marginBottom: 12,
    },
    modalZone: { color: "#fff", fontSize: 16, marginBottom: 8 },
    modalStatus: { color: "#8b949e", fontSize: 15, marginBottom: 4 },
    modalStatusValue: { color: "#ffa657", fontWeight: "bold" },
    modalTime: { color: "#6e7681", fontSize: 13, marginBottom: 24 },
    dismissBtn: {
        backgroundColor: "#da3633",
        borderRadius: 8,
        paddingHorizontal: 40,
        paddingVertical: 14,
    },
    dismissBtnText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
        letterSpacing: 2,
    },
});
