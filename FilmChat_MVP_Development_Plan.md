# FilmChatApp MVP Development Plan

**Status:** Stage 0 complete\
**Purpose:** Implementation roadmap for reaching the first functional
MVP\
**Product:** Private, mobile-first group chat whose durable output is a
shared movie list

------------------------------------------------------------------------

## Development philosophy

Each stage should produce a concrete, testable product milestone. A
later stage should not fake or bypass the durable data model of an
earlier stage.

The development loop should be:

1.  Implement the stage.
2.  Add and run its automated tests.
3.  Manually verify the stage's exit criterion.
4.  Only then begin the next stage.

This structure is particularly appropriate for agentic development with
Codex because every stage has a clear boundary, a limited blast radius,
and a demonstrable outcome.

------------------------------------------------------------------------

# Stage 0 --- Development Foundation

**Status: DONE**

### Completed

-   Expo + React Native + TypeScript
-   Firebase SDK
-   Firebase Authentication emulator
-   Firestore emulator
-   Firebase Functions emulator
-   Android Virtual Device
-   AsyncStorage-based Firebase Auth persistence
-   Emulator-only development configuration
-   Initial Firestore rules/test infrastructure
-   End-to-end Firebase smoke test
-   Git/dependency baseline

### Verified

The complete local chain works:

``` text
Android emulator
    ↓
Expo / React Native
    ↓
Firebase SDK
    ├── Auth → Auth emulator
    └── Firestore → Firestore emulator
```

### Exit criterion

The app communicates successfully with local Firebase Auth and Firestore
without requiring production Firebase resources.

------------------------------------------------------------------------

# Stage 1 --- Authentication + Groups

Build the first actual FilmChat functionality.

## Features

-   Welcome screen
-   Sign up
-   Sign in
-   Sign out
-   Password reset
-   User document creation
-   Groups screen
-   Create group
-   Owner membership
-   Group list
-   Basic group shell/header
-   Navigation from Groups to Group

Do not build the chat yet.

## Tests

-   Authentication lifecycle
-   User document creation
-   Group creation
-   Owner membership
-   User sees only their own groups
-   Unauthenticated access is rejected by rules

## Exit criterion

> A user can create an account, create a group, and enter that group's
> shell. A second user cannot see the group yet.

------------------------------------------------------------------------

# Stage 2 --- Invitations + Membership

Give invitations their own stage because the invite system is
security-sensitive and has a Cloud Function boundary.

## Features

-   Generate reusable invite
-   Native share sheet
-   Deep-link handling
-   Open invite while signed out
-   Sign in/sign up and return to invite
-   Join confirmation
-   Join group
-   Idempotent invite redemption
-   Leave group
-   Rejoin group
-   Invalid/unavailable invite screen

## Tests

-   Valid invite
-   Invalid invite
-   Duplicate redemption
-   Leave → rejoin
-   Non-member cannot access group
-   Invite does not expose protected group data
-   Leaving immediately removes access

## Exit criterion

> Two independent accounts can join the same private group through a
> real shared invite link.

------------------------------------------------------------------------

# Stage 3 --- Text Chat

Build the conventional chat experience before introducing movies.

## Features

-   Message collection
-   Firestore security rules
-   Realtime listener
-   Pagination
-   Message bubbles
-   Author snapshots
-   Timestamps
-   Date separators
-   Composer
-   Optimistic send
-   Retry failed send
-   Reading-position behavior
-   Leave-group behavior

Do not introduce TMDb or movie recommendations yet.

## Tests

-   Active member can read
-   Active member can send
-   Non-member cannot read or send
-   User cannot forge another author
-   Two users receive messages in realtime
-   Pagination works
-   Failed sends remain retryable
-   Leaving removes access
-   Historic messages remain for remaining members

## Exit criterion

> Two users/accounts can have a normal, reliable private group
> conversation.

This is the first genuinely usable version of the app.

