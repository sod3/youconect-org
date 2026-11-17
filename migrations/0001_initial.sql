CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL, name text NOT NULL,
 headline text NOT NULL DEFAULT '', bio text NOT NULL DEFAULT '', avatar text NOT NULL DEFAULT 'blue',
 interests jsonb NOT NULL DEFAULT '[]', privacy jsonb NOT NULL DEFAULT '{"profile":"public","showMemberships":false,"presence":true}',
 email_verified boolean NOT NULL DEFAULT false, onboarding_complete boolean NOT NULL DEFAULT false,
 platform_role text NOT NULL DEFAULT 'user' CHECK (platform_role IN ('user','admin')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS auth_tokens (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose text NOT NULL CHECK (purpose IN ('verify','reset','invite')), expires_at timestamptz NOT NULL, used_at timestamptz);
CREATE TABLE IF NOT EXISTS organizations (
 id text PRIMARY KEY, slug text NOT NULL UNIQUE, name text NOT NULL, type text NOT NULL, description text NOT NULL DEFAULT '',
 location text NOT NULL DEFAULT '', website text NOT NULL DEFAULT '', initials text NOT NULL, color text NOT NULL DEFAULT 'blue',
 verified boolean NOT NULL DEFAULT false, verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected')),
 plan text NOT NULL DEFAULT 'listing', created_by text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
 organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','department_admin','staff','society_admin','moderator','member','guest')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','suspended')), joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id,status);
