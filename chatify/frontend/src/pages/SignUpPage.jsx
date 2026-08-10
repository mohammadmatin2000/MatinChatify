import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import { MessageCircleIcon, LockIcon, MailIcon, LoaderIcon } from "lucide-react";
import useTranslation from "../hooks/useTranslation";

function SignUpPage() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (formData.password !== formData.confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setIsSigningUp(true);

    try {
      const res = await axios.post(
        "http://localhost:8000/accounts/register/",
        {
          email: formData.email,
          password: formData.password,
          confirm_password: formData.confirmPassword
        },
        { headers: { "Content-Type": "application/json" } }
      );

      console.log("✅ ثبت‌نام موفق:", res.data);
      setSuccessMessage(t("auth.signupSuccess"));

      setTimeout(() => {
        navigate("/login");
      }, 1500);

    } catch (err) {
      console.error("❌ خطای ثبت‌نام:", err);
      setError(
        err.response?.data?.confirm_password ||
        err.response?.data?.email ||
        err.response?.data?.detail ||
        t("auth.signupFailed")
      );
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center p-4 bg-slate-900 min-h-screen">
      <div className="relative w-full max-w-6xl md:h-[800px] h-[650px]" dir="rtl">
        <BorderAnimatedContainer>
          <div className="w-full flex flex-col md:flex-row">

            <div className="md:w-1/2 p-8 flex items-center justify-center md:border-l border-slate-600/30">
              <div className="w-full max-w-md">
                <div className="text-center mb-8">
                  <MessageCircleIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <h2 className="text-2xl font-bold text-slate-200 mb-2">{t("auth.createAccount")}</h2>
                  <p className="text-slate-400">{t("auth.signupSubtitle")}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                  {successMessage && <p className="text-green-500 text-sm text-center">{successMessage}</p>}

                  <div>
                    <label className="auth-input-label">{t("auth.email")}</label>
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

                  <div>
                    <label className="auth-input-label">{t("auth.password")}</label>
                    <div className="relative">
                      <LockIcon className="auth-input-icon" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="input"
                        placeholder={t("auth.passwordPlaceholder")}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="auth-input-label">{t("auth.confirmPassword")}</label>
                    <div className="relative">
                      <LockIcon className="auth-input-icon" />
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="input"
                        placeholder={t("auth.confirmPasswordPlaceholder")}
                        required
                      />
                    </div>
                  </div>

                  <button
                    className="auth-btn w-full flex items-center justify-center"
                    type="submit"
                    disabled={isSigningUp}
                  >
                    {isSigningUp ? <LoaderIcon className="w-5 h-5 animate-spin" /> : t("auth.signupBtn")}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link to="/login" className="auth-link">
                    {t("auth.haveAccount")}
                  </Link>
                </div>
              </div>
            </div>

            <div className="hidden md:w-1/2 md:flex items-center justify-center p-6 bg-gradient-to-bl from-slate-800/20 to-transparent">
              <div>
                <img
                  src="/signup.png"
                  alt=""
                  className="w-full h-auto object-contain"
                />
                <div className="mt-6 text-center">
                  <h3 className="text-xl font-medium text-cyan-400">{t("auth.signupHeroTitle")}</h3>
                  <div className="mt-4 flex justify-center gap-4">
                    <span className="auth-badge">{t("auth.badgeFree")}</span>
                    <span className="auth-badge">{t("auth.badgeEasyInstall")}</span>
                    <span className="auth-badge">{t("auth.badgeSecure")}</span>
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

export default SignUpPage;