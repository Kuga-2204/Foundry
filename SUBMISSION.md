# Solvyard

**Is there already a startup solving my problem?**

That's the whole product. You describe something annoying about your day in
your own words, and Solvyard tells you who already fixes it. If nobody does,
your problem gets listed, other people vote on it, and startups can see there's
a queue of people waiting. When someone finally builds it, everyone who voted
hears about it first.

This file is for reviewers. It covers what to look at, how to run it, and what
isn't finished.

---

## The interesting part

Word matching is a terrible way to do this, and we found that out the hard way.

Someone typed "splitting rent with flatmates always turns into an argument" and
got recommended a design-to-code tool for developers, because both texts
happened to contain "turn" and "about". The same problem also pulled in a
medication reminder app, on the strength of "nobody" and "track".

So matching happens in two stages now.

**`backend/lib/match.js`** does the fast, dumb part. It scores every startup by
word overlap and casts a wide net on purpose, because it runs on every keystroke
while you type and needs to be instant. It's allowed to be wrong.

**`backend/lib/agent.js`** is the part worth reading. It takes that messy
shortlist, reads it against the actual problem, and decides which candidates
genuinely solve it. Then it writes the sentence you see on each card. On the
rent example it kept SplitFair, threw out the design tool, and explained why in
one line: *"It is a design-to-code handoff tool for software teams, not a way to
split rent or track household bills."*

The same file handles the harder case, which is when nothing in our directory
fits. It searches the live web and comes back with real products. Ask it about
forgotten subscriptions and you get Rocket Money and Copilot Money. Ask about
files not syncing to your phone and you get Dropbox, Google Drive and OneDrive.
Real companies, real links, checked at the moment you ask.

Getting that trustworthy took more work than expected. It has to search rather
than answer from memory, or it recommends products that shut down years ago. It
has to link the company's own site instead of some listicle about the company.
`tidyUrl()` throws out anything pointing at a review site, an app store, Reddit
or Wikipedia, and strips the tracking junk off what's left.

The whole thing is optional. No API key set, or the API is down, and every
function quietly returns nothing and you get plain keyword matching instead.
The site doesn't break because a model was unavailable.

---

## Where everything lives

**`backend/routes/problems.js`** is the biggest file and the centre of the app.
Posting, voting, following, a startup committing to build something, marking it
shipped. It's also where the two matching stages get wired together, and where
`prefetchWebMatches()` lives. That last one starts the web search the second a
problem is posted instead of when someone opens it, which is the difference
between waiting twenty seconds and waiting half of one.

**`frontend/src/pages/ProblemDetail.jsx`** is where you actually see all of it.
Matches with their explanations, the separate web results section, solutions,
reviews, comments.

**`frontend/src/pages/PostProblem.jsx`** handles posting, including the live
check that runs while you're still typing and warns you if someone already
posted the same thing.

**`backend/db/index.js`** has the full database schema. It builds itself on
first run, so there are no migrations to apply.

Three smaller files carry rules that matter more than their size suggests:

- `backend/lib/stake.js` decides who's allowed to review a solution. Only people
  who posted or voted on the problem. This is what stops a startup from
  reviewing itself.
- `backend/lib/moderation.js` runs report escalation. Three reports hide
  something and give its author a strike. Strikes build up into a suspension,
  then a ban.
- `backend/lib/anon.js` lets people post anonymously while keeping one steady
  handle, so an anonymous poster still has a consistent identity without
  exposing who they are.

`PRODUCT.md` has the full spec if you want the reasoning behind any of it.

---

## Running it

You need Node 18 or newer and a Supabase Postgres database.

Backend first, on port 4000:

```
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in `SUPABASE_DB_URL` and `JWT_SECRET`. Those two are
required and nothing starts without them. `OPENAI_API_KEY` is optional.

```
npm run seed
npm start
```

The seed step loads 12 sample startups. Skip it and matching has nothing to
match against.

Frontend second, on port 5173:

```
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`.

### Two things to try

Sign up, hit **Post**, and type this:

> Splitting rent with flatmates always turns into an argument. Every month we
> fight about who used what.

Watch the suggestions while you're typing. You'll see a false positive in
there. Post it, and it's gone, with SplitFair left behind and a sentence
explaining why it fits. That gap between the two is the agent doing its job.

Now post this one:

> I keep forgetting which subscriptions I am paying for.

Nothing in the directory handles subscriptions, so it goes out to the web
instead and comes back with real products in their own section. Click the
links. They should go to actual companies.

---

## What's fake, what's borrowed, what's missing

**The 12 startups aren't real.** They're sample data from
`backend/db/seed.js` and their websites all point at `example.com`. They exist
so matching has something to chew on. In a live product these would be real
companies who signed up and listed themselves.

The products in the "Also found on the web" section are the opposite. Those are
genuine companies found by searching at that moment, and the links go to their
actual sites.

**There are no tests.** None. Everything here was checked by hand against a
live database and a live API. It's the most obvious gap in the repo and we'd
rather say so than have you go looking.

**What it depends on:**

Supabase Postgres holds everything and the backend won't start without it.
Supabase Storage handles photo and video uploads, and without it you can still
post, just not attach anything. The OpenAI API powers the agent, and without a
key the site works fine but falls back to keyword matching with no explanations
and no web section. Email goes through SMTP if you configure it, and if you
don't, `backend/lib/email.js` prints messages to the server console instead, so
password resets are still testable without a mail account.

**Rough edges we know about:**

Notifications only exist inside the app and get polled once a minute, so
there's no push or websockets. A cold web search takes about twenty seconds,
which is why it's cached for 30 days and prefetched at post time. On a
serverless host that kills work after the response is sent, that prefetch might
not finish and the first person to open the problem waits for the live search
instead. The keyword matcher only works in English and compares words rather
than meaning.

---

## Credentials

Secrets live in `backend/.env`, which is gitignored. `backend/.env.example` has
placeholders only.

If you're reading through the commit history, older versions of
`backend/.env.example` had real Supabase values in them by mistake. They've been
replaced with placeholders and the credentials are being rotated.
