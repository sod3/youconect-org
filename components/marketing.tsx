"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  GraduationCap,
  MessageCircle,
  Users,
  CalendarDays,
  Globe2,
  ShieldCheck,
  Network,
  Sparkles,
  Building2,
  BriefcaseBusiness,
  Heart,
  Layers3,
  Search,
  Bell,
  Home,
  Compass,
  Bookmark,
  Plus,
  CheckCheck,
  Play,
  Zap,
} from "lucide-react";
import { useState } from "react";
import {
  Logo,
  BrandMark,
  ButtonLink,
  Avatar,
  Verified,
  Badge,
  Button,
  useToast,
} from "./ui";
import { api } from "@/lib/client";
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="marketing-header">
      <div className="marketing-nav">
        <Logo />
        <nav
          className={open ? "marketing-links open" : "marketing-links"}
          aria-label="Main navigation"
        >
          <Link href="/features">
            Product <ChevronDown size={13} />
          </Link>
          <Link href="/solutions">
            Solutions <ChevronDown size={13} />
          </Link>
          <Link href="/organizations">Organizations</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">Our story</Link>
        </nav>
        <div className="marketing-actions">
          <Link className="login-link" href="/login">
            Log in
          </Link>
          <ButtonLink href="/signup">
            Get started <ArrowUpRight size={16} />
          </ButtonLink>
          <button
            className="mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setOpen(!open)}
          >
            <Layers3 size={23} />
          </button>
        </div>
      </div>
    </header>
  );
}
export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Logo />
          <p>
            One identity. Every community.
            <br />
            Infinite connections.
          </p>
          <span className="footer-locale">
            <Globe2 size={14} /> English · Built for everywhere
          </span>
        </div>
        {[
          {
            title: "Product",
            items: [
              ["Features", "features"],
              ["Communities", "features#communities"],
              ["Messaging", "features#messaging"],
              ["YouConect Bridges", "features#bridges"],
              ["Security", "security"],
            ],
          },
          {
            title: "For organizations",
            items: [
              ["Universities", "solutions/universities"],
              ["Companies", "solutions/companies"],
              ["Nonprofits", "solutions/nonprofits"],
              ["Training institutes", "solutions/training-institutes"],
              ["Pricing", "pricing"],
            ],
          },
          {
            title: "YouConect",
            items: [
              ["Our story", "about"],
              ["Journal", "blog"],
              ["Help center", "help"],
              ["Contact us", "contact"],
              ["Try the demo", "demo"],
            ],
          },
        ].map((g) => (
          <div className="footer-links" key={g.title}>
            <h4>{g.title}</h4>
            {g.items.map(([label, path]) => (
              <Link href={`/${path}`} key={label}>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} YouConect. Connect beyond boundaries.
        </span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <span className="status-dot" /> A little more connected.
        </div>
      </div>
    </footer>
  );
}
function MiniPost() {
  return (
    <div className="mini-post">
      <div className="row">
        <Avatar name="Zara Ahmed" color="amber" size="sm" />
        <div>
          <strong>
            Zara Ahmed <Verified demo />
          </strong>
          <small>Northstar University · 2h</small>
        </div>
        <span className="mini-more">•••</span>
      </div>
      <p>
        A new chapter. A thousand possibilities. ✨<br />
        <span>Welcome week is officially here. Find your people.</span>
      </p>
      <div className="mini-campus">
        <img
          src="/campus-community.webp"
          alt="Illustrative campus graduation gathering"
          loading="lazy"
        />
        <span>THE START OF SOMETHING GOOD.</span>
      </div>
      <div className="mini-post-actions">
        <span>
          <Heart size={14} /> 3
        </span>
        <span>
          <MessageCircle size={14} /> 2 comments
        </span>
        <Bookmark size={14} />
      </div>
    </div>
  );
}
export function ProductPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`product-preview ${compact ? "preview-compact" : ""}`}>
      <div className="preview-window-bar">
        <div className="window-dots">
          <i />
          <i />
          <i />
        </div>
        <span>
          <ShieldCheck size={11} /> youconect.app
        </span>
        <span className="preview-label">Fictional product preview</span>
      </div>
      <div className="preview-shell">
        <aside className="preview-sidebar">
          <Logo small />
          <div className="mini-switcher">
            <span className="org-symbol tone-blue">NU</span>
            <div>
              <strong>Northstar University</strong>
              <small>Your organization</small>
            </div>
            <ChevronDown size={12} />
          </div>
          <div className="mini-nav">
            {[
              [Home, "Home"],
              [Compass, "Explore"],
              [Building2, "My organizations"],
              [Users, "Communities"],
              [MessageCircle, "Messages"],
              [CalendarDays, "Events"],
              [BriefcaseBusiness, "Opportunities"],
            ].map(([Icon, label], i) => {
              const I = Icon as typeof Home;
              return (
                <Link
                  href="/demo"
                  key={String(label)}
                  className={i === 0 ? "active" : ""}
                >
                  <I size={15} />
                  {String(label)}
                  {i === 4 && <b>2</b>}
                </Link>
              );
            })}
          </div>
          <Link href="/demo" className="mini-create">
            <Plus size={15} /> Create a post
          </Link>
          <div className="mini-user">
            <Avatar name="Ayla Khan" color="rose" size="sm" />
            <div>
              <strong>Ayla Khan</strong>
              <small>Your personal space</small>
            </div>
          </div>
        </aside>
        <div className="preview-main">
          <div className="mini-topbar">
            <span>Your world, connected.</span>
            <Search size={14} />
            <Bell size={14} />
            <Avatar name="Ayla Khan" color="rose" size="xs" />
          </div>
          <div className="mini-greeting">
            <span>YOUR EVERYDAY, A LITTLE BETTER</span>
            <h3>
              Good morning, Ayla <span>☀️</span>
            </h3>
            <p>
              A little inspiration. A few familiar faces. Endless possibilities.
            </p>
          </div>
          <div className="mini-tabs">
            <b>For you</b>
            <span>Following</span>
            <span>My organizations</span>
            <span>Communities</span>
          </div>
          <Link href="/demo" className="mini-composer">
            <Avatar name="Ayla Khan" color="rose" size="sm" />
            <span>What’s on your mind, Ayla?</span>
            <Plus size={16} />
          </Link>
          <MiniPost />
        </div>
        <aside className="preview-right">
          <div className="preview-right-title">
            YOUR ORGANIZATIONS
            <Plus size={12} />
          </div>
          {[
            ["NU", "Northstar University", "blue"],
            ["m.", "MakerSpace Collective", "teal"],
            ["L", "Lumina Labs", "violet"],
          ].map(([symbol, name, color]) => (
            <div className="mini-org-row" key={name}>
              <span className={`org-symbol tone-${color}`}>{symbol}</span>
              <div>
                <strong>{name}</strong>
                <small>
                  <span className="status-dot" /> You’re connected
                </small>
              </div>
            </div>
          ))}
          <div className="mini-event-card">
            <span className="mini-event-art">
              <Sparkles size={28} />
              <i />
              <i />
            </span>
            <Badge color="violet">Coming together</Badge>
            <strong>Designing what’s next</strong>
            <span>A workshop for curious minds.</span>
            <Link href="/demo">
              Explore events <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="mini-right-heading">
            People you might connect with
          </div>
          <div className="row">
            <Avatar name="Daniel Lee" size="sm" />
            <div>
              <strong>Daniel Lee</strong>
              <small>Creative technologist</small>
            </div>
            <Plus size={14} />
          </div>
        </aside>
      </div>
    </div>
  );
}
const features = [
  {
    icon: Users,
    title: "Find your people.",
    description:
      "A community for every side of you. Share ideas, discover perspectives, and make meaningful connections.",
    color: "blue",
    id: "communities",
  },
  {
    icon: MessageCircle,
    title: "Keep the conversation going.",
    description:
      "One calm inbox for your people, groups, and organization channels. Pick up right where you left off.",
    color: "teal",
    id: "messaging",
  },
  {
    icon: Building2,
    title: "Give your organization a home.",
    description:
      "Announcements, communities, events, and opportunities. A shared space with the right boundaries.",
    color: "violet",
    id: "organizations",
  },
  {
    icon: Network,
    title: "Build bridges. Go further.",
    description:
      "Bring organizations together in approved shared spaces. Collaborate without opening up private content.",
    color: "amber",
    id: "bridges",
  },
  {
    icon: CalendarDays,
    title: "Be part of what’s next.",
    description:
      "From a campus workshop to your next opportunity, turn a connection into something that matters.",
    color: "rose",
    id: "events",
  },
  {
    icon: ShieldCheck,
    title: "Stay connected. Stay in control.",
    description:
      "Choose what you share and who you share it with. Your memberships and private conversations stay yours.",
    color: "teal",
    id: "privacy",
  },
];
export function HomeMarketing() {
  return (
    <>
      <MarketingNav />
      <main>
        <section className="hero">
          <div className="hero-grid" />
          <div className="hero-content">
            <div className="hero-pill">
              <span /> A world of connections. One place to belong.{" "}
              <ArrowRight size={13} />
            </div>
            <h1>
              One Place.
              <br />
              <span>Every Connection.</span>
              <svg className="hero-spark" viewBox="0 0 38 40" fill="none">
                <path
                  d="m17 2 3 13 14-4-12 10 9 10-14-5-5 12 1-15L2 20l12-4z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </h1>
            <p>
              Bring your people, organizations, communities, and conversations
              together. One identity. A world of possibilities.
            </p>
            <div className="hero-buttons">
              <ButtonLink href="/signup">
                Get Started Free <ArrowUpRight size={18} />
              </ButtonLink>
              <ButtonLink href="/demo" variant="secondary">
                <span className="play-circle">
                  <Play size={11} fill="currentColor" />
                </span>{" "}
                Explore YouConect
              </ButtonLink>
            </div>
            <div className="hero-fine">
              <Check size={14} /> Free for individuals. Made for meaningful
              connections.
            </div>
            <div className="hero-org-invite">
              <Building2 size={15} />
              <span>Better together, as an organization.</span>
              <Link href="/organizations">
                Bring yours <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div className="hero-side-note">
            <span className="handdrawn-arrow">↙</span>
            <span>
              Your world.
              <br />
              Beautifully connected.
            </span>
          </div>
          <div className="hero-preview-wrap">
            <div className="floating-note note-left">
              <span className="note-icon tone-teal">
                <Network size={16} />
              </span>
              <div>
                <strong>One you. Many communities.</strong>
                <small>Switch spaces. Keep your identity.</small>
              </div>
            </div>
            <div className="floating-note note-right">
              <span className="tiny-online" />
              <span>Good things happen together.</span>
            </div>
            <ProductPreview />
          </div>
          <div className="hero-caption">
            <span className="status-dot" /> Your personal world and your
            organizational world, finally connected.
          </div>
        </section>
        <section className="belong-section">
          <p className="eyebrow">FOR EVERY SIDE OF YOU</p>
          <h2>
            You’re more than one thing.
            <br />
            Your network should be, too.
          </h2>
          <p>
            You’re a student, a creator, a teammate, a dreamer. YouConect brings
            all your communities into one connected experience.
          </p>
          <div className="audience-strip">
            {[
              [GraduationCap, "Students & educators"],
              [Building2, "Organizations"],
              [BriefcaseBusiness, "Professionals"],
              [Heart, "Communities"],
              [Sparkles, "Curious people"],
            ].map(([Icon, name]) => {
              const I = Icon as typeof Users;
              return (
                <span key={String(name)}>
                  <I size={20} />
                  {String(name)}
                </span>
              );
            })}
          </div>
        </section>
        <section className="connected-section">
          <div className="connected-copy">
            <span className="eyebrow">LESS SWITCHING. MORE BELONGING.</span>
            <h2>
              All your worlds.
              <br />
              One simple connection.
            </h2>
            <p>
              Your university has a group chat. Your team has a workspace. Your
              community has somewhere else entirely.
            </p>
            <p>
              Bring it all a little closer. Move between your organizations,
              keep one identity, and find every conversation in one inbox.
            </p>
            <ButtonLink href="/features" variant="secondary">
              Meet your connected world <ArrowUpRight size={16} />
            </ButtonLink>
          </div>
          <div className="identity-visual">
            <div className="identity-orbit orbit-one" />
            <div className="identity-orbit orbit-two" />
            <div className="identity-center">
              <Avatar name="Ayla Khan" color="rose" size="xl" />
              <strong>Ayla Khan</strong>
              <small>One identity. Always you.</small>
            </div>
            <div className="identity-node node-uni">
              <span className="org-symbol tone-blue">
                <GraduationCap size={24} />
              </span>
              <strong>Your university</strong>
              <small>A place to grow</small>
            </div>
            <div className="identity-node node-team">
              <span className="org-symbol tone-violet">
                <BriefcaseBusiness size={22} />
              </span>
              <strong>Your team</strong>
              <small>Ideas into impact</small>
            </div>
            <div className="identity-node node-community">
              <span className="org-symbol tone-teal">
                <Users size={23} />
              </span>
              <strong>Your communities</strong>
              <small>Your kind of people</small>
            </div>
            <div className="identity-tag">
              <Check size={13} /> Connected, on your terms
            </div>
          </div>
        </section>
        <section className="features-section">
          <div className="center-section-heading">
            <span className="eyebrow">MADE FOR YOUR EVERYDAY</span>
            <h2>
              More connection.
              <br />
              Less complication.
            </h2>
            <p>Thoughtful tools for the things you do together.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, ...f }) => (
              <Link
                href={`/features#${f.id}`}
                className="feature-card"
                key={f.title}
              >
                <span className={`feature-icon tone-${f.color}`}>
                  <Icon size={23} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
        </section>
        <section className="bridge-section">
          <div className="bridge-art">
            <div className="bridge-org">
              <span className="org-symbol tone-blue">NU</span>
              <span>Northstar University</span>
              <Badge color="teal">Demo organization</Badge>
            </div>
            <div className="bridge-connection">
              <i />
              <span>
                <Network size={29} />
              </span>
              <i />
            </div>
            <div className="bridge-org">
              <span className="org-symbol tone-teal">m.</span>
              <span>MakerSpace Collective</span>
              <Badge color="teal">Demo organization</Badge>
            </div>
            <div className="bridge-art-caption">
              <ShieldCheck size={14} /> Approved by both. Shared with the right
              people.
            </div>
          </div>
          <div>
            <span className="eyebrow">INTRODUCING YOUCONECT BRIDGES</span>
            <h2>
              Great things happen
              <br />
              between communities.
            </h2>
            <p>
              A university meets a startup. A nonprofit meets a new generation
              of volunteers. Bridges create shared spaces for organizations to
              make something happen — together.
            </p>
            <ButtonLink href="/features#bridges" variant="secondary">
              A new way to collaborate <ArrowUpRight size={16} />
            </ButtonLink>
          </div>
        </section>
        <section className="organization-section">
          <div className="center-section-heading">
            <span className="eyebrow">
              BUILT AROUND PEOPLE. READY FOR ORGANIZATIONS.
            </span>
            <h2>A stronger sense of together.</h2>
            <p>Give your organization a digital home that feels human.</p>
          </div>
          <div className="solution-grid">
            {[
              {
                icon: GraduationCap,
                name: "Education",
                copy: "Bring your campus to life.",
                path: "universities",
                tone: "blue",
              },
              {
                icon: BriefcaseBusiness,
                name: "Companies",
                copy: "Connect the people behind the work.",
                path: "companies",
                tone: "violet",
              },
              {
                icon: Heart,
                name: "Nonprofits",
                copy: "Turn shared purpose into action.",
                path: "nonprofits",
                tone: "teal",
              },
            ].map((s) => (
              <Link
                key={s.path}
                href={`/solutions/${s.path}`}
                className={`solution-card tone-${s.tone}`}
              >
                <s.icon size={29} />
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.copy}</p>
                </div>
                <ArrowUpRight size={21} />
              </Link>
            ))}
          </div>
          <Link className="text-link" href="/solutions">
            Find your organization’s place <ArrowRight size={15} />
          </Link>
        </section>
        <PricingSection />
        <FaqSection />
        <section className="final-cta">
          <div className="cta-line-grid" />
          <BrandMark size={44} />
          <h2>
            Your next connection
            <br />
            starts here.
          </h2>
          <p>A new idea. A familiar face. A community that feels like you.</p>
          <ButtonLink href="/signup">
            Find your place <ArrowUpRight size={17} />
          </ButtonLink>
          <span>One identity. Every community. Infinite connections.</span>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
