export const STATUS_KEYS = ['planned', 'unsure', 'applied', 'interview', 'rejected', 'offer']

// The two built-in values of the free-text type of an application (independent of the status): a job posting
// ("Stelle") and an unsolicited application ("Initiativ").
export const BUILTIN_KINDS = ['posting', 'initiative']

// A follow up only makes sense while an answer is still awaited.
export const OPEN_STATUSES = ['applied']

// Statuses of applications that were really sent.
export const SENT_STATUSES = ['applied', 'interview', 'rejected', 'offer']
