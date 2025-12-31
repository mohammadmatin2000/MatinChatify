import { useState } from "react";
import GroupsList from "./GroupsList";
import GroupChatContainer from "./GroupChatContainer";
import { ArrowLeftIcon } from "lucide-react";

function GroupsPage() {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const accessToken = localStorage.getItem("accessToken");

  return (
    <div className="h-full flex flex-col">
      {selectedGroup ? (
        <div className="flex flex-col h-full">
          <button
            onClick={() => setSelectedGroup(null)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white hover:bg-slate-600"
          >
            <ArrowLeftIcon className="size-4" />
            بازگشت به گروه‌ها
          </button>
          <div className="flex-1 overflow-y-auto">
            <GroupChatContainer group={selectedGroup} accessToken={accessToken} />
          </div>
        </div>
      ) : (
        <GroupsList onSelectGroup={setSelectedGroup} />
      )}
    </div>
  );
}

export default GroupsPage;
