import {useRef, useState, useEffect} from "react";
import {ImageIcon, CameraIcon, FileTextIcon, MapPinIcon, UserIcon, PlusIcon, BarChart3Icon, XIcon, TrashIcon} from "lucide-react";
import {useChatStore} from "../store/useChatStore";
import {createPortal} from "react-dom";
import CameraCaptureModal from "./CameraCaptureModal";
import toast from "react-hot-toast";
import useTranslation from "../hooks/useTranslation";
import { API_URL } from "../lib/apiConfig";

function AttachMenu({onSelectGallery, onSelectCamera, onSelectDocument, onSelectLocation, onSelectContact, onSelectPoll}) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [showContactPicker, setShowContactPicker] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [showPollModal, setShowPollModal] = useState(false);
    const [menuPos, setMenuPos] = useState({bottom: 0, right: 0});
    const [isLocating, setIsLocating] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    const galleryInputRef = useRef(null);
    const documentInputRef = useRef(null);

    const {allContacts, getAllContacts} = useChatStore();

    const OPTIONS = [
        {key: "gallery", label: t("attach.gallery"), icon: ImageIcon, color: "bg-purple-500"},
        {key: "camera", label: t("attach.camera"), icon: CameraIcon, color: "bg-pink-500"},
        {key: "document", label: t("attach.document"), icon: FileTextIcon, color: "bg-indigo-500"},
        {key: "location", label: t("attach.location"), icon: MapPinIcon, color: "bg-green-500"},
        {key: "contact", label: t("attach.contact"), icon: UserIcon, color: "bg-cyan-500"},
        {key: "poll", label: t("attach.poll"), icon: BarChart3Icon, color: "bg-orange-500"},
    ];

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
                bottom: window.innerHeight - rect.top + 8,
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
            case "poll":
                setShowPollModal(true);
                break;
            default:
                break;
        }
    };

    const handleShareLocation = () => {
        if (!navigator.geolocation) {
            toast.error(t("attach.noGeoSupport"));
            return;
        }
        if (isLocating) return;

        setIsLocating(true);
        const loadingToast = toast.loading(t("attach.gettingLocation"));

        const cleanup = () => {
            setIsLocating(false);
            toast.dismiss(loadingToast);
        };

        const onSuccess = (pos) => {
            cleanup();
            onSelectLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
            });
        };

        const attemptLowAccuracy = () => {
            navigator.geolocation.getCurrentPosition(
                onSuccess,
                (err) => {
                    cleanup();
                    toast.error(describeLocationError(err, t));
                },
                {enableHighAccuracy: false, timeout: 10000, maximumAge: 300000}
            );
        };

        navigator.geolocation.getCurrentPosition(
            onSuccess,
            (err) => {
                if (err.code === err.TIMEOUT) {
                    attemptLowAccuracy();
                } else {
                    cleanup();
                    toast.error(describeLocationError(err, t));
                }
            },
            {enableHighAccuracy: true, timeout: 6000, maximumAge: 0}
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
                        <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)}/>

                        <div
                            ref={menuRef}
                            style={{bottom: menuPos.bottom, right: menuPos.right}}
                            className="fixed bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl p-2 w-56 z-[100]"
                        >
                            {OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                const isLocationBusy = opt.key === "location" && isLocating;
                                return (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        disabled={isLocationBusy}
                                        onClick={() => handleOptionClick(opt.key)}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-right"
                                    >
                                        <div
                                            className={`w-9 h-9 rounded-full ${opt.color} flex items-center justify-center flex-shrink-0`}>
                                            <Icon className="w-4.5 h-4.5 text-white"/>
                                        </div>
                                        <span className="text-slate-200 text-sm">
                                            {isLocationBusy ? t("attach.gettingLocation") : opt.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </>,
                    document.body
                )}

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

            <CameraCaptureModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={(file) => {
                    onSelectCamera(file);
                    setShowCamera(false);
                }}
            />

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
                            <h3 className="text-slate-100 font-semibold text-base">{t("attach.sendContact")}</h3>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {allContacts.length === 0 ? (
                                <p className="text-center text-slate-500 text-sm py-8">{t("forward.noContacts")}</p>
                            ) : (
                                allContacts.map((c) => {
                                    const profilePic = c.profile?.startsWith("http")
                                        ? c.profile
                                        : c.raw?.profile?.startsWith("http")
                                            ? c.raw.profile
                                            : c.raw?.profile
                                                ? `${API_URL}${c.raw.profile}`
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

            {showPollModal && (
                <PollCreateModal
                    onClose={() => setShowPollModal(false)}
                    onCreate={(pollData) => {
                        onSelectPoll(pollData);
                        setShowPollModal(false);
                    }}
                />
            )}
        </div>
    );
}

function describeLocationError(err, t) {
    switch (err?.code) {
        case err?.PERMISSION_DENIED:
            return t("attach.locationDenied");
        case err?.POSITION_UNAVAILABLE:
            return t("attach.locationUnavailable");
        case err?.TIMEOUT:
            return t("attach.locationTimeout");
        default:
            return t("attach.locationFailed");
    }
}

function PollCreateModal({onClose, onCreate}) {
    const { t } = useTranslation();
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(["", ""]);
    const [multiple, setMultiple] = useState(false);

    const updateOption = (idx, value) => {
        setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
    };

    const addOption = () => {
        if (options.length >= 10) return;
        setOptions((prev) => [...prev, ""]);
    };

    const removeOption = (idx) => {
        if (options.length <= 2) return;
        setOptions((prev) => prev.filter((_, i) => i !== idx));
    };

    const canSubmit = question.trim() && options.filter((o) => o.trim()).length >= 2;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onCreate({
            question: question.trim(),
            multiple,
            options: options.filter((o) => o.trim()).map((text) => ({text: text.trim()})),
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-slate-700/50"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
                    <h3 className="text-slate-100 font-semibold text-base">{t("poll.createTitle")}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <XIcon className="w-5 h-5"/>
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-4">
                    <div>
                        <label className="text-slate-400 text-xs mb-1 block">{t("poll.question")}</label>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder={t("poll.questionPlaceholder")}
                            className="w-full bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-cyan-500"
                        />
                    </div>

                    <div>
                        <label className="text-slate-400 text-xs mb-2 block">{t("poll.optionsLabel")}</label>
                        <div className="space-y-2">
                            {options.map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => updateOption(idx, e.target.value)}
                                        placeholder={t("poll.optionPlaceholder", { n: idx + 1 })}
                                        className="flex-1 bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-cyan-500"
                                    />
                                    {options.length > 2 && (
                                        <button
                                            onClick={() => removeOption(idx)}
                                            className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                                        >
                                            <TrashIcon className="w-4 h-4"/>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {options.length < 10 && (
                            <button
                                onClick={addOption}
                                className="mt-2 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors"
                            >
                                {t("poll.addOption")}
                            </button>
                        )}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={multiple}
                            onChange={(e) => setMultiple(e.target.checked)}
                            className="w-4 h-4 accent-cyan-500"
                        />
                        <span className="text-slate-300 text-sm">{t("poll.allowMultiple")}</span>
                    </label>
                </div>

                <div className="p-4 border-t border-slate-700/50 flex-shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        {t("poll.submit")}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default AttachMenu;