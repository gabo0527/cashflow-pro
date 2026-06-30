// src/app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push('/')
    }
    checkAuth()
  }, [router])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div className="v-page">
      {/* Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Instrument+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div className="v-bg" />

      <div className={`v-frame ${mounted ? 'v-in' : ''}`}>

        {/* ───────── LEFT: sign-in ───────── */}
        <div className="v-left">
          <div className="v-lwrap">
          <div className="v-tile">
            <svg width="30" height="30" viewBox="0 0 48 48" fill="none">
              <path d="M12 13 L24 37 L36 13" stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="v-eyebrow">Vantage</div>
          <h1 className="v-h1">Welcome back</h1>
          <p className="v-sub">Sign in to your workspace</p>

          <div className="v-card">
            {error && (
              <div className="v-error">{error}</div>
            )}

            <button className="v-gbtn" onClick={handleGoogleLogin} disabled={loading}>
              {loading ? (
                <span className="v-spinner" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="rgba(255,255,255,.95)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="rgba(255,255,255,.8)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="rgba(255,255,255,.7)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="rgba(255,255,255,.95)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
              {!loading && (
                <span className="v-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              )}
            </button>

            <p className="v-ws">Use your company Google Workspace account</p>

            <div className="v-sec">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" /></svg>
              Encrypted · Single sign-on
            </div>
          </div>

          <p className="v-legal">
            By signing in, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>
          </p>
          </div>
        </div>

        {/* ───────── RIGHT: glass-gradient showcase ───────── */}
        <div className="v-right">
          <div className="v-pinstripe" />

          <div className="v-brand">
            <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
              <path d="M11 12 L24 38 L37 12" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="v-word">Vantage</span>
          </div>

          <div className="v-rcontent">
          <div className="v-hero">
            <h2>Business operations,<br /><span className="v-mint">all in one place.</span></h2>
            <p>Clients, projects, contractors, time, and documents — one system.</p>
          </div>

          {/* Anonymized product peek — no real names or figures */}
          <div className="v-mock">
            <div className="v-mh">
              <span className="v-mt">Time Analytics</span>
              <span className="v-mchips"><span className="v-mchip" /><span className="v-mchip" /></span>
            </div>
            <div className="v-tiles">
              <div className="v-tile2"><div className="v-lbl">Hours</div><div className="v-val">612</div></div>
              <div className="v-tile2"><div className="v-lbl">Billable</div><div className="v-val">548</div></div>
              <div className="v-tile2"><div className="v-lbl">Util</div><div className="v-val g">71%</div></div>
              <div className="v-tile2"><div className="v-lbl">Margin</div><div className="v-val g">24%</div></div>
            </div>
            <div className="v-rows">
              <div className="v-r"><div className="v-lft"><span className="v-dot" style={{ background: '#10B981' }} /><span className="v-nm">Project A</span></div><span className="v-hrs">142 hrs</span></div>
              <div className="v-r"><div className="v-lft"><span className="v-dot" style={{ background: '#6571B2' }} /><span className="v-nm">Project B</span></div><span className="v-hrs">98 hrs</span></div>
              <div className="v-r"><div className="v-lft"><span className="v-dot" style={{ background: '#66B0F8' }} /><span className="v-nm">Project C</span></div><span className="v-hrs">76 hrs</span></div>
              <div className="v-r"><div className="v-lft"><span className="v-dot" style={{ background: '#FDD034' }} /><span className="v-nm">Project D</span></div><span className="v-hrs">54 hrs</span></div>
            </div>
          </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .v-page {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          font-family: 'Instrument Sans', system-ui, sans-serif;
        }
        .v-bg {
          position: fixed; inset: 0; z-index: 0;
          background:
            radial-gradient(900px 500px at 80% 10%, rgba(16,185,129,.06), transparent 60%),
            linear-gradient(180deg, #eef1f4, #e6eaee);
        }

        .v-frame {
          position: relative; z-index: 1;
          width: 100%; max-width: none; height: 100vh;
          display: flex;
          background: #fff;
          border-radius: 0;
          overflow: hidden;
          opacity: 0; transform: translateY(14px);
        }
        .v-in { animation: vFade .6s ease-out forwards; }
        @keyframes vFade { to { opacity: 1; transform: translateY(0); } }

        /* LEFT */
        .v-left {
          width: 46%;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          padding: 0 64px;
        }
        .v-lwrap { width: 100%; max-width: 380px; }
        .v-tile {
          width: 56px; height: 56px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #6EE7B7, #10B981);
          box-shadow: 0 6px 16px rgba(16,185,129,.28);
        }
        .v-eyebrow {
          color: #10B981; font-family: 'Archivo', sans-serif; font-weight: 800;
          font-size: 11px; letter-spacing: .16em; text-transform: uppercase; margin: 30px 0 10px;
        }
        .v-h1 {
          font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 38px;
          line-height: 1.04; letter-spacing: -.01em; color: #161C1F; text-transform: uppercase;
        }
        .v-sub { color: #6b7682; font-size: 14.5px; margin-top: 12px; }

        .v-card {
          margin-top: 30px; max-width: 360px; background: #fff;
          border: 1px solid #e7eaed; border-radius: 16px; padding: 22px;
          box-shadow: 0 1px 2px rgba(22,28,31,.04), 0 10px 26px rgba(22,28,31,.05);
        }
        .v-error {
          margin-bottom: 16px; padding: 11px 13px; border-radius: 11px;
          background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
          font-size: 13px; text-align: center;
        }
        .v-gbtn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px;
          padding: 14px; border: none; cursor: pointer; border-radius: 12px;
          color: #fff; font-size: 15px; font-weight: 600; font-family: 'Instrument Sans', sans-serif;
          background: linear-gradient(180deg, #14c98c, #10B981);
          box-shadow: 0 2px 10px rgba(16,185,129,.22);
          transition: box-shadow .2s, transform .1s;
        }
        .v-gbtn:hover:not(:disabled) { box-shadow: 0 10px 28px rgba(16,185,129,.32); }
        .v-gbtn:active:not(:disabled) { transform: scale(.985); }
        .v-gbtn:disabled { opacity: .65; cursor: not-allowed; }
        .v-arrow { opacity: .7; display: inline-flex; transition: transform .2s, opacity .2s; }
        .v-gbtn:hover:not(:disabled) .v-arrow { opacity: 1; transform: translateX(2px); }
        .v-spinner {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
          animation: vSpin .7s linear infinite;
        }
        @keyframes vSpin { to { transform: rotate(360deg); } }

        .v-ws { color: #6b7682; font-size: 12px; text-align: center; margin-top: 13px; }
        .v-sec {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          color: #9aa3ad; font-size: 11.5px; margin-top: 16px; padding-top: 15px;
          border-top: 1px solid #eef0f2;
        }
        .v-legal { color: #9aa3ad; font-size: 11px; margin-top: 20px; line-height: 1.6; max-width: 360px; }
        .v-legal a { color: #065F46; font-weight: 600; text-decoration: none; }
        .v-legal a:hover { text-decoration: underline; }

        /* RIGHT */
        .v-right {
          flex: 1; position: relative; overflow: hidden;
          background: linear-gradient(135deg, #0a2a22 0%, #0d3a2e 26%, #10B981 56%, #6EE7B7 80%, #d9efe6 100%);
        }
        .v-right::before {
          content: ""; position: absolute; inset: 0;
          background: repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 26px);
        }
        .v-right::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(115deg, rgba(22,28,31,.78) 0%, rgba(22,28,31,.30) 42%, transparent 70%);
        }
        .v-pinstripe {
          position: absolute; inset: 0; opacity: .5;
          background: repeating-linear-gradient(135deg, rgba(255,255,255,.04) 0 1px, transparent 1px 9px);
        }
        .v-brand { position: absolute; top: 42px; left: 48px; z-index: 3; display: flex; align-items: center; gap: 12px; }
        .v-word { color: #fff; font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 24px; letter-spacing: -.01em; }

        .v-rcontent {
          position: absolute; inset: 0; padding: 0 56px;
          display: flex; flex-direction: column; justify-content: center; z-index: 2;
        }
        .v-hero { position: relative; z-index: 3; max-width: 540px; }
        .v-hero h2 {
          color: #fff; font-family: 'Archivo', sans-serif; font-weight: 900; font-size: 42px;
          line-height: 1.02; letter-spacing: -.01em; text-transform: uppercase;
        }
        .v-mint { color: #6EE7B7; }
        .v-hero p { color: rgba(255,255,255,.72); font-size: 14.5px; margin-top: 16px; max-width: 330px; line-height: 1.5; }

        .v-mock {
          position: relative; align-self: flex-end; width: 560px; max-width: 96%;
          margin-top: 48px; margin-right: -56px; z-index: 2;
          transform: perspective(1700px) rotateY(-13deg) rotateX(4deg);
          background: #fff; border-radius: 14px; overflow: hidden;
          box-shadow: 0 40px 90px rgba(8,20,16,.5); border: 1px solid rgba(255,255,255,.5);
        }
        .v-mh { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #eef0f2; }
        .v-mt { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 13px; color: #161C1F; text-transform: uppercase; letter-spacing: .03em; }
        .v-mchips { display: flex; gap: 6px; }
        .v-mchip { width: 42px; height: 14px; border-radius: 5px; background: #eef1f3; display: inline-block; }
        .v-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #eef0f2; }
        .v-tile2 { background: #fff; padding: 12px; }
        .v-lbl { font-size: 8px; color: #9aa3ad; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
        .v-val { font-size: 18px; font-weight: 700; color: #161C1F; margin-top: 3px; letter-spacing: -.02em; }
        .v-val.g { color: #10B981; }
        .v-rows { padding: 6px 16px 16px; }
        .v-r { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #f3f5f6; }
        .v-r:last-child { border-bottom: none; }
        .v-lft { display: flex; align-items: center; gap: 9px; }
        .v-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
        .v-nm { font-size: 11.5px; color: #3b454d; font-weight: 500; }
        .v-hrs { font-size: 11px; color: #9aa3ad; font-variant-numeric: tabular-nums; }

        @media (max-width: 920px) {
          .v-frame { flex-direction: column; height: auto; min-height: 100vh; }
          .v-left, .v-right { width: 100%; }
          .v-left { padding: 48px 28px; order: 2; }
          .v-right { order: 1; min-height: 300px; padding-bottom: 32px; }
          .v-rcontent { position: relative; inset: auto; padding: 92px 28px 0; }
          .v-hero h2 { font-size: 30px; }
          .v-brand { top: 26px; left: 28px; }
          .v-mock { display: none; }
        }
      `}</style>
    </div>
  )
}
