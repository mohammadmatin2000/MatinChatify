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
    Settings as SettingsIcon,
    ChevronLeft,
    Bell,
    BellOff,
    Lock,
    MessageSquare,
    Database,
    HelpCircle,
    Share2,
    Info,
    Eye,
    EyeOff,
    Globe,
    Shield,
    Image as ImageIcon,
    Smartphone,
    Trash2,
    KeyRound,
    ChevronDown,
    Loader2,
} from "lucide-react";
import {useChatStore} from "../store/useChatStore";
import {useCallStore} from "../store/useCallStore";
import CreateChannelModal from "./CreateChannelModal";
import axios from "axios";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");
const API_BASE_URL = "http://localhost:8000";

// ============================== کامپوننت سوییچ آی‌اواس‌استایل ==============================
function ToggleSwitch({checked, onChange, disabled}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => {
                console.log("🔘 سوییچ کلیک شد. مقدار فعلی:", checked, "=> جدید:", !checked);
                if (!disabled) onChange(!checked);
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                checked ? "bg-cyan-500" : "bg-slate-600"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        >
            <span
                className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                    checked ? "-translate-x-6" : "-translate-x-1"
                }`}
            />
        </button>
    );
}

function SettingRow({icon: Icon, iconColor = "text-cyan-400", title, subtitle, onClick, rightContent, danger}) {
    return (
        <div
            onClick={(e) => {
                console.log("SettingRow clicked:", title);
                if (onClick) onClick(e);
            }}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer hover:bg-slate-700/40 active:bg-slate-700/60"
        >
            {Icon && (
                <div
                    className={`flex items-center justify-center h-9 w-9 rounded-full bg-slate-700/60 flex-shrink-0 ${
                        danger ? "text-red-400" : iconColor
                    }`}
                >
                    <Icon className="h-4.5 w-4.5"/>
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${danger ? "text-red-400" : "text-slate-200"}`}>{title}</p>
                {subtitle && <p className="text-slate-500 text-xs mt-0.5 truncate">{subtitle}</p>}
            </div>
            {rightContent}
        </div>
    );
}

function SectionLabel({children}) {
    return <p className="px-4 pt-4 pb-1 text-xs font-medium text-cyan-500/80">{children}</p>;
}

