import {useState, useEffect, useRef} from "react";
import {LogOutIcon, VolumeOffIcon, Volume2Icon, PencilIcon, PlusIcon, PhoneIcon} from "lucide-react";
import {useChatStore} from "../store/useChatStore";
import axios from "axios";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");

function ProfileHeader() {
    const {logout} = useChatStore();
    const [profile, setProfile] = useState({first_name: "", image: "/avatar.png"});
    const [isEditingName, setIsEditingName] = useState(false);
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);
    const [selectedImg, setSelectedImg] = useState(null);
    const [showNewMenu, setShowNewMenu] = useState(false);
    const [newItemType, setNewItemType] = useState(null);
    const [newItemName, setNewItemName] = useState("");

    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const accessToken = localStorage.getItem("accessToken");

    useEffect(() => {
        if (!accessToken) return;

        const fetchProfile = async () => {
            try {
                const res = await axios.get("http://localhost:8000/accounts/profile/update/", {
                    headers: {Authorization: `Bearer ${accessToken}`},
                });
                setProfile(res.data);
            } catch {
            }
        };

        fetchProfile();
    }, [accessToken]);

    const handleLogout = async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        try {
            await axios.post(
                "http://localhost:8000/accounts/logout/",
                {refresh: refreshToken},
                {headers: {Authorization: `Bearer ${accessToken}`}}
            );
        } catch {
        } finally {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
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
        setIsSoundEnabled(prev => !prev);
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("image", file);
        formData.append("first_name", profile.first_name || "");

        try {
            const res = await axios.patch("http://localhost:8000/accounts/profile/update/", formData, {
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
            const res = await axios.patch("http://localhost:8000/accounts/profile/update/", formData, {
                headers: {Authorization: `Bearer ${accessToken}`},
            });
            setProfile(res.data);
        } catch {
        }
    };

    const handleNewItemSubmit = () => {
        if (!newItemName) return;
        console.log(`ساخت ${newItemType}: ${newItemName}`);
        setNewItemName("");
        setNewItemType(null);
        setShowNewMenu(false);
    };

    useEffect(() => {
        if (isEditingName && inputRef.current) inputRef.current.focus();
    }, [isEditingName]);

    if (!accessToken) return null;

    return (
        <div className="p-6 border-b border-slate-700/50 relative">
            <div className="flex items-center justify-between">
                {/* بخش عکس و نام کاربر */}
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
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange}
                               className="hidden"/>
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

                {/* -------------------------- بخش آیکون‌ها و دکمه‌های سمت راست -------------------------- */}
                <div className="flex items-center gap-4 relative z-50">
                    <div className="relative flex items-center gap-2">
                        <button
                            onClick={handleToggleSound}
                            className="text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
                            title={isSoundEnabled ? "قطع صدا" : "پخش صدا"}
                        >
                            {isSoundEnabled ? <Volume2Icon className="size-5"/> : <VolumeOffIcon className="size-5"/>}
                        </button>


                        {/* منوی + */}
                        {showNewMenu && !newItemType && (
                            <div
                                className="absolute top-full right-1/2 translate-x-1/2 mt-2 bg-slate-800 rounded shadow-lg w-56 flex flex-col z-50">
                                <div className="p-2 hover:bg-slate-700 cursor-pointer text-white"
                                     onClick={() => setNewItemType('group')}>ساخت گروه
                                </div>
                                <div className="p-2 hover:bg-slate-700 cursor-pointer text-white"
                                     onClick={() => setNewItemType('contact')}>ساخت مخاطب
                                </div>
                            </div>
                        )}

                        {/* فرم فرعی وارد کردن نام */}
                        {newItemType && (
                            <div
                                className="absolute top-full right-1/2 translate-x-1/2 mt-2 bg-slate-700 rounded shadow-lg w-56 p-3 z-50">
                                <p className="text-white mb-1">
                                    نام {newItemType === 'group' ? 'گروه' : 'مخاطب'} را وارد کنید:
                                </p>
                                <input
                                    type="text"
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    className="w-full p-1 rounded bg-slate-600 text-white outline-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleNewItemSubmit();
                                    }}
                                />
                                <button
                                    onClick={handleNewItemSubmit}
                                    className="mt-2 w-full bg-cyan-500 hover:bg-cyan-600 text-white py-1 rounded"
                                >
                                    تایید
                                </button>
                            </div>
                        )}
                    </div>

                    {/* دکمه خروج */}
                    <button
                        onClick={handleLogout}
                        className="text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
                        title="خروج از حساب"
                    >
                        <LogOutIcon className="size-5"/>
                    </button>

                    {/* دکمه تماس */}
                    <button
                        className="text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
                        title="تماس"
                    >
                        <PhoneIcon className="size-5"/>
                    </button>

                    {/* دکمه صدا */}
                    {/* دکمه + */}
                    <button
                        onClick={() => {
                            if (newItemType) {
                                setNewItemType(null); // بستن فرم فرعی
                                setShowNewMenu(false);
                            } else {
                                setShowNewMenu(prev => !prev);
                            }
                        }}
                        className="text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
                        title="ساخت جدید"
                    >
                        <PlusIcon className="size-5"/>
                    </button>

                </div>
            </div>
        </div>
    );
}

export default ProfileHeader;
