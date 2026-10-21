"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  Clock3,
  FolderKanban,
  LockKeyhole,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import VantageLogo from "@/components/brand/VantageLogo";
import styles from "./login.module.css";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (active && user) router.push("/");
      })
      .catch(() => {
        /* A failed session lookup must leave sign-in available. */
      });
    return () => {
      active = false;
    };
  }, [router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
    } catch {
      setError("We couldn’t start your sign-in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <VantageLogo className={styles.logo} />
        <span className={styles.headerCaption}>
          A clearer view of your business.
        </span>
      </header>

      <div className={styles.workspace}>
        <section
          className={styles.story}
          aria-labelledby="vantage-story-heading"
        >
          <svg
            className={styles.horizon}
            viewBox="0 0 800 800"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M-190 -90L390 900L970 -90"
              stroke="#93c5fd"
              strokeOpacity=".08"
              strokeWidth="1"
            />
            <path
              d="M-110 -90L390 760L890 -90"
              stroke="#93c5fd"
              strokeOpacity=".13"
              strokeWidth="1"
            />
            <path
              d="M-30 -90L390 620L810 -90"
              stroke="#93c5fd"
              strokeOpacity=".18"
              strokeWidth="1"
            />
            <path
              d="M50 -90L390 480L730 -90"
              stroke="#ea8a2f"
              strokeOpacity=".20"
              strokeWidth="1"
            />
            <circle cx="390" cy="480" r="5" fill="#ea8a2f" />
            <circle
              cx="390"
              cy="480"
              r="13"
              stroke="#ea8a2f"
              strokeOpacity=".2"
            />
          </svg>
          <div className={styles.storyCopy}>
            <p className={styles.eyebrow}>
              <span />
              Your business, connected
            </p>
            <h1 id="vantage-story-heading">
              See the
              <br />
              whole <span>picture.</span>
            </h1>
            <p className={styles.storyDescription}>
              Clients, projects, people, and time.
              <br />
              One workspace to bring it all into focus.
            </p>
          </div>

          <div className={styles.overview}>
            <div className={styles.overviewHeading}>
              <span className={styles.overviewSymbol}>
                <FolderKanban size={16} aria-hidden="true" />
              </span>
              <span>From the big picture to the details.</span>
            </div>
            <div
              className={styles.connectedWork}
              aria-label="Clients and projects connected to people and time"
            >
              <div className={styles.workColumn}>
                <span className={styles.workLabel}>The foundation</span>
                <div>
                  <Building2 size={17} aria-hidden="true" />
                  <span>Clients & projects</span>
                </div>
              </div>
              <ArrowRight
                size={18}
                className={styles.workArrow}
                aria-hidden="true"
              />
              <div className={styles.workColumn}>
                <span className={styles.workLabel}>The work</span>
                <div>
                  <Users size={17} aria-hidden="true" />
                  <span>People & time</span>
                </div>
              </div>
            </div>
            <div className={styles.overviewFooter}>
              <Check size={14} aria-hidden="true" />
              <span>Connected work. Clearer decisions.</span>
              <Clock3
                size={14}
                className={styles.footerClock}
                aria-hidden="true"
              />
            </div>
          </div>
          <div className={styles.storyFooter}>
            <span>Built for project-based businesses</span>
            <span className={styles.storyRule} />
          </div>
        </section>

        <section className={styles.signIn} aria-labelledby="sign-in-heading">
          <div className={styles.signInContent}>
            <span className={styles.welcomeIcon}>
              <LockKeyhole size={22} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <p className={styles.formEyebrow}>Your Vantage workspace</p>
            <h2 id="sign-in-heading">Welcome back.</h2>
            <p className={styles.formDescription}>
              Your next clear view starts here.
            </p>
            <div className={styles.form}>
              {error && (
                <div role="alert" className={styles.error}>
                  {error}
                </div>
              )}
              <button
                type="button"
                className={styles.googleButton}
                onClick={handleGoogleLogin}
                disabled={loading}
                aria-busy={loading}
                aria-describedby="workspace-sign-in-help"
              >
                {loading ? (
                  <span className={styles.spinner} aria-hidden="true" />
                ) : (
                  <GoogleMark />
                )}
                <span>
                  {loading ? "Connecting to Google…" : "Continue with Google"}
                </span>
                {!loading && (
                  <ArrowRight
                    size={17}
                    className={styles.buttonArrow}
                    aria-hidden="true"
                  />
                )}
              </button>
              <p id="workspace-sign-in-help" className={styles.accountHelp}>
                Use your company Google Workspace account.
              </p>
              <div className={styles.accessNote}>
                <LockKeyhole size={15} aria-hidden="true" />
                <p>
                  One account. Secure access.
                  <span>
                    Sign in with the account connected to your organization.
                  </span>
                </p>
              </div>
            </div>
            <p className={styles.legal}>
              By signing in, you agree to our <a href="/terms">Terms</a> and{" "}
              <a href="/privacy">Privacy Policy</a>.
            </p>
          </div>
          <div className={styles.signInFooter}>
            <span className={styles.smallMark} aria-hidden="true">
              V
            </span>
            <span>Clarity in every connection.</span>
          </div>
        </section>
      </div>
      <footer className={styles.pageFooter}>
        <span>VantageFP · Business operations, in focus.</span>
        <div>
          <a href="/privacy">Privacy</a>
          <span aria-hidden="true">/</span>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </main>
  );
}
