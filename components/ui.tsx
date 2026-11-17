"use client";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  ArrowRight,
  X,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { initials } from "@/lib/client";
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="11" fill="#2457E7" />
      <path
        d="M10 12.5v5a5 5 0 0 0 10 0v-7M26 23.5v-5a5 5 0 0 0-10 0v7"
        stroke="white"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <path
        d="M17.8 15.6v4.8"
        stroke="white"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Logo({
  light = false,
  small = false,
}: {
  light?: boolean;
  small?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="YouConect home"
    >
      <BrandMark size={small ? 30 : 35} />
      <span>
        YouConect<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function Button({
  variant = "primary",
  size,
  loading = false,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`button button-${variant} ${size === "sm" ? "button-sm" : ""} ${className}`}
    >
      {loading ? <Loader2 size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`button button-${variant} ${className}`}>
      {children}
    </Link>
  );
}
export function IconButton({
  icon: Icon,
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      {...props}
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon size={19} />
    </button>
  );
}
export function Avatar({
  name,
  color = "blue",
  size = "md",
  src,
}: {
  name: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  src?: string;
}) {
  return (
    <span className={`avatar avatar-${size} tone-${color}`} aria-label={name}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
export function Badge({
  children,
  color = "blue",
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return <span className={`badge tone-${color} ${className}`}>{children}</span>;
}
export function Verified({ demo = false }: { demo?: boolean }) {
  return (
    <span
      className="verified"
      title={
        demo
          ? "Verified fictional demonstration organization"
          : "Verified organization"
      }
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-label="Verified"
      >
        <path d="m10 0 2.5 2 3.2.1 1.1 3L19.5 7l-.7 3 1 3-2.5 1.9-1.1 3-3.2.1-2.5 2-2.5-2-3.2-.1-1.1-3L.5 13l.7-3-1-3 2.5-1.9 1.1-3L7 2z" />
        <path
          d="m6 10 2.5 2.5L14 7"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content ${wide ? "dialog-wide" : ""}`}
        >
          <div className="dialog-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description
                className={description ? "dialog-description" : "sr-only"}
              >
                {description || title}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close dialog" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Menu({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    danger?: boolean;
  }[];
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="dropdown-menu" align="end" sideOffset={7}>
          {items.map(({ label, icon: Icon, onClick, danger }) => (
            <Dropdown.Item
              key={label}
              className={`dropdown-item ${danger ? "danger-text" : ""}`}
              onSelect={onClick}
            >
              {Icon && <Icon size={16} />}
              <span>{label}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <p>{error?.message || "We couldn’t load this page."}</p>
      {retry && (
        <Button variant="secondary" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
export function PageSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-label="Loading content">
      <Skeleton className="skeleton-title" />
      {[1, 2, 3].map((n) => (
        <div className="card skeleton-card" key={n}>
          <div className="row">
            <Skeleton className="skeleton-avatar" />
            <Skeleton className="skeleton-line" />
          </div>
          <Skeleton className="skeleton-line" />
          <Skeleton className="skeleton-block" />
        </div>
      ))}
    </div>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
type ToastFn = (message: string, kind?: "success" | "error") => void;
const ToastContext = createContext<ToastFn>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<
    { id: number; text: string; kind: string }[]
  >([]);
  const show: ToastFn = (text, kind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div className={`toast toast-${t.kind}`} key={t.id}>
            {t.kind === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <Check size={18} />
            )}
            <span>{t.text}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export function ArrowLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="text-link">
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}