------------------------------------------------------------------------

# Stage 4 --- Movie Search + First Recommendation

Introduce the distinctive FilmChat mechanic.

Combine catalog search with the first recommendation flow so the stage
produces a complete vertical slice.

## Features

-   Cloud Function TMDb proxy
-   Search input
-   Search debouncing
-   Loading state
-   Empty state
-   Error/retry state
-   Search result list
-   Movie selection
-   Optional recommendation note
-   Recommendation composer
-   Movie recommendation Cloud Function
-   Movie recommendation card in chat

At this stage, do not build the complete persistent Movies tab yet.

The first complete flow is:

``` text
Search
  ↓
Select movie
  ↓
Optional note
  ↓
Send recommendation
  ↓
Movie card appears in chat
```

## Tests

-   Search proxy
-   TMDb/API failure
-   Free-form/invalid movie cannot be sent
-   Active member can recommend
-   Non-member cannot recommend
-   Recommendation creates the correct message
-   Recommendation retry is idempotent

## Exit criterion

> A user can search for a real movie, recommend it, and another group
> member sees it as a movie card in the conversation.

------------------------------------------------------------------------

# Stage 5 --- Persistent Movies + Recommendation History

This is where FilmChat becomes more than a chat app.

## Features

-   `groupMovies`
-   Persistent movie records
-   Deduplication
-   Recommendation history
-   Recommendation count
-   First/last recommendation timestamps
-   Recommender information
-   Movies tab
-   Movie list
-   Movie detail
-   Link recommendation cards to movie detail
-   Repeat recommendation behavior
-   Concurrent recommendation handling

The fundamental relationship is:

``` text
Movie recommendation
        ↓
   Chat message
        ↓
   Group movie
        ↓
Recommendation history
```

When the same movie is recommended again:

``` text
Same movie again
        ↓
New chat message
        ↓
Same persistent group movie
        ↓
Count +1
        ↓
Moves to top
```

## Critical integrity requirement

Two members recommending the same movie simultaneously must result in:

-   Two recommendation/chat history entries
-   One persistent group-movie record
-   Correct recommendation count
-   Correct ordering

## Tests

-   First recommendation creates group movie
-   Repeat recommendation reuses group movie
-   Recommendation history is preserved
-   Count increments correctly
-   List ordering updates
-   Concurrent recommendations do not create duplicate group movies
-   Recommendation transaction is atomic
-   Idempotent retry does not duplicate the recommendation

## Exit criterion

> Two people can recommend the same film and FilmChat produces two
> conversational recommendations but exactly one persistent movie in the
> group's Movies list.

This is a major product milestone.

------------------------------------------------------------------------

# Stage 6 --- Watch Notes: Rating + Review + Platform

Use the product's `watch note` terminology for the member-specific movie
feedback.

Each active member gets one watch note per group movie:

``` text
watchNote
├── rating       1–5, optional
├── reviewText   optional
└── watchedOn    optional
```

At least one field is required when saving.

## Features

-   Watch-note editor
-   1--5 star rating
-   Short review
-   Platform/medium
-   Save
-   Edit
-   Remove
-   Member review feed
-   Rating count
-   Rating average
-   Correct aggregate updates
-   One-decimal average display

The platform/medium remains free text in the MVP.

Examples:

-   Netflix
-   Blu-ray
-   Cinema
-   Downloaded

Do not build a streaming-provider catalog.

## Tests

Test the aggregate transitions explicitly:

``` text
No rating → rating
Rating → different rating
Rating → no rating
No rating → no rating
Review only
Platform only
Rating + review + platform
Remove entire note
Multiple members updating
```

Also test:

-   Only the owner of a watch note can modify it
-   Forged user IDs are rejected
-   Review length limits
-   Platform length limits
-   Rating bounds
-   At least one field is required
-   Aggregate count remains correct
-   Aggregate sum remains correct
-   Average remains correct after updates/removal

