/**
 * 팀장 NPC(아군 챔피언) 설정 — 이름·대사·패시브 설명.
 * 대사는 이 파일만 수정하면 반영됩니다. 전투 수치는 balance.ts 의 captains 항목에 있습니다.
 */
import type { TeamId, LaneId } from '../world/mapData';

export interface CaptainDef {
  team: TeamId;
  lane: LaneId;
  name: string;
  /** 부장님과 최초 조우 시 말풍선 */
  greeting: string;
  /** 궁극기 집결 연출 문구 */
  rallyLine: string;
  passiveName: string;
  passiveDesc: string;
}

export const CAPTAIN_DEFS: Record<TeamId, CaptainDef> = {
  push: {
    team: 'push',
    lane: 'top',
    name: '추진팀장',
    greeting: '부장님! 추진팀 진격 준비 완료했습니다!',
    rallyLine: '추진팀 지원 도착!',
    passiveName: '전방 지휘',
    passiveDesc: '주변 아군이 받는 피해 감소',
  },
  dev: {
    team: 'dev',
    lane: 'mid',
    name: '개발팀장',
    greeting: '부장님! 기술 지원 준비 완료입니다!',
    rallyLine: '개발팀 지원 도착!',
    passiveName: '기술 지원',
    passiveDesc: '주변 아군의 공격 속도 증가',
  },
  biz: {
    team: 'biz',
    lane: 'bot',
    name: '사업팀장',
    greeting: '부장님! 이번 승리도 계약하겠습니다!',
    rallyLine: '사업팀 지원 도착!',
    passiveName: '전략적 지원',
    passiveDesc: '주변 아군의 포탑 공격력 증가',
  },
};
