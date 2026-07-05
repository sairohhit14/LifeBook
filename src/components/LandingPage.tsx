import React, { useState } from "react";
import { api } from "../api";
import { User } from "../types";
import { BookOpen, Shield, Heart, Lock, User as UserIcon, Mail, Phone, Calendar, ArrowRight, Loader } from "lucide-react";

interface LandingPageProps {
  onLoginSuccess: (user: User) => void;
  onEnterGuestMode: (legacyKey: string, familyMemberName: string) => Promise<void>;
}

export default function LandingPage({ onLoginSuccess, onEnterGuestMode }: LandingPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isFamilyMode, setIsFamilyMode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");

  // Family Mode states
  const [familyName, setFamilyName] = useState("");
  const [familyKey, setFamilyKey] = useState("");

  // Forgot Password / OTP Login States
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState("");
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setRecoverySuccessMessage("");
    setEmailPreviewUrl(null);
    setLoading(true);
    try {
      const result = await api.forgotPassword(recoveryEmail);
      setRecoverySuccessMessage(result.message);
      if (result.previewUrl) {
        setEmailPreviewUrl(result.previewUrl);
      }
      setIsOtpStep(true);
    } catch (err: any) {
      setError(err.message || "Failed to request password recovery. Please check your email.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setError("Please enter the 6-digit confirmation code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await api.confirmLogin(recoveryEmail, otpCode);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "Login confirmation failed. Please check your code.");
    } finally {
      setLoading(false);
    }
  };

  const handleFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName || !familyKey) {
      setError("Please enter both your name and the Legacy Key.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onEnterGuestMode(familyKey, familyName);
    } catch (err: any) {
      setError(err.message || "Failed to enter legacy vault. Please verify the key.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        if (!email || !password) {
          throw new Error("Please fill in all fields.");
        }
        const user = await api.login({ email, password });
        onLoginSuccess(user);
      } else {
        if (!name || !email || !password || !dob) {
          throw new Error("Name, Email, Password, and Date of Birth are required.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        const user = await api.register({ name, email, password, dob, phone });
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="landing-container" className="min-h-screen bg-[#0F172A] text-[#F1F5F9] flex flex-col md:flex-row font-sans">
      {/* Visual / Introduction Side */}
      <div id="landing-intro" className="flex-1 p-8 md:p-16 flex flex-col justify-between bg-[#1E293B] border-r border-[#334155]">
        <div id="brand-logo" className="flex items-center gap-3">
          <div className="p-2.5 bg-[#F59E0B] text-[#0F172A] shadow-sm">
            <BookOpen className="w-6 h-6" />
          </div>
          <span className="text-2xl font-serif italic tracking-tight text-[#F1F5F9]" style={{ fontFamily: "Georgia, serif" }}>LifeBook</span>
        </div>

        <div id="intro-hero" className="my-auto py-12 max-w-lg">
          <h1 className="text-4xl md:text-5xl font-serif italic text-[#F1F5F9] mb-6 leading-tight" style={{ fontFamily: "Georgia, serif" }}>
            Preserve Your Life Story. <br />
            <span className="text-[#64748B]">Secure Your Legacy.</span>
          </h1>
          <p className="text-[#94A3B8] text-base mb-8 leading-relaxed">
            The AI-powered digital legacy platform designed to capture your personal memories, structure interactive life timelines, schedule milestone messages for descendants, and securely archive essential documents.
          </p>

          <div id="intro-features" className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-[#0F172A] border border-[#334155]">
              <div className="p-1 bg-[#F59E0B] text-[#0F172A] mt-0.5 border border-[#F59E0B]">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif italic text-base text-[#F1F5F9]" style={{ fontFamily: "Georgia, serif" }}>Empathetic Memory Vault</h4>
                <p className="text-[#64748B] text-xs mt-0.5">Log photos, videos, and oral records with an interactive companion.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-[#0F172A] border border-[#334155]">
              <div className="p-1 bg-[#F59E0B] text-[#0F172A] mt-0.5 border border-[#F59E0B]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif italic text-base text-[#F1F5F9]" style={{ fontFamily: "Georgia, serif" }}>AI Biography Generator</h4>
                <p className="text-[#64748B] text-xs mt-0.5">Convert raw timeline details into an elegant, printable narrative book.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-[#0F172A] border border-[#334155]">
              <div className="p-1 bg-[#F59E0B] text-[#0F172A] mt-0.5 border border-[#F59E0B]">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif italic text-base text-[#F1F5F9]" style={{ fontFamily: "Georgia, serif" }}>Secure Legacy Capsule</h4>
                <p className="text-[#64748B] text-xs mt-0.5">Safeguard medical documents, wills, and credentials with full privacy.</p>
              </div>
            </div>
          </div>
        </div>

        <div id="intro-footer" className="text-xs text-[#64748B] font-medium tracking-wide uppercase">
          © 2026 LifeBook Inc. Protecting your digital memoirs with absolute privacy and local isolation.
        </div>
      </div>

      {/* Auth Form Side */}
      <div id="landing-auth" className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-[#0F172A]">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div id="auth-header" className="text-center md:text-left pb-4 border-b border-[#334155]">
            <h2 className="text-3xl font-serif italic text-[#F1F5F9] tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
              {isFamilyMode 
                ? "Family Member Access" 
                : forgotPasswordMode
                  ? "Account Recovery"
                  : isLogin 
                    ? "Welcome Back" 
                    : "Begin Your Legacy"}
            </h2>
            <p className="text-[#64748B] text-xs mt-2 uppercase font-mono font-bold tracking-wider">
              {isFamilyMode
                ? "Enter your name and the legacy key generated by the book owner to view their chronicles."
                : forgotPasswordMode
                  ? isOtpStep
                    ? "Verify the 6-digit confirmation code sent to your inbox to log in."
                    : "Enter your registered email address to recover your password and login."
                  : isLogin 
                    ? "Sign in to review and write your digital life story." 
                    : "Create a private ledger and preserve memoirs for future generations."}
            </p>
          </div>

          {error && (
            <div id="auth-error" className="p-4 bg-[#EF4444]/10 border border-[#EF4444] text-[#F87171] rounded-none text-xs font-semibold">
              {error}
            </div>
          )}

          {isFamilyMode ? (
            <form id="family-auth-form" onSubmit={handleFamilySubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Your Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                    <UserIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="E.g., Jane Smith"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Owner's Legacy Key</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={familyKey}
                    onChange={(e) => setFamilyKey(e.target.value)}
                    placeholder="E.g., LB-A1B2C3"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs focus:outline-none focus:border-[#F59E0B] font-mono font-bold tracking-wider"
                  />
                </div>
              </div>

              <button
                id="submit-family-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-4 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Enter Legacy Vault</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setIsFamilyMode(false);
                }}
                className="w-full py-3 border border-[#334155] hover:bg-[#1E293B] bg-[#1E293B] text-[#F1F5F9] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span>Go Back to Owner Sign In</span>
              </button>
            </form>
          ) : forgotPasswordMode ? (
            <>
              {recoverySuccessMessage && (
                <div id="recovery-success" className="p-4 bg-[#10B981]/10 border border-[#10B981] text-[#34D399] rounded-none text-xs font-semibold leading-relaxed">
                  {recoverySuccessMessage}
                </div>
              )}

              {isOtpStep ? (
                <form id="confirm-login-form" onSubmit={handleConfirmLoginSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">6-Digit Confirmation Code</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="E.g., 123456"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs font-mono font-bold tracking-widest focus:outline-none focus:border-[#F59E0B] placeholder:font-sans placeholder:tracking-normal"
                      />
                    </div>
                    <p className="text-[10px] text-[#64748B] leading-relaxed italic">
                      Please check your email. If you don't receive it shortly, check your spam folder.
                    </p>
                  </div>

                  {emailPreviewUrl && (
                    <div className="p-4 bg-[#F59E0B]/10 border border-[#F59E0B] text-[#FBBF24] rounded-none text-xs space-y-2">
                      <p className="font-bold uppercase tracking-wider text-[9px] text-[#F59E0B]">
                        [Test Mode] Automatic Email Delivery Interceptor
                      </p>
                      <p className="leading-relaxed text-[11px]">
                        Since this is a simulated sandbox environment, the system has dispatched a test Ethereal message containing your credentials and code.
                      </p>
                      <a
                        href={emailPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F1F5F9] hover:underline uppercase tracking-wide bg-[#1E293B] px-2.5 py-1.5 border border-[#334155] shadow-xs"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Open Sent Email Preview ↗</span>
                      </a>
                    </div>
                  )}

                  <button
                    id="submit-confirm-login-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 mt-4 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Confirm Login & Enter</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setRecoverySuccessMessage("");
                        setIsOtpStep(false);
                        setOtpCode("");
                      }}
                      className="flex-1 py-2.5 border border-[#334155] hover:bg-[#1E293B] bg-[#1E293B] text-[#F1F5F9] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center cursor-pointer transition-all"
                    >
                      <span>Resend Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setRecoverySuccessMessage("");
                        setForgotPasswordMode(false);
                        setIsOtpStep(false);
                        setOtpCode("");
                        setRecoveryEmail("");
                        setEmailPreviewUrl(null);
                      }}
                      className="flex-1 py-2.5 border border-[#334155] hover:bg-[#1E293B] bg-[#1E293B] text-[#F1F5F9] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center cursor-pointer transition-all"
                    >
                      <span>Cancel</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form id="forgot-password-form" onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Registered Email Address</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs focus:outline-none focus:border-[#F59E0B]"
                      />
                    </div>
                  </div>

                  <button
                    id="submit-forgot-password-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 mt-4 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send Recovery Email</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setRecoverySuccessMessage("");
                      setForgotPasswordMode(false);
                      setIsOtpStep(false);
                      setRecoveryEmail("");
                      setEmailPreviewUrl(null);
                    }}
                    className="w-full py-3 border border-[#334155] hover:bg-[#1E293B] bg-[#1E293B] text-[#F1F5F9] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>Back to Sign In</span>
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Full Name</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                        <UserIcon className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="E.g., John Doe"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs focus:outline-none focus:border-[#F59E0B]"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="type" // Keep original
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>
                </div>

                {!isLogin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Date of Birth</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                          <Calendar className="w-4 h-4" />
                        </span>
                        <input
                          type="date"
                          required
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs focus:outline-none focus:border-[#F59E0B]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Phone (Optional)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                          <Phone className="w-4 h-4" />
                        </span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs focus:outline-none focus:border-[#F59E0B]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Password</label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setForgotPasswordMode(true);
                            setRecoveryEmail(email); // Autofill from main email input if entered
                            setIsOtpStep(false);
                            setRecoverySuccessMessage("");
                          }}
                          className="text-[10px] font-bold text-[#64748B] hover:text-[#F1F5F9] uppercase tracking-wider underline cursor-pointer focus:outline-none"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs focus:outline-none focus:border-[#F59E0B]"
                      />
                    </div>
                  </div>

                  {!isLogin && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Confirm Password</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B]">
                          <Lock className="w-4 h-4" />
                        </span>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-none text-[#F1F5F9] text-xs focus:outline-none focus:border-[#F59E0B]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  id="submit-auth-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 mt-4 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{isLogin ? "Log In" : "Create Account"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div id="auth-toggle-container" className="flex flex-col gap-4 text-center pt-2">
                <button
                  id="toggle-auth-btn"
                  onClick={() => {
                    setError("");
                    setIsLogin(!isLogin);
                  }}
                  className="text-xs text-[#64748B] hover:text-[#F1F5F9] font-bold uppercase tracking-wider underline cursor-pointer"
                >
                  {isLogin 
                    ? "Don't have an account? Create New Account" 
                    : "Already registered? Log in to your account"}
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-[#334155]"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Or enter as family member</span>
                  <div className="flex-grow border-t border-[#334155]"></div>
                </div>

                <button
                  id="guest-mode-btn"
                  onClick={() => {
                    setError("");
                    setIsFamilyMode(true);
                  }}
                  className="w-full py-3 border border-[#334155] hover:bg-[#1E293B] bg-[#1E293B] text-[#F1F5F9] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span>Continue as Family Member</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
