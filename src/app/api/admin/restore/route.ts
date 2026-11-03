import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const TABLES_ORDER_PARENTS_FIRST: string[] = [
  'accounting_periods',
  'cost_centers',
  'accounts',
  'hotels',
  'unit_types',
  'payment_methods',
  'customers',
  'customer_accounts',
  'profiles',
  'units',
  'bookings',
  'temporary_reservations',
  'invoices',
  'journal_entries',
  'payments',
  'payment_allocations',
  'journal_lines',
  'system_events',
  'ejar_contract_uploads',
  'documents',
];

const TABLES_ORDER_CHILDREN_FIRST: string[] = [...TABLES_ORDER_PARENTS_FIRST].reverse();

const BATCH_SIZE = 100;

function findSheetRowsByTableName(workbook: XLSX.WorkBook, tableName: string): any[] | null {
  const exact = workbook.SheetNames.find((n) => n === tableName);
  if (exact) {
    return XLSX.utils.sheet_to_json(workbook.Sheets[exact], { defval: null, raw: true });
  }
  const lowerTarget = tableName.toLowerCase();
  const candidate = workbook.SheetNames.find((n) => n.toLowerCase() === lowerTarget);
  if (candidate) {
    return XLSX.utils.sheet_to_json(workbook.Sheets[candidate], { defval: null, raw: true });
  }
  if (workbook.SheetNames.length === 1) {
    return null;
  }
  const sheetByPrefix = workbook.SheetNames.find(
    (n) => n.toLowerCase().startsWith(lowerTarget.slice(0, Math.min(8, lowerTarget.length))),
  );
  if (sheetByPrefix) {
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetByPrefix], { defval: null, raw: true });
  }
  return null;
}

function tryParseJsonString(value: any): any {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function normalizeRestoreCellValue(value: any): any {
  if (value === undefined || value === '') return null;
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return tryParseJsonString(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeRestoreRows(rows: any[]): any[] {
  return (rows || []).map((row) => {
    const out: Record<string, any> = {};
    Object.keys(row || {}).forEach((k) => {
      const val = (row as any)[k];
      if (val === undefined || val === '') {
        return;
      }
      out[k] = normalizeRestoreCellValue(val);
    });
    return out;
  });
}

async function deleteAllRowsForTable(admin: any, table: string): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < 10_000; i += 1) {
    const { data: batchIds, error: selErr } = await admin
      .from(table)
      .select('id')
      .limit(BATCH_SIZE * 10);
    if (selErr) throw new Error(`${table} delete select: ${selErr.message}`);
    const ids = (batchIds || []).map((r: any) => r.id).filter(Boolean);
    if (!ids.length) break;
    const { count, error: delErr } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .in('id', ids);
    if (delErr) throw new Error(`${table} delete rows: ${delErr.message}`);
    deleted += count || ids.length;
    if (ids.length < BATCH_SIZE * 10) break;
  }
  return deleted;
}

async function upsertRowsForTable(admin: any, table: string, rows: any[]): Promise<number> {
  if (!rows.length) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { count, error } = await admin
      .from(table)
      .upsert(chunk, { onConflict: 'id', count: 'exact', ignoreDuplicates: false })
      .select('id', { count: 'exact' });
    if (error) {
      throw new Error(
        `${table} upsert rows ${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)}: ${error.message}`,
      );
    }
    inserted += count || chunk.length;
  }
  return inserted;
}

