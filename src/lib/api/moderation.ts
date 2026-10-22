// src/lib/api/moderation.ts
// PENORA Moderation & Safety API: Mute, Block, and Report
// Protects reader & creator experience, enforces safety policies, and persists moderation records.

import { supabase } from '../supabaseClient';
import type { MuteRecord, BlockRecord, ReportRecord } from './types';

const LOCAL_MUTES_KEY = 'penora_mutes_ledger_v1';
const LOCAL_BLOCKS_KEY = 'penora_blocks_ledger_v1';
const LOCAL_REPORTS_KEY = 'penora_reports_ledger_v1';

let memoryMutes: Record<string, string[]> = {};
let memoryBlocks: Record<string, string[]> = {};
let memoryReports: ReportRecord[] = [];

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function readLocalMutes(): Record<string, string[]> {
  if (typeof window === 'undefined' || !window.localStorage) return memoryMutes;
  try {
    const raw = window.localStorage.getItem(LOCAL_MUTES_KEY);
    return raw ? JSON.parse(raw) : memoryMutes;
  } catch {
    return memoryMutes;
  }
}

function writeLocalMutes(data: Record<string, string[]>): void {
  memoryMutes = data;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_MUTES_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function readLocalBlocks(): Record<string, string[]> {
  if (typeof window === 'undefined' || !window.localStorage) return memoryBlocks;
  try {
    const raw = window.localStorage.getItem(LOCAL_BLOCKS_KEY);
    return raw ? JSON.parse(raw) : memoryBlocks;
  } catch {
    return memoryBlocks;
  }
}

function writeLocalBlocks(data: Record<string, string[]>): void {
  memoryBlocks = data;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_BLOCKS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function readLocalReports(): ReportRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) return memoryReports;
  try {
    const raw = window.localStorage.getItem(LOCAL_REPORTS_KEY);
    return raw ? JSON.parse(raw) : memoryReports;
  } catch {
    return memoryReports;
  }
}

