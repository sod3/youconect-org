"use client";
import { useState } from "react";
import { ShieldCheck, KeyRound, Check, Copy, ArrowRight } from "lucide-react";
import { api, useResource, downloadJson } from "@/lib/client";
import { useApp } from "./app-context";
import { Badge, Button, Modal, useToast } from "./ui";
export function MfaSettings() {
  const { data, refetch } = useResource<{
    enabled: boolean;
    productionEnforced: boolean;
  }>("security/mfa");
  const { refresh } = useApp(),
    toast = useToast();
  const [setup, setSetup] = useState(false),
    [disable, setDisable] = useState(false),
    [secret, setSecret] = useState(""),
    [codes, setCodes] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <div className="preference-row">
        <div>
          <strong>Authenticator protection</strong>
          <p>
            {data?.enabled
              ? "Your account uses a six-digit authenticator code or a single-use recovery code."
              : "Add a second step when signing in. Required for organization and platform administrators in production."}
          </p>
        </div>
        {data?.enabled ? (
          <div className="row">
            <Badge color="teal">
              <Check size={11} /> Enabled
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setDisable(true)}>
              Manage
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              setCodes([]);
              try {
                const result = await api<{ secret: string }>(
                  "security/mfa/enroll",
                  {},
                );
                setSecret(result.secret);
                setSetup(true);
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <KeyRound size={14} /> Set up
          </Button>
        )}
      </div>
      <Modal
        open={setup}
        onOpenChange={setSetup}
        title={
          codes.length
            ? "Keep your recovery codes somewhere safe."
            : "Add YouConect to your authenticator"
        }
        description={
          codes.length
            ? "These codes are shown once. Each one can be used for a single sign-in."
            : "In your authenticator app, add a time-based account using the setup key below."
        }
      >
        {codes.length ? (
          <div className="stack-form">
            <div className="info-notice">
              <ShieldCheck size={18} />
              <p>
                Other sessions have been signed out. Your current session is
                verified. Store these codes privately; they bypass your
                authenticator once each.
              </p>
            </div>
            <div className="recovery-codes">
              {codes.map((c) => (
                <code key={c}>{c}</code>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                downloadJson("youconect-recovery-codes.json", {
                  service: "YouConect",
                  recoveryCodes: codes,
                })
              }
            >
              Download recovery codes
            </Button>
            <Button
              onClick={() => {
                setCodes([]);
                setSetup(false);
              }}
            >
              I’ve saved my codes <Check size={15} />
            </Button>
          </div>
        ) : (
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const result = await api<{ backupCodes: string[] }>(
                  "security/mfa/confirm",
                  { code: new FormData(e.currentTarget).get("code") },
                );
                setSecret("");
                setCodes(result.backupCodes);
                await refetch();
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Setup key<code className="authenticator-key">{secret}</code>
            </label>
            <small className="muted">
              Choose time-based (TOTP), SHA-1, 6 digits, with a 30-second
              interval. Never share this key.
            </small>
            <label>
              Six-digit authenticator code
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
                maxLength={6}
                placeholder="000000"
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={busy}>
              Verify & enable authenticator <ShieldCheck size={16} />
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={disable}
        onOpenChange={setDisable}
        title="Remove authenticator protection?"
        description="Your password and a valid authenticator or recovery code are required. All sessions will be signed out."
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const fields = Object.fromEntries(new FormData(e.currentTarget));
            try {
              await api("security/mfa/disable", fields);
              window.location.assign("/login");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Current password
            <input
              name="password"
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
            />
          </label>
          <label>
            Authenticator or recovery code
            <input
              name="code"
              required
              maxLength={30}
              autoComplete="one-time-code"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="danger" loading={busy}>
            Remove authenticator & sign out
          </Button>
        </form>
      </Modal>
    </>
  );
}
