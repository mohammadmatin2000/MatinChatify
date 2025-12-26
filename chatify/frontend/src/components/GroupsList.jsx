import { useState, useEffect } from "react";
import ChatContainer from "./ChatContainer";
import axios from "axios";

function GroupsList() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const accessToken = localStorage.getItem("accessToken");

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await axios.get("http://localhost:8000/groups/groups/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setGroups(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchGroups();
  }, [accessToken]);

  if (selectedGroup) {
    return <ChatContainer group={selectedGroup} />;
  }

  return (
    <div className="relative mt-4">
      {groups.length === 0 ? (
        <div className="text-center text-gray-400 mt-6">هیچ گروهی موجود نیست</div>
      ) : (
        <ul className="space-y-2 mt-2">
          {groups.map((g) => (
            <li
              key={g.id || g._id}
              className="p-2 bg-slate-700 rounded cursor-pointer hover:bg-slate-600"
              onClick={() => setSelectedGroup(g)}
            >
              {g.name} ({g.members?.length || 0} عضو)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default GroupsList;
