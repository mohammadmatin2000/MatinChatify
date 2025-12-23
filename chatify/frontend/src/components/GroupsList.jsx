import { useState } from "react";
import ChatContainer from "./ChatContainer"; // سمت راست برای گروه انتخاب شده

function GroupsList() {
  const [groups, setGroups] = useState([]); // لیست گروه‌ها
  const [selectedGroup, setSelectedGroup] = useState(null); // گروه انتخاب شده

  if (selectedGroup) {
    return <ChatContainer group={selectedGroup} />;
  }

  return (
    <div className="relative">
      {/* لیست گروه‌ها یا پیام خالی */}
      {groups.length === 0 ? (
        <div className="text-center text-gray-400 mt-6">
          هیچ گروهی موجود نیست
        </div>
      ) : (
        <ul className="space-y-2 mt-2">
          {groups.map((g) => (
            <li
              key={g._id}
              className="p-2 bg-slate-700 rounded cursor-pointer hover:bg-slate-600"
              onClick={() => setSelectedGroup(g)}
            >
              {g.name} ({g.members.length} عضو)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default GroupsList;
