# FilmChatApp MVP Specification

**Status:** implementation source of truth for the first MVP  
**Scope:** private, mobile-first group chat whose durable output is a shared movie list

## 1. Product definition

### What it is

FilmChatApp is a private group chat for people deciding what to watch or sharing movies they like. Members converse normally, but a movie sent into the conversation becomes a durable, structured item in that group's movie list.

The interaction model should be immediately legible to a WhatsApp group-chat user: a chat list leads to a conversation, messages appear as familiar left/right bubbles, the composer is fixed at the bottom, group actions are in the header/overflow menu, and sharing uses the operating system's share sheet. This familiarity is about established mobile chat conventions—not WhatsApp branding, names, icons, artwork, or a pixel-for-pixel copy.

### Who it is for

Small, existing groups of friends, partners, families, or film clubs that already chat together and want to keep track of films mentioned or recommended.

### Problem

Movie recommendations in conventional chat get buried, are difficult to find later, and lack shared context such as who suggested them and how members rated them.

### Core mechanic

When a member selects a movie and sends it, the app creates both:

1. a movie-recommendation message in the chat timeline; and
2. a persistent group-movie record, visible in the group movie list.

The conversation may be long and transient to the user; the group-movie record is the durable shared object. Plain-text messages never become recommendations automatically in this MVP.

### Why it is more than a WhatsApp group

FilmChatApp preserves a searchable, group-specific movie history that is linked to the original recommendation messages, de-duplicates the same movie within a group, and lets every current member record a rating. It is not a general messaging app and should not try to compete with WhatsApp's broad communication feature set.

## 2. Scope, assumptions, and architecture decisions

### In scope

- Email/password account creation and sign-in.
- Create a private group; join it with a shareable invite link.
- Realtime group text chat.
- Search a third-party movie catalog and send a selected movie as a recommendation.
- Persistent group movie list, recommendation history, and per-member ratings/watch notes.

### Assumptions adopted for this specification

- The client is a mobile app; no web app or administrative console is required.
- A group has one owner initially. There are no moderator/admin tools beyond owner identity in this MVP.
- Invitation links do not expire by default and can be reused while active. This is an explicit default, not a future requirement for link management UI.
- Members may leave; they may rejoin using a valid invite. Leaving does not delete their previous messages, recommendations, or watch notes.
- A member's group-movie watch note is optional: 1–5 stars, a short written review, and/or a watched-on platform/medium. This is not a long-form review system.

### Recommended architecture

Use **React Native with Expo + TypeScript**, Firebase Authentication, Cloud Firestore, and Firebase Cloud Functions (2nd generation). This is a good MVP fit: React Native delivers iOS/Android from one codebase; Firestore supports offline-tolerant realtime listeners and simple group-scoped data; Firebase Auth and rules cover the private membership model.

Use a small server-side function for security-sensitive writes that must be atomic or need an API secret:

- create a recommendation message and its group-movie record transactionally;
- redeem an invite token and create/reactivate membership;
- proxy movie-search requests to keep the movie API key out of the client.

The client can write ordinary text messages directly under Firestore rules. The function boundary is deliberately narrow; it avoids a separate backend while preventing clients from forging catalog data, group aggregates, or arbitrary memberships.

**Alternative:** Supabase (Auth, Postgres, Realtime, Edge Functions) is viable if the team prefers SQL and relational reporting. It is not a compelling advantage for this small mobile-first MVP, so Firebase is the default. Do not introduce both.

## 3. MVP user journeys

### First launch and account creation

1. A signed-out user sees a concise welcome screen with Sign up and Sign in.
2. Sign up collects email, password, and display name. On successful Firebase Auth creation, the app creates the corresponding user document.
3. A signed-in user with no groups sees the empty Groups screen and a Create group action. The app must not force onboarding slides or profile completion.

### Creating a group

1. The user enters a required group name (1–60 visible characters).
2. The app creates the group, its active reusable invite, and an owner membership atomically.
3. The user lands in the new group's Chat tab. A share action exposes the invite link.

