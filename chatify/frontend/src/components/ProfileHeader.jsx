import {useState, useEffect, useRef, useCallback} from "react";
import {
    LogOutIcon,
    VolumeOffIcon,
    Volume2Icon,
    PencilIcon,
    PlusIcon,
    PhoneIcon,
    MailIcon,
    XIcon,
    UserIcon,
    UserPlus,
    Search,
    Check,
    UsersIcon,
    Radio,
} from "lucide-react";
import {useChatStore} from "../store/useChatStore";
import {useCallStore} from "../store/useCallStore";
import CreateChannelModal from "./CreateChannelModal";
import axios from "axios";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");
const API_BASE_URL = "http://localhost:8000";

function ProfileHeader({onNewGroup}) {
    const {
        logout,
        allContacts,
        getAllContacts,
        addContact,
        searchResults,
        isSearching,
        searchUsers,
        clearSearch,
    } = useChatStore();

    const {disconnectCallSocket} = useCallStore();

    const [profile, setProfile] = useState({first_name: "", image: "/avatar.png"});
    const [isEditingName, setIsEditingName] = useState(false);
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);
    const [selectedImg, setSelectedImg] = useState(null);
    const [showNewMenu, setShowNewMenu] = useState(false);

    // ---- مودال افزودن مخاطب ----
    const [showAddContact, setShowAddContact] = useState(false);
    const [addContactTab, setAddContactTab] = useState("phone"); // "phone" | "email"

    // تب شماره
    const [contactPhone, setContactPhone] = useState("");
    const [contactDisplayName, setContactDisplayName] = useState("");
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [addContactError, setAddContactError] = useState("");
    const [addContactSuccess, setAddContactSuccess] = useState(false);

    // تب ایمیل
    const [contactQuery, setContactQuery] = useState("");
    const [addingId, setAddingId] = useState(null);
    const debounceRef = useRef(null);

    // ---- مودال ساخت گروه ----
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    // ---- مودال ساخت چنل ----
    const [showCreateChannel, setShowCreateChannel] = useState(false);

    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const accessToken = localStorage.getItem("accessToken");

    useEffect(() => {
        if (!accessToken) return;
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/accounts/profile/update/`, {
                    headers: {Authorization: `Bearer ${accessToken}`},
                });
                setProfile(res.data);
            } catch {
            }
        };
        fetchProfile();
    }, [accessToken]);

    useEffect(() => {
        if (isEditingName && inputRef.current) inputRef.current.focus();
    }, [isEditingName]);

    const handleLogout = async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        try {
            await axios.post(
                `${API_BASE_URL}/accounts/logout/`,
                {refresh: refreshToken},
                {headers: {Authorization: `Bearer ${accessToken}`}}
            );
        } catch {
        } finally {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            disconnectCallSocket();
            logout();
            window.location.replace("/login");
        }
    };

    const handleToggleSound = () => {
        try {
            mouseClickSound.currentTime = 0;
            mouseClickSound.play();
        } catch {
        }
        setIsSoundEnabled((prev) => !prev);
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("image", file);
        formData.append("first_name", profile.first_name || "");

        try {
            const res = await axios.patch(`${API_BASE_URL}/accounts/profile/update/`, formData, {
                headers: {Authorization: `Bearer ${accessToken}`},
            });
            setProfile(res.data);
            setSelectedImg(URL.createObjectURL(file));
        } catch {
        }
    };

    const handleNameChange = async () => {
        try {
            const formData = new FormData();
            formData.append("first_name", profile.first_name);
            const res = await axios.patch(`${API_BASE_URL}/accounts/profile/update/`, formData, {
                headers: {Authorization: `Bearer ${accessToken}`},
            });
            setProfile(res.data);
        } catch {
        }
    };

    // ========================== مودال افزودن مخاطب ==========================
    const openAddContact = () => {
        setShowNewMenu(false);
        setAddContactTab("phone");
        setContactPhone("");
        setContactDisplayName("");
        setContactQuery("");
        clearSearch();
        setAddContactError("");
        setAddContactSuccess(false);
        setShowAddContact(true);
    };

    const closeAddContact = () => {
        setShowAddContact(false);
        setContactPhone("");
        setContactDisplayName("");
        setContactQuery("");
        clearSearch();
        setAddContactError("");
        setAddContactSuccess(false);
    };

    const handleAddContactByPhone = async (e) => {
        e.preventDefault();
        setAddContactError("");
        setAddContactSuccess(false);

        if (!/^09\d{9}$/.test(contactPhone)) {
            setAddContactError("شماره موبایل معتبر نیست.");
            return;
        }
        if (!contactDisplayName.trim()) {
            setAddContactError("یه اسم برای این مخاطب وارد کن.");
            return;
        }

        setIsAddingContact(true);
        const result = await addContact({phoneNumber: contactPhone, displayName: contactDisplayName.trim()});
        setIsAddingContact(false);

        if (result) {
            setAddContactSuccess(true);
            setContactPhone("");
            setContactDisplayName("");
        } else {
            setAddContactError("این شماره توی چتیفای ثبت‌نام نکرده.");
        }
    };

    const handleContactQueryChange = useCallback(
        (value) => {
            setContactQuery(value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                searchUsers(value);
            }, 350);
        },
        [searchUsers]
    );

    const handleAddContactByEmail = async (user) => {
        setAddingId(user.id);
        await addContact({userId: user.id, displayName: user.name || user.email});
        setAddingId(null);
    };

    // ========================== مودال ساخت گروه ==========================
    const openCreateGroup = () => {
        setShowNewMenu(false);
        setGroupName("");
        setGroupDescription("");
        setSelectedMemberIds([]);
        getAllContacts();
        setShowCreateGroup(true);
    };

    const closeCreateGroup = () => {
        setShowCreateGroup(false);
        setGroupName("");
        setGroupDescription("");
        setSelectedMemberIds([]);
    };

    const toggleMember = (contactId) => {
        setSelectedMemberIds((prev) =>
            prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
        );
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim() || isCreatingGroup) return;
        setIsCreatingGroup(true);

        try {
            const res = await axios.post(
                `${API_BASE_URL}/groups/groups/`,
                {
                    name: groupName.trim(),
                    description: groupDescription.trim() || "گروه جدید",
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const newGroup = res.data;

            try {
                await axios.post(
                    `${API_BASE_URL}/groups/members/`,
                    {group: newGroup.id, role: "admin"},
                    {headers: {Authorization: `Bearer ${accessToken}`}}
                );
            } catch (err) {
                console.warn("خطا در افزودن سازنده به گروه:", err.response?.data || err);
            }

            await Promise.all(
                selectedMemberIds.map((memberId) =>
                    axios
                        .post(
                            `${API_BASE_URL}/groups/members/`,
                            {group: newGroup.id, user: memberId, role: "member"},
                            {headers: {Authorization: `Bearer ${accessToken}`}}
                        )
                        .catch((err) => console.warn("خطا در افزودن عضو:", err.response?.data || err))
                )
            );

            if (onNewGroup) onNewGroup(newGroup);
            closeCreateGroup();
        } catch (err) {
            console.error("خطا در ساخت گروه:", err.response?.data || err);
        } finally {
            setIsCreatingGroup(false);
        }
    };

    // ========================== مودال ساخت چنل ==========================
    const openCreateChannel = () => {
        setShowNewMenu(false);
        setShowCreateChannel(true);
    };

    if (!accessToken) return null;

    return (
        <div className="p-6 border-b border-slate-700/50 relative">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="avatar online">
                        <button
                            className="size-14 rounded-full overflow-hidden relative group"
                            onClick={() => fileInputRef.current.click()}
                        >
                            <img
                                src={selectedImg || profile.image || "/avatar.png"}
                                alt="User"
                                className="size-full object-cover"
                            />
                            <div
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-white text-xs">تغییر</span>
                            </div>
                        </button>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            className="hidden"
                        />
                    </div>

                    <div className="relative group">
                        {isEditingName ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={profile.first_name || ""}
                                onChange={(e) => setProfile({...profile, first_name: e.target.value})}
                                onBlur={() => {
                                    setIsEditingName(false);
                                    handleNameChange();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        setIsEditingName(false);
                                        handleNameChange();
                                    }
                                }}
                                className="bg-transparent border-b border-cyan-400 outline-none text-slate-200 text-sm px-1 transition-all duration-200"
                            />
                        ) : (
                            <div
                                className="text-slate-200 font-medium text-base flex items-center gap-1 cursor-pointer group-hover:text-cyan-300 transition-colors"
                                onClick={() => setIsEditingName(true)}
                            >
                                <span>{profile.first_name || "کاربر ناشناس"}</span>
                                <PencilIcon className="size-3 opacity-0 group-hover:opacity-80 transition-opacity"/>
                            </div>
                        )}
                        <p className="text-slate-400 text-xs mt-1">آنلاین</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 relative z-50">
                    <button
                        onClick={handleLogout}
                        className="text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
                        title="خروج از حساب"
                    >
                        <LogOutIcon className="size-5"/>
                    </button>

                    <button
                        onClick={handleToggleSound}
                        className="text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
                        title={isSoundEnabled ? "قطع صدا" : "پخش صدا"}
                    >
                        {isSoundEnabled ? <Volume2Icon className="size-5"/> : <VolumeOffIcon className="size-5"/>}
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowNewMenu((prev) => !prev)}
                            className="text-slate-300 hover:text-cyan-400 hover:bg-slate-700/60 transition-colors flex items-center justify-center rounded-full size-8"
                            title="ساخت جدید"
                        >
                            <PlusIcon className="size-6"/>
                        </button>
                    </div>

                    {showNewMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)}/>
                            <div
                                className="absolute top-full left-1/2 -translate-x-1/3 mt-2 bg-slate-800 rounded-lg shadow-lg w-56 flex flex-col z-50 overflow-hidden border border-slate-700/50">
                                <button
                                    onClick={openCreateGroup}
                                    className="flex items-center gap-2 p-3 hover:bg-slate-700 cursor-pointer text-white text-sm text-right whitespace-nowrap"
                                >
                                    <UsersIcon className="w-4 h-4 text-cyan-400 shrink-0"/>
                                    ساخت گروه
                                </button>

                                <button
                                    onClick={openAddContact}
                                    className="flex items-center gap-2 p-3 hover:bg-slate-700 cursor-pointer text-white text-sm text-right border-t border-slate-700/50 whitespace-nowrap"
                                >
                                    <UserPlus className="w-4 h-4 text-cyan-400 shrink-0"/>
                                    ساخت مخاطب
                                </button>
                                <button
                                    onClick={openCreateChannel}
                                    className="flex items-center gap-2 p-3 hover:bg-slate-700 cursor-pointer text-white text-sm text-right border-t border-slate-700/50 whitespace-nowrap"
                                >
                                    <Radio className="w-4 h-4 text-violet-400 shrink-0"/>
                                    ساخت چنل
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* مودال افزودن مخاطب - دو تب: شماره / ایمیل */}
            {showAddContact && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={closeAddContact}
                >
                    <div
                        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[75vh] flex flex-col overflow-hidden border border-slate-700/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
                            <h3 className="text-slate-100 font-semibold text-base">افزودن مخاطب جدید</h3>
                            <button onClick={closeAddContact}
                                    className="text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-5 h-5"/>
                            </button>
                        </div>

                        <div className="flex border-b border-slate-700/50 flex-shrink-0">
                            <button
                                onClick={() => setAddContactTab("phone")}
                                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                                    addContactTab === "phone"
                                        ? "text-cyan-400 border-b-2 border-cyan-400"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                با شماره موبایل
                            </button>
                            <button
                                onClick={() => setAddContactTab("email")}
                                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                                    addContactTab === "email"
                                        ? "text-cyan-400 border-b-2 border-cyan-400"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                با ایمیل
                            </button>
                        </div>

                        {addContactTab === "phone" && (
                            <form onSubmit={handleAddContactByPhone} className="p-5 space-y-4">
                                {addContactError && (
                                    <p className="text-red-500 text-sm text-center">{addContactError}</p>
                                )}
                                {addContactSuccess && (
                                    <p className="text-green-500 text-sm text-center">مخاطب با موفقیت اضافه شد ✅</p>
                                )}

                                <div>
                                    <label className="text-slate-400 text-xs mb-1 block">شماره موبایل</label>
                                    <div className="relative flex items-center bg-slate-900/60 rounded-lg px-3 py-2">
                                        <PhoneIcon className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                        <input
                                            autoFocus
                                            type="tel"
                                            value={contactPhone}
                                            onChange={(e) => setContactPhone(e.target.value)}
                                            placeholder="09123456789"
                                            dir="ltr"
                                            className="bg-transparent outline-none text-sm text-slate-200 w-full placeholder:text-slate-500 mr-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-slate-400 text-xs mb-1 block">اسم مخاطب</label>
                                    <div className="relative flex items-center bg-slate-900/60 rounded-lg px-3 py-2">
                                        <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                        <input
                                            type="text"
                                            value={contactDisplayName}
                                            onChange={(e) => setContactDisplayName(e.target.value)}
                                            placeholder="مثلاً: علی رضایی"
                                            className="bg-transparent outline-none text-sm text-slate-200 w-full placeholder:text-slate-500 mr-2"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isAddingContact}
                                    className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <UserPlus className="w-4 h-4"/>
                                    {isAddingContact ? "در حال افزودن..." : "افزودن مخاطب"}
                                </button>
                            </form>
                        )}

                        {addContactTab === "email" && (
                            <>
                                <div className="p-3 border-b border-slate-700/50 flex-shrink-0">
                                    <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2">
                                        <Search className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={contactQuery}
                                            onChange={(e) => handleContactQueryChange(e.target.value)}
                                            placeholder="ایمیل کاربر را وارد کنید..."
                                            className="bg-transparent outline-none text-sm text-slate-200 w-full placeholder:text-slate-500"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-y-auto flex-1">
                                    {isSearching && (
                                        <p className="text-center text-slate-500 text-sm py-4">در حال جستجو...</p>
                                    )}

                                    {!isSearching && contactQuery.trim() && searchResults.length === 0 && (
                                        <p className="text-center text-slate-500 text-sm py-4">کاربری یافت نشد</p>
                                    )}

                                    {!contactQuery.trim() && (
                                        <p className="text-center text-slate-500 text-sm py-6">
                                            با ایمیل، مخاطب موردنظرت رو جستجو کن
                                        </p>
                                    )}

                                    {searchResults.map((user) => (
                                        <div
                                            key={user.id}
                                            className="flex items-center gap-3 p-3 hover:bg-slate-700/40 transition-colors"
                                        >
                                            <div
                                                className="w-10 h-10 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                <img
                                                    src={user.profile || "/avatar.png"}
                                                    alt={user.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => (e.target.src = "/avatar.png")}
                                                />
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span
                                                    className="text-slate-200 text-sm font-medium truncate">{user.name}</span>
                                                <span
                                                    className="text-slate-500 text-xs truncate">{user.email}</span>
                                            </div>
                                            {user.is_contact ? (
                                                <span
                                                    className="flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                                                    <Check className="w-4 h-4"/> افزوده شد
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleAddContactByEmail(user)}
                                                    disabled={addingId === user.id}
                                                    className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-md flex-shrink-0 transition-colors"
                                                >
                                                    <UserPlus className="w-3.5 h-3.5"/>
                                                    {addingId === user.id ? "..." : "افزودن"}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showCreateGroup && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={closeCreateGroup}
                >
                    <div
                        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-slate-700/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
                            <h3 className="text-slate-100 font-semibold text-base">ساخت گروه جدید</h3>
                            <button onClick={closeCreateGroup}
                                    className="text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-5 h-5"/>
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-4">
                            <div>
                                <label className="text-slate-400 text-xs mb-1 block">نام گروه</label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="مثلاً: تیم پروژه"
                                    className="w-full bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="text-slate-400 text-xs mb-1 block">توضیحات (اختیاری)</label>
                                <textarea
                                    value={groupDescription}
                                    onChange={(e) => setGroupDescription(e.target.value)}
                                    placeholder="درباره‌ی این گروه بنویس..."
                                    rows={2}
                                    className="w-full bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 resize-none focus:ring-1 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="text-slate-400 text-xs mb-2 block">
                                    افزودن اعضا از
                                    مخاطبین {selectedMemberIds.length > 0 && `(${selectedMemberIds.length} انتخاب شده)`}
                                </label>

                                {allContacts.length === 0 ? (
                                    <p className="text-slate-500 text-xs py-3 text-center">مخاطبی برای افزودن نداری</p>
                                ) : (
                                    <div
                                        className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700/50">
                                        {allContacts.map((contact) => {
                                            const contactId = contact._id || contact.id;
                                            const isSelected = selectedMemberIds.includes(contactId);

                                            const profilePic = contact.profile?.startsWith("http")
                                                ? contact.profile
                                                : contact.raw?.profile?.startsWith("http")
                                                    ? contact.raw.profile
                                                    : contact.raw?.profile
                                                        ? `${API_BASE_URL}${contact.raw.profile}`
                                                        : "/avatar.png";

                                            return (
                                                <div
                                                    key={contactId}
                                                    onClick={() => toggleMember(contactId)}
                                                    className={`flex items-center gap-3 p-2 cursor-pointer transition-colors ${
                                                        isSelected ? "bg-cyan-600/20" : "hover:bg-slate-700/40"
                                                    }`}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                        <img
                                                            src={profilePic}
                                                            alt={contact.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => (e.target.src = "/avatar.png")}
                                                        />
                                                    </div>
                                                    <span
                                                        className="text-slate-200 text-sm truncate flex-1">{contact.name}</span>
                                                    <div
                                                        className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                                            isSelected ? "bg-cyan-500 border-cyan-500" : "border-slate-500"
                                                        }`}
                                                    >
                                                        {isSelected && <Check className="w-3 h-3 text-white"/>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-700/50 flex-shrink-0">
                            <button
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || isCreatingGroup}
                                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                {isCreatingGroup ? "در حال ساخت..." : "ساخت گروه"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* مودال ساخت چنل */}
            <CreateChannelModal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)} />
        </div>
    );
}

export default ProfileHeader;