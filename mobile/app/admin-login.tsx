import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { API_BASE } from "../constants/api";

export default function AdminLoginScreen() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const login = async () => {
        if (!username || !password) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/data/admin/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                Alert.alert("Login Failed", data.message || "Invalid credentials");
                return;
            }
            await SecureStore.setItemAsync("adminToken", data.token);
            router.replace("/admin");
        } catch {
            Alert.alert("Error", "Cannot connect to server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>⚙ Admin</Text>
                <Text style={styles.subtitle}>Administrator Access</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#888"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#888"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TouchableOpacity style={styles.loginBtn} onPress={login} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>LOGIN</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0d1117",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    card: {
        width: "100%",
        maxWidth: 400,
        backgroundColor: "#161b22",
        borderRadius: 16,
        padding: 32,
        borderWidth: 1,
        borderColor: "#58a6ff",
    },
    title: {
        color: "#58a6ff",
        fontSize: 28,
        fontWeight: "bold",
        textAlign: "center",
        letterSpacing: 2,
        marginBottom: 4,
    },
    subtitle: {
        color: "#8b949e",
        fontSize: 13,
        textAlign: "center",
        marginBottom: 28,
    },
    input: {
        backgroundColor: "#0d1117",
        borderWidth: 1,
        borderColor: "#30363d",
        borderRadius: 8,
        color: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        marginBottom: 14,
    },
    loginBtn: {
        backgroundColor: "#1f6feb",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 4,
    },
    loginBtnText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
        letterSpacing: 2,
    },
    backBtn: {
        marginTop: 16,
        alignItems: "center",
    },
    backBtnText: {
        color: "#8b949e",
        fontSize: 14,
    },
});
