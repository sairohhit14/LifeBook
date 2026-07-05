import React, { useState, useEffect } from "react";
import { User, DashboardStats, Notification } from "./types";
import { api } from "./api";

// Sub Components
import LandingPage from "./components/LandingPage";
import DashboardHome from "./components/DashboardHome";
import MemoryVault from "./components/MemoryVault";
import LifeTimeline from "./components/LifeTimeline";
import LegacyMessages from "./components/LegacyMessages";
import FamilyCircle from "./components/FamilyCircle";
import SecureVault from "./components/SecureVault";
import BiographyBooks from "./components/BiographyBooks";
import LegacyCompanion from "./components/LegacyCompanion";
import GlobalSearch from "./components/GlobalSearch";
import SettingsPanel from "./components/SettingsPanel";
import GoogleFlowVideo from "./components/GoogleFlowVideo";

// Icons
import { 
  BookOpen, Heart, Calendar, Lock, Users, HardDrive, MessageSquare, 
  Search, Settings, Bell, LogOut, ChevronRight, Menu, X, ShieldAlert, Sparkles, Video
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // Shell states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    bootstrapSession();
  }, []);

  const bootstrapSession = async () => {
    setLoading(true);
    try {
      if (api.isLoggedIn()) {
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
        if (currentUser.id.startsWith("guest_")) {
          setGuestMode(true);
        } else {
          setGuestMode(false);
        }
        await refreshStatsAndNotifications();
      }
    } catch (err) {
      console.error("Session restoration failed:", err);
      api.clearSession();
    } finally {
      setLoading(false);
    }
  };

  const refreshStatsAndNotifications = async () => {
    try {
      const dashboardStats = await api.getDashboardStats();
      setStats(dashboardStats);
      const notifyList = await api.getNotifications();
      setNotifications(notifyList);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    }
  };

  const handleLoginSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setGuestMode(false);
    await refreshStatsAndNotifications();
    setActiveTab("dashboard");
  };

  const handleEnterGuestMode = async (legacyKey: string, familyMemberName: string) => {
    const guestUser = await api.familyLogin(legacyKey, familyMemberName);
    setUser(guestUser);
    setGuestMode(true);
    await refreshStatsAndNotifications();
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    api.clearSession();
    setUser(null);
    setGuestMode(false);
    setStats(null);
    setNotifications([]);
    setActiveTab("dashboard");
  };

  const handleMarkNotificationRead = async (id: string) => {
    if (guestMode) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      return;
    }
    try {
      await api.markNotificationRead(id);
      const list = await api.getNotifications();
      setNotifications(list);
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleClearNotifications = async () => {
    if (guestMode) {
      setNotifications([]);
      return;
    }
    try {
      await api.clearAllNotifications();
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  if (loading) {
    return (
      <div id="app-bootstrap-loader" className="min-h-screen bg-[#0F172A] text-[#F1F5F9] flex flex-col items-center justify-center font-sans gap-3">
        <LoaderComponent />
        <span className="text-xs font-mono text-[#64748B] uppercase tracking-widest animate-pulse font-bold">Decrypting legacy ledgers...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage 
        onLoginSuccess={handleLoginSuccess} 
        onEnterGuestMode={handleEnterGuestMode} 
      />
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div id="app-shell" className="min-h-screen bg-[#0F172A] text-[#F1F5F9] flex flex-col font-sans">
      
      {/* Top Header */}
      <header id="app-header" className="h-20 border-b border-[#334155] bg-[#0F172A]/90 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="p-2 hover:bg-[#1E293B] rounded-none lg:hidden text-[#F1F5F9] transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#F59E0B] text-[#0F172A] rounded-none border border-[#F59E0B]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-serif italic tracking-tighter text-[#F1F5F9] leading-none" style={{ fontFamily: "Georgia, serif" }}>LifeBook</span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#64748B] font-bold hidden sm:inline">Your Digital Ancestry</span>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-4 relative">
          
          {/* Universal Search Tab quick link */}
          <button 
            onClick={() => setActiveTab("search")}
            className={`p-2 hover:bg-[#1E293B] rounded-none transition-all cursor-pointer ${activeTab === "search" ? "text-[#F59E0B] bg-[#1E293B]" : "text-[#64748B] hover:text-[#F1F5F9]"}`}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications Center Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-[#1E293B] rounded-none text-[#64748B] hover:text-[#F1F5F9] transition-all cursor-pointer relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F59E0B] rounded-full"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-[#1E293B] border border-[#334155] rounded-none shadow-2xl p-4 space-y-3 z-50 text-[#F1F5F9]">
                <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E1]">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B]">Legacy Notifications</h5>
                  {notifications.length > 0 && (
                    <button 
                      onClick={handleClearNotifications}
                      className="text-[10px] text-[#64748B] hover:text-[#F1F5F9] cursor-pointer transition-colors font-bold underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-[10px] text-[#64748B] py-4 text-center">No active legacy updates.</p>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => handleMarkNotificationRead(n.id)}
                        className={`p-2.5 text-[11px] leading-normal transition-all cursor-pointer border ${
                          n.read 
                            ? "bg-[#0F172A]/40 border-[#334155] text-[#64748B]" 
                            : "bg-[#1E293B] border-[#475569] text-[#F1F5F9] font-medium"
                        }`}
                      >
                        {n.title && <p className="font-bold mb-0.5">{n.title}</p>}
                        <p>{n.message || (n as any).text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Legacy score indicator pill */}
          {stats && (
            <div className="px-3 py-1.5 bg-[#F59E0B] border border-[#F59E0B] text-[#0F172A] rounded-none text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="hidden md:inline text-[#0F172A]/75 text-[9px] font-medium tracking-widest">Legacy Completion</span>
              <span>{stats.legacyCompletion}%</span>
            </div>
          )}

          {/* User Badge & Dropdown */}
          <div className="relative flex items-center">
            <button 
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2.5 pl-2 border-l border-[#334155] hover:bg-[#1E293B] p-1.5 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-xs font-serif italic font-bold text-[#F1F5F9] overflow-hidden flex-shrink-0">
                {user.profilePhoto ? (
                  <img referrerPolicy="no-referrer" src={user.profilePhoto} className="w-full h-full object-cover" />
                ) : (
                  user.name.split(" ").map(n => n[0]).join("")
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-[#F1F5F9] leading-none">{user.name}</p>
                <span className="text-[9px] text-[#64748B] font-semibold">{user.email}</span>
              </div>
            </button>

            {userDropdownOpen && (
              <>
                {/* Backdrop to close the dropdown */}
                <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)}></div>
                
                {/* Dropdown Card */}
                <div className="absolute right-0 top-11 mt-2 w-56 bg-[#1E293B] border border-[#334155] rounded-none shadow-2xl p-2 z-50 text-[#F1F5F9] animate-fade-in">
                  <div className="p-3 border-b border-[#334155] md:hidden">
                    <p className="text-xs font-bold text-[#F1F5F9] leading-none">{user.name}</p>
                    <p className="text-[9px] text-[#64748B] font-semibold mt-1 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setActiveTab("settings");
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider hover:bg-[#1E293B] transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-[#64748B]" />
                      <span>Owner Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[#EF4444] hover:bg-[#EF4444]/10 hover:text-[#F87171] transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out Legacy</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div id="app-body-container" className="flex-1 flex relative">
        
        {/* Navigation Sidebar */}
        <aside 
          id="app-sidebar" 
          className={`w-64 border-r border-[#334155] bg-[#1E293B] p-4 space-y-6 flex-shrink-0 flex flex-col justify-between fixed lg:sticky top-20 bottom-0 z-30 transition-all duration-300 ${
            mobileMenuOpen ? "left-0" : "-left-64 lg:left-0"
          }`}
        >
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-[0.2em] pl-3">Legacy Modules</span>
            <nav className="space-y-1">
              {[
                { id: "dashboard", label: "Dashboard Hub", icon: <Heart className="w-4 h-4" /> },
                { id: "memories", label: "Memory Vault", icon: <Heart className="w-4 h-4" /> },
                { id: "timeline", label: "Life Timeline", icon: <Calendar className="w-4 h-4" /> },
                { id: "messages", label: "Time-Capsule Letters", icon: <Lock className="w-4 h-4" /> },
                { id: "family", label: "Family Circle Tree", icon: <Users className="w-4 h-4" /> },
                { id: "vault", label: "Secure Digital Vault", icon: <HardDrive className="w-4 h-4" /> },
                { id: "stories", label: "AI Biography Shelf", icon: <BookOpen className="w-4 h-4" /> },
                { id: "companion", label: "AI Life Companion", icon: <MessageSquare className="w-4 h-4" /> },
                { id: "video", label: "Google Flow AI Video", icon: <Video className="w-4 h-4" /> }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer rounded-none ${
                    activeTab === item.id 
                      ? "bg-[#F59E0B] text-[#0F172A] font-bold" 
                      : "text-[#64748B] hover:bg-[#334155] hover:text-[#F1F5F9]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeTab === item.id ? "rotate-90" : "opacity-0"}`} />
                </button>
              ))}
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="space-y-2 pt-4 border-t border-[#334155]">
            <button
              onClick={() => { setActiveTab("settings"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer rounded-none ${
                activeTab === "settings" 
                  ? "bg-[#F59E0B] text-[#0F172A] font-bold" 
                  : "text-[#64748B] hover:bg-[#334155] hover:text-[#F1F5F9]"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Owner Settings</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#EF4444] hover:bg-[#EF4444]/10 hover:text-[#F87171] transition-all cursor-pointer rounded-none"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Legacy</span>
            </button>
          </div>
        </aside>

        {/* Content canvas container */}
        <main id="app-main-canvas" className="flex-grow p-6 md:p-8 bg-[#0F172A] overflow-y-auto max-w-full">
          {guestMode && (
            <div className="mb-6 p-4 bg-[#1E293B] border border-[#334155] flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#F59E0B] text-[#0F172A] rounded-none">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B]">Family Vault Viewer Mode</h4>
                  <p className="text-[11px] text-[#64748B] font-medium">
                    You are logged in under a secure family access session to explore the private legacy of <span className="font-bold text-[#F1F5F9]">{user?.ownerName || "the legacy owner"}</span>.
                  </p>
                </div>
              </div>
              <div className="px-3 py-1 bg-[#F59E0B]/10 text-[9px] font-mono tracking-wider font-bold text-[#F59E0B]">
                View-Only Privilege Enabled
              </div>
            </div>
          )}

          {activeTab === "dashboard" && stats && (
            <DashboardHome 
              stats={stats} 
              user={user} 
              onNavigate={(tab) => setActiveTab(tab)} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "memories" && (
            <MemoryVault 
              onMemoryChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "timeline" && (
            <LifeTimeline 
              onTimelineChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "messages" && (
            <LegacyMessages 
              onMessagesChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "family" && (
            <FamilyCircle 
              onFamilyChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "vault" && (
            <SecureVault 
              onVaultChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "stories" && (
            <BiographyBooks 
              onStoryGenerated={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "companion" && (
            <LegacyCompanion 
              onMemoryAdded={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "video" && (
            <GoogleFlowVideo 
              guestMode={guestMode}
            />
          )}

          {activeTab === "search" && (
            <GlobalSearch 
              onNavigateToTab={(tab) => setActiveTab(tab)} 
            />
          )}

          {activeTab === "settings" && (
            <SettingsPanel 
              user={user} 
              onProfileUpdated={(updatedUser) => setUser(updatedUser)} 
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// Inline Helper spinner
function LoaderComponent() {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <div className="absolute w-12 h-12 border-2 border-[#334155] rounded-full"></div>
      <div className="absolute w-12 h-12 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
