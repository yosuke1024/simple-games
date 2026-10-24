import { createApiRequest } from './client';
import { ClubApiError } from './errors';
import { isCount, isObject, isText } from './managementTypes';
import {
  validateRankingEntry,
  validateResult,
  validateList,
  type RankingEntry,
  type Result,
} from './types';

export interface RecordTable {
  gameId: string;
  paramsKey: string;
  participantCount: number;
  axis: { fact: string; direction: 'asc' | 'desc' };
  leader: RankingEntry | null;
  medianBestValue: number | null;
  me: { rank: number; entry: RankingEntry } | null;
}
export interface RecordDaily {
  challengeId: string;
  gameId: string;
  contractVersion: 1;
  params: unknown;
  seed: string;
  boardDigest: string;
  daily: string;
  participantCount: number;
  axis: RecordTable['axis'] | null;
  leader: Result | null;
  me: { rank: number; entry: Result } | null;
}
export interface OwnerRecords {
  club: { id: string; name: string };
  generatedAt: string;
  memberCount: number;
  basis: 'retained-member-bests';
  tables: RecordTable[];
  nextAfter: string | null;
  daily: RecordDaily[];
  nextDailyAfter: string | null;
}
export interface AlbumSummary {
  id: string;
  title: string;
  createdAt: string;
  itemCount: number;
}
export interface RecordAlbum extends AlbumSummary {
  tables: { gameId: string; paramsKey: string; entry: RankingEntry }[];
  daily: {
    challengeId: string;
    gameId: string;
    contractVersion: 1;
    params: unknown;
    seed: string;
    boardDigest: string;
    daily: string;
    entry: Result;
  }[];
  unavailableCount: number;
}
const nullableString = (v: unknown): v is string | null => v === null || isText(v);
function axis(raw: unknown): RecordTable['axis'] | null {
  return isObject(raw) && isText(raw.fact) && (raw.direction === 'asc' || raw.direction === 'desc')
    ? { fact: raw.fact, direction: raw.direction }
    : null;
}
function table(raw: unknown): RecordTable | null {
  if (
    !isObject(raw) ||
    !isText(raw.gameId) ||
    !isText(raw.paramsKey) ||
    !isCount(raw.participantCount)
  )
    return null;
  const a = axis(raw.axis),
    leader = raw.leader === null ? null : validateRankingEntry(raw.leader);
  if (
    !a ||
    (raw.leader !== null && !leader) ||
    !(
      raw.medianBestValue === null ||
      (typeof raw.medianBestValue === 'number' && Number.isFinite(raw.medianBestValue))
    )
  )
    return null;
  let me: RecordTable['me'] = null;
  if (raw.me !== null) {
    if (!isObject(raw.me) || !isCount(raw.me.rank) || raw.me.rank < 1) return null;
    const entry = validateRankingEntry(raw.me.entry);
    if (!entry) return null;
    me = { rank: raw.me.rank, entry };
  }
  return {
    gameId: raw.gameId,
    paramsKey: raw.paramsKey,
    participantCount: raw.participantCount,
    axis: a,
    leader,
    medianBestValue: raw.medianBestValue,
    me,
  };
}
function daily(raw: unknown): RecordDaily | null {
  if (
    !isObject(raw) ||
    !isText(raw.challengeId) ||
    !isText(raw.gameId) ||
    raw.contractVersion !== 1 ||
    !isText(raw.seed) ||
    !isText(raw.boardDigest) ||
    !isText(raw.daily) ||
    !isCount(raw.participantCount)
  )
    return null;
  const a = raw.axis === null ? null : axis(raw.axis),
    leader = raw.leader === null ? null : validateResult(raw.leader);
  if ((raw.axis !== null && !a) || (raw.leader !== null && !leader)) return null;
  let me: RecordDaily['me'] = null;
  if (raw.me !== null) {
    if (!isObject(raw.me) || !isCount(raw.me.rank) || raw.me.rank < 1) return null;
    const entry = validateResult(raw.me.entry);
    if (!entry) return null;
    me = { rank: raw.me.rank, entry };
  }
  return {
    challengeId: raw.challengeId,
    gameId: raw.gameId,
    contractVersion: 1,
    params: raw.params,
    seed: raw.seed,
    boardDigest: raw.boardDigest,
    daily: raw.daily,
    participantCount: raw.participantCount,
    axis: a,
    leader,
    me,
  };
}
export function validateOwnerRecords(raw: unknown): OwnerRecords | null {
  if (
    !isObject(raw) ||
    !isObject(raw.club) ||
    !isText(raw.club.id) ||
    !isText(raw.club.name) ||
    !isText(raw.generatedAt) ||
    !isCount(raw.memberCount) ||
    raw.basis !== 'retained-member-bests' ||
    !nullableString(raw.nextAfter) ||
    !nullableString(raw.nextDailyAfter)
  )
    return null;
  const tables = validateList(raw.tables, table),
    dailies = validateList(raw.daily, daily);
  if (!tables || !dailies) return null;
  return {
    club: { id: raw.club.id, name: raw.club.name },
    generatedAt: raw.generatedAt,
    memberCount: raw.memberCount,
    basis: 'retained-member-bests',
    tables,
    nextAfter: raw.nextAfter,
    daily: dailies,
    nextDailyAfter: raw.nextDailyAfter,
  };
}
function albumSummary(raw: unknown): AlbumSummary | null {
  return isObject(raw) &&
    isText(raw.id) &&
    isText(raw.title) &&
    isText(raw.createdAt) &&
    isCount(raw.itemCount)
    ? { id: raw.id, title: raw.title, createdAt: raw.createdAt, itemCount: raw.itemCount }
    : null;
}
export function validateRecordAlbum(raw: unknown): RecordAlbum | null {
  const summary = albumSummary(raw);
  if (!summary || !isObject(raw) || !isCount(raw.unavailableCount)) return null;
  const tables = validateList(raw.tables, (item) => {
    if (!isObject(item) || !isText(item.gameId) || !isText(item.paramsKey)) return null;
    const entry = validateRankingEntry(item.entry);
    return entry ? { gameId: item.gameId, paramsKey: item.paramsKey, entry } : null;
  });
  const dailies = validateList(raw.daily, (item) => {
    if (
      !isObject(item) ||
      !isText(item.challengeId) ||
      !isText(item.gameId) ||
      item.contractVersion !== 1 ||
      !isText(item.seed) ||
      !isText(item.boardDigest) ||
      !isText(item.daily)
    )
      return null;
    const entry = validateResult(item.entry);
    return entry
      ? {
          challengeId: item.challengeId,
          gameId: item.gameId,
          contractVersion: 1 as const,
          params: item.params,
          seed: item.seed,
          boardDigest: item.boardDigest,
          daily: item.daily,
          entry,
        }
      : null;
  });
  return tables && dailies
    ? { ...summary, tables, daily: dailies, unavailableCount: raw.unavailableCount }
    : null;
}
function check<T>(v: T | null): T {
  if (v === null) throw new ClubApiError('malformed_response', 0);
  return v;
}
export function createRecordsClient(
  endpoint: string,
  memberToken: string,
  fetchImpl?: typeof fetch,
) {
  const request = createApiRequest(endpoint, memberToken, fetchImpl);
  return {
    async records(
      options: { after?: string; daily?: string; dailyAfter?: string } = {},
    ): Promise<OwnerRecords> {
      const query = new URLSearchParams({ limit: '25', ...options });
      return check(
        validateOwnerRecords(await request('GET', `/owner/records?${query.toString()}`)),
      );
    },
    async albums(): Promise<AlbumSummary[]> {
      const raw = await request('GET', '/albums');
      return check(isObject(raw) ? validateList(raw.albums, albumSummary) : null);
    },
    async album(id: string): Promise<RecordAlbum> {
      return check(validateRecordAlbum(await request('GET', `/albums/${encodeURIComponent(id)}`)));
    },
    async publish(
      title: string,
      tables: { gameId: string; paramsKey: string }[],
      challengeIds: string[],
      clientId: string,
    ): Promise<RecordAlbum> {
      return check(
        validateRecordAlbum(
          await request('POST', '/albums', { title, tables, challengeIds, clientId }),
        ),
      );
    },
    async deleteAlbum(id: string): Promise<void> {
      await request('DELETE', `/albums/${encodeURIComponent(id)}`);
    },
  };
}
