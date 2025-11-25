import { useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();   // This must be inside the component

  const [train_name, setTrainName] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    try {
      const res = await api.post("/auth/login", { train_name, password });
      localStorage.setItem("token", res.data.token);
      alert("Login success!");
      navigate("/dashboard");       // navigate works correctly now
    } catch (err) {
      alert("Login failed");
    }
  };

  return (
    <div className="page-wrapper fade-in">
      <h2>Login</h2>

      <input
        placeholder="Train Name"
        onChange={(e) => setTrainName(e.target.value)}
      />

      <input
        placeholder="Password"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={login}>Login</button>
    </div>
  );
}