CREATE TABLE IF NOT EXISTS departments (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name text NOT NULL, UNIQUE(organization_id,name));
CREATE TABLE IF NOT EXISTS communities (
 id text PRIMARY KEY, organization_id text REFERENCES organizations(id) ON DELETE CASCADE, name text NOT NULL, description text NOT NULL DEFAULT '', category text NOT NULL DEFAULT 'General',
 visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','organization','private')), color text NOT NULL DEFAULT 'blue', icon text NOT NULL DEFAULT 'users', owner_id text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS community_members (community_id text NOT NULL REFERENCES communities(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'member', PRIMARY KEY(community_id,user_id));
CREATE TABLE IF NOT EXISTS bridges (
 id text PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '', proposer_org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 target_org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','rejected','closed')),
 created_by text REFERENCES users(id) ON DELETE SET NULL, approved_by text REFERENCES users(id) ON DELETE SET NULL, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK(proposer_org_id <> target_org_id)
);
CREATE TABLE IF NOT EXISTS bridge_members (bridge_id text NOT NULL REFERENCES bridges(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, added_by text REFERENCES users(id) ON DELETE SET NULL, PRIMARY KEY(bridge_id,user_id));
CREATE TABLE IF NOT EXISTS uploads (id text PRIMARY KEY, owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, filename text NOT NULL, mime text NOT NULL, size integer NOT NULL CHECK(size > 0 AND size <= 5242880), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS posts (
 id text PRIMARY KEY, author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, organization_id text REFERENCES organizations(id) ON DELETE CASCADE,
 community_id text REFERENCES communities(id) ON DELETE CASCADE, bridge_id text REFERENCES bridges(id) ON DELETE CASCADE,
 content text NOT NULL CHECK(length(content) BETWEEN 1 AND 12000), kind text NOT NULL DEFAULT 'text',
 audience text NOT NULL DEFAULT 'public' CHECK (audience IN ('public','organization','community','bridge')), official boolean NOT NULL DEFAULT false,
 media jsonb NOT NULL DEFAULT '[]', poll jsonb, created_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz,
 CHECK ((audience='public' AND bridge_id IS NULL) OR (audience='organization' AND organization_id IS NOT NULL AND bridge_id IS NULL) OR (audience='community' AND community_id IS NOT NULL AND bridge_id IS NULL) OR (audience='bridge' AND bridge_id IS NOT NULL AND organization_id IS NULL AND community_id IS NULL))
);
CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at DESC,id);
CREATE INDEX IF NOT EXISTS posts_org_idx ON posts(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS posts_community_idx ON posts(community_id);
CREATE INDEX IF NOT EXISTS posts_bridge_idx ON posts(bridge_id);
CREATE TABLE IF NOT EXISTS reactions (post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, emoji text NOT NULL DEFAULT 'heart', PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS saved_posts (post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS comments (id text PRIMARY KEY, post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, parent_id text REFERENCES comments(id) ON DELETE CASCADE, content text NOT NULL CHECK(length(content) BETWEEN 1 AND 3000), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id,created_at);
CREATE TABLE IF NOT EXISTS poll_votes (post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, option_index integer NOT NULL CHECK(option_index >= 0), PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS follows (follower_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(follower_id,following_id), CHECK(follower_id <> following_id));
CREATE TABLE IF NOT EXISTS conversations (id text PRIMARY KEY, name text NOT NULL DEFAULT '', kind text NOT NULL DEFAULT 'direct' CHECK(kind IN ('direct','group','channel')), organization_id text REFERENCES organizations(id) ON DELETE CASCADE, bridge_id text REFERENCES bridges(id) ON DELETE CASCADE, community_id text REFERENCES communities(id) ON DELETE CASCADE, visibility text NOT NULL DEFAULT 'private', description text NOT NULL DEFAULT '', announcements_only boolean NOT NULL DEFAULT false, direct_key text UNIQUE, created_by text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS conversation_participants (conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'member', last_read_at timestamptz NOT NULL DEFAULT '2000-01-01', muted boolean NOT NULL DEFAULT false, pinned boolean NOT NULL DEFAULT false, PRIMARY KEY(conversation_id,user_id));
CREATE INDEX IF NOT EXISTS participants_user_idx ON conversation_participants(user_id);
CREATE TABLE IF NOT EXISTS messages (id text PRIMARY KEY, client_id text NOT NULL, conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, sender_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, content text NOT NULL CHECK(length(content) <= 6000), attachment_id text REFERENCES uploads(id) ON DELETE SET NULL, reply_to text REFERENCES messages(id) ON DELETE SET NULL, deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz, UNIQUE(sender_id,client_id));
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id,created_at DESC,id);
CREATE TABLE IF NOT EXISTS message_reactions (message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, emoji text NOT NULL, PRIMARY KEY(message_id,user_id));
CREATE TABLE IF NOT EXISTS events (id text PRIMARY KEY, title text NOT NULL, description text NOT NULL, organization_id text REFERENCES organizations(id) ON DELETE CASCADE, bridge_id text REFERENCES bridges(id) ON DELETE CASCADE, host_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, timezone text NOT NULL DEFAULT 'Asia/Karachi', location text NOT NULL, category text NOT NULL DEFAULT 'Workshop', cover text NOT NULL DEFAULT 'workshop', color text NOT NULL DEFAULT 'blue', capacity integer NOT NULL DEFAULT 100 CHECK(capacity>0), visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','organization','bridge')), created_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_at > starts_at), CHECK(visibility <> 'organization' OR organization_id IS NOT NULL), CHECK(visibility <> 'bridge' OR bridge_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS events_start_idx ON events(starts_at);
CREATE TABLE IF NOT EXISTS registrations (event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, attended boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(event_id,user_id));
CREATE TABLE IF NOT EXISTS opportunities (id text PRIMARY KEY, title text NOT NULL, description text NOT NULL, category text NOT NULL, organization_id text REFERENCES organizations(id) ON DELETE CASCADE, created_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE, location text NOT NULL, deadline timestamptz NOT NULL, compensation text NOT NULL DEFAULT '', eligibility text NOT NULL DEFAULT '', visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','organization')), created_at timestamptz NOT NULL DEFAULT now(), CHECK(visibility <> 'organization' OR organization_id IS NOT NULL));
CREATE TABLE IF NOT EXISTS saved_opportunities (opportunity_id text NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(opportunity_id,user_id));
CREATE TABLE IF NOT EXISTS applications (id text PRIMARY KEY, opportunity_id text NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, note text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'submitted', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(opportunity_id,user_id));
CREATE TABLE IF NOT EXISTS notifications (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, body text NOT NULL DEFAULT '', href text NOT NULL, kind text NOT NULL DEFAULT 'activity', read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS reports (id text PRIMARY KEY, reporter_id text REFERENCES users(id) ON DELETE SET NULL, organization_id text REFERENCES organizations(id) ON DELETE CASCADE, resource_type text NOT NULL, resource_id text NOT NULL, reason text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')), reviewed_by text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs (id text PRIMARY KEY, organization_id text REFERENCES organizations(id) ON DELETE CASCADE, actor_id text REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL, resource_id text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS audit_org_idx ON audit_logs(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS plans (id text PRIMARY KEY, name text NOT NULL, price_pkr integer, member_limit integer NOT NULL, admin_limit integer NOT NULL, storage_mb integer NOT NULL, bridges boolean NOT NULL DEFAULT false, private_workspace boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS subscriptions (organization_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE, plan_id text NOT NULL REFERENCES plans(id), status text NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','past_due','cancelled')), renews_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS billing_records (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, amount_pkr integer NOT NULL CHECK(amount_pkr>=0), status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','invoiced','paid','void')), plan_id text NOT NULL REFERENCES plans(id), reference text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, count integer NOT NULL, resets_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS contact_requests (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL, organization text NOT NULL DEFAULT '', message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS blocks (blocker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id <> blocked_id));
INSERT INTO plans(id,name,price_pkr,member_limit,admin_limit,storage_mb,bridges,private_workspace) VALUES
 ('listing','Free listing',0,0,1,100,false,false),('starter','Campus Starter',8000,500,3,5000,false,true),('growth','Campus Growth',22000,2500,10,25000,true,true),('pro','Campus Pro',55000,10000,25,100000,true,true),('enterprise','Enterprise',NULL,1000000,1000,1000000,true,true) ON CONFLICT(id) DO NOTHING;
INSERT INTO schema_migrations(version) VALUES ('0001') ON CONFLICT DO NOTHING;
