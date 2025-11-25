import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.get("/data/profile").then((res) => setProfile(res.data));
  }, []);

  return (
    <div>
      <h2>Profile</h2>
      {profile ? <pre>{JSON.stringify(profile, null, 2)}</pre> : "Loading..."}
    </div>
  );
}
