import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import { MessageCircleIcon, MailIcon, LockIcon, LoaderIcon } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // دسترسی مستقیم به setState از Zustand Store
  const setAuthUser = useAuthStore.setState;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoggingIn(true);

    try {
      const res = await axios.post(
        "http://localhost:8000/accounts/login/",
        formData,
        { headers: { "Content-Type": "application/json" } }
      );

      if (res.data.access && res.data.refresh) {
        // ذخیره‌ی توکن‌ها در localStorage
        localStorage.setItem("accessToken", res.data.access);
        localStorage.setItem("refreshToken", res.data.refresh);

        // ذخیره‌ی اطلاعات کاربر در استور
        setAuthUser({
          authUser: {
            id: res.data.id,
            email: res.data.email,
          },
        });

        console.log("✅ ورود موفق:", {
          id: res.data.id,
          email: res.data.email,
        });

        // هدایت به صفحه اصلی (مثلاً چت)
        navigate("/");
      } else {
        setError("ورود ناموفق بود. توکن دریافت نشد.");
      }
    } catch (err) {
      console.error(err);
      if (err.response) {
        const data = err.response.data;
        if (data.detail) setError(data.detail);
        else if (data.non_field_errors) setError(data.non_field_errors.join(", "));
        else setError("ورود انجام نشد. لطفاً اطلاعات خود را بررسی کنید.");
      } else {
        setError("خطا در اتصال به سرور. لطفاً بعداً دوباره تلاش کنید.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center p-4 bg-slate-900 min-h-screen">
      <div className="relative w-full max-w-6xl md:h-[800px] h-[650px]" dir="rtl">
        <BorderAnimatedContainer>
          <div className="w-full flex flex-col md:flex-row">

            {/* فرم سمت راست (برای راست‌چین بودن جابه‌جا شده) */}
            <div className="md:w-1/2 p-8 flex items-center justify-center md:border-l border-slate-600/30">
              <div className="w-full max-w-md">
                <div className="text-center mb-8">
                  <MessageCircleIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <h2 className="text-2xl font-bold text-slate-200 mb-2">خوش آمدی!</h2>
                  <p className="text-slate-400">برای ورود به حساب کاربری‌ات وارد شو</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                  {/* ایمیل */}
                  <div>
                    <label className="auth-input-label">ایمیل</label>
                    <div className="relative">
                      <MailIcon className="auth-input-icon" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="input"
                        placeholder="example@gmail.com"
                        required
                      />
                    </div>
                  </div>

                  {/* رمز عبور */}
                  <div>
                    <label className="auth-input-label">رمز عبور</label>
                    <div className="relative">
                      <LockIcon className="auth-input-icon" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="input"
                        placeholder="رمز عبور خود را وارد کنید"
                        required
                      />
                    </div>
                  </div>

                  <button
                    className="auth-btn w-full flex items-center justify-center"
                    type="submit"
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? <LoaderIcon className="w-5 h-5 animate-spin" /> : "ورود"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link to="/signup" className="auth-link">
                    حساب نداری؟ ثبت‌نام کن
                  </Link>
                </div>
              </div>
            </div>

            {/* تصویر سمت چپ */}
            <div className="hidden md:w-1/2 md:flex items-center justify-center p-6 bg-gradient-to-bl from-slate-800/20 to-transparent">
              <div>
                <img
                  src="/login.png"
                  alt="ورود به حساب کاربری"
                  className="w-full h-auto object-contain"
                />
                <div className="mt-6 text-center">
                  <h3 className="text-xl font-medium text-cyan-400">در هر زمان و مکان متصل شو</h3>
                  <div className="mt-4 flex justify-center gap-4">
                    <span className="auth-badge">رایگان</span>
                    <span className="auth-badge">نصب آسان</span>
                    <span className="auth-badge">امن و خصوصی</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </BorderAnimatedContainer>
      </div>
    </div>
  );
}

export default LoginPage;
