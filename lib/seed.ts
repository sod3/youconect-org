import { randomUUID } from "node:crypto";
import type { Database, SqlConnection } from "./db";
import { hashPassword } from "./auth";
export const DEMO_USERS = {
  ayla: "demo-ayla",
  zara: "demo-zara",
  omar: "demo-omar",
  daniel: "demo-daniel",
  sara: "demo-sara",
};
export async function seed(db: Database) {
  const [exists] = await db.query(
    "SELECT 1 FROM schema_migrations WHERE version='demo-v1'",
  );
  if (exists) return;
  const password = await hashPassword("YouConect-demo-2026!");
  await db.transaction(async (tx) => {
    const inserted = await tx.query(
      "INSERT INTO schema_migrations(version) VALUES('demo-v1') ON CONFLICT DO NOTHING RETURNING version",
    );
    if (!inserted.length) return;
    const users = [
      [
        "ayla",
        "Ayla Khan",
        "Design student & curious human",
        "Designing things that bring people together. Currently exploring the intersection of community, design, and technology.",
        "rose",
        ["Design", "Technology", "Entrepreneurship"],
      ],
      [
        "zara",
        "Zara Ahmed",
        "Community builder · Northstar University",
        "Good ideas become great when we build them together.",
        "amber",
        ["Community", "Design"],
      ],
      [
        "omar",
        "Omar Farooq",
        "Founder · Lumina Labs",
        "Building useful things with good people.",
        "teal",
        ["Technology", "Entrepreneurship"],
      ],
      [
        "daniel",
        "Daniel Lee",
        "Creative technologist",
        "Making room for a little more curiosity.",
        "blue",
        ["Design", "Technology"],
      ],
      [
        "sara",
        "Sara Malik",
        "Researcher & lifelong learner",
        "Exploring the questions between science and society.",
        "violet",
        ["Research", "Education"],
      ],
    ];
    for (const [key, name, headline, bio, avatar, interests] of users)
      await tx.query(
        "INSERT INTO users(id,email,password_hash,name,headline,bio,avatar,interests,email_verified,onboarding_complete,platform_role) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,true,$9)",
        [
          `demo-${key}`,
          `${key}@demo.youconect.local`,
          password,
          name,
          headline,
          bio,
          avatar,
          JSON.stringify(interests),
          key === "ayla" ? "admin" : "user",
        ],
      );
    for (const org of [
      [
        "northstar",
        "Northstar University",
        "University",
        "A fictional campus for curious minds. Meet your classmates, find your people, and build what comes next.",
        "Karachi, Pakistan",
        "NU",
        "blue",
        "demo-ayla",
      ],
      [
        "makers",
        "MakerSpace Collective",
        "Community organization",
        "An independent fictional community for people who turn ideas into things.",
        "Karachi, Pakistan",
        "m.",
        "teal",
        "demo-zara",
      ],
      [
        "lumina",
        "Lumina Labs",
        "Startup",
        "A fictional product studio bringing thoughtful technology to everyday life.",
        "Lahore, Pakistan",
        "L",
        "violet",
        "demo-omar",
      ],
    ]) {
      await tx.query(
        "INSERT INTO organizations(id,slug,name,type,description,location,initials,color,verified,verification_status,plan,created_by) VALUES($1,$1,$2,$3,$4,$5,$6,$7,true,'approved','growth',$8)",
        org,
      );
      await tx.query(
        "INSERT INTO subscriptions(organization_id,plan_id,status,renews_at) VALUES($1,'growth','trial',now()+interval '30 days')",
        [org[0]],
      );
    }
    for (const [org, user, role] of [
      ["northstar", "ayla", "owner"],
      ["northstar", "zara", "admin"],
      ["northstar", "daniel", "member"],
      ["northstar", "sara", "staff"],
      ["makers", "ayla", "member"],
      ["makers", "zara", "owner"],
      ["makers", "daniel", "member"],
      ["lumina", "omar", "owner"],
      ["lumina", "ayla", "member"],
      ["lumina", "daniel", "member"],
    ])
      await tx.query(
        "INSERT INTO memberships(organization_id,user_id,role,status) VALUES($1,$2,$3,'active')",
        [org, `demo-${user}`, role],
      );
    for (const [id, name, description, category, org, color, icon] of [
      [
        "design",
        "The Design Collective",
        "A little inspiration. A lot of making. A space for designers of every discipline.",
        "Design",
        null,
        "violet",
        "palette",
      ],
      [
        "builders",
        "Builders & Dreamers",
        "Find your next cofounder, side project, or spark of inspiration.",
        "Entrepreneurship",
        "makers",
        "amber",
        "rocket",
      ],
      [
        "campus",
        "Life at Northstar",
        "The moments, people, and ideas that make our campus feel like home.",
        "Campus",
        "northstar",
        "blue",
        "graduation",
      ],
      [
        "tech",
        "Tech for Good",
        "Build something that makes a difference.",
        "Technology",
        null,
        "teal",
        "code",
      ],
    ])
      await tx.query(
        "INSERT INTO communities(id,name,description,category,organization_id,color,icon,owner_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [id, name, description, category, org, color, icon, "demo-zara"],
      );
    for (const community of ["design", "builders", "campus"])
      for (const key of ["ayla", "zara", "daniel"])
        await tx.query(
          "INSERT INTO community_members(community_id,user_id) VALUES($1,$2)",
          [community, `demo-${key}`],
        );
    for (const [id, name] of [
      ["cs", "Computer Science"],
      ["design-dept", "Design & Creative Arts"],
      ["business", "Business & Entrepreneurship"],
    ])
      await tx.query(
        "INSERT INTO departments(id,organization_id,name) VALUES($1,'northstar',$2)",
        [id, name],
      );
    const campusImage = "/campus-community.webp";
    const posts = [
      {
        id: "welcome-week",
        author: "zara",
        org: "northstar",
        community: "campus",
        content:
          "A new chapter. A thousand possibilities. ✨\n\nWelcome week is officially here! From finding your favourite corner on campus to meeting the people who will change your world — this is where it all begins.\n\nWhat are you most looking forward to this semester? #LifeAtNorthstar",
        kind: "image",
        audience: "public",
        official: false,
        media: [campusImage],
        hours: 2,
      },
      {
        id: "build-together",
        author: "omar",
        org: "lumina",
        community: null,
        content:
          "The best projects rarely start with a perfect plan. They start with a conversation.\n\nWe’re opening up our Friday build sessions to the YouConect community. Bring an idea, a half-finished side project, or just your curiosity. Let’s make something useful together. 🛠️",
        kind: "text",
        audience: "public",
        official: false,
        media: [],
        hours: 4,
      },
      {
        id: "design-question",
        author: "daniel",
        org: null,
        community: "design",
        content:
          "A question for my fellow designers: what’s one small interaction in an app that made you stop and say “someone really thought about this”?\n\nMine: when a draft survives a lost connection. Quietly brilliant. ✦",
        kind: "question",
        audience: "community",
        official: false,
        media: [],
        hours: 6,
      },
      {
        id: "campus-announcement",
        author: "sara",
        org: "northstar",
        community: null,
        content:
          "Your next big idea deserves a little space.\n\nThe Innovation Studio is now open for student projects, research meetups, and creative experiments. Active Northstar members can use the studio from Monday to Friday, 9 AM–6 PM.\n\nFind us on the second floor of the library. Come make something.",
        kind: "announcement",
        audience: "organization",
        official: true,
        media: [],
        hours: 8,
      },
      {
        id: "community-poll",
        author: "zara",
        org: "makers",
        community: "builders",
        content:
          "We’re planning our next community meetup, and you get to help shape it. What would you love to explore together?",
        kind: "poll",
        audience: "community",
        official: false,
        media: [],
        hours: 12,
      },
    ];
    for (const p of posts)
      await tx.query(
        "INSERT INTO posts(id,author_id,organization_id,community_id,content,kind,audience,official,media,created_at,poll) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          p.id,
          `demo-${p.author}`,
          p.org,
          p.community,
          p.content,
          p.kind,
          p.audience,
          p.official,
          JSON.stringify(p.media),
          new Date(Date.now() - p.hours * 3600000).toISOString(),
          p.kind === "poll"
            ? JSON.stringify({
                question: "What should we build next?",
                options: [
                  "A hands-on design workshop",
                  "An open-source build night",
                  "A founder fireside chat",
                ],
              })
            : null,
        ],
      );
    for (const p of posts.slice(0, 3))
      for (const key of ["sara", "daniel", "zara"])
        await tx.query("INSERT INTO reactions(post_id,user_id) VALUES($1,$2)", [
          p.id,
          `demo-${key}`,
        ]);
    for (const [post, key, text] of [
      [
        "welcome-week",
        "ayla",
        "That first-day feeling never gets old. So excited for this chapter!",
      ],
      [
        "welcome-week",
        "daniel",
        "The creative studio, definitely. See you there!",
      ],
      [
        "build-together",
        "zara",
        "Love this. Bringing a notebook full of ideas.",
      ],
      [
        "design-question",
        "ayla",
        "Remembering my scroll position when I come back to a feed. Every time.",
      ],
    ])
      await tx.query(
        "INSERT INTO comments(id,post_id,author_id,content) VALUES($1,$2,$3,$4)",
        [randomUUID(), post, `demo-${key}`, text],
      );
    await tx.query(
      "INSERT INTO follows(follower_id,following_id) VALUES('demo-ayla','demo-zara'),('demo-ayla','demo-omar')",
    );
    for (const [
      id,
      title,
      description,
      org,
      days,
      category,
      cover,
      color,
      location,
    ] of [
      [
        "design-futures",
        "Designing what’s next",
        "An open conversation about the future of design, with a hands-on collaborative workshop. Bring your curiosity and a notebook.",
        "northstar",
        3,
        "Workshop",
        "design",
        "violet",
        "Innovation Studio · Karachi",
      ],
      [
        "builders-night",
        "Build something together",
        "An evening of ideas, prototypes, and good company. All skill levels are welcome.",
        "makers",
        5,
        "Meetup",
        "builders",
        "teal",
        "MakerSpace Hub · Karachi",
      ],
      [
        "future-connect",
        "Connections that matter",
        "Meet people working on meaningful things across our university and startup communities.",
        "lumina",
        9,
        "Networking",
        "network",
        "blue",
        "Online · Asia/Karachi",
      ],
    ] as const) {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + days);
      start.setUTCHours(11, 0, 0, 0);
      await tx.query(
        "INSERT INTO events(id,title,description,organization_id,host_id,starts_at,ends_at,location,category,cover,color,capacity) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,40)",
        [
          id,
          title,
          description,
          org,
          org === "lumina" ? "demo-omar" : "demo-zara",
          start.toISOString(),
          new Date(+start + 7200000).toISOString(),
          location,
          category,
          cover,
          color,
        ],
      );
      await tx.query(
        "INSERT INTO registrations(event_id,user_id) VALUES($1,'demo-zara')",
        [id],
      );
    }
    for (const [id, title, org, category, location, pay] of [
      [
        "design-intern",
        "Product Design Intern",
        "lumina",
        "Internship",
        "Lahore · Hybrid",
        "Paid internship",
      ],
      [
        "research-grant",
        "Undergraduate Research Fellowship",
        "northstar",
        "Scholarship",
        "Karachi · On campus",
        "Research grant",
      ],
      [
        "volunteer",
        "Community Workshop Facilitator",
        "makers",
        "Volunteer",
        "Karachi · Flexible",
        "Volunteer",
      ],
    ])
      await tx.query(
        "INSERT INTO opportunities(id,title,description,category,organization_id,created_by,location,deadline,compensation,eligibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          id,
          title,
          "Work alongside a thoughtful team, learn by doing, and make something that matters. Share a short introduction and tell us what you would like to contribute.",
          category,
          org,
          org === "lumina" ? "demo-omar" : "demo-zara",
          location,
          new Date(Date.now() + 21 * 86400000).toISOString(),
          pay,
          "Open to curious, motivated members of the YouConect community.",
        ],
      );
    for (const [id, name, kind, org, people] of [
      ["dm-zara", "", "direct", null, ["ayla", "zara"]],
      ["dm-omar", "", "direct", null, ["ayla", "omar"]],
      [
        "campus-general",
        "general",
        "channel",
        "northstar",
        ["ayla", "zara", "daniel", "sara"],
      ],
      [
        "campus-announcements",
        "announcements",
        "channel",
        "northstar",
        ["ayla", "zara", "daniel", "sara"],
      ],
      [
        "design-circle",
        "Design circle",
        "group",
        null,
        ["ayla", "zara", "daniel"],
      ],
    ] as const) {
      await tx.query(
        "INSERT INTO conversations(id,name,kind,organization_id,created_by,announcements_only,direct_key) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          name,
          kind,
          org,
          "demo-zara",
          id === "campus-announcements",
          kind === "direct"
            ? [...people]
                .map((p) => `demo-${p}`)
                .sort()
                .join(":")
            : null,
        ],
      );
      for (const person of people)
        await tx.query(
          "INSERT INTO conversation_participants(conversation_id,user_id,role) VALUES($1,$2,$3)",
          [id, `demo-${person}`, person === "zara" ? "admin" : "member"],
        );
    }
    const msgs = [
      [
        "dm-zara",
        "zara",
        "Hey Ayla! Are you coming to the design workshop this week?",
      ],
      ["dm-zara", "ayla", "Absolutely! I’ve been looking forward to it ✨"],
      ["dm-zara", "zara", "Same here. Let’s grab a coffee before we head in?"],
      [
        "dm-omar",
        "omar",
        "Hey! Loved your thoughts on the community post. Would be great to have you at a Friday build session.",
      ],
      [
        "campus-general",
        "daniel",
        "Anyone up for a study session at the library this afternoon?",
      ],
      [
        "design-circle",
        "zara",
        "A little space for inspiration, feedback, and things worth sharing. Welcome, everyone!",
      ],
    ];
    for (let i = 0; i < msgs.length; i++) {
      const [conversation, sender, content] = msgs[i];
      await tx.query(
        "INSERT INTO messages(id,client_id,conversation_id,sender_id,content,created_at) VALUES($1,$1,$2,$3,$4,$5)",
        [
          `seed-message-${i}`,
          conversation,
          `demo-${sender}`,
          content,
          new Date(Date.now() - (msgs.length - i) * 900000).toISOString(),
        ],
      );
    }
    await tx.query(
      "INSERT INTO bridges(id,name,description,proposer_org_id,target_org_id,status,created_by,approved_by,approved_at) VALUES('creative-bridge','Campus × Makers','A shared space for campus ideas to meet a community of makers. Collaborate on workshops, projects, and better questions.','northstar','makers','active','demo-ayla','demo-zara',now())",
    );
    for (const user of ["ayla", "zara", "daniel"])
      await tx.query(
        "INSERT INTO bridge_members(bridge_id,user_id,added_by) VALUES('creative-bridge',$1,'demo-zara')",
        [`demo-${user}`],
      );
    await tx.query(
      "INSERT INTO conversations(id,name,kind,bridge_id,created_by) VALUES('bridge-general','bridge-general','channel','creative-bridge','demo-zara')",
    );
    for (const user of ["ayla", "zara", "daniel"])
      await tx.query(
        "INSERT INTO conversation_participants(conversation_id,user_id) VALUES('bridge-general',$1)",
        [`demo-${user}`],
      );
    await tx.query(
      "INSERT INTO posts(id,author_id,bridge_id,content,audience) VALUES('bridge-welcome','demo-zara','creative-bridge','Welcome to Campus × Makers! This space is shared only with explicitly approved members of our two organizations. What should we create together?','bridge')",
    );
    await tx.query(
      "INSERT INTO notifications(id,user_id,title,body,href,kind) VALUES($1,'demo-ayla','Your communities, a little closer','You have access to the Campus × Makers Bridge.','/app/bridges','bridge'),($2,'demo-ayla','Welcome to your corner of YouConect','Explore your communities and make your first connection.','/app/explore','welcome')",
      [randomUUID(), randomUUID()],
    );
  });
}