export function PricingSection() {
  return (
    <section className="pricing-section" id="plans">
      <div className="center-section-heading">
        <span className="eyebrow">ROOM TO GROW</span>
        <h2>Free for you. Flexible for your organization.</h2>
        <p>
          Proposed launch pricing in PKR. Organization plans are billed
          annually.
        </p>
      </div>
      <div className="pricing-grid">
        {[
          {
            name: "Individual",
            price: "Free",
            caption: "Your world, connected.",
            items: [
              "One universal identity",
              "Communities & social connections",
              "Direct and group conversations",
              "Events & opportunities",
            ],
            href: "/signup",
            cta: "Create your account",
          },
          {
            name: "Campus Starter",
            price: "8,000",
            caption: "For a closer-knit organization.",
            items: [
              "Up to 500 verified members",
              "Private organizational workspace",
              "Channels, notices & events",
              "3 administrative seats",
            ],
            href: "/organizations",
            cta: "Bring your organization",
          },
          {
            name: "Campus Growth",
            price: "22,000",
            caption: "More possibilities, together.",
            items: [
              "Up to 2,500 verified members",
              "Cross-organization Bridges",
              "10 administrative seats",
              "Expanded storage & administration",
            ],
            href: "/organizations",
            cta: "Let’s grow together",
            featured: true,
          },
        ].map((p) => (
          <div
            className={`pricing-card ${p.featured ? "featured" : ""}`}
            key={p.name}
          >
            {p.featured && (
              <span className="pricing-popular">
                MADE FOR GROWING COMMUNITIES
              </span>
            )}
            <h3>{p.name}</h3>
            <p>{p.caption}</p>
            <div className="price">
              {p.price === "Free" ? (
                p.price
              ) : (
                <>
                  <small>PKR</small>
                  {p.price}
                  <span>/mo</span>
                </>
              )}
            </div>
            {p.price !== "Free" && (
              <small className="annual-price">
                PKR {(Number(p.price.replace(",", "")) * 12).toLocaleString()}{" "}
                billed annually
              </small>
            )}
            <ButtonLink
              href={p.href}
              variant={p.featured ? "primary" : "secondary"}
            >
              {p.cta}
              <ArrowUpRight size={15} />
            </ButtonLink>
            <ul>
              {p.items.map((i) => (
                <li key={i}>
                  <Check size={15} />
                  {i}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="pricing-footnote">
        Need more room?{" "}
        <Link href="/pricing">
          Explore Campus Pro and Enterprise <ArrowRight size={14} />
        </Link>
      </p>
    </section>
  );
}
export function FaqSection() {
  return (
    <section className="faq-section">
      <div>
        <span className="eyebrow">A FEW GOOD QUESTIONS</span>
        <h2>Glad you asked.</h2>
        <p>Have something else on your mind?</p>
        <Link className="text-link" href="/contact">
          Let’s talk <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="faq-list">
        {[
          [
            "What makes YouConect different?",
            "YouConect organizes your digital world around you and the communities you belong to. One account connects your social life, organizations, and conversations, with separate permissions for each space.",
          ],
          [
            "Is YouConect free for individuals?",
            "Yes. Core social, messaging, community, and discovery features are free for individuals. Organizations can choose a paid plan for a private workspace and administrative tools.",
          ],
          [
            "Can I belong to more than one organization?",
            "Absolutely. Your identity stays the same as you move between your university, company, volunteer group, and other communities.",
          ],
          [
            "Who can see my organization’s private content?",
            "Only approved members with the appropriate permissions. Bridges need explicit approval from both organizations and do not expose either organization’s private workspace.",
          ],
          [
            "Can I try it before creating an organization?",
            "Yes. Open the clearly labeled demo to explore fictional organizations, publish a post, send messages between demo accounts, and try the core workflows.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <Plus size={17} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
const publicCopy: Record<
  string,
  { eyebrow: string; title: string; description: string }
> = {
  features: {
    eyebrow: "THE CONNECTED EXPERIENCE",
    title: "Everything you do together. A little closer.",
    description:
      "From a passing thought to your next big collaboration, make room for meaningful connection.",
  },
  solutions: {
    eyebrow: "A PLACE FOR EVERY ORGANIZATION",
    title: "Your people make the difference.",
    description: "Give them a better way to connect, collaborate, and belong.",
  },
  organizations: {
    eyebrow: "BRING YOUR ORGANIZATION",
    title: "Create a home for your community.",
    description:
      "A verified identity, private spaces, and thoughtful tools for bringing your people together.",
  },
  about: {
    eyebrow: "OUR STORY",
    title: "Connection should feel more human.",
    description:
      "We believe the best networks start with a sense of belonging. YouConect is being built to bring your communities closer, without fragmenting who you are.",
  },
  security: {
    eyebrow: "BUILT ON CLEAR BOUNDARIES",
    title: "Your connections. Your control.",
    description:
      "One identity doesn’t mean one audience. Every organization, conversation, and shared space has its own permissions.",
  },
  blog: {
    eyebrow: "THE YOUCONECT JOURNAL",
    title: "Ideas for a more connected world.",
    description:
      "Product notes and practical perspectives on building communities that matter.",
  },
  help: {
    eyebrow: "WE’RE HERE TO HELP",
    title: "Make yourself at home.",
    description: "A few simple guides to finding your way around YouConect.",
  },
  privacy: {
    eyebrow: "PRIVACY NOTICE · DEVELOPMENT EDITION",
    title: "A little clarity about your data.",
    description:
      "This application stores the information you provide to make your account, communities, and conversations work. This notice describes the current implementation; a jurisdiction-specific policy is required before institutional launch.",
  },
  terms: {
    eyebrow: "TERMS · DEVELOPMENT EDITION",
    title: "A thoughtful place to connect.",
    description:
      "These development terms explain how to use the current application responsibly. A reviewed service agreement is required before commercial institutional deployment.",
  },
};
export function PublicPage({ slug }: { slug: string }) {
  const root = slug.split("/")[0],
    solution = slug.split("/")[1];
  if (root === "pricing")
    return (
      <>
        <MarketingNav />
        <PricingSection />
        <section className="pro-plans">
          <h2>More room for your organization.</h2>
          <div className="card">
            <h3>Campus Pro · PKR 55,000/month equivalent</h3>
            <p>
              PKR 660,000 billed annually. Up to 10,000 verified members, 25
              admin seats, expanded storage and Bridges.
            </p>
            <ButtonLink href="/contact" variant="secondary">
              Discuss Campus Pro <ArrowUpRight size={16} />
            </ButtonLink>
          </div>
          <div className="card">
            <h3>Enterprise · Let’s talk</h3>
            <p>
              Contract-specific scale, onboarding, integrations, and service
              requirements.
            </p>
            <ButtonLink href="/contact" variant="secondary">
              Contact the team <ArrowUpRight size={16} />
            </ButtonLink>
          </div>
          <p className="muted">
            A free verified public listing is also available. These are proposed
            launch prices, subject to agreement. No payment gateway is currently
            connected.
          </p>
        </section>
        <FaqSection />
        <MarketingFooter />
      </>
    );
  const copy = publicCopy[root];
  if (!copy) return null;
  const titles: Record<string, string> = {
    universities: "A campus that feels connected.",
    companies: "Great work starts with connected people.",
    nonprofits: "Shared purpose. Real connections.",
    "training-institutes": "Keep learning. Keep connecting.",
  };
  return (
    <>
      <MarketingNav />
      <main className="public-page">
        <section className="public-hero">
          <span className="eyebrow">
            {solution
              ? `YOUCONECT FOR ${solution.replace("-", " ").toUpperCase()}`
              : copy.eyebrow}
          </span>
          <h1>{solution ? titles[solution] || copy.title : copy.title}</h1>
          <p>{copy.description}</p>
          {!["privacy", "terms"].includes(root) && (
            <div className="hero-buttons">
              <ButtonLink href="/signup">
                Get started free <ArrowUpRight size={16} />
              </ButtonLink>
              <ButtonLink href="/demo" variant="secondary">
                Explore the demo <ArrowRight size={16} />
              </ButtonLink>
            </div>
          )}
        </section>
        {root === "features" && (
          <>
            <ProductPreview />
            <div className="feature-grid public-features">
              {features.map(({ icon: Icon, ...f }) => (
                <article className="feature-card" id={f.id} key={f.id}>
                  <span className={`feature-icon tone-${f.color}`}>
                    <Icon size={23} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                  <Link href="/demo" className="text-link">
                    Try it in the demo <ArrowRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
        {["solutions", "organizations"].includes(root) && (
          <>
            <div className="public-benefits">
              {[
                [
                  "A verified home",
                  "Apply for an organization profile. Verification is reviewed by a platform administrator before a verified badge appears.",
                ],
                [
                  "Your people, with the right access",
                  "Review membership requests, assign scoped roles, and manage private channels from your organization workspace.",
                ],
                [
                  "Built to grow together",
                  "Start with a public listing. After verification, activate a 14-day Starter trial or request an annual invoice.",
                ],
              ].map(([title, desc], i) => (
                <article key={title}>
                  <span className="step-number">0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </article>
              ))}
            </div>
            <div className="organization-callout">
              <Building2 size={32} />
              <div>
                <h2>Ready to bring your people together?</h2>
                <p>
                  Create an account, then submit your organization for
                  verification.
                </p>
              </div>
              <ButtonLink href="/app/organizations/new">
                Create an organization <ArrowUpRight size={17} />
              </ButtonLink>
            </div>
          </>
        )}
        {root === "security" && (
          <div className="public-benefits">
            {[
              [
                "Scoped access",
                "Private data access is checked on the server using current memberships, conversation participants, and Bridge approvals.",
              ],
              [
                "Protected sessions",
                "Passwords are hashed with scrypt. Random session tokens are stored as hashes. Cookies use HttpOnly, SameSite and HTTPS-only settings in production.",
              ],
              [
                "Clear sharing boundaries",
                "Your private memberships are hidden from your public profile by default. Bridge access is explicit and revocable.",
              ],
              [
                "Your data, with you",
                "Export your account data from settings. Account deletion is supported after you transfer any organization ownership.",
              ],
              [
                "Honest security",
                "Authenticator MFA is available and required for production administration. Transport security depends on your HTTPS deployment. End-to-end encryption and independent security review are not yet implemented.",
              ],
              [
                "Before institutional launch",
                "Configure backups, encryption at rest, monitoring, SMTP, storage protections, and relevant privacy policies. Run a security review before using real student data.",
              ],
            ].map(([title, desc]) => (
              <article key={title}>
                <ShieldCheck size={24} />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        )}
        {root === "about" && (
          <section className="story-block">
            <h2>
              One identity. Every community.
              <br />
              Infinite connections.
            </h2>
            <p>
              People don’t fit into a single box. The same person can be a
              student, a founder, a volunteer, and a mentor. Their digital life
              should make that easier.
            </p>
            <p>
              We’re building the Universal Organizational Network: a space where
              personal identity stays consistent, communities feel closer, and
              organizations keep control of their own boundaries.
            </p>
            <p>
              This is a development release. The organizations and people in the
              demo are fictional, and there are no claimed institutional
              partnerships.
            </p>
          </section>
        )}
        {root === "blog" && (
          <div className="public-benefits">
            {[
              [
                "The idea behind one identity",
                "Moving between your communities shouldn’t mean starting over. YouConect keeps your identity consistent while preserving each space’s boundaries.",
              ],
              [
                "Why we’re building Bridges",
                "Useful collaboration needs clear approval, scoped participation, and a way to revoke access. That is the foundation of YouConect Bridges.",
              ],
              [
                "A calmer kind of social feed",
                "Chronological feeds, deliberate following, and explicit community choices put you in charge of what you see.",
              ],
            ].map(([title, desc]) => (
              <article key={title}>
                <Badge>Product note</Badge>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        )}
        {root === "help" && (
          <div className="public-benefits">
            {[
              [
                "Getting started",
                "Create an account, verify your email, and pick a few interests during onboarding. In local development, the verification link appears in the development email screen.",
              ],
              [
                "Joining an organization",
                "Find an organization in My Organizations and request membership. An authorized administrator reviews your request before private content becomes visible.",
              ],
              [
                "Finding a community",
                "Open Communities, explore the available spaces, and select Join. Private organization communities require an active organization membership.",
              ],
              [
                "Starting a conversation",
                "Open Messages and select New conversation. Search for a person, choose them, and start a direct or group conversation.",
              ],
              [
                "Publishing a post",
                "Select Create a post. Choose your audience carefully: public, organization, community, or an approved Bridge. Drafts are preserved locally.",
              ],
              [
                "Trying a second account",
                "The demo offers several clearly fictional identities. Use a second browser profile to test actual message delivery between separate sessions.",
              ],
            ].map(([title, desc]) => (
              <article key={title}>
                <CircleHelp size={24} />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        )}
        {["privacy", "terms"].includes(root) && (
          <div className="policy-copy">
            {(root === "privacy"
              ? [
                  [
                    "Information stored",
                    "We store your account profile, email, password hash, session hashes, memberships, posts, messages, uploads, event registrations, and actions needed for administration.",
                  ],
                  [
                    "Visibility and access",
                    "Public posts can be seen by signed-in users. Private content requires the relevant permissions. Your organization memberships are private on your profile by default. Organization administrators can view membership and registration data for their organization.",
                  ],
                  [
                    "Retention and control",
                    "Use account settings to export your data or request deletion. Organization owners must transfer ownership before deleting their account. Database and upload retention policies, backups, and legal obligations must be configured for the actual deployment.",
                  ],
                  [
                    "Service providers",
                    "The default local application uses embedded PostgreSQL and local disk storage. Configured deployments can use external PostgreSQL and SMTP. No external AI service is called, and no private content is sent to a model provider.",
                  ],
                  [
                    "Development data",
                    "Demo identities and organizations are fictional. Demo accounts share a development environment. Do not put sensitive information into demonstration accounts.",
                  ],
                ]
              : [
                  [
                    "Using the service",
                    "Be respectful. Do not harass others, share illegal content, impersonate an institution, or attempt to access data outside your permissions.",
                  ],
                  [
                    "Accounts and organizations",
                    "Keep your credentials secure. Organization owners are responsible for reviewing memberships and permissions. Verified badges reflect an administrator’s recorded review, not a guarantee of endorsement.",
                  ],
                  [
                    "Content and moderation",
                    "Publish only content you have the right to share. Users can report content; authorized administrators can review and remove posts.",
                  ],
                  [
                    "Subscriptions",
                    "Displayed prices are proposed launch pricing. Invoice requests do not charge money or activate a paid subscription. Manual reconciliation requires an authorized administrator to record a payment reference.",
                  ],
                  [
                    "Development release",
                    "This software is under development. Real institutional deployment requires reviewed agreements, appropriate safeguards, and operational configuration.",
                  ],
                ]
            ).map(([title, desc]) => (
              <section key={title}>
                <h2>{title}</h2>
                <p>{desc}</p>
              </section>
            ))}
            <Link className="text-link" href="/contact">
              Contact the team <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </main>
      <MarketingFooter />
    </>
  );
}
export function ContactPage() {
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    toast = useToast();
  return (
    <>
      <MarketingNav />
      <main className="contact-page">
        <div>
          <span className="eyebrow">LET’S MAKE A CONNECTION</span>
          <h1>
            Good things start
            <br />
            with a conversation.
          </h1>
          <p>
            Tell us about your organization, your ideas, or what you’d like to
            build together.
          </p>
          <div className="contact-note">
            <MessageCircle size={24} />
            <div>
              <h3>A real conversation.</h3>
              <p>
                Your message is stored for the platform team to review. We’ll
                use the email you provide to follow up when a team member
                responds.
              </p>
            </div>
          </div>
        </div>
        <form
          className="card contact-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const d = new FormData(e.currentTarget);
            try {
              await api("contact", Object.fromEntries(d));
              setSent(true);
            } catch (error) {
              toast((error as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {sent ? (
            <div className="contact-success">
              <Check size={32} />
              <h2>Your message is with us.</h2>
              <p>
                Thanks for reaching out. Your inquiry has been saved for review.
              </p>
              <ButtonLink href="/demo" variant="secondary">
                Explore YouConect <ArrowRight size={16} />
              </ButtonLink>
            </div>
          ) : (
            <>
              <h2>Say hello.</h2>
              <label>
                Your name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Alex Morgan"
                  autoComplete="name"
                />
              </label>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@organization.com"
                  autoComplete="email"
                />
              </label>
              <label>
                Organization <span className="muted">(optional)</span>
                <input
                  name="organization"
                  maxLength={150}
                  placeholder="Where you belong"
                />
              </label>
              <label>
                What’s on your mind?
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={4}
                  placeholder="Tell us a little about it…"
                />
              </label>
              <Button loading={busy} type="submit">
                Send your message <ArrowUpRight size={16} />
              </Button>
              <small>
                By submitting, you agree to our{" "}
                <Link href="/privacy">privacy notice</Link>.
              </small>
            </>
          )}
        </form>
      </main>
      <MarketingFooter />
    </>
  );
}