## Exit criterion

> The complete recommendation → movie → member rating/review → aggregate
> flow works correctly.

At this point the functional MVP is complete.

------------------------------------------------------------------------

# Stage 7 --- Hardening, Polish + Release Readiness

This stage is product completion rather than new feature work.

## UX hardening

-   Empty states
-   Loading states
-   Error states
-   Retry states
-   Invite unavailable state
-   Invalid deep-link handling
-   Movie-search failure
-   Missing poster handling
-   Message-send failure
-   Optimistic-send edge cases
-   Leave confirmation
-   Keyboard/safe-area behavior
-   Standard back navigation

## Security hardening

-   Complete Firestore rules
-   Emulator rule coverage
-   Function authorization
-   Forged UID attempts
-   Forged group/movie IDs
-   Membership edge cases
-   Invite security
-   Provider API key isolation

## Device testing

-   Android emulator
-   Physical Android device over LAN
-   Network interruption/reconnection
-   App background/foreground
-   Two simultaneous users

## Performance

-   Chat pagination
-   Realtime listener behavior
-   Movie-list queries
-   Group-list queries
-   Unnecessary Firestore reads
-   Image loading

## Release preparation

-   Production Firebase configuration
-   Production Firestore rules
-   TMDb terms and attribution verification
-   Error/crash reporting
-   App icon/name/version
-   Android production build
-   Final end-to-end smoke test

## Exit criterion

The complete principal user journey works reliably:

``` text
Create account
    ↓
Create group
    ↓
Share invite
    ↓
Second user joins
    ↓
Realtime chat
    ↓
Search movie
    ↓
Recommend movie
    ↓
Persistent Movies list
    ↓
Repeat recommendation
    ↓
Rating / review / platform
    ↓
Correct aggregate
    ↓
Leave / rejoin
```

------------------------------------------------------------------------

# Roadmap at a glance

  Stage   Product milestone                            Status
  ------- -------------------------------------------- ----------
  0       Development foundation                       **DONE**
  1       Authentication + Groups                      Next
  2       Invitations + Membership                     
  3       Text Chat                                    
  4       Movie Search + First Recommendation          
  5       Persistent Movies + Recommendation History   
  6       Watch Notes + Ratings                        
  7       Hardening + Release                          

------------------------------------------------------------------------

# Why this sequencing

The stages deliberately move from generic infrastructure toward the
unique FilmChat mechanic:

``` text
1. I can create a group.
             ↓
2. I can invite someone into it.
             ↓
3. We can actually chat.
             ↓
4. I can recommend a movie.
             ↓
5. Recommendations become a permanent shared movie list.
             ↓
6. We can rate and review what we watched.
             ↓
7. The app behaves like a finished product.
```

This creates a useful development rhythm for agentic coding: every stage
is independently testable and produces something concrete that can be
manually demonstrated.

The durable recommendation model should not be faked or deferred behind
client-only state. The recommendation transaction is a core product
integrity boundary.

------------------------------------------------------------------------

# MVP scope discipline

Do not expand the roadmap with the following during MVP development:

-   AI or algorithmic recommendations
-   Personalized feeds
-   Push notifications
-   Read receipts
-   Typing indicators
-   Presence
-   Reactions
-   Replies
-   Mentions
-   Message editing/deletion
-   Attachments
-   Voice/video calls
-   Public groups
-   User discovery
-   Profiles/social graph
-   Streaming availability
-   Trailers
-   Cast/crew exploration
-   Full movie-detail pages
-   Complex rating algorithms
-   Charts, badges, or leaderboards
-   Group moderation
-   Invite management/revocation UI
-   Group renaming/deletion UI
-   Ownership transfer
-   Payments
-   Ads
-   Web client
-   Pixel-perfect WhatsApp cloning

The goal is a small, coherent product:

> **A private group chat in which movie recommendations become a
> persistent, shared movie history with member ratings and reviews.**
