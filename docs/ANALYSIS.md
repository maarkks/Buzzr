# Competitive Analysis: JeopardyLabs.com

*Prepared as the foundation for the Buzzr PRD — June 2026*

## 1. What JeopardyLabs is

JeopardyLabs is a long-running web tool that lets anyone build a Jeopardy!-style
quiz board online "without PowerPoint" and present it from a browser. It is a
staple in classrooms: teachers build a board of categories × point values, put
it on a projector, click squares to reveal questions, and award points by
clicking +/− buttons while students shout out or raise hands to "buzz in".

## 2. Core product facts

| Aspect | JeopardyLabs |
| --- | --- |
| Account required | No — create instantly, protect with a password |
| Game creation | Form-based grid editor (categories × clues) |
| Content library | Millions of public, searchable, pre-made boards |
| Gameplay | One shared screen; host clicks squares; manual +/− scoring for up to 12 teams |
| Buzzing | Physical — shout your name / raise your hand |
| Pricing | Free core; **$20 one-time** for premium |
| Premium gates | Editing saved games, images/equations/video in clues, private games, more questions, template management |
| Platform | Browser-based, works offline if downloaded |

## 3. What it does brilliantly (keep these)

1. **Zero-friction creation.** No signup, no install — a board exists in
   minutes. This is the single biggest reason for its adoption and must be
   preserved at all costs.
2. **The format itself.** The Jeopardy board is a perfect review-game
   structure: self-pacing, point-tiered difficulty, team-friendly.
3. **A huge reusable library.** Teachers rarely start from scratch; search and
   clone is the dominant flow.
4. **Simplicity under pressure.** A host running a class of 30 kids needs big
   buttons and an obvious flow; JeopardyLabs delivers that.

## 4. Where it falls short (our openings)

1. **No real multiplayer.** Everything happens on one screen. There is no
   notion of a "room", no participant devices, no real buzzer — fairness
   disputes ("I said it first!") are constant.
2. **Manual scorekeeping.** The host clicks +/− under team labels. It is
   error-prone and pulls the host's attention away from hosting.
3. **Dated UI/UX.** The visual design is functional but ancient; clue
   reveal/board interactions have little of the game-show energy that makes
   the format fun.
4. **Paywalled fundamentals.** You cannot *edit your own game* on the free
   tier, and media in clues is premium. Reviews consistently flag this.
5. **No participant identity.** No player names, avatars, leaderboards, or
   per-player stats — nothing for students to feel ownership over.
6. **No Daily Doubles / wagering / Final round mechanics** as first-class,
   automated features — the drama of the real show is missing.
7. **No host/presenter split.** The host sees exactly what the audience sees,
   so reading answers means peeking at notes or memorizing them.

## 5. Adjacent competitors

- **Kahoot/Blooket/Gimkit** — phone-first quiz games with strong engagement
  loops, but none of them are *the Jeopardy board*; they are question streams.
- **Factile / PlayFactile** — modern Jeopardy clone with accounts + freemium
  limits; closer competitor, but still no true phone buzzers in free tier and
  the account requirement adds friction.
- **Buzzin.live / CrowdParty** — phone buzzer tools without the board/editor.

**The gap:** nobody combines (a) JeopardyLabs' no-login instant editor and
library, (b) Kahoot-class phone participation with real buzzers, and (c) a
proper host/board/player three-screen architecture. That gap is Buzzr.

## 6. Strategic takeaways for Buzzr

1. Keep creation login-free; use edit tokens saved in the browser (and
   shareable edit links) instead of accounts.
2. Make *everything* JeopardyLabs paywalls free: editing, media, privacy.
3. Build the product around a **room model** with three first-class surfaces:
   **Board** (projector), **Host dashboard** (control + answers), **Player
   phone** (buzzer, avatar, wagers, leaderboard).
4. Automate the drudgery: buzz adjudication, scoring, lockouts, Daily Double
   wagers, Final round wagering/answers — the host should only judge
   correctness.
5. Preserve a "classic mode" path: a host with no student devices can still
   run the board solo with manual scoring.
6. Bring the show-business: board fill animations, buzz lock-in moments,
   Daily Double splashes, podium finale. Delight is a feature.