### Inviting and joining

1. A member shares the group invite link using the device share sheet.
2. Opening a valid link launches the app (or a minimal landing/deep-link flow), requires sign-in/sign-up if necessary, and shows the group name plus Join group.
3. Tapping Join creates or reactivates membership and opens that group's chat. Redeeming again is idempotent: an active member enters directly, with no duplicate membership.

### Chatting and recommending

1. An active member opens a group and sends plain text. It appears to all current members in chronological order.
2. The member taps the movie action, searches, selects a result, optionally adds a short note, and sends.
3. The chat receives a movie card. The selected movie becomes available immediately in the group's Movies tab.
4. Tapping a movie card opens the group-movie detail/list context, not an unrelated global movie page.

### Persistent list and watch notes

1. In the group Movies tab, members see each distinct movie recommended to that group, newest first by its most recent recommendation.
2. A movie detail shows catalog metadata, recommendation count/history, the original recommenders, and rating summary.
3. A member can set, change, or remove their own rating, short review, and watched-on platform/medium. The app updates the visible aggregate shortly after a successful write.

### Repeat recommendations

When the same catalog movie is recommended again in the same group, create a new recommendation chat message/history entry but do **not** create a second group-movie item. Increment its recommendation count and move that item to the top of the Movies list. The card should state that it was previously recommended and display the count where practical.

## 4. Functional requirements

### Accounts

- Support email/password sign-up, sign-in, sign-out, and Firebase's normal password-reset flow.
- Display name is required at sign-up and immutable in this MVP. It is copied into message/recommendation author snapshots for resilient display.
- Do not build social profiles, contact discovery, or account deletion UI.

### Groups and membership

- Any authenticated user can create a group. Group names are not globally unique.
- Only active members can see a group in their group list, read its content, post, recommend, or rate.
- Group membership must be checked from server-authoritative membership data, never trusted from a client-supplied `memberIds` array.
- The owner may leave in this MVP; ownership remains historical and no transfer logic is required. The group remains usable for other active members.
- An active member can leave a group from group settings, after a confirmation. It disappears from their group list and access is removed immediately.
- No member management, kicking, renaming, group deletion, or invite revocation UI is required in the MVP.

### Invites

- An invite contains a high-entropy opaque token and points to exactly one group.
- An active invite may be redeemed by any authenticated user possessing its link. This is the intentional trust model for private groups.
- Invalid, disabled, expired, or deleted-group links show a clear unavailable state and never reveal group messages or member data.
- Store only a token hash in Firestore; a Cloud Function validates the raw token.

### Messages

- Supported message types: `text` and `movie_recommendation` only.
- Text is required after trim, maximum 2,000 characters, and sent exactly as text (no URLs, mentions, attachments, reactions, replies, edits, or deletes).
- A movie recommendation has required movie data and may have an optional accompanying note up to 500 characters. The note is not a separate text message.
- The sender sees a local pending state; on success it receives the server timestamp. On failure it remains visibly retryable and is not silently lost.

### Movies and ratings/watch notes

- Search returns catalog results and must have debouncing (about 300 ms), loading, empty, and retry states.
- Only a result selected from the server-proxied catalog search can be recommended. Free-form movie creation is out of scope.
- Any active member may create one watch note per persistent group movie. It has an optional 1–5-star rating, optional review text of up to 1,000 characters, and optional watched-on platform/medium of up to 80 characters.
- At least one of rating, review text, or watched-on platform/medium is required to save a watch note. This lets someone record where they watched without being forced to score or review it.
- A member may update or remove only their own watch note. Removing it removes all of its fields.
- Platform/medium is free text for the MVP (for example: “Netflix”, “Blu-ray”, “Cinema”, or “Downloaded”). Do not maintain a streaming-provider catalog or validate availability.
- The app displays total rating count and average rating rounded to one decimal; do not display a rating average when count is zero.

## 5. Information architecture and screens

Bottom-level navigation is intentionally small:

