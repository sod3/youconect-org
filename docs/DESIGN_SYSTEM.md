# Design system

## Foundations

YouConect uses Midnight Navy `#0C1733`, Connection Blue `#2457E7`, and Campus Teal `#0F766E`. Blue means an action or selection. Teal identifies verified/positive states. Neutral surfaces use `#F6F8FC`, white, and `#E5EAF2` borders.

The dark theme has dedicated surface, text, border, blue, and teal tokens rather than applying a color inversion. System-theme detection runs before hydration, and the user’s preference persists. Inter is bundled locally; font loading does not depend on a third-party stylesheet.

Most spaces follow a 4/8px rhythm. Cards use 12px corners, buttons 8px, and stronger containers 13–16px. Shadows are restrained. Main reading text uses 14px with supporting UI generally 11–13px. The miniature marketing preview deliberately uses smaller scale to show the product as an illustration.

## Shared primitives

`components/ui.tsx` documents props through TypeScript and provides Logo/BrandMark, Button/ButtonLink, IconButton, Avatar, Badge, Verified, Modal, Menu, EmptyState, ErrorState, Skeleton, SectionHeading, ToastProvider, and ArrowLink.

- Buttons have primary, secondary, ghost, danger, small, disabled, and loading variants.
- Icon-only controls require a label.
- Radix dialogs handle focus trapping, Escape, accessible titles, and focus restoration. Dropdowns use Radix keyboard behavior.
- Forms use explicit labels, native constraints, server validation, pending state, and useful error messages.
- Toasts are announced through a polite live region.
- Skeletons identify pending content without fabricating records.
- A skip link, focus outlines, reduced-motion rules, and semantic navigation are included.

`app-shell.tsx` provides organization switching, desktop navigation, contextual panels, a navigation drawer, mobile bottom navigation, a permission-aware command palette, offline feedback, and session-aware realtime state.

## Breakpoints and behavior

The desktop app uses a fixed organization/navigation rail and a main area with an optional contextual panel. The panel disappears when it no longer fits. The sidebar becomes a drawer below 820px; mobile bottom navigation uses safe-area padding. The mobile inbox shows either the conversation list or a selected conversation.

The composer preserves drafts, reports actual upload progress, and keeps failures retryable. The chat separates pending, sent, failed, and read states. Transitions are short, and reduced-motion preferences are respected.

Accessibility has not undergone an independent WCAG audit. The keyboard and responsive checks in this project are a foundation; a complete screen-reader, touch-target, contrast, and assistive-technology review remains part of production validation.
