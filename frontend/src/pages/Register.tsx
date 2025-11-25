import { useState } from "react";
import api from "../api/axios";

export default function Register() {
  const [trainName, setTrainName] = useState("");
  const [password, setPassword] = useState("");

  const register = async () => {
    try {
      await api.post("/auth/register", {
        train_name: trainName,
        password,
      });
      alert("Registered!");
    } catch {
      alert("Registration error");
    }
  };

  return (
    <div>
      <h2>Register</h2>
      <input placeholder="Train Name" onChange={(e) => setTrainName(e.target.value)} />
      <input placeholder="Password" type="password" onChange={(e) => setPassword(e.target.value)} />
      <button onClick={register}>Register</button>
    </div>
  );
}