```text
Authentication
  Welcome -> Sign up / Sign in -> Groups

Groups (list)
  -> Create group -> Group chat
  -> Invite deep link -> Join confirmation -> Group chat
  -> Group
       Chat tab <-> Movies tab
       Chat -> Movie search -> Selected movie composer -> Chat
       Chat/Movie list -> Group-movie detail
       Group settings -> Leave group / Share invite
```

Minimum screens/views:

| View                    | Required content/actions                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Welcome/authentication  | Sign in, sign up, reset-password entry point.                                                                   |
| Groups                  | Active groups ordered by latest activity; create action; empty state.                                           |
| Create group            | Group name, validation, Create.                                                                                 |
| Group chat              | Header (name, share/settings), chronological messages, composer, movie action, Chat/Movies switch.              |
| Movie search            | Search field, catalog result list, loading/empty/error states.                                                  |
| Recommendation composer | Selected movie summary, optional note, Send recommendation. May be a modal/sheet.                               |
| Group movies            | Distinct persistent movies, recommendation count, rating summary, newest/recently-recommended sort.             |
| Group-movie detail      | Metadata, aggregate, recommendation history, member watch-note editor, and compact member review/platform feed. |
| Invite join/unavailable | Group name and Join, or safe invalid-link explanation.                                                          |
| Group settings          | Share invite and Leave group only.                                                                              |

### Familiar chat interaction conventions

Use these conventions unless they conflict with the durable-recommendation mechanic:

- The Groups screen resembles a conventional chat inbox: each row has a group avatar/initial, group name, last-activity preview, and relative timestamp. Tapping the row opens that group; creating a group is a prominent floating or header action.
- The group header has a back affordance, group name, and an overflow menu. The menu contains **Group info/settings**, **Share invite**, and **Leave group**. Do not hide routine actions behind unfamiliar gestures.
- The conversation uses outgoing messages aligned to the sender's side and incoming messages aligned opposite, clear bubbles/cards, author names for incoming group messages, timestamps, date separators, and a fixed bottom composer. Colors, typography, iconography, and layout must be original rather than copied from WhatsApp.
- The composer contains a text field, send affordance that becomes active only for valid text, and a clearly labelled movie action. Tapping the movie action opens search; it should not require a slash command or novel chat syntax.
- Movie recommendation cards belong naturally in the same chronological stream as messages. Their added persistence is explained in plain language such as “Saved to this group’s movies”; the card is visibly tappable.
- The group-level **Movies** view is a clearly named tab/segmented control next to **Chat**. It is the single purposeful departure from a normal chat: users can always find the durable result of the conversation without searching message history.
- Use native confirmation patterns for leaving and native share sheets for invitations. Support standard back navigation and platform-safe areas; do not require custom gesture discovery.

## 6. Chat behavior

- A chat is scoped to one group. It is accessible only by that group's active members.
- Each message has a stable ID, type, author ID/display-name snapshot, payload, `createdAt` server timestamp, and a client-generated idempotency key.
- Order messages by `createdAt` ascending in the UI. Paginate older messages (initial page 50; load 50 more). Tie-break equal timestamps by document ID ascending. Show date separators in the user's locale and a lightweight sent time on each bubble/card.
- Subscribe in realtime to the newest page while the chat is open. When a newer message arrives, append it; preserve a user's reading position rather than forcibly jumping them to the bottom. Offer a “new messages” affordance if they have scrolled away.
- On send, render an optimistic pending message using the idempotency key. A retry must reuse that key so duplicate taps cannot create duplicate logical sends.
- Firestore server timestamps are authoritative. Messages with a pending timestamp are placed near the bottom locally; the final server ordering replaces it on acknowledgement.
- Render text as plain text. Escape/safely render all user content; do not support HTML.
- A recommendation card includes poster (or placeholder), title, release year when known, sender, send time, optional note, and a clear indicator that it was saved to the group list. It links to its group-movie detail.
- The visual treatment distinguishes a movie card from a text bubble through original card styling and poster imagery, while retaining familiar chat affordances: incoming/outgoing alignment, sender name where applicable, time, tap target, and chronological placement.
- A `movie_recommendation` must be created only by the recommendation Cloud Function. That function atomically creates the message/history and updates the persistent group-movie record. A failed transaction must yield neither a durable list change nor a visible sent recommendation.
- A user who leaves can no longer load chat history or receive live updates. Their historic messages remain for remaining members, labelled with their stored author snapshot.
- Watch notes are not chat messages and do not create chat activity. They are shown only in the associated group-movie detail.

