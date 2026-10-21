"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
          <div className={styles.storyCopy}>
            <p className={styles.eyebrow}>
              <span />
              Your business, connected
            </p>
            <h2 id="vantage-story-heading">
              See the
              <br />
              whole <span>picture.</span>
            </h2>
            <p className={styles.storyDescription}>
              Clients, projects, people, and time.
              <br />
              One workspace to bring it all into focus.
            </p>
          </div>

          <div className={styles.brandArtwork} aria-hidden="true">
            <svg viewBox="0 0 600 270" fill="none">
              <defs>
                <linearGradient
                  id="vantage-plane-blue"
                  x1="155"
                  y1="25"
                  x2="320"
                  y2="250"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#82b8ff" />
                  <stop offset=".45" stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#1e3a66" />
                </linearGradient>
                <linearGradient
                  id="vantage-plane-copper"
                  x1="432"
                  y1="25"
                  x2="270"
                  y2="250"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#f2bc8a" />
                  <stop offset=".48" stopColor="#df9556" />
                  <stop offset="1" stopColor="#a75e30" />
                </linearGradient>
                <linearGradient
                  id="vantage-edge"
                  x1="0"
                  y1="0"
                  x2="600"
                  y2="0"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#93c5fd" stopOpacity="0" />
                  <stop offset=".5" stopColor="#93c5fd" stopOpacity=".4" />
                  <stop offset="1" stopColor="#93c5fd" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M25 40H575M25 250H575" stroke="url(#vantage-edge)" />
              <path
                d="M104 20L254 260M146 20L296 260M454 20L304 260M496 20L346 260"
                stroke="#8daacb"
                strokeOpacity=".12"
              />
              <path
                d="M148 33H219L324 221L286 258Z"
                fill="url(#vantage-plane-blue)"
              />
              <path
                d="M381 33H452L324 258H248Z"
                fill="url(#vantage-plane-copper)"
              />
              <path
                d="M148 33H219L324 221"
                stroke="#bad6ff"
                strokeOpacity=".65"
              />
              <path
                d="M381 33H452L324 258H248"
                stroke="#ffd3ac"
                strokeOpacity=".5"
              />
              <path
                d="M219 33L324 221L286 258"
                fill="#101b2b"
                fillOpacity=".15"
              />
              <path
                d="M452 33L324 258H312L440 33Z"
                fill="#ffe3ca"
                fillOpacity=".12"
              />
              <path
                d="M48 145H124M476 145H552"
                stroke="#849bb8"
                strokeOpacity=".3"
              />
              <circle cx="48" cy="145" r="2" fill="#96b4d9" />
              <circle cx="552" cy="145" r="2" fill="#eaaa72" />
            </svg>
            <div className={styles.artworkCaption}>
              <span>Clarity through connection</span>
              <span>VantageFP</span>
            </div>
          </div>
          <div className={styles.storyFooter}>
            <span>Built for project-based businesses</span>
            <span className={styles.storyRule} />
          </div>
        </section>

        <section className={styles.signIn} aria-labelledby="sign-in-heading">
          <div className={styles.signInContent}>
            <div className={styles.entranceRule} aria-hidden="true">
              <span />
              <span />
            </div>
            <p className={styles.formEyebrow}>Your Vantage workspace</p>
            <h1 id="sign-in-heading">Welcome back.</h1>
            <p className={styles.formDescription}>Sign in to your workspace.</p>
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
                  <span className={styles.buttonArrow} aria-hidden="true" />
                )}
              </button>
              <p id="workspace-sign-in-help" className={styles.accountHelp}>
                Use your company Google Workspace account.
              </p>
              <div className={styles.accessNote}>
                <span>Google Workspace</span>
                <p>Access managed by your organization.</p>
              </div>
            </div>
            <p className={styles.legal}>
              By signing in, you agree to our <a href="/terms">Terms</a> and{" "}
              <a href="/privacy">Privacy Policy</a>.
            </p>
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
