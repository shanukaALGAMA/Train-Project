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

export default function LoginScreen() {
    const router = useRouter();
    const [trainName, setTrainName] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const login = async () => {
        if (!trainName || !password) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ train_name: trainName, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                Alert.alert("Login Failed", data.message || "Invalid credentials");
                return;
            }

            await SecureStore.setItemAsync("token", data.token);
            router.replace("/dashboard");
        } catch (err) {
            Alert.alert("Error", "Cannot connect to server. Check your network.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>SEIDS</Text>
                <Text style={styles.subtitle}>Train Safety System</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Train Name"
                    placeholderTextColor="#888"
                    value={trainName}
                    onChangeText={setTrainName}
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
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.loginBtnText}>LOGIN</Text>
                    )}
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
        borderColor: "#30363d",
    },
    title: {
        color: "#fff",
        fontSize: 36,
        fontWeight: "bold",
        textAlign: "center",
        letterSpacing: 4,
    },
    subtitle: {
        color: "#8b949e",
        fontSize: 14,
        textAlign: "center",
        marginBottom: 32,
        letterSpacing: 1,
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
        backgroundColor: "#238636",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 8,
    },
    loginBtnText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
        letterSpacing: 2,
    },
});