## 7. Movie/recommendation model

These are distinct entities because they have different lifetimes and scopes:

| Entity                  | Scope and purpose                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Movie**               | A normalized external-catalog identity and a small metadata snapshot: e.g. TMDb movie ID, title, year, poster path. It is not social content.                    |
| **Recommendation post** | A specific act of sending a movie into one group's chat: author, time, optional note, and its message ID. Several can exist for the same movie/group.            |
| **Group movie**         | The durable, unique association of one catalog movie with one group. It aggregates recommendation history/count, rating summary, and list ordering.              |
| **User watch note**     | One member's optional 1–5-star rating, short review, and watched-on platform/medium for one group movie. It is group-scoped: it does not carry to another group. |

Use TMDb's numeric movie ID as `externalMovieId`. A group movie is unique by `(groupId, provider, externalMovieId)`; use a deterministic, safely encoded document ID such as `tmdb_<id>` beneath the group. A global movie cache is optional and must never be the source of group authorization or state.

## 8. Firebase data model

Use Firestore server timestamps (`createdAt`, `updatedAt`) and store all timestamp fields as Firestore `Timestamp`, not device time. The proposed denormalization supports direct group-scoped queries and must be maintained only by trusted functions where noted.

```text
users/{uid}
  displayName: string
  email: string                 // only if required for product display; never expose to other users
  createdAt: Timestamp

groups/{groupId}
  name: string
  ownerId: uid
  createdAt, updatedAt: Timestamp
  lastActivityAt: Timestamp
  lastActivityPreview: string   // bounded/sanitized; text or “recommended <title>”
  deletedAt: Timestamp | null   // internal soft-delete only; no deletion UI

groups/{groupId}/members/{uid}
  userId: uid
  displayNameSnapshot: string
  role: "owner" | "member"
  status: "active" | "left"
  joinedAt: Timestamp
  leftAt: Timestamp | null
  updatedAt: Timestamp

groups/{groupId}/messages/{messageId}
  type: "text" | "movie_recommendation"
  authorId: uid
  authorDisplayNameSnapshot: string
  text: string | null                    // text body or optional recommendation note
  createdAt: Timestamp
  clientRequestId: string                // unique per sender operation
  movie: {                            // present only for movie_recommendation
    provider: "tmdb"
    externalMovieId: string
    title: string
    releaseYear: number | null
    posterPath: string | null
    overview: string | null            // bounded snapshot; may be omitted in card list
  } | null
  groupMovieId: string | null

groups/{groupId}/groupMovies/{groupMovieId}
  provider: "tmdb"
  externalMovieId: string
  title: string
  releaseYear: number | null
  posterPath: string | null
  overview: string | null
  firstRecommendedAt, lastRecommendedAt: Timestamp
  firstRecommendationMessageId: string
  recommendationCount: number
  recommenderIds: string[]              // cap at 100; use history for full detail
  ratingCount: number
  ratingSum: number
  ratingAverage: number | null
  updatedAt: Timestamp

groups/{groupId}/groupMovies/{groupMovieId}/recommendations/{messageId}
  messageId: string
  authorId: uid
  authorDisplayNameSnapshot: string
  note: string | null
  createdAt: Timestamp

groups/{groupId}/groupMovies/{groupMovieId}/watchNotes/{uid}
  userId: uid
  value: 1 | 2 | 3 | 4 | 5 | null
  reviewText: string | null             // max 1,000 characters
  watchedOn: string | null               // max 80 characters; free text
  createdAt, updatedAt: Timestamp
```