type SummaryRow = {
  table: string;
  sheet_found: boolean;
  rows_in_sheet: number;
  rows_deleted: number;
  rows_restored: number;
  status: 'ok' | 'skipped' | 'warn' | 'error';
  message?: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user || null;
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const { data: myProfile, error: roleErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
    if (!myProfile || myProfile.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'missing_service_role' }, { status: 409 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const confirm = String(formData.get('confirm') || '').trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'missing_file' }, { status: 400 });
    }
    if (confirm !== 'yes_iam_sure_i_want_to_overwrite_all_data') {
      return NextResponse.json({ ok: false, error: 'missing_confirmation_token' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { ok: false, error: 'invalid_file_type_expected_xlsx' },
        { status: 400 },
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
    if (!workbook.SheetNames.length) {
      return NextResponse.json({ ok: false, error: 'empty_workbook' }, { status: 400 });
    }

    const admin = createSupabaseClient(supabaseUrl, serviceKey);
    const summary: SummaryRow[] = [];
    const normalizedByTable: Record<string, any[]> = {};

    for (const table of TABLES_ORDER_PARENTS_FIRST) {
      const sheetRows = findSheetRowsByTableName(workbook, table);
      const normalizedRows = sheetRows ? normalizeRestoreRows(sheetRows) : [];
      normalizedByTable[table] = normalizedRows;
    }

    for (const table of TABLES_ORDER_CHILDREN_FIRST) {
      const rows = normalizedByTable[table] || [];
      const found = rows.length > 0 || workbook.SheetNames.includes(table);
      if (!found) {
        summary.push({
          table,
          sheet_found: false,
          rows_in_sheet: 0,
          rows_deleted: 0,
          rows_restored: 0,
          status: 'skipped',
          message: 'لم يتم إيجاد ورقة لهذا الجدول في الملف — تخطي.',
        });
        continue;
      }
      try {
        const deleted = await deleteAllRowsForTable(admin, table);
        summary.push({
          table,
          sheet_found: true,
          rows_in_sheet: rows.length,
          rows_deleted: deleted,
          rows_restored: 0,
          status: 'ok',
          message: 'تم تفريغ الجدول بالكامل.',
        });
      } catch (e: any) {
        summary.push({
          table,
          sheet_found: true,
          rows_in_sheet: rows.length,
          rows_deleted: 0,
          rows_restored: 0,
          status: 'error',
          message: `فشل تفريغ الجدول: ${String(e?.message || e)}`,
        });
        return NextResponse.json({
          ok: false,
          error: 'delete_phase_failed',
          phase: 'delete',
          failed_at_table: table,
          summary,
        });
      }
    }

    for (const table of TABLES_ORDER_PARENTS_FIRST) {
      const rows = normalizedByTable[table] || [];
      const entry = summary.find((s) => s.table === table);
      if (!entry || entry.status !== 'ok') continue;
      try {
        const restoredCount = await upsertRowsForTable(admin, table, rows);
        entry.rows_restored = restoredCount;
        entry.status = 'ok';
        entry.message = `تم الاستعادة بنجاح (${restoredCount} صف).`;
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (table === 'profiles' && msg.toLowerCase().includes('foreign')) {
          entry.status = 'warn';
          entry.message =
            'تخطي جدول profiles: لا يمكن الإدراج بسبب قيود المفتاح الخارجي مع auth.users (قم باستعادة مستخدمي Auth من لوحة Supabase أولاً ثم أعد تشغيل الاستعادة لهذا الجدول إذا لزم الأمر).';
        } else {
          entry.status = 'error';
          entry.message = `فشل الإدراج: ${msg}`;
          return NextResponse.json({
            ok: false,
            error: 'insert_phase_failed',
            phase: 'insert',
            failed_at_table: table,
            summary,
          });
        }
      }
    }

    const totalInSheet = summary.reduce((a, s) => a + s.rows_in_sheet, 0);
    const totalRestored = summary.reduce((a, s) => a + s.rows_restored, 0);
    const hasWarn = summary.some((s) => s.status === 'warn');

    return NextResponse.json({
      ok: true,
      total_tables: summary.length,
      total_rows_in_sheet: totalInSheet,
      total_rows_restored: totalRestored,
      warnings_count: hasWarn ? 1 : 0,
      summary,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || 'internal_error',
        phase: 'unknown',
      },
      { status: 500 },
    );
  }
}
