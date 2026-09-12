/**
 * Date-based feature gates.
 * After a feature launches, remove its gate and the admin-only guards.
 */

/** Guide per Te — launches Tue 10 Mar 2026 at 08:00 CET */
const GUIDE_LAUNCH = new Date("2026-03-10T08:00:00+01:00");

export const isGuideLive = () => Date.now() >= GUIDE_LAUNCH.getTime();
