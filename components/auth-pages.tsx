"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
  Building2,
  MessageCircle,
  GraduationCap,
} from "lucide-react";
import { api, useResource } from "@/lib/client";
import {
  Logo,
  Button,
  ButtonLink,
  Avatar,
  Badge,
  useToast,
  ErrorState,
} from "./ui";
export function AuthPage({
  mode,
  token = "",
}: {
  mode: string;
  token?: string;
}) {
  const router = useRouter(),
    toast = useToast();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [show, setShow] = useState(false),
    [success, setSuccess] = useState(false),
    [devUrl, setDevUrl] = useState(""),
    [error, setError] = useState(""),
    [mfaRequired, setMfaRequired] = useState(false);
  const signup = mode === "signup",
    forgot = mode === "forgot-password",
    reset = mode === "reset-password",
    verify = mode === "verify-email";
  const heading = signup
    ? "Your world starts here."
    : forgot
      ? "Let’s get you back in."
      : reset
        ? "A fresh start."
        : verify
          ? "One more little step."
          : "Welcome back.";
  const description = signup
    ? "One identity. A world of people and possibilities."
    : forgot
      ? "Enter your email and we’ll send you a recovery link."
      : reset
        ? "Choose a strong password for your account."
        : verify
          ? "Verify your email to start making connections."
          : "Your people, your communities, your conversations.";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (verify) {
        await api("auth/verify", { token });
        client.clear();
        setSuccess(true);
        return;
      }
      const result = await api<{
        mfaRequired?: boolean;
        verified?: boolean;
        onboarding?: boolean;
        devVerificationUrl?: string;
        devResetUrl?: string;
      }>(`auth/${mode}`, reset ? { ...body, token } : body);
      if (result.mfaRequired) {
        setMfaRequired(true);
        return;
      }
      if (signup || (!forgot && !reset)) client.clear();
      if (signup) {
        setSuccess(true);
        setDevUrl(result.devVerificationUrl || "");
      } else if (forgot) {
        setSuccess(true);
        setDevUrl(result.devResetUrl || "");
      } else if (reset) {
        setSuccess(true);
      } else
        router.push(
          !result.verified
            ? "/verify-email"
            : !result.onboarding
              ? "/onboarding"
              : "/app",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-brand-side">
        <Logo light />
        <div className="auth-brand-content">
          <div className="auth-orbit">
            <div className="auth-orbit-ring" />
            <span className="auth-orbit-node orbit-node-one">
              <GraduationCap size={24} />
            </span>
            <span className="auth-orbit-node orbit-node-two">
              <MessageCircle size={23} />
            </span>
            <span className="auth-orbit-node orbit-node-three">
              <Users size={24} />
            </span>
            <Avatar name="You" color="rose" size="xl" />
            <span className="auth-orbit-tag">
              <Check size={13} /> Always you. Everywhere.
            </span>
          </div>
          <h2>
            One identity.
            <br />
            Every community.
            <br />
            <span>Infinite connections.</span>
          </h2>
          <p>
            Find the people, ideas, and communities
            <br />
            that make your world a little bigger.
          </p>
        </div>
        <span className="auth-side-footer">Connect beyond boundaries.</span>
      </aside>
      <main className="auth-main">
        <Link className="auth-back" href="/">
          <ChevronLeft size={16} /> Back to YouConect
        </Link>
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">
            {signup ? "GOOD THINGS AHEAD" : "YOUR PLACE TO CONNECT"}
          </span>
          <h1>{heading}</h1>
          <p>{description}</p>
          {success ? (
            <div className="auth-success">
              <div className="empty-icon">
                <Check size={28} />
              </div>
              <h2>
                {signup
                  ? "Check your inbox."
                  : forgot
                    ? "Check your inbox."
                    : reset
                      ? "Your password is updated."
                      : "You’re verified!"}
              </h2>
              <p>
                {signup
                  ? "We’ve sent a verification link to your email."
                  : forgot
                    ? "If there’s an account with this email, we’ve sent a password recovery link."
                    : reset
                      ? "You can now sign in with your new password."
                      : "You’re ready to find your people."}
              </p>
              {devUrl && (
                <div className="dev-mail-notice">
                  <Badge color="amber">Local development email</Badge>
                  <p>
                    No email provider is configured. Your message is saved in
                    the local development outbox.
                  </p>
                  <a className="button button-secondary" href={devUrl}>
                    {signup ? "Open verification email" : "Open recovery email"}
                    <ArrowRight size={15} />
                  </a>
                </div>
              )}
              <ButtonLink href={verify ? "/onboarding" : "/login"}>
                {verify ? "Make yourself at home" : "Go to sign in"}
                <ArrowRight size={16} />
              </ButtonLink>
            </div>
          ) : (
            <form onSubmit={submit} className="auth-form">
              {signup && (
                <label>
                  Full name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
              )}
              {!verify && (
                <>
                  {!reset && (
                    <label>
                      Email address
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        autoComplete="email"
                        maxLength={254}
                      />
                    </label>
                  )}
                  {!forgot && (
                    <label>
                      <span className="label-line">
                        Password
                        {!signup && !reset && (
                          <Link href="/forgot-password">Forgot password?</Link>
                        )}
                      </span>
                      <span className="password-input">
                        <input
                          name="password"
                          type={show ? "text" : "password"}
                          required
                          minLength={signup || reset ? 12 : 1}
                          maxLength={128}
                          placeholder={
                            signup || reset
                              ? "At least 12 characters"
                              : "Your password"
                          }
                          autoComplete={
                            signup || reset
                              ? "new-password"
                              : "current-password"
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShow(!show)}
                          aria-label={show ? "Hide password" : "Show password"}
                        >
                          {show ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </span>
                      {(signup || reset) && (
                        <small>
                          Use a unique password with at least 12 characters.
                        </small>
                      )}
                    </label>
                  )}
                </>
              )}
              {mfaRequired && (
                <label>
                  Authenticator or recovery code
                  <input
                    name="code"
                    autoComplete="one-time-code"
                    required
                    maxLength={30}
                    placeholder="Your six-digit code"
                    autoFocus
                  />
                  <small>
                    Enter the code from your authenticator, or a recovery code.
                  </small>
                </label>
              )}
              {verify && !token && (
                <div className="dev-mail-notice">
                  <Mail size={24} />
                  <p>
                    Use the link in your verification email. If you just
                    registered in local development, return to the signup
                    confirmation to open your development email.
                  </p>
                </div>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {(!verify || token) && (
                <Button type="submit" loading={busy}>
                  {signup
                    ? "Create your account"
                    : forgot
                      ? "Send recovery link"
                      : reset
                        ? "Update password"
                        : verify
                          ? "Verify my email"
                          : "Log in"}
                  <ArrowRight size={17} />
                </Button>
              )}
              {signup && (
                <small className="auth-terms">
                  By joining, you agree to our <Link href="/terms">Terms</Link>{" "}
                  and <Link href="/privacy">Privacy Notice</Link>.
                </small>
              )}
            </form>
          )}
          {!success && (
            <>
              <div className="auth-divider">
                <span>or take a look around</span>
              </div>
              <ButtonLink href="/demo" variant="secondary">
                Explore the live demo <ArrowUpRight size={16} />
              </ButtonLink>
              <p className="auth-switch">
                {signup ? "Already have a place here?" : "New around here?"}{" "}
                <Link href={signup ? "/login" : "/signup"}>
                  {signup ? "Log in" : "Create an account"}
                </Link>
              </p>
            </>
          )}
          <div className="auth-trust">
            <ShieldCheck size={14} /> Your identity stays yours. Your
            connections grow.
          </div>
        </div>
        <div className="auth-bottom">
          <span>© {new Date().getFullYear()} YouConect</span>
          <Link href="/help">Need a hand?</Link>
        </div>
      </main>
    </div>
  );
}
export function DemoPage() {
  const client = useQueryClient();
  const { data, error } = useResource<{ enabled: boolean }>("demo-status");
  const [busy, setBusy] = useState("");
  const router = useRouter(),
    toast = useToast();
  const people = [
    {
      key: "ayla",
      name: "Ayla Khan",
      headline: "Design student & curious human",
      color: "rose",
      role: "Organization owner",
      description:
        "Explore a connected personal feed and administer Northstar University.",
    },
    {
      key: "zara",
      name: "Zara Ahmed",
      headline: "Community builder",
      color: "amber",
      role: "Community owner",
      description: "Manage MakerSpace, approve Bridges, and chat with Ayla.",
    },
    {
      key: "omar",
      name: "Omar Farooq",
      headline: "Founder · Lumina Labs",
      color: "teal",
      role: "Startup owner",
      description:
        "Explore a different organization and test cross-tenant privacy.",
    },
    {
      key: "daniel",
      name: "Daniel Lee",
      headline: "Creative technologist",
      color: "blue",
      role: "Member",
      description: "Experience the platform with ordinary member permissions.",
    },
  ];
  return (
    <main className="demo-page">
      <Logo />
      <div className="demo-heading">
        <Badge color="teal">
          <Sparkles size={13} /> A WORKING DEVELOPMENT DEMO
        </Badge>
        <h1>Make yourself at home.</h1>
        <p>
          Real workflows. Fictional people.
          <br />
          Choose a perspective and explore YouConect.
        </p>
      </div>
      {error ? (
        <ErrorState error={error} />
      ) : data?.enabled === false ? (
        <div className="card">
          <h2>The demo is disabled.</h2>
          <p>Create your own account to get started.</p>
          <ButtonLink href="/signup">Create an account</ButtonLink>
        </div>
      ) : (
        <div className="demo-people">
          {people.map((p) => (
            <button
              className="demo-person card"
              key={p.key}
              disabled={!!busy}
              onClick={async () => {
                setBusy(p.key);
                try {
                  await api("auth/demo", { person: p.key });
                  client.clear();
                  router.push("/app");
                } catch (e) {
                  toast((e as Error).message, "error");
                  setBusy("");
                }
              }}
            >
              <Avatar name={p.name} color={p.color} size="lg" />
              <Badge color={p.color}>{p.role}</Badge>
              <h2>{p.name}</h2>
              <span>{p.headline}</span>
              <p>{p.description}</p>
              <span className="text-link">
                {busy === p.key
                  ? "Opening your space…"
                  : `Explore as ${p.name.split(" ")[0]}`}{" "}
                <ArrowRight size={16} />
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="demo-disclaimer">
        <ShieldCheck size={19} />
        <p>
          Everything here is fictional demonstration data, including verified
          badges. Changes are saved to this development environment. Please
          don’t add sensitive information. To test messaging, open a second
          browser profile and choose a different person.
        </p>
      </div>
      <Link className="text-link" href="/">
        Back to YouConect <ArrowRight size={15} />
      </Link>
    </main>
  );
}
export function OnboardingPage() {
  const [step, setStep] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [headline, setHeadline] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mfaRequired, setMfaRequired] = useState(false);
  const router = useRouter();
  const { data } = useResource<{
    user: { name: string; email_verified: boolean };
  }>("me");
  return (
    <main className="onboarding-page">
      <Logo />
      <div className="onboarding-progress">
        <i className="active" />
        <i className={step > 0 ? "active" : ""} />
      </div>
      <span className="eyebrow">A LITTLE MORE YOU</span>
      <h1>
        {step === 0
          ? `Nice to meet you${data ? `, ${data.user.name.split(" ")[0]}` : ""}.`
          : "What brings you to life?"}
      </h1>
      <p>
        {step === 0
          ? "A few words help the right people find you."
          : "Pick a few interests. You can always change these later."}
      </p>
      {step === 0 ? (
        <div className="onboarding-form">
          <label>
            Your headline
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={160}
              placeholder="Student, maker, lifelong learner…"
            />
          </label>
          <Button onClick={() => setStep(1)}>
            That’s me <ArrowRight size={16} />
          </Button>
        </div>
      ) : (
        <div className="onboarding-interests">
          <div>
            {[
              "Design",
              "Technology",
              "Entrepreneurship",
              "Education",
              "Research",
              "Community",
              "Arts & Culture",
              "Sustainability",
              "Science",
              "Mentorship",
              "Volunteering",
              "Career growth",
            ].map((interest) => (
              <button
                key={interest}
                className={selected.includes(interest) ? "selected" : ""}
                onClick={() =>
                  setSelected((s) =>
                    s.includes(interest)
                      ? s.filter((x) => x !== interest)
                      : [...s, interest],
                  )
                }
              >
                {selected.includes(interest) && <Check size={15} />} {interest}
              </button>
            ))}
          </div>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("auth/onboarding", { headline, interests: selected });
                router.push("/app");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Find my place <ArrowRight size={16} />
          </Button>
          <button className="text-link" onClick={() => setStep(0)}>
            Back
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <span className="onboarding-footnote">
        One identity. Every community. Always you.
      </span>
    </main>
  );
}