`groups/{groupId}/members/{uid}` is the authorization source. The Groups list should be built from a member-scoped index for efficient querying, for example `users/{uid}/groupRefs/{groupId}` with group name and last activity copied by Cloud Functions. If retaining that extra index complicates early work, initially query active memberships via a Firestore collection-group query with an appropriate index, then fetch group summaries; implement the user-scoped index when it becomes necessary for UX/performance.

Required indexes include: messages by `createdAt`; groupMovies by `lastRecommendedAt` descending; recommendation history by `createdAt`; and membership collection-group lookup by `userId, status` if used.

### Write invariants

- Recommendation function transaction: validate active membership and catalog response; use `(groupId, uid, clientRequestId)` idempotency; create/return one message; upsert `groupMovies/tmdb_<id>`; create matching recommendation-history document; update group activity.
- Watch-note function transaction: validate active membership, review/platform bounds, and that at least one field exists; compare any prior numeric rating; create/update/delete that user's watch-note document; adjust `ratingCount` and `ratingSum` only when the numeric rating changes; recalculate `ratingAverage`.
- Join function transaction: validate invite hash/status/group; create or reactivate exactly one membership and group reference.

## 9. Security and authorization model

Firebase Authentication is mandatory for all app data access. Enforce the following in Firestore Security Rules and duplicate critical checks in Cloud Functions:

| Resource/action                                                         | Authorization                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Read group, messages, group movies, recommendation history, watch notes | Active group member only.                                                                                                       |
| Create text message                                                     | Active group member; only own author ID; only `text` type; validate length/schema.                                              |
| Create movie recommendation or alter group-movie aggregate/history      | Cloud Function/service account only.                                                                                            |
| Read/write own watch note                                               | Active group member; all mutations go through the watch-note function so rating aggregates stay correct.                        |
| Create group                                                            | Authenticated user via function or a tightly validated client write plus membership creation. Prefer function for atomic setup. |
| Join group                                                              | Redeem-invite Cloud Function only.                                                                                              |
| Leave group                                                             | Active member can mark only their own membership `left`; preferably a function also removes their group reference.              |
| Read invite records                                                     | Service account only.                                                                                                           |

Never expose movie provider keys in a mobile bundle. Never rely on UI hiding for privacy. Validate maximum lengths, enumerated message types, numeric rating bounds, review/platform bounds, and immutable author identity server-side. Do not store users' emails in group-visible documents.

## 10. Movie data source

Use **The Movie Database (TMDb) API** through a Firebase Callable/HTTP Function. It has broad film coverage, search, poster paths, and simple enough data for an MVP. Review its current API terms, attribution, image URL construction, rate limits, and production-key requirements before launch; display any required attribution in an About/settings surface.

Required catalog fields only:

- provider and external ID;
- title;
- release year (nullable);
- poster path/URL source (nullable);
- short overview (nullable).

Do not ingest full cast, streaming availability, trailers, genres, or a local full-catalog mirror. Cache selected-result metadata in the recommendation/message records so historic cards still render during temporary provider failures. Use a neutral generated placeholder when a poster is absent or fails to load.

## 11. Edge cases and required handling

| Situation                                       | Required behavior                                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same movie recommended repeatedly               | One group movie; many chat/history posts; atomic count/list update.                                                                                               |
| Two members recommend same movie simultaneously | Transaction retries produce one group movie and two distinct recommendation posts; count becomes two.                                                             |
| Duplicate tap/network retry                     | Idempotency key returns the original outcome; no duplicate message/watch note.                                                                                    |
| Member leaves and rejoins                       | Prior content remains; membership is reactivated; user regains access and their prior watch note remains unless product later chooses otherwise.                  |
| Invalid/expired/disabled invite                 | Safe unavailable screen; no protected details exposed.                                                                                                            |
| Invite used after group soft deletion           | Reject as unavailable.                                                                                                                                            |
| Deleted/disabled user                           | Preserve author snapshot on historic content; prohibit access/writes. A deletion workflow must remove or restrict the auth account separately from this MVP.      |
| Deleted group                                   | Soft-delete and deny all member access; hide it from group lists; retain data only according to the future retention policy.                                      |
| Simultaneous text messages                      | Server timestamp ordering plus document-ID tie-break; neither message is overwritten.                                                                             |
| Rating/review/platform changed or removed       | Exactly one watch-note document per `(group movie, user)`; only numeric-rating changes affect the aggregate, atomically.                                          |
| Movie search/API failure                        | Preserve query; show retry/error; user cannot send an unverified catalog movie.                                                                                   |
| Missing/changed movie metadata or poster        | Render cached title/year and placeholder poster; never break a chat row.                                                                                          |
| Device offline                                  | Firestore may show cached content/pending text; clearly keep sends pending until acknowledged. Movie search/recommendation and invite redemption require network. |

