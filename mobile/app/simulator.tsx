import { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    Alert,
    PanResponder,
    Animated,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import Svg, { Circle } from "react-native-svg";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE } from "../constants/api";
import { Audio } from 'expo-av';

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
// Google Maps dark style
const DARK_MAP_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
    { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1b" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
];

export default function SimulatorScreen() {
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
    const [closestZoneCode, setClosestZoneCode] = useState<string | null>(null); // only updates on actual switch
    const prevClosestZoneCodeRef = useRef<string | null>(null);
    const [notification, setNotification] = useState<ZoneStatus | null>(null);
    const [notificationDistance, setNotificationDistance] = useState<number | null>(null);
    const [notificationClearing, setNotificationClearing] = useState(false);

    const alarmOverriddenRef = useRef(false);
    const [alarmOverridden, setAlarmOverridden] = useState(false);
    const [brakeApplied, setBrakeApplied] = useState(false);
    const lastAlarmCmdRef = useRef<"ON" | "OFF" | null>(null);
    const lastBrakeCmdRef = useRef<"ON" | "OFF" | null>(null);
    const sirenSoundRef = useRef<Audio.Sound | null>(null);

    const locationRef = useRef<{ lat: number; lon: number; accuracy: number } | null>(null);
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Relay status
    const [relayStatus, setRelayStatus] = useState("");
    const [darkMap, setDarkMap] = useState(false);

    // Trajectory & Distance tracking
    const referenceLocRef = useRef<{ lat: number; lon: number } | null>(null);
    const zoneDistancesRef = useRef<{ [code: string]: number[] }>({});

    // Polling interval ref
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─────────────────────────────
    // AUDIO CONTROL
    // ─────────────────────────────
    useEffect(() => {
        // Initialize audio engine
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
        });

        return () => {
            // Cleanup sound on unmount
            if (sirenSoundRef.current) {
                sirenSoundRef.current.unloadAsync();
            }
        }
    }, []);

    const playSiren = async () => {
        try {
            if (!sirenSoundRef.current) {
                const { sound } = await Audio.Sound.createAsync(
                    require('../assets/siren.wav'),
                    { shouldPlay: true, isLooping: true }
                );
                sirenSoundRef.current = sound;
            } else {
                const status = await sirenSoundRef.current.getStatusAsync();
                if (status.isLoaded && !status.isPlaying) {
                    await sirenSoundRef.current.playAsync();
                } else if (!status.isLoaded) {
                    // The sound was unloaded, meaning the player was destroyed. Re-create it.
                    const { sound } = await Audio.Sound.createAsync(
                        require('../assets/siren.wav'),
                        { shouldPlay: true, isLooping: true }
                    );
                    sirenSoundRef.current = sound;
                }
            }
        } catch (error) {
            console.error("Error playing siren: ", error);
            sirenSoundRef.current = null; // Reset so it tries to create next time
        }
    };

    const stopSiren = async () => {
        try {
            if (sirenSoundRef.current) {
                const status = await sirenSoundRef.current.getStatusAsync();
                if (status.isLoaded && status.isPlaying) {
                    await sirenSoundRef.current.stopAsync();
                }
            }
        } catch (error) {
            console.error("Error stopping siren: ", error);
            sirenSoundRef.current = null;
        }
    };

    // ─────────────────────────────
    // SIMULATED GPS (Joystick Control)
    // ─────────────────────────────
    const joystickPan = useRef(new Animated.ValueXY()).current;
    const joystickOffset = useRef({ x: 0, y: 0 });
    const joystickInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const MAX_DRAG = 40; // Max radius of the joystick
    const BASE_SPEED = 0.00015; // Max degrees per tick (approx 16 meters)

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                joystickPan.setOffset({
                    x: (joystickPan.x as any)._value,
                    y: (joystickPan.y as any)._value,
                });
                joystickPan.setValue({ x: 0, y: 0 });

                // Start continuous movement loop
                if (!joystickInterval.current) {
                    joystickInterval.current = setInterval(() => {
                        const { x, y } = joystickOffset.current;
                        if (x === 0 && y === 0) return;

                        // Calculate speed based on how far the stick is pushed
                        const distancePct = Math.min(Math.sqrt(x * x + y * y) / MAX_DRAG, 1);
                        const angle = Math.atan2(y, x);

                        // Y axis on screen is inverted compared to latitude (up = Negative Y = Positive Lat)
                        const dLat = -Math.sin(angle) * BASE_SPEED * distancePct;
                        const dLon = Math.cos(angle) * BASE_SPEED * distancePct;

                        handleMove(dLat, dLon);
                    }, 100); // 10 ticks per second
                }
            },
            onPanResponderMove: (_, gestureState) => {
                // Constrain drag to a circle
                const distance = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);
                let { dx, dy } = gestureState;

                if (distance > MAX_DRAG) {
                    dx = (dx / distance) * MAX_DRAG;
                    dy = (dy / distance) * MAX_DRAG;
                }

                joystickPan.setValue({ x: dx, y: dy });
                joystickOffset.current = { x: dx, y: dy };
            },
            onPanResponderRelease: () => {
                joystickPan.flattenOffset();
                Animated.spring(joystickPan, {
                    toValue: { x: 0, y: 0 },
                    friction: 5,
                    useNativeDriver: false,
                }).start();

                joystickOffset.current = { x: 0, y: 0 };
                if (joystickInterval.current) {
                    clearInterval(joystickInterval.current);
                    joystickInterval.current = null;
                }
            },
            onPanResponderTerminate: () => {
                joystickPan.flattenOffset();
                Animated.spring(joystickPan, {
                    toValue: { x: 0, y: 0 },
                    friction: 5,
                    useNativeDriver: false,
                }).start();

                joystickOffset.current = { x: 0, y: 0 };
                if (joystickInterval.current) {
                    clearInterval(joystickInterval.current);
                    joystickInterval.current = null;
                }
            }
        })
    ).current;

    const handleMove = (dLat: number, dLon: number) => {
        setLocation(prev => {
            if (!prev) return null;
            const newLoc = { ...prev, lat: prev.lat + dLat, lon: prev.lon + dLon };
            locationRef.current = newLoc;

            // Initialize reference location if empty
            if (referenceLocRef.current) {
                const distFromRef = haversine(
                    referenceLocRef.current.lat, referenceLocRef.current.lon,
                    newLoc.lat, newLoc.lon
                );

                if (distFromRef >= 0.02) {
                    referenceLocRef.current = { lat: newLoc.lat, lon: newLoc.lon };
                }
            } else {
                referenceLocRef.current = { lat: newLoc.lat, lon: newLoc.lon };
            }
            return newLoc;
        });
    };

    // ─────────────────────────────
    // ALL ZONES POLLING (every 5 seconds)
    // ─────────────────────────────
    const fetchAllZones = async () => {
        try {
            const res = await fetch(`${API_BASE}/data/zones/all`);
            if (!res.ok) return;
            const zones: ZoneStatus[] = await res.json();
            setAllZones(zones);
        } catch (_) {
            // silent fail
        }
    };

    // ─────────────────────────────
    // REAL-TIME DISTANCE & ALARM LOGIC
    // ─────────────────────────────
    useEffect(() => {
        if (!location || allZones.length === 0) return;

        const current = location;
        type NearestType = { zone: ZoneStatus; distKm: number; label: string } | null;
        let approachingNearest: NearestType = null;
        let absoluteNearest: NearestType = null;
        let previousNearest: NearestType = null;

        let minApproachingDist = Infinity;
        let minAbsDist = Infinity;

        for (const z of allZones) {
            if (z.latitude == null || z.longitude == null || !z.device_code) continue;
            const lat = parseFloat(z.latitude as any);
            const lon = parseFloat(z.longitude as any);
            const d = haversine(current.lat, current.lon, lat, lon);

            const label = d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(2)} km`;
            const zoneData = { zone: z, distKm: d, label };

            if (z.device_code === prevClosestZoneCodeRef.current) {
                previousNearest = zoneData;
            }

            // 1. Maintain distance history buffer (max 3 ticks)
            if (!zoneDistancesRef.current[z.device_code]) {
                zoneDistancesRef.current[z.device_code] = [];
            }
            const history = zoneDistancesRef.current[z.device_code];
            history.push(d);
            if (history.length > 3) history.shift();

            // 2. Track absolute closest (fallback/global nearest)
            if (d < minAbsDist) {
                minAbsDist = d;
                absoluteNearest = zoneData;
            }

            // 3. Determine if actively approaching
            if (history.length >= 2) {
                // difference from oldest recorded point to current
                const delta = history[0] - d;
                // if delta is positive, distance is shrinking -> we are approaching
                // require at least 5 meters of movement to filter GPS noise/drift
                if (delta > 0.005) {
                    if (d < minApproachingDist) {
                        minApproachingDist = d;
                        approachingNearest = zoneData;
                    }
                }
            }
        }

        // Use approaching nearest if valid, otherwise fallback to the previously selected one (prevents flipping when stationary)
        // If all else fails (e.g. startup), use absolute nearest.
        const nearest = approachingNearest || previousNearest || absoluteNearest;

        if (nearest) {
            setClosestZone({ zone: nearest.zone, distance: nearest.label });
            // Only update closestZoneCode state if it actually changed — avoids map re-render every poll
            const newCode = nearest.zone.device_code ?? null;
            if (newCode !== prevClosestZoneCodeRef.current) {
                prevClosestZoneCodeRef.current = newCode;
                setClosestZoneCode(newCode);
            }

            if (nearest.zone.status !== 0 && nearest.distKm <= 5) {
                // Closest zone is UNSAFE
                if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null; }
                setNotificationClearing(false);
                setNotification(nearest.zone);
                setNotificationDistance(nearest.distKm);

                if (!alarmOverriddenRef.current && lastAlarmCmdRef.current !== "ON") {
                    sendCommand("ALARM", "ON");
                    lastAlarmCmdRef.current = "ON";
                    playSiren();
                }

                // Automatic Brake at 2km if NOT acknowledged
                if (nearest.distKm < 2.0 && !alarmOverriddenRef.current) {
                    if (lastBrakeCmdRef.current !== "ON") {
                        sendCommand("BRAKE", "ON");
                        lastBrakeCmdRef.current = "ON";
                        setBrakeApplied(true);
                    }
                }
            } else {
                // Closest zone is SAFE — transition notification to safe then auto-close
                if (alarmOverriddenRef.current) {
                    alarmOverriddenRef.current = false;
                    setAlarmOverridden(false);
                }

                setNotification(prev => {
                    if (prev && !notificationClearing) {
                        setNotificationClearing(true);
                        if (lastAlarmCmdRef.current !== "OFF") {
                            sendCommand("ALARM", "OFF");
                            lastAlarmCmdRef.current = "OFF";
                            stopSiren();
                        }
                        if (lastBrakeCmdRef.current !== "OFF") {
                            sendCommand("BRAKE", "OFF");
                            lastBrakeCmdRef.current = "OFF";
                            setBrakeApplied(false);
                        }
                        clearTimerRef.current = setTimeout(() => {
                            setNotification(null);
                            setNotificationClearing(false);
                            clearTimerRef.current = null;
                            lastAlarmCmdRef.current = null;
                            lastBrakeCmdRef.current = null;
                        }, 5000);
                    }
                    return prev;
                });
            }
        }
    }, [location, allZones]);

    useEffect(() => {
        // Initial fetch to set starting location near a real zone
        const initializeSimulator = async () => {
            try {
                const res = await fetch(`${API_BASE}/data/zones/all`);
                if (!res.ok) return;
                const zones: ZoneStatus[] = await res.json();
                // Start between Zone 1 and Zone 5 (closer to Zone 5)
                const zone1 = zones.find(z => z.zone_name.includes("Zone 1"));
                const zone5 = zones.find(z => z.zone_name.includes("Zone 5"));

                if (zone1 && zone5 && zone1.latitude && zone1.longitude && zone5.latitude && zone5.longitude) {
                    const lat1 = parseFloat(zone1.latitude as any);
                    const lon1 = parseFloat(zone1.longitude as any);
                    const lat5 = parseFloat(zone5.latitude as any);
                    const lon5 = parseFloat(zone5.longitude as any);

                    // 50% of the way from Zone 1 to Zone 5
                    const lat = lat1 + (lat5 - lat1) * 0.5;
                    const lon = lon1 + (lon5 - lon1) * 0.5;

                    const initialLoc = { lat, lon, accuracy: 1 };
                    setLocation(initialLoc);
                    locationRef.current = initialLoc;
                } else if (zones.length > 0 && zones[0].latitude && zones[0].longitude) {
                    // Fallback to old behavior
                    const lat = parseFloat(zones[0].latitude as any) - 0.005;
                    const lon = parseFloat(zones[0].longitude as any);
                    const initialLoc = { lat, lon, accuracy: 1 };
                    setLocation(initialLoc);
                    locationRef.current = initialLoc;
                }

                fetchAllZones();
            } catch (_) { }
        };

        initializeSimulator();
        pollRef.current = setInterval(fetchAllZones, 5000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ─────────────────────────────
    // RELAY COMMANDS
    // ─────────────────────────────
    const sendCommand = async (device: "ALARM" | "BRAKE", state: "ON" | "OFF") => {
        try {
            const token = await SecureStore.getItemAsync("token");
            await fetch(`${API_BASE}/data/esp32/control`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ device, state }),
            });
        } catch (_) {
            // silently ignore relay errors
        }
    };

    // ─────────────────────────────
    // LOGOUT
    // ─────────────────────────────
    const logout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out of the Simulator?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await SecureStore.deleteItemAsync("token");
                        router.replace("/");
                    }
                }
            ]
        );
    };

    // ─────────────────────────────
    // RENDER
    // ─────────────────────────────
    return (
        <View style={styles.container}>
            {/* ── MAP (75%) ── */}
            <View style={styles.mapContainer}>
                {/* ── NOTIFICATION OVERLAY (danger → safe transition) ── */}
                {!!notification && (
                    <View style={styles.modalOverlay} pointerEvents="box-none">
                        <View style={[
                            styles.modalCard,
                            notificationClearing && styles.modalCardSafe,
                        ]} pointerEvents="auto">
                            {notificationClearing ? (
                                /* ── SAFE MODE ── */
                                <>
                                    <Text style={styles.modalTitleSafe}>✓ ZONE IS NOW SAFE</Text>
                                    <Text style={styles.modalZone}>{notification?.zone_name}</Text>
                                    <View style={styles.ringContainer}>
                                        <Svg width={140} height={140} style={styles.svg}>
                                            <Circle cx={70} cy={70} r={54} stroke="#238636" strokeWidth={10} fill="none" />
                                        </Svg>
                                        <View style={styles.ringCenter}>
                                            <Text style={styles.ringDistValueSafe}>✓</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.modalStatusSafe}>Closing in 5 seconds...</Text>
                                </>
                            ) : (
                                /* ── DANGER MODE ── */
                                <>
                                    <Ionicons name="warning" size={48} color="#f85149" style={styles.modalIcon} />
                                    <Text style={styles.modalTitle}>DANGER DETECTED</Text>
                                    <Text style={styles.modalZone}>{notification?.zone_name}</Text>

                                    {/* Circular distance indicator */}
                                    {(() => {
                                        const MAX_KM = 10;
                                        const dist = notificationDistance ?? MAX_KM;
                                        const clamped = Math.min(dist, MAX_KM);
                                        const progress = 1 - clamped / MAX_KM;
                                        const R = 54;
                                        const circumference = 2 * Math.PI * R;
                                        const strokeDash = circumference * progress;
                                        return (
                                            <View style={styles.ringContainer}>
                                                <Svg width={140} height={140} style={styles.svg}>
                                                    <Circle cx={70} cy={70} r={R} stroke="#30363d" strokeWidth={10} fill="none" />
                                                    <Circle
                                                        cx={70} cy={70} r={R}
                                                        stroke="#da3633" strokeWidth={10} fill="none"
                                                        strokeDasharray={`${strokeDash} ${circumference}`}
                                                        strokeLinecap="round"
                                                        rotation={-90} origin="70,70"
                                                    />
                                                </Svg>
                                                <View style={styles.ringCenter}>
                                                    <Text style={styles.ringDistValue}>
                                                        {dist < 1 ? `${Math.round(dist * 1000)}` : dist.toFixed(2)}
                                                    </Text>
                                                    <Text style={styles.ringDistUnit}>
                                                        {dist < 1 ? "m" : "km"}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    })()}

                                    {/* EMERGENCY BRAKE UI */}
                                    {brakeApplied && (
                                        <View style={styles.brakeBanner}>
                                            <Text style={styles.brakeBannerText}>⚠️ EMERGENCY BRAKES APPLIED</Text>
                                        </View>
                                    )}

                                    <Text style={styles.modalStatus}>
                                        Status:{" "}
                                        <Text style={styles.modalStatusValue}>
                                            {STATUS_LABEL[notification?.status ?? 0]}
                                        </Text>
                                    </Text>
                                    <Text style={styles.modalTime}>
                                        {notification?.checked_at?.slice(0, 19).replace("T", " ")}
                                    </Text>
                                </>
                            )}

                            {!notificationClearing ? (
                                <TouchableOpacity
                                    style={[styles.dismissBtn, { backgroundColor: alarmOverridden ? "#6e7681" : "#da3633" }]}
                                    onPress={() => {
                                        if (!alarmOverridden) {
                                            alarmOverriddenRef.current = true;
                                            setAlarmOverridden(true);

                                            sendCommand("ALARM", "OFF");
                                            lastAlarmCmdRef.current = "OFF";
                                            stopSiren();

                                            if (lastBrakeCmdRef.current === "ON") {
                                                sendCommand("BRAKE", "OFF");
                                                lastBrakeCmdRef.current = "OFF";
                                                setBrakeApplied(false);
                                            }
                                        }
                                    }}
                                    disabled={alarmOverridden}
                                >
                                    <Text style={styles.dismissBtnText}>
                                        {alarmOverridden ? "ALARM SILENCED" : "ACKNOWLEDGE & SILENCE"}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                )}

                {location ? (
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        initialRegion={{
                            latitude: location.lat,
                            longitude: location.lon,
                            latitudeDelta: 0.09,
                            longitudeDelta: 0.09,
                        }}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        customMapStyle={darkMap ? DARK_MAP_STYLE : []}
                    >
                        <Marker
                            coordinate={{ latitude: location.lat, longitude: location.lon }}
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <View style={styles.markerOuter} />
                        </Marker>

                        {/* All zone markers */}
                        {allZones.map((z) => {
                            if (z.latitude == null || z.longitude == null) return null;
                            const isClosest = closestZoneCode === z.device_code;
                            return (
                                <Marker
                                    key={z.device_code}
                                    coordinate={{
                                        latitude: parseFloat(z.latitude as any),
                                        longitude: parseFloat(z.longitude as any),
                                    }}
                                    title={z.device_code}
                                    description={isClosest ? "▶ Nearest zone" : z.zone_name}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                >
                                    {isClosest ? (
                                        <View style={styles.zoneMarkerClosestOuter}>
                                            <View style={styles.zoneMarkerClosestInner} />
                                        </View>
                                    ) : (
                                        <View style={styles.zoneMarkerOuter}>
                                            <View style={styles.zoneMarkerInner} />
                                        </View>
                                    )}
                                </Marker>
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

                {/* Dark mode toggle */}
                <TouchableOpacity
                    style={[styles.mapIconBtn, { bottom: 64 }]}
                    onPress={() => setDarkMap(d => !d)}
                >
                    <Ionicons name={darkMap ? "sunny" : "moon"} size={22} color="#8b949e" />
                </TouchableOpacity>

                {/* Recenter button */}
                {location && (
                    <TouchableOpacity
                        style={styles.mapIconBtn}
                        onPress={() =>
                            mapRef.current?.animateToRegion({
                                latitude: location.lat,
                                longitude: location.lon,
                                latitudeDelta: 0.11,
                                longitudeDelta: 0.11,
                            }, 600)
                        }
                    >
                        <Ionicons name="locate" size={22} color="#8b949e" />
                    </TouchableOpacity>
                )}

                {/* Header bar on top of map */}
                <View style={styles.headerBar}>
                    <Text style={styles.headerText}>SIMULATOR</Text>
                    {closestZone && (
                        <View style={[
                            styles.statusBadge,
                            closestZone.zone.status === 2 ? styles.badgeOccupied
                                : closestZone.zone.status === 1 ? styles.badgeApproaching
                                    : styles.badgeSafe,
                        ]}>
                            <Text style={styles.statusBadgeText}>
                                {closestZone.zone.device_code}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* ── BOTTOM PANEL (25%) ── */}
            <View style={styles.bottomPanel}>
                <View style={styles.simulatorBottomContent}>
                    {/* Closest zone info on the left */}
                    <View style={styles.zoneCenterContainer}>
                        <Text style={styles.zoneNameCenter}>
                            {closestZone ? `Nearest: ${closestZone.zone.zone_name}` : "Connecting to SEIDS..."}
                        </Text>
                        {closestZone && (
                            <Text style={styles.zoneDistanceCenter}>{closestZone.distance}</Text>
                        )}
                    </View>

                    {/* ── SIMULATOR JOYSTICK on the right ── */}
                    <View style={styles.joystickContainer}>
                        <View style={styles.joystickOuter}>
                            <Animated.View
                                style={[
                                    styles.joystickInner,
                                    { transform: joystickPan.getTranslateTransform() }
                                ]}
                                {...panResponder.panHandlers}
                            >
                                <View style={styles.joystickNub} />
                            </Animated.View>
                        </View>
                        <Text style={styles.joystickLabel}>DRIVERS SEAT</Text>
                    </View>
                </View>

                {/* Logout floating bottom right */}
                <TouchableOpacity style={styles.logoutBtnFloating} onPress={logout}>
                    <Ionicons name="power" size={24} color="#f85149" />
                </TouchableOpacity>
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

    // Map icon buttons (recenter + dark mode toggle)
    mapIconBtn: {
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

    // Current location marker — single teal circle
    markerOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#1a56db",
        elevation: 8,
    },
    markerInner: { width: 0, height: 0 }, // unused, kept to avoid missing-style errors

    // Zone markers on map
    zoneMarkerOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#ff0055ff",
        borderWidth: 2,
        borderColor: "#000000ff",
        alignItems: "center",
        justifyContent: "center",
        elevation: 4,
    },
    zoneMarkerInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#000000ff",
    },
    // Closest zone — highlighted
    zoneMarkerClosestOuter: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: "#444444ff",
        borderWidth: 2.5,
        borderColor: "#d2ff58ff",
        alignItems: "center",
        justifyContent: "center",
        elevation: 8,
    },
    zoneMarkerClosestInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#c2ce1dff",
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
        position: "relative",
    },
    simulatorBottomContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 20,
    },
    zoneCenterContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: 20,
        paddingBottom: 30, // nudges the text higher
    },
    zoneNameCenter: {
        color: "#8b949e",
        fontSize: 16,
        letterSpacing: 1,
        marginBottom: 8,
    },
    zoneDistanceCenter: {
        color: "#39ff14",
        fontSize: 32,
        fontWeight: "bold",
        letterSpacing: 1,
    },
    // Joystick
    joystickContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    joystickOuter: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "#161b22",
        borderWidth: 2,
        borderColor: "#30363d",
        alignItems: "center",
        justifyContent: "center",
    },
    joystickInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#2d333b",
        borderWidth: 1,
        borderColor: "#58a6ff",
        alignItems: "center",
        justifyContent: "center",
        elevation: 6,
    },
    joystickNub: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#58a6ff",
        opacity: 0.5,
    },
    joystickLabel: {
        marginTop: 12,
        color: "#8b949e",
        fontSize: 10,
        fontWeight: "bold",
        letterSpacing: 2,
    },
    logoutBtnFloating: {
        position: "absolute",
        bottom: 50,
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "rgba(248, 81, 73, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
    },

    // Modal (now an inline overlay over the map)
    modalOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100, // ensure it sits on top of map
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalCard: {
        backgroundColor: "rgba(22, 27, 34, 0.85)",
        borderRadius: 16,
        padding: 32,
        width: "100%",
        maxWidth: 400,
        borderWidth: 2,
        borderColor: "#da3633",
        alignItems: "center",
        textAlign: "center"
    },
    brakeBanner: {
        backgroundColor: "#da3633",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 12,
        marginBottom: 8,
    },
    brakeBannerText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "bold",
        textAlign: "center",
    },
    modalIcon: { marginBottom: 12 },
    modalTitle: {
        color: "#f85149",
        fontSize: 20,
        fontWeight: "bold",
        letterSpacing: 2,
        marginBottom: 6,
    },
    modalZone: { color: "#fff", fontSize: 15, marginBottom: 12 },
    // Circular distance ring
    ringContainer: {
        width: 140,
        height: 140,
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 12,
    },
    svg: { position: "absolute" },
    ringCenter: {
        alignItems: "center",
        justifyContent: "center",
    },
    ringDistValue: {
        color: "#f85149",
        fontSize: 30,
        fontWeight: "bold",
        lineHeight: 34,
    },
    ringDistUnit: {
        color: "#8b949e",
        fontSize: 13,
    },
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
        fontSize: 14,
        letterSpacing: 1,
    },
    // Safe-mode variants
    modalCardSafe: { borderColor: "#238636" },
    modalTitleSafe: {
        color: "#3fb950",
        fontSize: 20,
        fontWeight: "bold",
        letterSpacing: 2,
        marginBottom: 6,
    },
    ringDistValueSafe: {
        color: "#3fb950",
        fontSize: 48,
        fontWeight: "bold",
    },
    modalStatusSafe: {
        color: "#8b949e",
        fontSize: 13,
        marginBottom: 20,
    },
    dismissBtnSafe: { backgroundColor: "#238636" },
});
