"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  CalendarDays,
  MapPin,
  Users,
  ArrowUpRight,
  ArrowLeft,
  Plus,
  Check,
  Clock3,
  Globe2,
  Search,
  Bookmark,
  BriefcaseBusiness,
  ArrowRight,
  Download,
  FileText,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { api, useResource, formatDate } from "@/lib/client";
import type { Event, Opportunity } from "@/lib/types";
import { useApp } from "./app-context";
import {
  SectionHeading,
  Button,
  ButtonLink,
  Badge,
  Avatar,
  Modal,
  ErrorState,
  EmptyState,
  PageSkeleton,
  useToast,
  Verified,
} from "./ui";
function EventArt({ event }: { event: Event }) {
  return (
    <div className={`event-card-art event-art-${event.cover || "design"}`}>
      <span className="event-art-orbit" />
      <span className="event-art-shape" />
      <span className="event-art-cross">✦</span>
      <Badge color={event.color}>{event.category}</Badge>
      <span className="event-art-word">
        {event.cover === "builders" ? (
          <>
            GOOD IDEAS.
            <br />
            GREAT COMPANY.
          </>
        ) : event.cover === "network" ? (
          <>
            MAKE A<br />
            CONNECTION.
          </>
        ) : (
          <>
            DESIGN
            <br />
            WHAT’S NEXT.
          </>
        )}
      </span>
      <span className="event-art-caption">A YOUCONECT COMMUNITY EVENT</span>
      <div className="event-date-ticket">
        <strong>{formatDate(event.starts_at, { day: "2-digit" })}</strong>
        <span>{formatDate(event.starts_at, { month: "short" })}</span>
      </div>
    </div>
  );
}
export function EventCard({ event: e }: { event: Event }) {
  const { refresh } = useApp(),
    toast = useToast();
  const [busy, setBusy] = useState(false);
  const ended = new Date(e.starts_at) < new Date();
  return (
    <article className="event-card card">
      <Link href={`/app/events/${e.id}`}>
        <EventArt event={e} />
      </Link>
      <div className="event-card-body">
        <span className="event-organization">{e.organization_name}</span>
        <Link href={`/app/events/${e.id}`}>
          <h2>{e.title}</h2>
        </Link>
        <div className="event-meta">
          <span>
            <CalendarDays size={14} />
            {formatDate(e.starts_at, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: e.timezone,
            })}
          </span>
          <span>
            <MapPin size={14} />
            {e.location}
          </span>
        </div>
        <div className="event-card-footer">
          <span>
            <Users size={14} />
            {e.attendee_count} going
          </span>
          <Button
            variant={e.registered ? "secondary" : "primary"}
            size="sm"
            disabled={ended && !e.registered}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`events/${e.id}/rsvp`, { cancel: e.registered });
                await refresh();
                toast(
                  e.registered
                    ? "Your registration is cancelled."
                    : "You’re on the list. See you there!",
                );
              } catch (error) {
                toast((error as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {e.registered ? (
              <>
                <Check size={14} /> Going
              </>
            ) : ended ? (
              "Registration closed"
            ) : (
              <>
                Count me in <ArrowUpRight size={14} />
              </>
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}
export function EventsPage() {
  const { data, error, isPending } = useResource<{ items: Event[] }>("events");
  const [filter, setFilter] = useState("All events"),
    [search, setSearch] = useState(""),
    [create, setCreate] = useState(false);
  const categories = [
    "All events",
    "My events",
    ...new Set(data?.items.map((e) => e.category)),
  ];
  const items = data?.items.filter(
    (e) =>
      (filter === "All events" ||
        (filter === "My events" && e.registered) ||
        e.category === filter) &&
      (e.title + " " + e.organization_name)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="SOMETHING TO LOOK FORWARD TO"
        title="Good things happen together."
        description="A new idea, a shared experience, or the start of something meaningful."
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} /> Create an event
        </Button>
      </SectionHeading>
      <div className="event-feature-banner">
        <div>
          <Badge color="blue">
            <Sparkles size={12} /> MAKE A LITTLE ROOM FOR POSSIBILITY
          </Badge>
          <h2>
            Be there.
            <br />
            Be part of what’s next.
          </h2>
          <p>
            From a small meetup to your next big idea.
            <br />
            Find a reason to come together.
          </p>
        </div>
        <div className="feature-calendar">
          <span>GOOD COMPANY</span>
          <CalendarDays size={63} strokeWidth={1.2} />
          <strong>
            is always
            <br />
            worth the time.
          </strong>
          <i>✦</i>
        </div>
      </div>
      <div className="directory-tools">
        <div className="filter-pills">
          {categories.map((c) => (
            <button
              className={filter === c ? "active" : ""}
              key={c}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="inline-search">
          <Search size={16} />
          <input
            aria-label="Search events"
            placeholder="Find your next event…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {isPending ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <div className="event-grid">
          {items?.map((e) => (
            <EventCard event={e} key={e.id} />
          ))}
        </div>
      )}
      {items && !items.length && (
        <EmptyState
          icon={CalendarDays}
          title={
            filter === "My events"
              ? "Make a little time for something good."
              : "A little quiet on the calendar."
          }
          description="Explore another category, or bring your people together with an event."
        >
          <Button
            variant="secondary"
            onClick={() => {
              setFilter("All events");
              setSearch("");
            }}
          >
            Explore all events
          </Button>
        </EmptyState>
      )}
      <CreateEventForm open={create} onOpenChange={setCreate} />
    </div>
  );
}
export function CreateEventForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, refresh } = useApp(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Give your people a reason to come together"
      description="A few details turn an idea into a date on the calendar."
      wide
    >
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api<{ id: string }>("events", {
              ...f,
              organization_id: f.organization_id || null,
              capacity: Number(f.capacity),
              starts_at: new Date(String(f.starts_at)).toISOString(),
              ends_at: new Date(String(f.ends_at)).toISOString(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            await refresh();
            onOpenChange(false);
            router.push(`/app/events/${result.id}`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Event title
          <input
            name="title"
            required
            minLength={3}
            maxLength={150}
            placeholder="What are we getting together for?"
          />
        </label>
        <label>
          A little about the event
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={5000}
            rows={3}
          />
        </label>
        <div className="form-two-columns">
          <label>
            Starts
            <input name="starts_at" type="datetime-local" required />
          </label>
          <label>
            Ends
            <input name="ends_at" type="datetime-local" required />
          </label>
        </div>
        <small className="muted">
          Times use your device’s timezone and are stored in UTC.
        </small>
        <label>
          Location or online meeting link
          <input
            name="location"
            required
            maxLength={200}
            placeholder="A place to meet"
          />
        </label>
        <div className="form-two-columns">
          <label>
            Category
            <select name="category">
              {[
                "Workshop",
                "Meetup",
                "Networking",
                "Conference",
                "Competition",
                "Social",
                "Webinar",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Capacity
            <input
              name="capacity"
              type="number"
              min={1}
              max={100000}
              defaultValue={100}
            />
          </label>
        </div>
        <div className="form-two-columns">
          <label>
            Hosted by
            <select name="organization_id">
              <option value="">Me · personal event</option>
              {data.organizations
                .filter((o) =>
                  [
                    "owner",
                    "admin",
                    "staff",
                    "department_admin",
                    "society_admin",
                  ].includes(o.role || ""),
                )
                .map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Who can join?
            <select name="visibility">
              <option value="public">Anyone on YouConect</option>
              <option value="organization">Organization members</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy}>
          Put it on the calendar <ArrowUpRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
function calendarDownload(e: Event) {
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const date = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YouConect//Events//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@youconect`,
    `DTSTAMP:${date(new Date().toISOString())}`,
    `DTSTART:${date(e.starts_at)}`,
    `DTEND:${date(e.ends_at)}`,
    `SUMMARY:${escape(e.title)}`,
    `DESCRIPTION:${escape(e.description)}`,
    `LOCATION:${escape(e.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `youconect-${e.id}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function EventDetail({ id }: { id: string }) {
  const { data, error, isPending } = useResource<{ event: Event }>(
    `events/${id}`,
  );
  const { refresh } = useApp(),
    toast = useToast();
  const [busy, setBusy] = useState(false);
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} />;
  const e = data.event;
  return (
    <div className="standard-page event-detail">
      <Link href="/app/events" className="back-link">
        <ArrowLeft size={16} /> A little something ahead
      </Link>
      <EventArt event={e} />
      <div className="detail-two-columns">
        <section>
          <Badge color={e.color}>{e.category}</Badge>
          <h1>{e.title}</h1>
          <p className="detail-hosted">
            Brought together by <strong>{e.organization_name}</strong>
          </p>
          <h2>A good reason to be there.</h2>
          <p className="detail-description">{e.description}</p>
          <div className="event-detail-info">
            <div>
              <CalendarDays size={21} />
              <span>
                <strong>
                  {formatDate(e.starts_at, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: e.timezone,
                  })}
                </strong>
                <small>
                  {new Date(e.starts_at).toLocaleTimeString("en", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: e.timezone,
                  })}{" "}
                  –{" "}
                  {new Date(e.ends_at).toLocaleTimeString("en", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: e.timezone,
                  })}{" "}
                  · {e.timezone}
                </small>
              </span>
            </div>
            <div>
              <MapPin size={21} />
              <span>
                <strong>{e.location}</strong>
                <small>A place to connect</small>
              </span>
            </div>
            <div>
              <Users size={21} />
              <span>
                <strong>{e.attendee_count} people coming together</strong>
                <small>
                  Room for {Math.max(0, e.capacity - e.attendee_count)} more
                </small>
              </span>
            </div>
          </div>
        </section>
        <aside className="card event-registration">
          <span className="eyebrow">MAKE A LITTLE ROOM FOR POSSIBILITY</span>
          <h2>
            {e.registered ? "You’re on the list." : "Your spot is waiting."}
          </h2>
          <p>
            {e.registered
              ? "We’re looking forward to seeing you there."
              : "Be part of a shared experience. A connection might be closer than you think."}
          </p>
          <Button
            loading={busy}
            variant={e.registered ? "secondary" : "primary"}
            disabled={
              !e.registered &&
              (new Date(e.starts_at) < new Date() ||
                e.attendee_count >= e.capacity)
            }
            onClick={async () => {
              setBusy(true);
              try {
                await api(`events/${id}/rsvp`, { cancel: e.registered });
                await refresh();
                toast(
                  e.registered
                    ? "Your registration is cancelled."
                    : "Your registration is confirmed.",
                );
              } catch (error) {
                toast((error as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {e.registered ? (
              <>
                <Check size={16} /> Going · cancel registration
              </>
            ) : (
              <>
                Count me in <ArrowUpRight size={16} />
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={() => calendarDownload(e)}>
            <Download size={16} /> Add to your calendar
          </Button>
          <small>
            <ShieldSmall /> Your registration is saved to your account.
          </small>
        </aside>
      </div>
    </div>
  );
}
function ShieldSmall() {
  return <Check size={12} />;
}
export function OpportunityCard({
  opportunity: o,
}: {
  opportunity: Opportunity;
}) {
  const { refresh } = useApp(),
    toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <article className="opportunity-card card">
      <div className="opportunity-card-top">
        <span className={`org-symbol tone-${o.color}`}>
          <BriefcaseBusiness size={23} />
        </span>
        <button
          aria-label={o.saved ? "Unsave opportunity" : "Save opportunity"}
          className={`icon-button ${o.saved ? "is-saved" : ""}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`opportunities/${o.id}/save`, { active: !o.saved });
              await refresh();
              toast(
                o.saved
                  ? "Removed from saved opportunities."
                  : "Opportunity saved.",
              );
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Bookmark size={19} fill={o.saved ? "currentColor" : "none"} />
        </button>
      </div>
      <Badge color={o.color}>{o.category}</Badge>
      <Link href={`/app/opportunities/${o.id}`}>
        <h2>{o.title}</h2>
      </Link>
      <span className="opportunity-org">{o.organization_name}</span>
      <p>{o.description}</p>
      <div className="opportunity-meta">
        <span>
          <MapPin size={14} />
          {o.location}
        </span>
        <span>
          <Clock3 size={14} /> Apply by {formatDate(o.deadline)}
        </span>
      </div>
      <div className="opportunity-card-footer">
        <span>{o.compensation}</span>
        <Link href={`/app/opportunities/${o.id}`} className="text-link">
          {o.applied ? (
            <>
              <Check size={14} /> Applied
            </>
          ) : (
            <>
              Take a closer look <ArrowUpRight size={15} />
            </>
          )}
        </Link>
      </div>
    </article>
  );
}
export function OpportunitiesPage() {
  const { data, error, isPending } = useResource<{ items: Opportunity[] }>(
    "opportunities",
  );
  const [filter, setFilter] = useState("All opportunities"),
    [search, setSearch] = useState(""),
    [create, setCreate] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("saved") === "true")
      setFilter("Saved");
  }, []);
  const categories = [
    "All opportunities",
    "Saved",
    ...new Set(data?.items.map((o) => o.category)),
  ];
  const items = data?.items.filter(
    (o) =>
      (filter === "All opportunities" ||
        (filter === "Saved" && o.saved) ||
        filter === o.category) &&
      (o.title + " " + o.organization_name)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="YOUR NEXT CHAPTER COULD START HERE"
        title="A little possibility. A lot of potential."
        description="Find work, learning, and ways to make your mark."
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={16} /> Share an opportunity
        </Button>
      </SectionHeading>
      <div className="opportunities-feature">
        <div>
          <span className="eyebrow">GOOD THINGS ARE AHEAD</span>
          <h2>
            Go where your
            <br />
            curiosity takes you.
          </h2>
          <p>
            Your next role, a research idea, or a chance to give back.
            <br />
            There’s more than one way to grow.
          </p>
        </div>
        <div className="opportunity-feature-art">
          <span>✦</span>
          <i />
          <div>
            <RocketIcon />
          </div>
          <b>
            YOUR NEXT
            <br />
            CHAPTER.
          </b>
        </div>
      </div>
      <div className="directory-tools">
        <div className="filter-pills">
          {categories.map((c) => (
            <button
              key={c}
              className={filter === c ? "active" : ""}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="inline-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search opportunities"
            placeholder="Find your next possibility…"
          />
        </div>
      </div>
      {isPending ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <div className="directory-grid">
          {items?.map((o) => (
            <OpportunityCard opportunity={o} key={o.id} />
          ))}
        </div>
      )}
      {items && !items.length && (
        <EmptyState
          icon={BriefcaseBusiness}
          title={
            filter === "Saved"
              ? "Keep your next chapter in sight."
              : "Your next opportunity is still out there."
          }
          description="Try another category, or save an opportunity to come back to later."
        />
      )}
      <CreateOpportunityForm open={create} onOpenChange={setCreate} />
    </div>
  );
}
function RocketIcon() {
  return <Sparkles size={50} strokeWidth={1} />;
}
export function CreateOpportunityForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, refresh } = useApp(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Open a door for someone"
      description="Share an opportunity with your community."
      wide
    >
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api<{ id: string }>("opportunities", {
              ...f,
              organization_id: f.organization_id || null,
              deadline: new Date(String(f.deadline)).toISOString(),
            });
            await refresh();
            onOpenChange(false);
            router.push(`/app/opportunities/${result.id}`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Opportunity title
          <input
            name="title"
            minLength={3}
            maxLength={150}
            required
            placeholder="A next step worth taking"
          />
        </label>
        <label>
          What’s the opportunity?
          <textarea
            name="description"
            minLength={10}
            maxLength={6000}
            rows={4}
            required
          />
        </label>
        <div className="form-two-columns">
          <label>
            Category
            <select name="category">
              {[
                "Internship",
                "Job",
                "Scholarship",
                "Competition",
                "Research",
                "Volunteer",
                "Workshop",
                "Startup program",
                "Mentorship",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Application deadline
            <input name="deadline" required type="datetime-local" />
          </label>
        </div>
        <label>
          Location
          <input
            name="location"
            required
            maxLength={150}
            placeholder="City · Remote / Hybrid / On site"
          />
        </label>
        <label>
          Compensation or support
          <input
            name="compensation"
            maxLength={100}
            placeholder="Be clear about what’s offered"
          />
        </label>
        <label>
          Who’s this for?
          <textarea name="eligibility" maxLength={1000} rows={2} />
        </label>
        <div className="form-two-columns">
          <label>
            Organization
            <select name="organization_id">
              <option value="">My personal network</option>
              {data.organizations
                .filter((o) =>
                  [
                    "owner",
                    "admin",
                    "staff",
                    "department_admin",
                    "society_admin",
                  ].includes(o.role || ""),
                )
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Visibility
            <select name="visibility">
              <option value="public">Anyone on YouConect</option>
              <option value="organization">Organization members</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy}>
          Share this opportunity <ArrowUpRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
export function OpportunityDetail({ id }: { id: string }) {
  const { data, error, isPending } = useResource<{ opportunity: Opportunity }>(
    `opportunities/${id}`,
  );
  const { refresh } = useApp();
  const [apply, setApply] = useState(false),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} />;
  const o = data.opportunity;
  return (
    <div className="standard-page opportunity-detail">
      <Link href="/app/opportunities" className="back-link">
        <ArrowLeft size={16} /> Your next possibilities
      </Link>
      <div className="card opportunity-detail-header">
        <span className={`org-symbol org-symbol-lg tone-${o.color}`}>
          <BriefcaseBusiness size={30} />
        </span>
        <Badge color={o.color}>{o.category}</Badge>
        <h1>{o.title}</h1>
        <p>{o.organization_name}</p>
        <div className="row">
          <span>
            <MapPin size={15} />
            {o.location}
          </span>
          <span>
            <Clock3 size={15} /> Apply by{" "}
            {formatDate(o.deadline, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
      <div className="detail-two-columns">
        <section className="card opportunity-description">
          <h2>A little about your next chapter.</h2>
          <p>{o.description}</p>
          <h3>Who this could be for</h3>
          <p>
            {o.eligibility || "Curious people ready to make a contribution."}
          </p>
          {o.compensation && (
            <>
              <h3>What’s offered</h3>
              <p>{o.compensation}</p>
            </>
          )}
        </section>
        <aside className="card event-registration">
          <span className="eyebrow">TAKE THE NEXT STEP</span>
          <h2>
            {o.applied
              ? "You’ve put yourself forward."
              : "Could this be your next thing?"}
          </h2>
          <p>
            {o.applied
              ? "Your introduction has been saved for the organizer to review."
              : "Tell the organizer a little about yourself and why this opportunity speaks to you."}
          </p>
          <Button
            disabled={o.applied || new Date(o.deadline) < new Date()}
            onClick={() => setApply(true)}
          >
            {o.applied ? (
              <>
                <Check size={16} /> Application submitted
              </>
            ) : new Date(o.deadline) < new Date() ? (
              "Applications closed"
            ) : (
              <>
                Apply with an introduction <ArrowUpRight size={16} />
              </>
            )}
          </Button>
          <small>
            <FileText size={13} /> Your introduction goes to the opportunity
            organizer.
          </small>
        </aside>
      </div>
      <Modal
        open={apply}
        onOpenChange={setApply}
        title="A little introduction goes a long way"
        description={`Apply for ${o.title}`}
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setFormError("");
            try {
              await api(`opportunities/${id}/apply`, {
                note: new FormData(e.currentTarget).get("note"),
              });
              await refresh();
              setApply(false);
            } catch (e) {
              setFormError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            What would you like them to know?
            <textarea
              name="note"
              rows={7}
              required
              minLength={20}
              maxLength={4000}
              placeholder="Introduce yourself, share what you’re interested in, and tell them what you could bring."
            />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <Button type="submit" loading={busy}>
            Send your introduction <ArrowUpRight size={16} />
          </Button>
        </form>
      </Modal>
    </div>
  );
}