function SettingsSubHeader({title, onBack, saving}) {
    return (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50 flex-shrink-0 bg-slate-800">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5"/>
            </button>
            <h3 className="text-slate-100 font-semibold text-base flex-1">{title}</h3>
            {saving && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin"/>}
        </div>
    );
}

function RadioOptionGroup({options, value, onChange}) {
    return (
        <div className="divide-y divide-slate-700/40">
            {options.map((opt) => (
                <div
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                >
                    <div>
                        <p className="text-sm text-slate-200">{opt.label}</p>
                        {opt.subtitle && <p className="text-xs text-slate-500 mt-0.5">{opt.subtitle}</p>}
                    </div>
                    <div
                        className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center flex-shrink-0 ${
                            value === opt.value ? "border-cyan-500" : "border-slate-500"
                        }`}
                    >
                        {value === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-cyan-500"/>}
                    </div>
                </div>
            ))}
        </div>
    );
}

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
        isSoundEnabled,
        toggleSound,
    } = useChatStore();

    const {disconnectCallSocket} = useCallStore();

    const [profile, setProfile] = useState({first_name: "", image: "/avatar.png"});
    const [isEditingName, setIsEditingName] = useState(false);
    const [selectedImg, setSelectedImg] = useState(null);
    const [showNewMenu, setShowNewMenu] = useState(false);

    // ---- مودال افزودن مخاطب ----
    const [showAddContact, setShowAddContact] = useState(false);
    const [addContactTab, setAddContactTab] = useState("phone");
    const [contactPhone, setContactPhone] = useState("");
    const [contactDisplayName, setContactDisplayName] = useState("");
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [addContactError, setAddContactError] = useState("");
    const [addContactSuccess, setAddContactSuccess] = useState(false);
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

    // ============================== تنظیمات ==============================
    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState("main");
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsError, setSettingsError] = useState("");
    const settingsLoadedRef = useRef(false);

    const [lastSeen, setLastSeen] = useState("everyone");
    const [photoVisibility, setPhotoVisibility] = useState("everyone");
    const [aboutVisibility, setAboutVisibility] = useState("everyone");
    const [readReceipts, setReadReceipts] = useState(true);
    const [onlineStatus, setOnlineStatus] = useState(true);
    const [twoStepEnabled, setTwoStepEnabled] = useState(false);

    const [notifMessages, setNotifMessages] = useState(true);
    const [notifGroups, setNotifGroups] = useState(true);
    const [notifCalls, setNotifCalls] = useState(true);
    const [notifPreview, setNotifPreview] = useState(true);
    const [notifVibrate, setNotifVibrate] = useState(true);

    const [darkTheme, setDarkTheme] = useState(true);
    const [enterToSend, setEnterToSend] = useState(true);
    const [fontSize, setFontSize] = useState("medium");

    const [autoDownloadWifi, setAutoDownloadWifi] = useState(true);
    const [autoDownloadMobile, setAutoDownloadMobile] = useState(false);

    const [language, setLanguage] = useState("fa");
    const [aboutText, setAboutText] = useState("");

    // ---- تغییر رمز عبور ----
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [changePasswordError, setChangePasswordError] = useState("");
    const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // ---- حذف حساب ----
    const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteAccountError, setDeleteAccountError] = useState("");
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const fileInputRef = useRef(null);
    const settingsAvatarInputRef = useRef(null);
    const inputRef = useRef(null);
    const accessToken = localStorage.getItem("accessToken");
    const authHeaders = {Authorization: `Bearer ${accessToken}`};

    useEffect(() => {
        if (!accessToken) return;
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/accounts/profile/update/`, {
                    headers: authHeaders,
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

    // ---- گرفتن تنظیمات از بک‌اند (اولین باری که پنل تنظیمات باز میشه) ----
    useEffect(() => {
        if (!showSettings || !accessToken || settingsLoadedRef.current) return;

        const fetchSettings = async () => {
            setSettingsLoading(true);
            setSettingsError("");
            try {
                const res = await axios.get(`${API_BASE_URL}/settings/`, {headers: authHeaders});
                const d = res.data;

                setAboutText(d.about_text ?? "");
                setTwoStepEnabled(!!d.two_step_enabled);
                setLastSeen(d.last_seen_visibility ?? "everyone");
                setPhotoVisibility(d.photo_visibility ?? "everyone");
                setAboutVisibility(d.about_visibility ?? "everyone");
                setReadReceipts(!!d.read_receipts);
                setOnlineStatus(!!d.online_status_visible);
                setNotifMessages(!!d.notif_messages);
                setNotifGroups(!!d.notif_groups);
                setNotifCalls(!!d.notif_calls);
                setNotifPreview(!!d.notif_preview);
                setNotifVibrate(!!d.notif_vibrate);
                setDarkTheme(!!d.dark_theme);
                setEnterToSend(!!d.enter_to_send);
                setFontSize(d.font_size ?? "medium");
                setAutoDownloadWifi(!!d.auto_download_wifi);
                setAutoDownloadMobile(!!d.auto_download_mobile);
                setLanguage(d.language ?? "fa");

                if (typeof d.sound_enabled === "boolean" && d.sound_enabled !== isSoundEnabled) {
                    toggleSound();
                }

                settingsLoadedRef.current = true;
            } catch (err) {
                console.error("خطا در دریافت تنظیمات:", err.response?.data || err);
                setSettingsError("دریافت تنظیمات با خطا مواجه شد.");
            } finally {
                setSettingsLoading(false);
            }
        };

        fetchSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSettings, accessToken]);

    // ---- PATCH عمومی برای هر فیلد تنظیمات ----
    const patchSetting = async (field, value) => {
        setSettingsSaving(true);
        setSettingsError("");
        try {
            const res = await axios.patch(`${API_BASE_URL}/settings/`, {[field]: value}, {headers: authHeaders});
            // eslint-disable-next-line no-console
            console.log("✅ PATCH موفق بود:", field, "=>", value, res.data);
        } catch (err) {
            console.error("خطا در ذخیره تنظیمات:", err.response?.data || err);
            // DEBUG TEMP: پاپ‌آپ نشون بده تا بدون DevTools هم خطا معلوم باشه
            alert(
                "❌ ذخیره نشد!\nفیلد: " +
                    field +
                    "\nمقدار: " +
                    value +
                    "\nخطا: " +
                    (err.response
                        ? `status ${err.response.status} - ${JSON.stringify(err.response.data)}`
                        : err.message)
            );
            setSettingsError("ذخیره نشد. دوباره امتحان کن.");
        } finally {
            setSettingsSaving(false);
        }
    };

    const bindToggle = (setter, field) => (value) => {
        setter(value);
        patchSetting(field, value);
    };

    const cycleVisibility = (current, setter, field) => {
        const next = current === "everyone" ? "contacts" : current === "contacts" ? "nobody" : "everyone";
        setter(next);
        patchSetting(field, next);
    };

    const cycleFontSize = () => {
        const next = fontSize === "small" ? "medium" : fontSize === "medium" ? "large" : "small";
        setFontSize(next);
        patchSetting("font_size", next);
    };

    const handleLanguageChange = (value) => {
        setLanguage(value);
        patchSetting("language", value);
    };

    const handleAboutTextBlur = () => {
        patchSetting("about_text", aboutText);
    };

    const handleSoundToggleInSettings = () => {
        handleToggleSound();
        patchSetting("sound_enabled", !isSoundEnabled);
    };

    const handleLogout = async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        try {
            await axios.post(
                `${API_BASE_URL}/accounts/logout/`,
                {refresh: refreshToken},
                {headers: authHeaders}
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
        toggleSound();
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("image", file);
        formData.append("first_name", profile.first_name || "");

        try {
            const res = await axios.patch(`${API_BASE_URL}/accounts/profile/update/`, formData, {
                headers: authHeaders,
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
                headers: authHeaders,
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
                    {headers: authHeaders}
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
                            {headers: authHeaders}
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

    // ========================== تنظیمات: باز/بسته کردن ==========================
    const openSettings = () => {
        setShowNewMenu(false);
        setSettingsView("main");
        setShowSettings(true);
    };

    const closeSettings = () => {
        setShowSettings(false);
        setSettingsView("main");
        setShowDeleteAccountConfirm(false);
        setShowChangePassword(false);
        setChangePasswordError("");
        setChangePasswordSuccess(false);
        setOldPassword("");
        setNewPassword("");
        setDeletePassword("");
        setDeleteAccountError("");
    };

    // ---- تغییر رمز عبور ----
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setChangePasswordError("");
        setChangePasswordSuccess(false);

        if (!oldPassword || !newPassword) {
            setChangePasswordError("هر دو فیلد رو پر کن.");
            return;
        }
        if (newPassword.length < 8) {
            setChangePasswordError("رمز جدید باید حداقل ۸ کاراکتر باشه.");
            return;
        }

        setIsChangingPassword(true);
        try {
            await axios.post(
                `${API_BASE_URL}/settings/change-password/`,
                {old_password: oldPassword, new_password: newPassword},
                {headers: authHeaders}
            );
            setChangePasswordSuccess(true);
            setOldPassword("");
            setNewPassword("");
        } catch (err) {
            const data = err.response?.data;
            const msg =
                data?.old_password?.[0] || data?.new_password?.[0] || data?.detail || "تغییر رمز با خطا مواجه شد.";
            setChangePasswordError(msg);
        } finally {
            setIsChangingPassword(false);
        }
    };

    // ---- حذف حساب ----
    const handleDeleteAccount = async () => {
        setDeleteAccountError("");
        if (!deletePassword) {
            setDeleteAccountError("برای تایید، رمز عبورت رو وارد کن.");
            return;
        }

        setIsDeletingAccount(true);
        try {
            await axios.post(
                `${API_BASE_URL}/settings/delete-account/`,
                {password: deletePassword},
                {headers: authHeaders}
            );
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            disconnectCallSocket();
            logout();
            window.location.replace("/login");
        } catch (err) {
            const data = err.response?.data;
            setDeleteAccountError(data?.password?.[0] || data?.detail || "حذف حساب با خطا مواجه شد.");
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const visibilityLabel = (v) =>
        v === "everyone" ? "همه" : v === "contacts" ? "مخاطبین من" : "هیچ‌کس";

    const fontSizeLabel = (v) => (v === "small" ? "کوچک" : v === "large" ? "بزرگ" : "متوسط");

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
                        onClick={openSettings}
                        className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center justify-center"
                        title="تنظیمات"
                    >
                        <SettingsIcon className="size-5"/>
                    </button>

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

            {/* مودال افزودن مخاطب */}
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

            <CreateChannelModal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)}/>

            {/* ============================== مودال تنظیمات ============================== */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={closeSettings}
                >
                    <div
                        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md h-[85vh] flex flex-col overflow-hidden border border-slate-700/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {settingsLoading && settingsView === "main" ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin"/>
                            </div>
                        ) : (
                            <>
                                {settingsView === "main" && (
                                    <>
                                        <div
                                            className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
                                            <h3 className="text-slate-100 font-semibold text-base">تنظیمات</h3>
                                            <button onClick={closeSettings}
                                                    className="text-slate-400 hover:text-white transition-colors">
                                                <XIcon className="w-5 h-5"/>
                                            </button>
                                        </div>

                                        {settingsError && (
                                            <p className="text-red-400 text-xs text-center py-2 bg-red-500/10">{settingsError}</p>
                                        )}

                                        <div className="overflow-y-auto flex-1">
                                            <div
                                                onClick={() => setSettingsView("account")}
                                                className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-slate-700/30 transition-colors border-b border-slate-700/40"
                                            >
                                                <div
                                                    className="w-14 h-14 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                    <img
                                                        src={selectedImg || profile.image || "/avatar.png"}
                                                        alt="User"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-slate-200 text-sm font-semibold truncate">
                                                        {profile.first_name || "کاربر ناشناس"}
                                                    </p>
                                                    <p className="text-slate-500 text-xs mt-0.5 truncate">
                                                        {aboutText || "درباره من"}
                                                    </p>
                                                </div>
                                                <ChevronLeft className="w-4 h-4 text-slate-500 flex-shrink-0"/>
                                            </div>

                                            <SettingRow
                                                icon={Lock}
                                                title="حریم خصوصی"
                                                subtitle="آخرین بازدید، عکس پروفایل، رسید خوانده‌شدن"
                                                onClick={() => setSettingsView("privacy")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Bell}
                                                title="اعلان‌ها"
                                                subtitle="پیام‌ها، گروه‌ها و تماس‌ها"
                                                onClick={() => setSettingsView("notifications")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={MessageSquare}
                                                title="چت‌ها"
                                                subtitle="تم، اندازه فونت، ارسال با اینتر"
                                                onClick={() => setSettingsView("chats")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Database}
                                                title="ذخیره‌سازی و داده"
                                                subtitle="دانلود خودکار رسانه‌ها"
                                                onClick={() => setSettingsView("storage")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Globe}
                                                title="زبان"
                                                subtitle={language === "fa" ? "فارسی" : "English"}
                                                onClick={() => setSettingsView("language")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={HelpCircle}
                                                title="کمک"
                                                subtitle="سوالات متداول، تماس با ما، درباره چتیفای"
                                                onClick={() => setSettingsView("help")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Share2}
                                                title="دعوت از دوستان"
                                                onClick={() => navigator.clipboard?.writeText(window.location.origin)}
                                            />

                                            <div className="h-2"/>
                                            <SettingRow icon={LogOutIcon} title="خروج از حساب" danger onClick={handleLogout}/>
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "account" && (
                                    <>
                                        <SettingsSubHeader
                                            title="اطلاعات حساب"
                                            onBack={() => setSettingsView("main")}
                                            saving={settingsSaving}
                                        />
                                        <div className="overflow-y-auto flex-1">
                                            <div
                                                className="flex flex-col items-center gap-3 py-6 border-b border-slate-700/40">
                                                <button
                                                    className="size-24 rounded-full overflow-hidden relative group"
                                                    onClick={() => settingsAvatarInputRef.current.click()}
                                                >
                                                    <img
                                                        src={selectedImg || profile.image || "/avatar.png"}
                                                        alt="User"
                                                        className="size-full object-cover"
                                                    />
                                                    <div
                                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <span className="text-white text-xs">تغییر عکس</span>
                                                    </div>
                                                </button>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    ref={settingsAvatarInputRef}
                                                    onChange={handleImageChange}
                                                    className="hidden"
                                                />
                                            </div>

                                            <SectionLabel>نام</SectionLabel>
                                            <div className="px-4 pb-4">
                                                <div className="flex items-center bg-slate-900/60 rounded-lg px-3 py-2.5">
                                                    <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                                    <input
                                                        type="text"
                                                        value={profile.first_name || ""}
                                                        onChange={(e) => setProfile({...profile, first_name: e.target.value})}
                                                        onBlur={handleNameChange}
                                                        className="bg-transparent outline-none text-sm text-slate-200 w-full mr-2"
                                                    />
                                                </div>
                                            </div>

                                            <SectionLabel>درباره من</SectionLabel>
                                            <div className="px-4 pb-4">
                                                <div className="flex items-center bg-slate-900/60 rounded-lg px-3 py-2.5">
                                                    <Info className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                                    <input
                                                        type="text"
                                                        value={aboutText}
                                                        onChange={(e) => setAboutText(e.target.value)}
                                                        onBlur={handleAboutTextBlur}
                                                        className="bg-transparent outline-none text-sm text-slate-200 w-full mr-2"
                                                    />
                                                </div>
                                            </div>

                                            <SectionLabel>امنیت</SectionLabel>
                                            <SettingRow
                                                icon={KeyRound}
                                                title="تغییر رمز عبور"
                                                onClick={() => {
                                                    setShowChangePassword((v) => !v);
                                                    setChangePasswordError("");
                                                    setChangePasswordSuccess(false);
                                                }}
                                            />

                                            {showChangePassword && (
                                                <form onSubmit={handleChangePassword} className="mx-4 mb-3 p-3 rounded-lg bg-slate-900/60 space-y-2">
                                                    {changePasswordError && (
                                                        <p className="text-red-400 text-xs text-center">{changePasswordError}</p>
                                                    )}
                                                    {changePasswordSuccess && (
                                                        <p className="text-green-400 text-xs text-center">رمز عبور تغییر کرد ✅</p>
                                                    )}
                                                    <input
                                                        type="password"
                                                        value={oldPassword}
                                                        onChange={(e) => setOldPassword(e.target.value)}
                                                        placeholder="رمز عبور فعلی"
                                                        className="w-full bg-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                                                    />
                                                    <input
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
                                                        className="w-full bg-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={isChangingPassword}
                                                        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white py-2 rounded-md text-sm font-medium transition-colors"
                                                    >
                                                        {isChangingPassword ? "در حال ذخیره..." : "ذخیره رمز جدید"}
                                                    </button>
                                                </form>
                                            )}

                                            <SettingRow
                                                icon={Shield}
                                                title="تایید دو مرحله‌ای"
                                                rightContent={
                                                    <ToggleSwitch
                                                        checked={twoStepEnabled}
                                                        onChange={bindToggle(setTwoStepEnabled, "two_step_enabled")}
                                                    />
                                                }
                                            />

                                            <div className="h-2"/>
                                            <SettingRow
                                                icon={Trash2}
                                                title="حذف حساب کاربری"
                                                danger
                                                onClick={() => setShowDeleteAccountConfirm((v) => !v)}
                                            />

                                            {showDeleteAccountConfirm && (
                                                <div className="mx-4 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2">
                                                    <p className="text-red-300 text-xs leading-relaxed">
                                                        با حذف حساب، تمام چت‌ها و اطلاعات تو برای همیشه پاک میشه. برای تایید رمزت رو وارد کن.
                                                    </p>
                                                    {deleteAccountError && (
                                                        <p className="text-red-400 text-xs">{deleteAccountError}</p>
                                                    )}
                                                    <input
                                                        type="password"
                                                        value={deletePassword}
                                                        onChange={(e) => setDeletePassword(e.target.value)}
                                                        placeholder="رمز عبور"
                                                        className="w-full bg-slate-900/60 rounded-md px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setShowDeleteAccountConfirm(false);
                                                                setDeletePassword("");
                                                                setDeleteAccountError("");
                                                            }}
                                                            className="flex-1 py-1.5 rounded-md bg-slate-700 text-slate-300 text-xs"
                                                        >
                                                            انصراف
                                                        </button>
                                                        <button
                                                            onClick={handleDeleteAccount}
                                                            disabled={isDeletingAccount}
                                                            className="flex-1 py-1.5 rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs"
                                                        >
                                                            {isDeletingAccount ? "..." : "حذف قطعی"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "privacy" && (
                                    <>
                                        <SettingsSubHeader title="حریم خصوصی" onBack={() => setSettingsView("main")} saving={settingsSaving}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SectionLabel>چه کسانی می‌بینند</SectionLabel>
                                            <SettingRow
                                                icon={Eye}
                                                title="آخرین بازدید"
                                                subtitle={visibilityLabel(lastSeen)}
                                                onClick={() => cycleVisibility(lastSeen, setLastSeen, "last_seen_visibility")}
                                            />
                                            <SettingRow
                                                icon={ImageIcon}
                                                title="عکس پروفایل"
                                                subtitle={visibilityLabel(photoVisibility)}
                                                onClick={() => cycleVisibility(photoVisibility, setPhotoVisibility, "photo_visibility")}
                                            />
                                            <SettingRow
                                                icon={Info}
                                                title="درباره من"
                                                subtitle={visibilityLabel(aboutVisibility)}
                                                onClick={() => cycleVisibility(aboutVisibility, setAboutVisibility, "about_visibility")}
                                            />

                                            <SectionLabel>ارتباطات</SectionLabel>
                                            <SettingRow
                                                icon={Check}
                                                title="رسید خوانده شدن"
                                                subtitle="نمایش تیک آبی برای طرف مقابل"
                                                rightContent={
                                                    <ToggleSwitch checked={readReceipts} onChange={bindToggle(setReadReceipts, "read_receipts")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={onlineStatus ? Eye : EyeOff}
                                                title="نمایش وضعیت آنلاین"
                                                rightContent={
                                                    <ToggleSwitch checked={onlineStatus} onChange={bindToggle(setOnlineStatus, "online_status_visible")}/>
                                                }
                                            />
                                            <SettingRow icon={Shield} title="مخاطبین مسدود شده" subtitle="۰ مخاطب"/>
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "notifications" && (
                                    <>
                                        <SettingsSubHeader title="اعلان‌ها" onBack={() => setSettingsView("main")} saving={settingsSaving}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SectionLabel>پیام‌ها</SectionLabel>
                                            <SettingRow
                                                icon={notifMessages ? Bell : BellOff}
                                                title="اعلان پیام‌های جدید"
                                                rightContent={
                                                    <ToggleSwitch checked={notifMessages} onChange={bindToggle(setNotifMessages, "notif_messages")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={Eye}
                                                title="نمایش متن پیام در اعلان"
                                                rightContent={
                                                    <ToggleSwitch checked={notifPreview} onChange={bindToggle(setNotifPreview, "notif_preview")}/>
                                                }
                                            />

                                            <SectionLabel>گروه‌ها</SectionLabel>
                                            <SettingRow
                                                icon={UsersIcon}
                                                title="اعلان پیام‌های گروه"
                                                rightContent={
                                                    <ToggleSwitch checked={notifGroups} onChange={bindToggle(setNotifGroups, "notif_groups")}/>
                                                }
                                            />

                                            <SectionLabel>تماس‌ها</SectionLabel>
                                            <SettingRow
                                                icon={PhoneIcon}
                                                title="اعلان تماس‌های ورودی"
                                                rightContent={
                                                    <ToggleSwitch checked={notifCalls} onChange={bindToggle(setNotifCalls, "notif_calls")}/>
                                                }
                                            />

                                            <SectionLabel>عمومی</SectionLabel>
                                            <SettingRow
                                                icon={Smartphone}
                                                title="لرزش"
                                                rightContent={
                                                    <ToggleSwitch checked={notifVibrate} onChange={bindToggle(setNotifVibrate, "notif_vibrate")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={isSoundEnabled ? Volume2Icon : VolumeOffIcon}
                                                title="صدای اعلان"
                                                rightContent={<ToggleSwitch checked={isSoundEnabled} onChange={handleSoundToggleInSettings}/>}
                                            />
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "chats" && (
                                    <>
                                        <SettingsSubHeader title="چت‌ها" onBack={() => setSettingsView("main")} saving={settingsSaving}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SectionLabel>ظاهر</SectionLabel>
                                            <SettingRow
                                                icon={MessageSquare}
                                                title="تم تیره"
                                                subtitle={darkTheme ? "روشن" : "خاموش"}
                                                rightContent={
                                                    <ToggleSwitch checked={darkTheme} onChange={bindToggle(setDarkTheme, "dark_theme")}/>
                                                }
                                            />
                                            <SettingRow icon={ImageIcon} title="پس‌زمینه چت" subtitle="پیش‌فرض"/>
                                            <SettingRow
                                                icon={ChevronDown}
                                                title="اندازه فونت"
                                                subtitle={fontSizeLabel(fontSize)}
                                                onClick={cycleFontSize}
                                            />

                                            <SectionLabel>رفتار ارسال</SectionLabel>
                                            <SettingRow
                                                icon={Check}
                                                title="ارسال با Enter"
                                                subtitle="فعال کردن ارسال پیام با زدن اینتر"
                                                rightContent={
                                                    <ToggleSwitch checked={enterToSend} onChange={bindToggle(setEnterToSend, "enter_to_send")}/>
                                                }
                                            />

                                            <SectionLabel>پشتیبان‌گیری</SectionLabel>
                                            <SettingRow icon={Database} title="پشتیبان‌گیری از چت‌ها" subtitle="هنوز پشتیبان‌گیری نشده"/>
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "storage" && (
                                    <>
                                        <SettingsSubHeader title="ذخیره‌سازی و داده" onBack={() => setSettingsView("main")} saving={settingsSaving}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SectionLabel>دانلود خودکار رسانه</SectionLabel>
                                            <SettingRow
                                                icon={ImageIcon}
                                                title="در وای‌فای"
                                                rightContent={
                                                    <ToggleSwitch checked={autoDownloadWifi} onChange={bindToggle(setAutoDownloadWifi, "auto_download_wifi")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={Smartphone}
                                                title="در اینترنت موبایل"
                                                rightContent={
                                                    <ToggleSwitch checked={autoDownloadMobile} onChange={bindToggle(setAutoDownloadMobile, "auto_download_mobile")}/>
                                                }
                                            />

                                            <SectionLabel>مصرف فضا</SectionLabel>
                                            <SettingRow icon={Database} title="مدیریت فضای ذخیره‌سازی" subtitle="۰ مگابایت مصرف شده"/>
                                            <SettingRow icon={Trash2} title="پاک کردن حافظه پنهان" danger/>
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "language" && (
                                    <>
                                        <SettingsSubHeader title="زبان برنامه" onBack={() => setSettingsView("main")} saving={settingsSaving}/>
                                        <RadioOptionGroup
                                            value={language}
                                            onChange={handleLanguageChange}
                                            options={[
                                                {value: "fa", label: "فارسی"},
                                                {value: "en", label: "English"},
                                            ]}
                                        />
                                    </>
                                )}

                                {settingsView === "help" && (
                                    <>
                                        <SettingsSubHeader title="کمک" onBack={() => setSettingsView("main")}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SettingRow icon={HelpCircle} title="سوالات متداول"/>
                                            <SettingRow icon={MailIcon} title="تماس با ما"/>
                                            <SettingRow icon={Shield} title="سیاست حفظ حریم خصوصی"/>
                                            <SettingRow icon={Info} title="درباره چتیفای" subtitle="نسخه ۱.۰.۰"/>
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProfileHeader;