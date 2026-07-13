// Seeds the startup directory with unclaimed sample profiles so matching and
// browsing work before real partners are onboarded. Run with: npm run seed
// Safe to re-run: it skips startups whose name already exists.
import db from "./index.js";

const STARTUPS = [
  {
    name: "SplitFair",
    tagline: "Splits rent and bills by actual usage, not evenly",
    description:
      "SplitFair tracks who uses what in a shared home and produces a fair monthly split. Roommates connect once and every bill is divided automatically, with a clear breakdown everyone can see.",
    website: "https://example.com/splitfair",
    category: "Home & Living",
    statements: [
      "Splitting rent with roommates always causes fights",
      "No easy way to divide utility bills fairly when usage differs",
      "Tracking shared household expenses is messy and awkward",
    ],
  },
  {
    name: "QueueLess",
    tagline: "Know how crowded a place is before you leave home",
    description:
      "QueueLess shows live wait times for clinics, government offices, and banks using anonymized signals, so people stop losing half a day standing in line.",
    website: "https://example.com/queueless",
    category: "Community",
    statements: [
      "Waiting in long queues at clinics and offices wastes hours",
      "No way to know how crowded a place is before going",
      "Appointment systems never show real waiting time",
    ],
  },
  {
    name: "MealLoop",
    tagline: "Weekly meal plans from what is already in your kitchen",
    description:
      "MealLoop scans your pantry and generates a week of meals, cutting food waste and the nightly what-do-we-cook debate. Grocery lists come out matched to local store prices.",
    website: "https://example.com/mealloop",
    category: "Health & Wellness",
    statements: [
      "Deciding what to cook every day is exhausting",
      "Groceries expire and get wasted before we use them",
      "Meal planning apps ignore what is already in the kitchen",
    ],
  },
  {
    name: "FocusDen",
    tagline: "Blocks distractions across every device at once",
    description:
      "FocusDen syncs focus sessions across phone, laptop, and tablet, so blocking social media on one device does not just move the scrolling to another.",
    website: "https://example.com/focusden",
    category: "Productivity",
    statements: [
      "Phone distractions destroy focus while studying or working",
      "Blocking apps on one device just moves scrolling to another",
      "Cannot stay consistent with deep work sessions",
    ],
  },
  {
    name: "PaperTrail",
    tagline: "Every warranty, receipt, and manual in one searchable place",
    description:
      "Snap a photo of any receipt or warranty card and PaperTrail files it, reminds you before warranties expire, and finds the document the moment an appliance breaks.",
    website: "https://example.com/papertrail",
    category: "Home & Living",
    statements: [
      "Never able to find receipts or warranty cards when something breaks",
      "Warranties expire without any reminder",
      "Product manuals get lost the day they arrive",
    ],
  },
  {
    name: "CommuteMate",
    tagline: "Reliable carpool matching for daily office commutes",
    description:
      "CommuteMate matches verified colleagues and neighbors on the same daily route, with cost splitting and schedule handling built in.",
    website: "https://example.com/commutemate",
    category: "Transport",
    statements: [
      "Daily commute costs too much travelling alone by car or cab",
      "Finding a trustworthy carpool partner on the same route is hard",
      "Office commute wastes hours in traffic every week",
    ],
  },
  {
    name: "TutorBridge",
    tagline: "Vetted peer tutors for exactly the topic you are stuck on",
    description:
      "TutorBridge connects students stuck on a specific topic with verified peer tutors who just aced it, for short focused sessions instead of expensive long-term coaching.",
    website: "https://example.com/tutorbridge",
    category: "Education",
    statements: [
      "Stuck on one topic but private tuition is too expensive",
      "Hard to find a tutor for a single exam chapter quickly",
      "Group coaching classes move too fast to ask doubts",
    ],
  },
  {
    name: "GreenBin",
    tagline: "Doorstep pickup for recyclables with fair payouts",
    description:
      "GreenBin schedules doorstep pickups for paper, plastic, and e-waste, weighs everything transparently, and pays market rates, making recycling the easy default.",
    website: "https://example.com/greenbin",
    category: "Sustainability",
    statements: [
      "No convenient way to recycle household waste properly",
      "E-waste piles up at home because disposal is confusing",
      "Scrap collectors quote arbitrary prices with no transparency",
    ],
  },
  {
    name: "RentRadar",
    tagline: "Alerts the minute a flat matching your filters is listed",
    description:
      "RentRadar watches every rental listing source and alerts renters within minutes of a match, with scam detection that flags fake listings and duplicate brokers.",
    website: "https://example.com/rentradar",
    category: "Home & Living",
    statements: [
      "Good rental flats get taken before I even see the listing",
      "Rental sites are full of fake and duplicate broker listings",
      "Searching for a flat means checking five apps every day",
    ],
  },
  {
    name: "MediMinder",
    tagline: "Medication reminders that the whole family can see",
    description:
      "MediMinder tracks prescriptions for elderly parents, confirms doses were taken, and alerts family members when one is missed, wherever they live.",
    website: "https://example.com/mediminder",
    category: "Health & Wellness",
    statements: [
      "Elderly parents forget their medicines and nobody knows",
      "No way to check remotely if a parent took their dose",
      "Managing multiple prescriptions across doctors is chaotic",
    ],
  },
  {
    name: "FreelanceFlow",
    tagline: "Invoices, contracts, and payment chasing for solo freelancers",
    description:
      "FreelanceFlow generates contracts, sends invoices, and automatically follows up on late payments, so independent workers stop doing unpaid admin.",
    website: "https://example.com/freelanceflow",
    category: "Finance",
    statements: [
      "Clients pay freelance invoices late and chasing them is awkward",
      "Writing contracts for small gigs takes longer than the gig",
      "Tracking income across many small clients is a mess at tax time",
    ],
  },
  {
    name: "DevHandoff",
    tagline: "Turns messy design files into developer-ready specs",
    description:
      "DevHandoff converts design mockups into annotated specs with spacing, tokens, and edge cases filled in, cutting the endless back and forth between designers and developers.",
    website: "https://example.com/devhandoff",
    category: "Developer Tools",
    statements: [
      "Design handoff to developers loses details and causes rework",
      "Developers keep asking designers about spacing and edge cases",
      "Design files and shipped UI drift apart over time",
    ],
  },
];

const exists = db.prepare("SELECT id FROM startups WHERE name = ?");
const insertStartup = db.prepare(
  `INSERT INTO startups (owner_user_id, name, tagline, description, website, category, claimed)
   VALUES (NULL, ?, ?, ?, ?, ?, 0)`
);
const insertStatement = db.prepare(
  "INSERT INTO startup_statements (startup_id, statement) VALUES (?, ?)"
);

let added = 0;
for (const s of STARTUPS) {
  if (exists.get(s.name)) continue;
  const info = insertStartup.run(s.name, s.tagline, s.description, s.website, s.category);
  for (const st of s.statements) insertStatement.run(info.lastInsertRowid, st);
  added++;
}

console.log(`Seed complete: ${added} startup(s) added, ${STARTUPS.length - added} already present.`);