function writeLocalReports(data: ReportRecord[]): void {
  memoryReports = data;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 1. MUTES (Hides creator content in feeds and articles)
// -------------------------------------------------------------

export async function isCreatorMuted(muterId: string, targetId: string): Promise<boolean> {
  if (!muterId || !targetId || muterId === targetId) return false;

  const localMap = readLocalMutes();
  const list = localMap[muterId] || [];
  if (list.includes(targetId)) return true;

  if (!isUuid(muterId) || !isUuid(targetId)) return false;

  try {
    const { data, error } = await supabase
      .from('mutes')
      .select('id')
      .eq('muter_id', muterId)
      .eq('muted_id', targetId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

export async function muteCreator(
  muterId: string,
  targetId: string
): Promise<{ success: boolean; isMuted: boolean; error: string | null }> {
  if (!muterId || !targetId || muterId === targetId) {
    return { success: false, isMuted: false, error: 'Cannot mute yourself' };
  }

  const localMap = readLocalMutes();
  const list = localMap[muterId] || [];
  if (!list.includes(targetId)) {
    list.push(targetId);
    localMap[muterId] = list;
    writeLocalMutes(localMap);
  }

  if (!isUuid(muterId) || !isUuid(targetId)) {
    return { success: true, isMuted: true, error: null };
  }

  try {
    const { error } = await supabase.from('mutes').insert({
      muter_id: muterId,
      muted_id: targetId,
    });

    if (error) {
      if (error.code === '23505') {
        return { success: true, isMuted: true, error: null };
      }
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { success: true, isMuted: true, error: isPending ? null : error.message };
    }
    return { success: true, isMuted: true, error: null };
  } catch (err: any) {
    return { success: true, isMuted: true, error: err.message || null };
  }
}

export async function unmuteCreator(
  muterId: string,
  targetId: string
): Promise<{ success: boolean; isMuted: boolean; error: string | null }> {
  const localMap = readLocalMutes();
  const list = (localMap[muterId] || []).filter(id => id !== targetId);
  localMap[muterId] = list;
  writeLocalMutes(localMap);

  if (!isUuid(muterId) || !isUuid(targetId)) {
    return { success: true, isMuted: false, error: null };
  }

  try {
    const { error } = await supabase
      .from('mutes')
      .delete()
      .eq('muter_id', muterId)
      .eq('muted_id', targetId);

    if (error && error.code !== '42P01') {
      return { success: false, isMuted: true, error: error.message };
    }
    return { success: true, isMuted: false, error: null };
  } catch (err: any) {
    return { success: false, isMuted: true, error: err.message || null };
  }
}

export async function getMutedCreatorIds(muterId: string): Promise<string[]> {
  const localMap = readLocalMutes();
  const set = new Set<string>(localMap[muterId] || []);

  if (!isUuid(muterId)) return Array.from(set);

  try {
    const { data } = await supabase.from('mutes').select('muted_id').eq('muter_id', muterId);
    if (data) {
      data.forEach((r: any) => set.add(r.muted_id));
    }
  } catch {
    // ignore
  }
  return Array.from(set);
}

// -------------------------------------------------------------
// 2. BLOCKS (Prevent interactions)
// -------------------------------------------------------------

export async function isCreatorBlocked(blockerId: string, targetId: string): Promise<boolean> {
  if (!blockerId || !targetId || blockerId === targetId) return false;

  const localMap = readLocalBlocks();
  const list = localMap[blockerId] || [];
  if (list.includes(targetId)) return true;

  if (!isUuid(blockerId) || !isUuid(targetId)) return false;

  try {
    const { data, error } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', targetId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

export async function blockCreator(
  blockerId: string,
  targetId: string
): Promise<{ success: boolean; isBlocked: boolean; error: string | null }> {
  if (!blockerId || !targetId || blockerId === targetId) {
    return { success: false, isBlocked: false, error: 'Cannot block yourself' };
  }

  const localMap = readLocalBlocks();
  const list = localMap[blockerId] || [];
  if (!list.includes(targetId)) {
    list.push(targetId);
    localMap[blockerId] = list;
    writeLocalBlocks(localMap);
  }

  // Also auto-mute when blocked
  await muteCreator(blockerId, targetId);

  if (!isUuid(blockerId) || !isUuid(targetId)) {
    return { success: true, isBlocked: true, error: null };
  }

  try {
    const { error } = await supabase.from('blocks').insert({
      blocker_id: blockerId,
      blocked_id: targetId,
    });

    if (error) {
      if (error.code === '23505') {
        return { success: true, isBlocked: true, error: null };
      }
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { success: true, isBlocked: true, error: isPending ? null : error.message };
    }
    return { success: true, isBlocked: true, error: null };
  } catch (err: any) {
    return { success: true, isBlocked: true, error: err.message || null };
  }
}

export async function unblockCreator(
  blockerId: string,
  targetId: string
): Promise<{ success: boolean; isBlocked: boolean; error: string | null }> {
  const localMap = readLocalBlocks();
  const list = (localMap[blockerId] || []).filter(id => id !== targetId);
  localMap[blockerId] = list;
  writeLocalBlocks(localMap);

  if (!isUuid(blockerId) || !isUuid(targetId)) {
    return { success: true, isBlocked: false, error: null };
  }

  try {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', targetId);

    if (error && error.code !== '42P01') {
      return { success: false, isBlocked: true, error: error.message };
    }
    return { success: true, isBlocked: false, error: null };
  } catch (err: any) {
    return { success: false, isBlocked: true, error: err.message || null };
  }
}

// -------------------------------------------------------------
// 3. REPORTS (Store reports securely for moderation)
// -------------------------------------------------------------

export async function submitReport(report: {
  reporterId: string;
  targetType: 'post' | 'comment' | 'profile';
  targetId: string;
  reason: string;
  details?: string;
}): Promise<{ success: boolean; error: string | null }> {
  if (!report.reporterId || !report.targetId || !report.reason) {
    return { success: false, error: 'Missing required report fields' };
  }

  const localRecord: ReportRecord = {
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reporter_id: report.reporterId,
    target_type: report.targetType,
    target_id: report.targetId,
    reason: report.reason.trim(),
    details: report.details?.trim() || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  const currentLocal = readLocalReports();
  currentLocal.push(localRecord);
  writeLocalReports(currentLocal);

  if (!isUuid(report.reporterId)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase.from('reports').insert({
      reporter_id: report.reporterId,
      target_type: report.targetType,
      target_id: report.targetId,
      reason: report.reason.trim(),
      details: report.details?.trim() || null,
      status: 'pending',
    });

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { success: true, error: isPending ? null : error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: true, error: err.message || null };
  }
}