## 12. Non-functional requirements

- **Performance:** initial group list and current chat page should feel usable on a typical mid-range phone and ordinary 4G connection; target a first useful render under 3 seconds after authenticated app launch with warm Firebase state. Paginate chat/history; do not load all messages at once.
- **Realtime:** new messages, recommendation cards, and rating summaries should normally propagate to online members within a few seconds. Reconnect listeners after app foreground/network recovery.
- **Security:** all private data—including group-visible review text and watched-on platforms—requires authentication and active membership; secrets live only in function configuration; rules are tested with the Firebase Emulator Suite.
- **Reliability:** server timestamps, transactions, and idempotency protect durable actions against retries/concurrency. Show actionable failures instead of pretending a write succeeded.
- **Maintainability:** TypeScript strict mode; centralized typed data access; feature-oriented modules; Firebase emulator configuration; no premature repository/service abstraction that conceals Firestore semantics.
- **Observability:** log function failures with correlation/request IDs and report client crashes/errors using a lightweight approved tool before a real beta. Do not build analytics dashboards for the MVP.

## 13. Testing strategy

### Unit tests

- Input validation (group names, message lengths, rating values, review/platform limits).
- Deterministic group-movie IDs and metadata mapping from TMDb responses.
- Watch-note aggregate transitions: new numeric rating, replace, clear numeric rating, and remove.
- Date/order and duplicate-recommendation presentation helpers.

### Integration tests (Firebase Emulator + mocked TMDb)

- Authentication and rules: non-members cannot read/write; active members can do only permitted operations.
- Create group atomically creates owner membership/invite.
- Invite redemption is valid, invalid, idempotent, and reactivates left membership.
- Recommendation transaction creates one message/history/group movie; concurrent duplicate-movie operations preserve the correct count.
- Watch-note transaction prevents forged user IDs, protects review/platform bounds, and maintains aggregate under updates.
- Leaving removes access while historical content remains visible to other members.

### End-to-end tests

- New account creates a group, shares/opens invite, second account joins, both exchange realtime text.
- A member searches, recommends, sees the card in chat and one item in Movies, then another member recommends it again and sees count/history update.
- A member records a rating, review, and watched-on medium; changes them, then removes the watch note; the aggregate is correct.
- Invalid invite and movie-search failure show recoverable states.

Run the core emulator integration suite in CI. Run E2E on at least one Android emulator before each MVP release; add iOS simulator coverage when the build pipeline is available.

## 14. Implementation phases

Each phase should ship with its tests before starting the next.

1. **Foundation:** Expo/React Native TypeScript app, navigation, Firebase environments/emulator setup, auth screens and user document lifecycle.
2. **Groups:** create-group function, membership/group list query, conventional chat-inbox row design, group shell/header/overflow menu, shareable deep-link plumbing, invite redemption.
3. **Text chat:** Firestore rules, realtime paginated message list, familiar bubble/composer interaction, optimistic/retry behavior, leave action.
4. **Movie catalog:** server-side TMDb search proxy, search/selection UI, placeholder/error states.
5. **Persistent recommendation mechanic:** transaction/function, movie cards, group movie list/detail, repeat recommendation history/count.
6. **Watch notes and hardening:** rating/review/platform transaction and UI, rules/emulator tests, edge-case states, performance pass, release configuration.

