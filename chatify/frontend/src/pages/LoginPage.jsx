import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import {
  MessageCircleIcon,
  MailIcon,
  LockIcon,
  LoaderIcon,
  PhoneIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import useTranslation from "../hooks/useTranslation";

const OTP_RESEND_SECONDS = 60;

function LoginPage() {
  const navigate = useNavigate();
  const { login, requestOtp, verifyOtp } = useAuthStore();
  const { t } = useTranslation();

  const [tab, setTab] = useState("email");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [emailForm, setEmailForm] = useState({ email: "", password: "" });

  const [phoneStep, setPhoneStep] = useState("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setError("");
    if (nextTab === "email") {
      setPhoneStep("phone");
      setOtpCode("");
    }
  };

  const startResendTimer = () => {
    setResendTimer(OTP_RESEND_SECONDS);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoggingIn(true);
    const user = await login(emailForm.email, emailForm.password);
    setIsLoggingIn(false);
    if (user) navigate("/");
    else setError(t("auth.loginFailed"));
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^09\d{9}$/.test(phoneNumber)) {
      setError(t("auth.invalidPhone"));
      return;
    }
    setIsSendingOtp(true);
    const sent = await requestOtp(phoneNumber);
    setIsSendingOtp(false);
    if (sent) {
      setPhoneStep("code");
      startResendTimer();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setIsVerifying(true);
    const user = await verifyOtp(phoneNumber, otpCode);
    setIsVerifying(false);
    if (user) navigate("/");
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setIsSendingOtp(true);
    const sent = await requestOtp(phoneNumber);
    setIsSendingOtp(false);
    if (sent) startResendTimer();
  };

  return (
    <div className="w-full flex items-center justify-center p-4 bg-slate-900 min-h-screen">
      <div className="relative w-full max-w-6xl md:h-[800px] h-[650px]" dir="rtl">
        <BorderAnimatedContainer>
          <div className="w-full flex flex-col md:flex-row">

            <div className="md:w-1/2 p-8 flex items-center justify-center md:border-l border-slate-600/30">
              <div className="w-full max-w-md">
                <div className="text-center mb-6">
                  <MessageCircleIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <h2 className="text-2xl font-bold text-slate-200 mb-2">{t("auth.welcomeBack")}</h2>
                  <p className="text-slate-400">{t("auth.loginSubtitle")}</p>
                </div>

                <div className="flex mb-6 rounded-lg overflow-hidden border border-slate-600/30">
                  <button
                    type="button"
                    onClick={() => switchTab("email")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      tab === "email"
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-transparent text-slate-400"
                    }`}
                  >
                    {t("auth.loginWithEmail")}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTab("phone")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      tab === "phone"
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-transparent text-slate-400"
                    }`}
                  >
                    {t("auth.loginWithPhone")}
                  </button>
                </div>

                {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

                {tab === "email" && (
                  <form onSubmit={handleEmailSubmit} className="space-y-6">
                    <div>
                      <label className="auth-input-label">{t("auth.email")}</label>
                      <div className="relative">
                        <MailIcon className="auth-input-icon" />
                        <input
                          type="email"
                          value={emailForm.email}
                          onChange={(e) =>
                            setEmailForm({ ...emailForm, email: e.target.value })
                          }
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
                          value={emailForm.password}
                          onChange={(e) =>
                            setEmailForm({ ...emailForm, password: e.target.value })
                          }
                          className="input"
                          placeholder={t("auth.passwordPlaceholder")}
                          required
                        />
                      </div>
                    </div>

                    <button
                      className="auth-btn w-full flex items-center justify-center"
                      type="submit"
                      disabled={isLoggingIn}
                    >
                      {isLoggingIn ? (
                        <LoaderIcon className="w-5 h-5 animate-spin" />
                      ) : (
                        t("auth.loginBtn")
                      )}
                    </button>
                  </form>
                )}

                {tab === "phone" && phoneStep === "phone" && (
                  <form onSubmit={handleRequestOtp} className="space-y-6">
                    <div>
                      <label className="auth-input-label">{t("auth.phoneNumber")}</label>
                      <div className="relative">
                        <PhoneIcon className="auth-input-icon" />
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="input"
                          placeholder="09123456789"
                          dir="ltr"
                          required
                        />
                      </div>
                    </div>

                    <button
                      className="auth-btn w-full flex items-center justify-center"
                      type="submit"
                      disabled={isSendingOtp}
                    >
                      {isSendingOtp ? (
                        <LoaderIcon className="w-5 h-5 animate-spin" />
                      ) : (
                        t("auth.sendOtp")
                      )}
                    </button>
                  </form>
                )}

                {tab === "phone" && phoneStep === "code" && (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <p className="text-slate-400 text-sm text-center">
                      {t("auth.otpSentTo", { phone: phoneNumber })}
                    </p>

                    <div>
                      <label className="auth-input-label">{t("auth.otpCode")}</label>
                      <div className="relative">
                        <ShieldCheckIcon className="auth-input-icon" />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) =>
                            setOtpCode(e.target.value.replace(/\D/g, ""))
                          }
                          className="input tracking-widest text-center"
                          placeholder="------"
                          dir="ltr"
                          required
                        />
                      </div>
                    </div>

                    <button
                      className="auth-btn w-full flex items-center justify-center"
                      type="submit"
                      disabled={isVerifying || otpCode.length !== 6}
                    >
                      {isVerifying ? (
                        <LoaderIcon className="w-5 h-5 animate-spin" />
                      ) : (
                        t("auth.verifyAndLogin")
                      )}
                    </button>

                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={() => setPhoneStep("phone")}
                        className="auth-link"
                      >
                        {t("auth.changeNumber")}
                      </button>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendTimer > 0 || isSendingOtp}
                        className="auth-link disabled:opacity-40"
                      >
                        {resendTimer > 0
                          ? t("auth.resendIn", { sec: resendTimer })
                          : t("auth.resendCode")}
                      </button>
                    </div>
                  </form>
                )}

                <div className="mt-6 text-center">
                  <Link to="/signup" className="auth-link">
                    {t("auth.noAccount")}
                  </Link>
                </div>
              </div>
            </div>

            <div className="hidden md:w-1/2 md:flex items-center justify-center p-6 bg-gradient-to-bl from-slate-800/20 to-transparent">
              <div>
                <img
                  src="/login.png"
                  alt=""
                  className="w-full h-auto object-contain"
                />
                <div className="mt-6 text-center">
                  <h3 className="text-xl font-medium text-cyan-400">{t("auth.loginHeroTitle")}</h3>
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

export default LoginPage;