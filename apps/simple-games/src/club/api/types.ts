/**
 * The wire types of club.md §5-2 and validators for them. A validator never
 * throws: a shape mismatch is null, and the client reports it as
 * `malformed_response`. `params` and `facts` stay opaque here — only a game's
 * contract (registry `challenge`) reads inside them.
 */
export interface Club {
  id: string;
  name: string;
  createdAt: string;
}
export interface Member {
  id: string;
  nickname: string;
  role: 'owner' | 'member';
  joinedAt: string;
}
export interface Challenge {
  id: string;
  gameId: string;
  contractVersion: 1;
  params: unknown;
  seed: string;
  boardDigest: string;
  title: string | null;
  createdBy: { id: string; nickname: string };
  createdAt: string;
  resultCount: number;
  mine: boolean;
  /** The local date (YYYY-MM-DD) this board is the daily of; null for any other board. Older servers omit it. */
  daily: string | null;
}
export interface Result {
  memberId: string;
  nickname: string;
  submittedAt: string;
  outcome: 'completed' | 'played';
  facts: unknown;
}
export interface ClubRecord {
  gameId: string;
  paramsKey: string;
  facts: unknown;
  memberId: string;
  nickname: string;
  challengeId: string;
}
export interface Hosting {
  provider: string | null;
  manageUrl: string | null;
  referralUrl: string | null;
  lastActivityAt: string | null;
}
export interface JoinResponse {
  club: Club;
  member: Member;
  memberToken: string;
}
export interface ClubResponse {
  club: Club;
  me: Member;
  /** The newest members only (50); `memberCount` is the total. */
  members: Member[];
  memberCount: number;
}
/** One row of `GET /members/reported` (club.md §17-3). */
export interface ReportedMember {
  member: Member;
  reportCount: number;
}
export interface InviteResponse {
  token: string;
  url: string;
}

/**
 * The body of POST /challenges/:id/results — exactly these four fields
 * (club.md §5-5). Nothing about the device, the app version or the locale.
 */
export interface ResultSubmission {
  contractVersion: 1;
  boardDigest: string;
  outcome: 'completed' | 'played';
  facts: Record<string, unknown>;
}

/** The body of POST /challenges (club.md §5-4). */
export interface ChallengeCreate {
  gameId: string;
  contractVersion: 1;
  params: Record<string, unknown>;
  seed: string;
  boardDigest: string;
  title: string | null;
  /** Set only for a daily that is one board for everyone; the server keeps one challenge per board. */
  daily?: string | null;
  result: { outcome: 'completed' | 'played'; facts: Record<string, unknown> };
}

/** One member's best result in a game × mode table (club.md §5-3, §16). */
export interface RankingEntry {
  memberId: string;
  nickname: string;
  submittedAt: string;
  facts: unknown;
  seed: string;
  boardDigest: string | null;
}
/** One row of `GET /rankings`: a table, its size and its leader. */
export interface RankingSummary {
  gameId: string;
  paramsKey: string;
  entryCount: number;
  leader: RankingEntry;
}
/** `GET /rankings/:gameId/:paramsKey`: the top rows and the caller's own row. */
export interface RankingTable {
  gameId: string;
  paramsKey: string;
  entryCount: number;
  entries: RankingEntry[];
  /** `rank` is null when the server stopped counting (below its scan ceiling, club.md §16-1). */
  me: { rank: number | null; entry: RankingEntry } | null;
}
/** The answer to `POST /rankings/results`. */
export interface RankingSubmitResponse {
  gameId: string;
  paramsKey: string;
  improved: boolean;
  entry: RankingEntry | null;
  entryCount: number;
}
/** The body of `POST /rankings/results` (club.md §16-1). */
export interface RankingSubmit {
  gameId: string;
  contractVersion: 1;
  paramsKey: string;
  params: Record<string, unknown>;
  seed: string;
  boardDigest: string | null;
  outcome: 'completed' | 'played';
  facts: Record<string, unknown>;
}

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const nullableStr = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isOutcome = (v: unknown): v is 'completed' | 'played' => v === 'completed' || v === 'played';

export function validateClub(raw: unknown): Club | null {
  if (!isRec(raw) || !str(raw.id) || !str(raw.name) || !str(raw.createdAt)) return null;
  return { id: raw.id, name: raw.name, createdAt: raw.createdAt };
}

export function validateMember(raw: unknown): Member | null {
  if (!isRec(raw) || !str(raw.id) || !str(raw.nickname) || !str(raw.joinedAt)) return null;
  if (raw.role !== 'owner' && raw.role !== 'member') return null;
  return { id: raw.id, nickname: raw.nickname, role: raw.role, joinedAt: raw.joinedAt };
}

export function validateChallenge(raw: unknown): Challenge | null {
  if (!isRec(raw)) return null;
  const by = raw.createdBy;
  if (
    !str(raw.id) ||
    !str(raw.gameId) ||
    raw.contractVersion !== 1 ||
    !str(raw.seed) ||
    !str(raw.boardDigest) ||
    !nullableStr(raw.title) ||
    !isRec(by) ||
    !str(by.id) ||
    !str(by.nickname) ||
    !str(raw.createdAt) ||
    typeof raw.resultCount !== 'number' ||
    !Number.isInteger(raw.resultCount) ||
    typeof raw.mine !== 'boolean' ||
    (raw.daily !== undefined && !nullableStr(raw.daily))
  ) {
    return null;
  }
  return {
    id: raw.id,
    gameId: raw.gameId,
    contractVersion: 1,
    params: raw.params,
    seed: raw.seed,
    boardDigest: raw.boardDigest,
    title: raw.title,
    createdBy: { id: by.id, nickname: by.nickname },
    createdAt: raw.createdAt,
    resultCount: raw.resultCount,
    mine: raw.mine,
    daily: typeof raw.daily === 'string' ? raw.daily : null,
  };
}

