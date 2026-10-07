import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 11:59 AM East Africa Time (UTC+3) is 08:59 UTC.
crons.daily(
  "post room charges",
  { hourUTC: 8, minuteUTC: 59 },
  internal.roomCharges.postDue,
);

export default crons;
