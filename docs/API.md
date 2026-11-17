# API reference

All endpoints are under `/api`. Requests and responses use JSON, except multipart file uploads and authorized downloads. Mutation requests require the same-origin `Origin` header. Authentication uses the HttpOnly `yc_session` cookie. Every protected operation checks permissions on the server.

Errors use `{ "error": "Useful message", "code": "ERROR_CODE", "requestId": "uuid" }`. Validation errors are HTTP 400; missing authentication 401; denied access 403; concealed/unavailable post details 404; unsupported methods 405; conflicts 409; oversized bodies 413; rate limits 429. No internal stack or database password is returned.

## Identity

| Method and path              | Body or result                                                                |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `POST /auth/signup`          | `{name,email,password}`; development-only email link when SMTP is absent      |
| `POST /auth/login`           | `{email,password,code?}`; returns `mfaRequired` without a session when needed |
| `POST /auth/demo`            | `{person:"ayla"\|"zara"\|"omar"\|"daniel"}`; only when demo is enabled        |
| `POST /auth/verify`          | `{token}`; single-use verification                                            |
| `POST /auth/forgot-password` | `{email}`; generic production response                                        |
| `POST /auth/reset-password`  | `{token,password}`; revokes prior sessions                                    |
| `POST /auth/onboarding`      | `{headline,interests}`                                                        |
| `POST /auth/logout`          | `{}`; revokes the current session                                             |
| `GET /me`, `GET /bootstrap`  | Current profile; bootstrap includes permitted contextual data                 |
| `GET /security/mfa`          | Enrollment status                                                             |
| `POST /security/mfa/enroll`  | `{}`; returns the enrollment key                                              |
| `POST /security/mfa/confirm` | `{code}`; returns recovery codes once                                         |
| `POST /security/mfa/disable` | `{password,code}`; revokes sessions                                           |

## Social

| Method and path                                                   | Purpose                                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /posts?mode=following&organization=id&cursor=timestamp%7Cid` | Feed; modes include `foryou`, `following`, `organizations`, `communities`, `saved` |
| `POST /posts`                                                     | Content, kind, audience, permitted scope IDs, uploaded media IDs, optional poll    |
| `GET /posts/:id`                                                  | Permission-checked post                                                            |
| `PATCH /posts/:id`, `DELETE /posts/:id`                           | Author edit; authorized removal                                                    |
| `POST /posts/:id/reaction`, `/save`                               | `{active:boolean}`                                                                 |
| `GET /posts/:id/comments`                                         | Threaded comments                                                                  |
| `POST /posts/:id/comments`                                        | `{content,parent_id?}`; parent must belong to the same post                        |
| `POST /posts/:id/vote`                                            | `{option:number}`                                                                  |
| `POST /posts/:id/report`                                          | `{reason}`                                                                         |
| `GET /profiles/:id`, `PATCH /profiles/:id`                        | Read permitted profile; update one’s own profile/privacy                           |
| `POST /profiles/:id/follow`, `/block`                             | `{active:boolean}`                                                                 |
| `GET /account/export`, `DELETE /account`                          | Export; delete after ownership transfer                                            |

## Spaces

| Method and path                                    | Purpose                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /organizations`, `POST /organizations`        | Discovery; request an organization                                         |
| `GET /organizations/:id`                           | Profile and permitted departments/channels                                 |
| `GET /organizations/:id/members`                   | Current members; organization membership required                          |
| `POST /organizations/:id/join`, `/leave`           | Request membership; leave unless owner                                     |
| `POST /organizations/:id/channels/:channelId/join` | Join an open organization channel                                          |
| `GET /communities`, `POST /communities`            | Discover/create a permitted community                                      |
| `GET /communities/:id`                             | Permitted community details                                                |
| `POST /communities/:id/join`                       | `{leave?:boolean}`                                                         |
| `GET /bridges`, `POST /bridges`                    | Scoped directory; propose with name, description, proposer and target IDs  |
| `POST /bridges/:id/approve`, `/reject`, `/close`   | Authorized review/revocation                                               |
| `GET /bridges/:id/members`                         | Scoped administrative participant list                                     |
| `POST /bridges/:id/members`                        | `{user_id,remove?:boolean}`; manages only one’s own organization’s members |

## Conversations

| Method and path                                       | Purpose                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `GET /conversations`, `POST /conversations`           | Unified inbox; create direct/group/channel with participants |
| `GET /conversations/:id?before=timestamp%7Cid&q=term` | Authorized history, participants, optional history search    |
| `POST /conversations/:id/messages`                    | `{client_id:uuid,content,reply_to?,attachment_id?}`          |
| `POST /conversations/:id/read`                        | Persist explicit read position                               |
| `POST /conversations/:id/preferences`                 | `{muted?,pinned?}`                                           |
| `POST /conversations/:id/participants`                | Add permitted participant as conversation administrator      |
| `POST /conversations/:id/report`                      | `{reason}`                                                   |
| `PATCH /messages/:id`                                 | `{content}` or `{emoji}`                                     |
| `DELETE /messages/:id`                                | Author deletion notice                                       |

Sockets authenticate using the same cookie. `message:send` takes the REST message fields plus `conversation_id` and returns `{ok,message}` or `{ok:false,error}` through an acknowledgment. `typing` takes `{conversation_id}` and is throttled. Server events are `ready`, `message`, `message-updated`, `typing`, `read`, and `notification`. Clients do not choose subscription room IDs.

## Discovery and administration

- `GET/POST /events`; `GET /events/:id`; `POST /events/:id/rsvp` with `{cancel?:boolean}`.
- `GET/POST /opportunities`; `GET /opportunities/:id`; `POST /opportunities/:id/save` or `/apply` (`{note}`).
- `GET /search?q=term`: grouped, permitted results. Queries shorter than two characters return no results.
- `GET /notifications`; `POST /notifications/:id`; `POST /notifications` with `{all:true}`.
- `POST /uploads`: multipart `file`; `GET /uploads/:id`: owner or permitted resource viewers only.
- `GET /admin/:organizationId`: scoped metrics, members, moderation, plans, billing, registrations, applications, and logs.
- `POST /admin/:organizationId/:action`: `membership`, `settings`, `department`, `moderate`, `trial`, `invoice`, `attendance`, `transfer`.
- `GET /platform`; `POST /platform/verify`, `/moderate`, `/reconcile`: platform administrators only, with production MFA enforcement.
- `GET /plans`; `GET /health`; `POST /contact`.

The feed uses 20-record cursor pages and messages use 40-record pages. Other initial directories have explicit bounded result limits, with broader directory pagination listed as remaining work.