export function validateResult(raw: unknown): Result | null {
  if (!isRec(raw) || !str(raw.memberId) || !str(raw.nickname) || !str(raw.submittedAt)) return null;
  if (!isOutcome(raw.outcome)) return null;
  return {
    memberId: raw.memberId,
    nickname: raw.nickname,
    submittedAt: raw.submittedAt,
    outcome: raw.outcome,
    facts: raw.facts,
  };
}

export function validateClubRecord(raw: unknown): ClubRecord | null {
  if (
    !isRec(raw) ||
    !str(raw.gameId) ||
    !str(raw.paramsKey) ||
    !str(raw.memberId) ||
    !str(raw.nickname) ||
    !str(raw.challengeId)
  ) {
    return null;
  }
  return {
    gameId: raw.gameId,
    paramsKey: raw.paramsKey,
    facts: raw.facts,
    memberId: raw.memberId,
    nickname: raw.nickname,
    challengeId: raw.challengeId,
  };
}

const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function validateRankingEntry(raw: unknown): RankingEntry | null {
  if (
    !isRec(raw) ||
    !str(raw.memberId) ||
    !str(raw.nickname) ||
    !str(raw.submittedAt) ||
    !str(raw.seed) ||
    !nullableStr(raw.boardDigest)
  ) {
    return null;
  }
  return {
    memberId: raw.memberId,
    nickname: raw.nickname,
    submittedAt: raw.submittedAt,
    facts: raw.facts,
    seed: raw.seed,
    boardDigest: raw.boardDigest,
  };
}

export function validateRankingSummary(raw: unknown): RankingSummary | null {
  if (!isRec(raw) || !str(raw.gameId) || !str(raw.paramsKey) || !count(raw.entryCount)) return null;
  const leader = validateRankingEntry(raw.leader);
  if (leader === null) return null;
  return { gameId: raw.gameId, paramsKey: raw.paramsKey, entryCount: raw.entryCount, leader };
}

export function validateRankingTable(raw: unknown): RankingTable | null {
  if (!isRec(raw) || !str(raw.gameId) || !str(raw.paramsKey) || !count(raw.entryCount)) return null;
  const entries = validateList(raw.entries, validateRankingEntry);
  if (entries === null) return null;
  let me: RankingTable['me'] = null;
  if (raw.me !== null && raw.me !== undefined) {
    if (!isRec(raw.me)) return null;
    const rank = raw.me.rank === null || raw.me.rank === undefined ? null : raw.me.rank;
    if (rank !== null && (!count(rank) || rank < 1)) return null;
    const entry = validateRankingEntry(raw.me.entry);
    if (entry === null) return null;
    me = { rank: rank as number | null, entry };
  }
  return { gameId: raw.gameId, paramsKey: raw.paramsKey, entryCount: raw.entryCount, entries, me };
}

export function validateRankingSubmitResponse(raw: unknown): RankingSubmitResponse | null {
  if (
    !isRec(raw) ||
    !str(raw.gameId) ||
    !str(raw.paramsKey) ||
    typeof raw.improved !== 'boolean' ||
    !count(raw.entryCount)
  ) {
    return null;
  }
  const entry = raw.entry === null ? null : validateRankingEntry(raw.entry);
  if (raw.entry !== null && entry === null) return null;
  return {
    gameId: raw.gameId,
    paramsKey: raw.paramsKey,
    improved: raw.improved,
    entry,
    entryCount: raw.entryCount,
  };
}

export function validateHosting(raw: unknown): Hosting | null {
  if (
    !isRec(raw) ||
    !nullableStr(raw.provider) ||
    !nullableStr(raw.manageUrl) ||
    !nullableStr(raw.referralUrl) ||
    !nullableStr(raw.lastActivityAt)
  ) {
    return null;
  }
  return {
    provider: raw.provider,
    manageUrl: raw.manageUrl,
    referralUrl: raw.referralUrl,
    lastActivityAt: raw.lastActivityAt,
  };
}

export function validateJoinResponse(raw: unknown): JoinResponse | null {
  if (!isRec(raw) || !str(raw.memberToken) || raw.memberToken === '') return null;
  const club = validateClub(raw.club);
  const member = validateMember(raw.member);
  if (club === null || member === null) return null;
  return { club, member, memberToken: raw.memberToken };
}

export function validateClubResponse(raw: unknown): ClubResponse | null {
  if (!isRec(raw) || !Array.isArray(raw.members)) return null;
  const club = validateClub(raw.club);
  const me = validateMember(raw.me);
  if (club === null || me === null) return null;
  const members: Member[] = [];
  for (const m of raw.members) {
    const member = validateMember(m);
    if (member === null) return null;
    members.push(member);
  }
  // Older servers omit the total: the list is then the whole club.
  if (raw.memberCount !== undefined && !count(raw.memberCount)) return null;
  const memberCount = typeof raw.memberCount === 'number' ? raw.memberCount : members.length;
  return { club, me, members, memberCount };
}

export function validateReportedMember(raw: unknown): ReportedMember | null {
  if (!isRec(raw) || !count(raw.reportCount)) return null;
  const member = validateMember(raw.member);
  if (member === null) return null;
  return { member, reportCount: raw.reportCount };
}

export function validateInviteResponse(raw: unknown): InviteResponse | null {
  if (!isRec(raw) || !str(raw.token) || !str(raw.url)) return null;
  return { token: raw.token, url: raw.url };
}

/** A list: every element must pass, or the whole response is malformed. */
export function validateList<T>(raw: unknown, each: (v: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const out: T[] = [];
  for (const v of raw) {
    const item = each(v);
    if (item === null) return null;
    out.push(item);
  }
  return out;
}
