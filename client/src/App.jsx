
import React from "react";
import { useEffect, useState } from "react";
import {
  ShieldCheck, Search, LayoutDashboard, History, GraduationCap,
  LogOut, Menu, X, AlertTriangle, CheckCircle2, LoaderCircle,
  LockKeyhole, Users, Activity, BookOpen, RefreshCw
} from "lucide-react";
import { apiRequest } from "./api.js";

const resources = [
  {
    title: "Recognize and report phishing",
    description: "Learn common phishing signs and safer ways to handle suspicious messages.",
    url: "https://www.cisa.gov/secure-our-world/recognize-and-report-phishing"
  },
  {
    title: "Google Safe Browsing",
    description: "Learn how Google's browsing protection helps identify dangerous websites.",
    url: "https://safebrowsing.google.com/"
  },
  {
    title: "OWASP SSRF Prevention",
    description: "Understand why backend applications must defend against server-side request forgery.",
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"
  }
];

const emptyStats = { total: 0, counts: { Low: 0, Medium: 0, High: 0 } };

export default function App() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("scanner");
  const [authMode, setAuthMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [adminStats, setAdminStats] = useState(null);
  const [adminRecent, setAdminRecent] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [quizProgress, setQuizProgress] = useState([]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [auth, setAuth] = useState({ name: "", email: "", password: "" });

  async function request(path, options = {}) {
    return apiRequest(path, token, options);
  }

  async function refreshDashboard() {
    const [historyData, statsData] = await Promise.all([
      request("/scans/history?limit=50"),
      request("/scans/stats")
    ]);
    setHistory(historyData);
    setStats(statsData);
  }

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function loadUser() {
      try {
        const data = await apiRequest("/auth/me", token);
        if (active) setUser(data.user);
      } catch {
        if (active) {
          setToken("");
          setUser(null);
        }
      }
    }

    loadUser();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;

    let active = true;

    async function loadPageData() {
      setError("");

      try {
        if (page === "dashboard" || page === "history") {
          const [historyData, statsData] = await Promise.all([
            request("/scans/history?limit=50"),
            request("/scans/stats")
          ]);

          if (active) {
            setHistory(historyData);
            setStats(statsData);
          }
        }

        if (page === "learning") {
          const [quizData, progressData] = await Promise.all([
            request("/quizzes"),
            request("/quizzes/progress")
          ]);

          if (active) {
            setQuestions(quizData.questions);
            setQuizProgress(progressData.attempts);
          }
        }

        if (page === "admin" && user.role === "admin") {
          const [summary, recent] = await Promise.all([
            request("/admin/stats"),
            request("/admin/recent")
          ]);

          if (active) {
            setAdminStats(summary);
            setAdminRecent(recent);
          }
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    }

    loadPageData();
    return () => { active = false; };
  }, [token, user, page]);

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const body = authMode === "login"
        ? { email: auth.email, password: auth.password }
        : auth;

      const data = await apiRequest(endpoint, "", {
        method: "POST",
        body: JSON.stringify(body)
      });

      setUser(data.user);
      setToken(data.token);
      setAuth({ name: "", email: "", password: "" });
      setPage("scanner");
      setNotice("You are signed in.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setResult(null);
    setHistory([]);
    setAdminStats(null);
    setQuizResult(null);
    setPage("scanner");
    setNotice("");
    setError("");
  }

  async function scanUrl(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setResult(null);

    try {
      const data = await request("/scans", {
        method: "POST",
        body: JSON.stringify({ url })
      });
      setResult(data);
      setUrl("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openHistoryItem(item) {
    setResult({
      ...item,
      disclaimer:
        "This is a saved assessment, not a guarantee that the website is safe or malicious."
    });
    setPage("scanner");
  }

  async function submitQuiz() {
    setBusy(true);
    setError("");
    setQuizResult(null);

    try {
      const data = await request("/quizzes/submit", {
        method: "POST",
        body: JSON.stringify({ answers })
      });
      setQuizResult(data);
      const progress = await request("/quizzes/progress");
      setQuizProgress(progress.attempts);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const navigation = [
    { id: "scanner", label: "URL Scanner", icon: Search },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "history", label: "Scan History", icon: History },
    { id: "learning", label: "Learning Center", icon: GraduationCap },
    ...(user?.role === "admin"
      ? [{ id: "admin", label: "Admin Dashboard", icon: Users }]
      : [])
  ];

  if (!token || !user) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="brand auth-brand">
            <ShieldCheck size={35} />
            <span>PhishShield</span>
          </div>

          <p className="eyebrow">CYBERSECURITY AWARENESS PLATFORM</p>
          <h1>{authMode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="muted">
            {authMode === "login"
              ? "Sign in to scan URLs and review your security activity."
              : "Register to start learning and checking suspicious links."}
          </p>

          {error && <div className="message error">{error}</div>}

          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === "register" && (
              <label>
                Full name
                <input
                  value={auth.name}
                  onChange={e => setAuth({ ...auth, name: e.target.value })}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={auth.email}
                onChange={e => setAuth({ ...auth, email: e.target.value })}
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={auth.password}
                onChange={e => setAuth({ ...auth, password: e.target.value })}
                minLength={authMode === "register" ? 12 : undefined}
                maxLength={128}
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                required
              />
              {authMode === "register" && (
                <small>Use at least 12 characters.</small>
              )}
            </label>

            <button className="primary full" disabled={busy}>
              {busy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="switch-auth">
            {authMode === "login" ? "New to PhishShield?" : "Already registered?"}
            {" "}
            <button
              className="text-button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {authMode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>

          <p className="fine-print">
            Risk assessments are informational and cannot guarantee website safety.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand sidebar-brand">
          <ShieldCheck size={30} />
          <span>PhishShield</span>
          <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="side-label">WORKSPACE</div>

        <nav className="nav-list">
          {navigation.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => {
                  setPage(item.id);
                  setMobileMenu(false);
                  setError("");
                  setNotice("");
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <strong>{user.name}</strong>
              <small>{user.role === "admin" ? "Administrator" : "Member"}</small>
            </div>
          </div>
          <button className="nav-item logout" onClick={logout}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Close menu" />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)}>
            <Menu size={22} />
          </button>
          <div>
            <p className="top-eyebrow">SECURITY WORKSPACE</p>
            <h2>{navigation.find(item => item.id === page)?.label || "URL Scanner"}</h2>
          </div>
          <div className="online-indicator"><span /> Local workspace</div>
        </header>

        <div className="page-content">
          {error && (
            <div className="message error">
              <AlertTriangle size={18} /> {error}
              <button className="icon-button" onClick={() => setError("")}><X size={16} /></button>
            </div>
          )}
          {notice && <div className="message success">{notice}</div>}

          {page === "scanner" && (
            <>
              <section className="welcome-banner">
                <div>
                  <p className="eyebrow">STAY ALERT. STAY PROTECTED.</p>
                  <h1>Think before you click.</h1>
                  <p>
                    Check suspicious URLs, inspect warning signs, and make informed decisions.
                  </p>
                </div>
                <ShieldCheck className="banner-icon" size={92} />
              </section>

              <section className="panel scanner-panel">
                <div className="section-heading">
                  <div className="heading-icon"><Search size={20} /></div>
                  <div>
                    <h3>URL Security Scanner</h3>
                    <p>Enter a complete HTTP or HTTPS URL to begin analysis.</p>
                  </div>
                </div>

                <form className="scanner-form" onSubmit={scanUrl}>
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://example.com/login"
                    aria-label="URL to analyze"
                    maxLength={2048}
                    required
                  />
                  <button className="primary" disabled={busy}>
                    {busy
                      ? <><LoaderCircle className="spin" size={18} /> Analyzing</>
                      : <><Search size={18} /> Analyze URL</>}
                  </button>
                </form>

                <div className="privacy-note">
                  <LockKeyhole size={16} />
                  The scanner analyzes URL patterns and reputation. It does not open the target website.
                </div>
              </section>

              {result && (
                <section className="panel result-panel">
                  <div className="result-header">
                    <div>
                      <p className="top-eyebrow">ANALYSIS REPORT</p>
                      <h3>{result.hostname || "Saved scan"}</h3>
                    </div>
                    <span className={`risk-pill ${result.risk?.toLowerCase()}`}>
                      {result.risk} risk
                    </span>
                  </div>

                  <div className="score-row">
                    <div className={`score-circle ${result.risk?.toLowerCase()}`}>
                      <strong>{result.score}</strong><span>/100</span>
                    </div>
                    <div>
                      <h4>{result.risk} risk assessment</h4>
                      <p className="muted">
                        {result.risk === "High"
                          ? "Significant indicators were identified. Avoid interacting with this URL until verified."
                          : result.risk === "Medium"
                            ? "Review the identified indicators and verify the destination independently."
                            : "Few configured risk indicators were identified. This does not certify the website as safe."}
                      </p>
                    </div>
                  </div>

                  <div className="reputation-row">
                    <span>Threat-intelligence check</span>
                    <strong>{result.checks?.reputation || "Not recorded"}</strong>
                  </div>

                  <h4 className="list-title">Why was it flagged?</h4>
                  <ul className="reason-list">
                    {(result.reasons || []).map((reason, index) => (
                      <li key={`${index}-${reason}`}>
                        <AlertTriangle size={17} />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="disclaimer">
                    <AlertTriangle size={18} />
                    {result.disclaimer ||
                      "This assessment cannot guarantee that a website is safe or malicious."}
                  </div>
                </section>
              )}

              <section className="mini-grid">
                <article className="panel mini-card">
                  <ShieldCheck size={24} />
                  <h3>Pattern Detection</h3>
                  <p>Inspect hostname structure and suspicious URL indicators.</p>
                </article>
                <article className="panel mini-card">
                  <Activity size={24} />
                  <h3>Risk Assessment</h3>
                  <p>Understand how the heuristic score and reputation result differ.</p>
                </article>
                <article className="panel mini-card">
                  <GraduationCap size={24} />
                  <h3>Security Education</h3>
                  <p>Learn to recognize suspicious messages and protect your accounts.</p>
                </article>
              </section>
            </>
          )}

          {page === "dashboard" && (
            <>
              <div className="page-intro">
                <h1>Your security overview</h1>
                <p>Summary of your saved URL scans.</p>
              </div>

              <div className="stats-grid">
                <StatCard title="Total scans" value={stats.total} icon={Search} />
                <StatCard title="Low risk" value={stats.counts.Low} icon={CheckCircle2} />
                <StatCard title="Medium risk" value={stats.counts.Medium} icon={Activity} />
                <StatCard title="High risk" value={stats.counts.High} icon={AlertTriangle} />
              </div>

              <section className="panel">
                <div className="panel-title-row">
                  <div><h3>Recent scans</h3><p>Your most recent saved assessments.</p></div>
                  <button className="secondary" onClick={() => setPage("history")}>View history</button>
                </div>
                <ScanTable scans={history.slice(0, 8)} onOpen={openHistoryItem} />
              </section>
            </>
          )}

          {page === "history" && (
            <section className="panel">
              <div className="panel-title-row">
                <div>
                  <h3>Scan history</h3>
                  <p>Only scans belonging to your account appear here.</p>
                </div>
                <button className="secondary" onClick={refreshDashboard}>
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>
              <ScanTable scans={history} onOpen={openHistoryItem} />
              {!history.length && <p className="empty-state">No scans yet. Start with the URL Scanner.</p>}
            </section>
          )}

          {page === "learning" && (
            <>
              <div className="page-intro">
                <h1>Learn to spot phishing</h1>
                <p>Practice recognizing suspicious messages and safer online behavior.</p>
              </div>

              <section className="panel quiz-panel">
                <div className="section-heading">
                  <div className="heading-icon"><GraduationCap size={22} /></div>
                  <div><h3>Phishing awareness quiz</h3><p>Choose one answer for each question.</p></div>
                </div>

                {questions.map((question, index) => (
                  <fieldset className="question" key={question.id}>
                    <legend>{index + 1}. {question.question}</legend>
                    {question.options.map((option, optionIndex) => (
                      <label className="answer-option" key={option}>
                        <input
                          type="radio"
                          name={question.id}
                          checked={answers[question.id] === optionIndex}
                          onChange={() => setAnswers({
                            ...answers, [question.id]: optionIndex
                          })}
                          disabled={Boolean(quizResult)}
                        />
                        {option}
                      </label>
                    ))}
                  </fieldset>
                ))}

                {!quizResult ? (
                  <button
                    className="primary"
                    disabled={busy || questions.length === 0 ||
                      questions.some(q => answers[q.id] === undefined)}
                    onClick={submitQuiz}
                  >
                    {busy ? "Submitting..." : "Submit quiz"}
                  </button>
                ) : (
                  <div className="quiz-results">
                    <h3>Your score: {quizResult.score}/{quizResult.total}</h3>
                    {quizResult.results.map(item => (
                      <div className="quiz-explanation" key={item.id}>
                        <strong>
                          {item.correct ? "Correct" : "Incorrect"}
                        </strong>
                        <p>{item.explanation}</p>
                      </div>
                    ))}
                    <button className="secondary" onClick={() => {
                      setAnswers({});
                      setQuizResult(null);
                    }}>Try again</button>
                  </div>
                )}
              </section>

              <section className="panel">
                <h3>Learning resources</h3>
                <div className="resource-grid">
                  {resources.map(resource => (
                    <article className="resource-card" key={resource.url}>
                      <BookOpen size={22} />
                      <h4>{resource.title}</h4>
                      <p>{resource.description}</p>
                      <a href={resource.url} target="_blank" rel="noreferrer">
                        Open resource ↗
                      </a>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <h3>Your quiz progress</h3>
                {!quizProgress.length
                  ? <p className="muted">Complete a quiz to record your progress.</p>
                  : <ScanTable scans={quizProgress.map(item => ({
                      _id: item._id,
                      hostname: "Awareness quiz",
                      score: Math.round(item.score / item.total * 100),
                      risk: `${item.score}/${item.total}`,
                      createdAt: item.completedAt
                    }))} />}
              </section>
            </>
          )}

          {page === "admin" && user.role === "admin" && (
            <>
              <div className="page-intro">
                <h1>Administrator overview</h1>
                <p>Aggregate usage metrics across all users. Access is enforced by the backend.</p>
              </div>

              {adminStats && (
                <>
                  <div className="stats-grid">
                    <StatCard title="All scans" value={adminStats.totalScans} icon={Search} />
                    <StatCard title="Registered users" value={adminStats.totalUsers} icon={Users} />
                    <StatCard title="High-risk scans" value={adminStats.riskCounts.High} icon={AlertTriangle} />
                    <StatCard title="Medium-risk scans" value={adminStats.riskCounts.Medium} icon={Activity} />
                  </div>

                  <section className="panel">
                    <h3>Risk distribution</h3>
                    <RiskBars counts={adminStats.riskCounts} />
                  </section>

                  <section className="panel">
                    <h3>Daily scans — last 7 days</h3>
                    {adminStats.dailyScans.length
                      ? <div className="daily-list">
                          {adminStats.dailyScans.map(item => (
                            <div className="daily-item" key={item._id}>
                              <span>{item._id}</span>
                              <strong>{item.count} scans</strong>
                            </div>
                          ))}
                        </div>
                      : <p className="muted">No scans recorded during this period.</p>}
                  </section>

                  <section className="panel">
                    <h3>Most common indicators</h3>
                    {adminStats.topIndicators.map(item => (
                      <div className="daily-item" key={item._id}>
                        <span>{item._id}</span><strong>{item.count}</strong>
                      </div>
                    ))}
                  </section>

                  <section className="panel">
                    <h3>Recent scan activity</h3>
                    <ScanTable scans={adminRecent} />
                  </section>
                </>
              )}
            </>
          )}
        </div>

        <footer className="app-footer">
          PhishShield · College cybersecurity project · Risk scores do not guarantee safety.
        </footer>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <article className="panel stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <Icon size={20} />
      </div>
      <strong>{value}</strong>
    </article>
  );
}

function ScanTable({ scans = [], onOpen }) {
  if (!scans.length) {
    return <p className="empty-state">No records available yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>URL / activity</th><th>Score</th><th>Risk / result</th><th>Date</th>{onOpen && <th>Details</th>}</tr>
        </thead>
        <tbody>
          {scans.map((scan, index) => (
            <tr key={scan._id || index}>
              <td className="host-cell">{scan.hostname}</td>
              <td>{scan.score ?? "—"}{scan.score !== undefined && scan.score !== null && scan.hostname !== "Awareness quiz" ? "/100" : ""}</td>
              <td>
                <span className={`risk-pill ${(scan.risk || "").toLowerCase().includes("high") ? "high" : (scan.risk || "").toLowerCase().includes("medium") ? "medium" : "low"}`}>
                  {scan.risk}
                </span>
              </td>
              <td>{scan.createdAt ? new Date(scan.createdAt).toLocaleDateString() : "—"}</td>
              {onOpen && <td><button className="text-button" onClick={() => onOpen(scan)}>View</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBars({ counts }) {
  const total = Math.max(1, counts.Low + counts.Medium + counts.High);

  return (
    <div className="risk-bars">
      {["Low", "Medium", "High"].map(level => (
        <div className="risk-bar-row" key={level}>
          <div><span>{level}</span><strong>{counts[level]}</strong></div>
          <div className="bar-track">
            <div
              className={`bar-fill ${level.toLowerCase()}`}
              style={{ width: `${counts[level] / total * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}