Avoid beginning a later phase by faking the durable model in client state; the recommendation transaction is the product's integrity boundary.

## 15. Explicit non-goals

Do not build any of the following in this MVP:

- AI or algorithmic recommendations, personalized feeds, or matching.
- Push notifications, read receipts, typing indicators, presence, reactions, replies, mentions, message edits/deletes, attachments, voice/video calls, or general file sharing.
- Public groups, user search, profiles, follows, contact import, or social graph.
- Long-form/multi-section reviews, watchlists/statuses, complex rating algorithms, charts, badges, or leaderboards.
- Streaming availability, trailers, cast/crew exploration, full movie-detail pages, or catalog synchronization.
- Group roles/moderation, invite management/revocation UI, group renaming/deletion UI, or ownership transfer.
- Offline-first guarantees, payments, ads, subscriptions, localization beyond device formatting, or a web client.
- A visual or behavioral clone of WhatsApp, including its name, logos, artwork, or distinctive branded assets.

## 16. Open questions and proposed defaults

| Decision needed                   | Why it matters                                                                   | Proposed MVP default                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication methods            | Changes onboarding and security surface.                                         | Email/password only; add Apple/Google only after validating sign-up friction.                                                                            |
| Invite revocation/expiry          | A reusable link can be forwarded indefinitely.                                   | No expiry/revocation UI; active reusable link, with data model status/expiry ready for later.                                                            |
| Who can invite                    | Affects privacy expectations.                                                    | Every active member can share the one group link.                                                                                                        |
| Owner departure                   | A group needs continuity rules later.                                            | Permit departure; no privileged owner operations exist, so no transfer needed.                                                                           |
| Watch-note visibility             | Individual ratings, reviews, and watched-on platforms can be socially sensitive. | Show active members' named watch notes in the group-movie detail, including any rating they chose to add; show only the aggregate in list rows and chat. |
| Recommendations after leaving     | Determines whether history is personal or group-owned.                           | History and watch notes remain group-owned and reappear on rejoin.                                                                                       |
| Group size limit                  | Affects costs/query constraints and the product's intimacy.                      | Enforce no hard UI limit initially; document intended small-group use and revisit before public launch.                                                  |
| Movie provider/legal requirements | TMDb rules can change.                                                           | Validate current terms/attribution during implementation; isolate provider adapter so it can be replaced.                                                |
| Data retention/account deletion   | Required before public launch in many jurisdictions.                             | Treat as launch-policy work; MVP preserves group history and has no self-service deletion UI.                                                            |

## 17. Acceptance criteria

The MVP is complete when all of the following are demonstrably true:

1. A new user can sign up, create a named private group, and immediately enter its chat.
2. The creator can share a link; a second authenticated user opening a valid link can join exactly once and then see the same chat.
3. Active group members see new text messages from each other without manually refreshing, with correct author and timestamp ordering.
4. A non-member cannot obtain group messages, movies, watch notes, or membership data by navigating to known Firestore paths or group IDs.
5. An active member can search a real movie catalog, select a result, add an optional note, and send one movie card into the chat.
6. That send creates a durable group-movie item visible in the Movies tab and links the card to it.
7. Recommending the same catalog movie again creates a second chat/history post while leaving exactly one persistent group-movie item whose count and recency are updated.
8. Two members can recommend the same movie concurrently without data loss, duplicate group-movie entries, or incorrect count.
9. Each active member can set, change, and remove one watch note for a group movie, containing any combination of a 1–5-star rating, a short review, and watched-on platform/medium; the displayed rating count/average remain correct.
10. Leaving a group immediately removes the leaver's ability to view or send group content, while remaining members retain historic content; rejoining through a valid link restores access.
11. Invalid invites, unavailable movie search, missing posters, and failed sends all show understandable recovery states and do not corrupt durable group data.
12. Firebase rules and core transaction behavior pass emulator integration tests, and the principal two-user flow passes an end-to-end mobile test.
