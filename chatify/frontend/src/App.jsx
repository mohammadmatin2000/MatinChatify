// src/App.jsx
import {Navigate, Route, Routes} from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import {useAuthStore} from "./store/useAuthStore";
import {useCallStore} from "./store/useCallStore";
import {useSettingsStore} from "./store/useSettingsStore"; // ✅ NEW
import {useEffect} from "react";
import PageLoader from "./components/PageLoader";
import {Toaster} from "react-hot-toast";
import CallModal from "./components/CallModal";
import GroupCallModal from "./components/GroupCallModal";
import useClickSound from "./hooks/useClickSound";
import useCallNotifications from "./hooks/useCallNotifications";

function App() {
    const {checkAuth, isCheckingAuth, authUser} = useAuthStore();
    const connectCallSocket = useCallStore((state) => state.connectCallSocket);
    // ✅ NEW: تنظیم واقعی نمایش/مخفی‌کردن پس‌زمینه‌ی گرید نقطه‌ای
    const backgroundPatternEnabled = useSettingsStore((state) => state.backgroundPatternEnabled);

    useClickSound();
    useCallNotifications()

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // بعد از تایید هویت کاربر، اتصال سیگنالینگ تماس رو برقرار می‌کنیم
    // تا همیشه (مهم نیست کاربر توی کدوم صفحه‌ست) بتونه تماس ورودی دریافت کنه
    useEffect(() => {
        if (authUser) connectCallSocket();
    }, [authUser, connectCallSocket]);

    if (isCheckingAuth) return <PageLoader/>;

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* UI DECORATIONS — ✅ FIX: حالا به تنظیم «پس‌زمینه‌ی گرید نقطه‌ای» وصله */}
            {backgroundPatternEnabled && (
                <>
                    <div
                        className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]"/>
                    <div className="absolute top-0 -left-4 size-96 bg-pink-500 opacity-20 blur-[100px]"/>
                    <div className="absolute bottom-0 -right-4 size-96 bg-cyan-500 opacity-20 blur-[100px]"/>
                </>
            )}

            <Routes>
                <Route
                    path="/"
                    element={authUser ? <ChatPage/> : <Navigate to="/login" replace/>}
                />
                <Route
                    path="/login"
                    element={!authUser ? <LoginPage/> : <Navigate to="/" replace/>}
                />
                <Route
                    path="/signup"
                    element={!authUser ? <SignUpPage/> : <Navigate to="/" replace/>}
                />
                <Route path="*" element={<Navigate to="/" replace/>}/>
            </Routes>

            <Toaster position="top-center"/>

            {/* مودال تماس - همیشه در دسترسه، بیرون از Routes، تا مهم نیست کاربر کدوم صفحه‌ست */}
            <CallModal/>
            <GroupCallModal/>
        </div>
    );
}

export default App;