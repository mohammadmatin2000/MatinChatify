import {useRef, useState, useEffect} from "react";
import {ImageIcon, CameraIcon, FileTextIcon, MapPinIcon, UserIcon, PlusIcon} from "lucide-react";
import {useChatStore} from "../store/useChatStore";
import {createPortal} from "react-dom";
import CameraCaptureModal from "./CameraCaptureModal";

const OPTIONS = [
    {key: "gallery", label: "عکس و ویدیو", icon: ImageIcon, color: "bg-purple-500"},
    {key: "camera", label: "دوربین", icon: CameraIcon, color: "bg-pink-500"},
    {key: "document", label: "داکیومنت", icon: FileTextIcon, color: "bg-indigo-500"},
    {key: "location", label: "لوکیشن", icon: MapPinIcon, color: "bg-green-500"},
    {key: "contact", label: "مخاطب", icon: UserIcon, color: "bg-cyan-500"},
];

function AttachMenu({onSelectGallery, onSelectCamera, onSelectDocument, onSelectLocation, onSelectContact}) {
    const [isOpen, setIsOpen] = useState(false);
    const [showContactPicker, setShowContactPicker] = useState(false);
    // ✅ NEW: به‌جای input فایل با capture (که دوربین سیستم‌عامل رو باز می‌کرد)،
    // حالا یه مودال دوربین واقعی داخل اپ داریم (getUserMedia + preview زنده)
    const [showCamera, setShowCamera] = useState(false);
    const [menuPos, setMenuPos] = useState({bottom: 0, right: 0});
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    const galleryInputRef = useRef(null);
    const documentInputRef = useRef(null);

    const {allContacts, getAllContacts} = useChatStore();

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const toggleMenu = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPos({
                bottom: window.innerHeight - rect.top + 8, // 8px فاصله از دکمه
                right: window.innerWidth - rect.right,
            });
        }
        setIsOpen((prev) => !prev);
    };

    const handleOptionClick = (key) => {
        setIsOpen(false);
        switch (key) {
            case "gallery":
                galleryInputRef.current?.click();
                break;
            case "camera":
                // ✅ NEW: به‌جای کلیک روی input مخفی، مودال دوربین واقعی رو باز کن
                setShowCamera(true);
                break;
            case "document":
                documentInputRef.current?.click();
                break;
            case "location":
                handleShareLocation();
                break;
            case "contact":
                getAllContacts();
                setShowContactPicker(true);
                break;
            default:
                break;
        }
    };

    const handleShareLocation = () => {
        if (!navigator.geolocation) {
            alert("مرورگرت از لوکیشن پشتیبانی نمی‌کنه");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                onSelectLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                });
            },
            () => {
                alert("دسترسی به لوکیشن رد شد یا امکان‌پذیر نبود");
            }
        );
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleMenu}
                className={`rounded-lg px-4 py-2 transition-all bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white ${
                    isOpen ? "ring-2 ring-cyan-300/50" : ""
                }`}
            >
                <PlusIcon className={`w-5 h-5 transition-transform ${isOpen ? "rotate-45" : ""}`}/>
            </button>

            {isOpen &&
                createPortal(
                    <>
                        {/* overlay شفاف برای بستن با کلیک بیرون */}
                        <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)}/>

                        <div
                            ref={menuRef}
                            style={{bottom: menuPos.bottom, right: menuPos.right}}
                            className="fixed bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl p-2 w-56 z-[100]"
                        >
                            {OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                return (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => handleOptionClick(opt.key)}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-700/50 transition-colors text-right"
                                    >
                                        <div
                                            className={`w-9 h-9 rounded-full ${opt.color} flex items-center justify-center flex-shrink-0`}>
                                            <Icon className="w-4.5 h-4.5 text-white"/>
                                        </div>
                                        <span className="text-slate-200 text-sm">{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </>,
                    document.body
                )}

            {/* input های مخفی (گالری/داکیومنت — دوربین دیگه از اینجا نیست) */}
            <input
                type="file"
                accept="image/*,video/*"
                ref={galleryInputRef}
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) onSelectGallery(file);
                    e.target.value = "";
                }}
            />
            <input
                type="file"
                ref={documentInputRef}
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) onSelectDocument(file);
                    e.target.value = "";
                }}
            />

            {/* ✅ NEW: مودال دوربین واقعی داخل اپ */}
            <CameraCaptureModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={(file) => {
                    onSelectCamera(file);
                    setShowCamera(false);
                }}
            />

            {/* پیکر مخاطب */}
            {showContactPicker && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowContactPicker(false)}
                >
                    <div
                        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden border border-slate-700/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-700/50">
                            <h3 className="text-slate-100 font-semibold text-base">ارسال مخاطب</h3>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {allContacts.length === 0 ? (
                                <p className="text-center text-slate-500 text-sm py-8">مخاطبی نداری</p>
                            ) : (
                                allContacts.map((c) => {
                                    const profilePic = c.profile?.startsWith("http")
                                        ? c.profile
                                        : c.raw?.profile?.startsWith("http")
                                            ? c.raw.profile
                                            : c.raw?.profile
                                                ? `http://localhost:8000${c.raw.profile}`
                                                : "/avatar.png";
                                    return (
                                        <button
                                            key={c._id || c.id}
                                            onClick={() => {
                                                onSelectContact({name: c.name, email: c.email, image: profilePic});
                                                setShowContactPicker(false);
                                            }}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/40 text-right transition-colors"
                                        >
                                            <div
                                                className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                <img
                                                    src={profilePic}
                                                    alt={c.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => (e.target.src = "/avatar.png")}
                                                />
                                            </div>
                                            <span className="text-slate-200 text-sm truncate">{c.name}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AttachMenu;