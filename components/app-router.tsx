"use client";
import { AppShell } from "./app-shell";
import { FeedPage, PostDetail, SearchPage } from "./social";
import {
  DirectoryPage,
  OrganizationDetail,
  NewOrganizationPage,
  CommunityDetail,
  ExplorePage,
} from "./directories";
import { MessagesPage } from "./messages";
import {
  EventsPage,
  EventDetail,
  OpportunitiesPage,
  OpportunityDetail,
} from "./events";
import { BridgesPage, BridgeDetail } from "./bridges";
import { ProfilePage, SettingsPage, NotificationsPage } from "./account";
import { AdminPage, PlatformPage } from "./admin";
import { EmptyState, ButtonLink } from "./ui";
export function ApplicationRouter({ section }: { section: string[] }) {
  const [page, id] = section;
  let content: React.ReactNode;
  if (!page) content = <FeedPage />;
  else if (page === "explore") content = <ExplorePage />;
  else if (page === "saved") content = <FeedPage saved />;
  else if (page === "post" && id) content = <PostDetail id={id} />;
  else if (page === "organizations")
    content =
      id === "new" ? (
        <NewOrganizationPage />
      ) : id ? (
        <OrganizationDetail id={id} />
      ) : (
        <DirectoryPage kind="organizations" />
      );
  else if (page === "communities")
    content = id ? (
      <CommunityDetail id={id} />
    ) : (
      <DirectoryPage kind="communities" />
    );
  else if (page === "messages") content = <MessagesPage id={id} />;
  else if (page === "events")
    content = id ? <EventDetail id={id} /> : <EventsPage />;
  else if (page === "opportunities")
    content = id ? <OpportunityDetail id={id} /> : <OpportunitiesPage />;
  else if (page === "bridges")
    content = id ? <BridgeDetail id={id} /> : <BridgesPage />;
  else if (page === "profile")
    content = id === "edit" ? <SettingsPage /> : <ProfilePage id={id} />;
  else if (page === "settings") content = <SettingsPage />;
  else if (page === "notifications") content = <NotificationsPage />;
  else if (page === "search") content = <SearchPage />;
  else if (page === "admin") content = <AdminPage organizationId={id} />;
  else if (page === "platform") content = <PlatformPage />;
  else
    content = (
      <EmptyState
        title="A little off the map."
        description="This part of your world doesn’t exist yet."
      >
        <ButtonLink href="/app" variant="secondary">
          Back to your world
        </ButtonLink>
      </EmptyState>
    );
  return <AppShell>{content}</AppShell>;
}
