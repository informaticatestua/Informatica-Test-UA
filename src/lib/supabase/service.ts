import { getServerClient } from './server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Option {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface Question {
  id: string;
  module_id: string;
  text: string;
  image_path: string | null;
  options: Option[];
}

export interface Module {
  id: string;
  subject_id: string;
  name: string;
}

export interface Subject {
  id: string;
  course_id: string;
  name: string;
  icon: string | null;
  category: string | null;
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export async function getSubjects(): Promise<Subject[]> {
  const db = getServerClient();
  const { data, error } = await db
    .from('subjects')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(`getSubjects: ${error.message}`);
  return data ?? [];
}

export async function getSubject(id: string): Promise<Subject | null> {
  const db = getServerClient();
  const { data, error } = await db
    .from('subjects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export async function getModulesForSubject(subjectId: string): Promise<Module[]> {
  const db = getServerClient();
  const { data, error } = await db
    .from('modules')
    .select('*')
    .eq('subject_id', subjectId)
    .order('name', { ascending: true });

  if (error) throw new Error(`getModulesForSubject: ${error.message}`);
  return data ?? [];
}

export async function getModule(id: string): Promise<Module | null> {
  const db = getServerClient();
  const { data, error } = await db
    .from('modules')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function getQuestionsForModule(moduleId: string): Promise<Question[]> {
  const db = getServerClient();

  const { data: questions, error: qError } = await db
    .from('questions')
    .select('id, module_id, text, image_path')
    .eq('module_id', moduleId);

  if (qError) throw new Error(`getQuestionsForModule: ${qError.message}`);
  if (!questions || questions.length === 0) return [];

  const questionIds = questions.map((q: any) => q.id);

  const { data: options, error: oError } = await db
    .from('options')
    .select('id, question_id, text, is_correct')
    .in('question_id', questionIds);

  if (oError) throw new Error(`getOptions: ${oError.message}`);

  return questions.map((q: any) => ({
    ...q,
    options: (options ?? []).filter((o: any) => o.question_id === q.id)
  }));
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function submitReport(data: {
  question_id: string;
  reason: string;
  details?: string;
}) {
  const db = getServerClient();
  const { error } = await db.from('reports').insert({
    ...data,
    status: 'pending'
  });
  if (error) throw new Error(`submitReport: ${error.message}`);
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

export async function submitSuggestion(data: {
  subject_id: string;
  module_id?: string;
  question_text: string;
  options: { text: string; is_correct: boolean }[];
  contributor_note?: string;
}) {
  const db = getServerClient();
  const { error } = await db.from('suggestions').insert({
    ...data,
    status: 'pending'
  });
  if (error) throw new Error(`submitSuggestion: ${error.message}`);
}

// ─── Admin queries ────────────────────────────────────────────────────────────

export async function getPendingReports() {
  const db = getServerClient();
  const { data, error } = await db
    .from('reports')
    .select(`
      id, reason, details, status, created_at,
      question:question_id (id, text, options:options(id, text, is_correct))
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getPendingReports: ${error.message}`);
  return data ?? [];
}

export async function getPendingSuggestions() {
  const db = getServerClient();
  const { data, error } = await db
    .from('suggestions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getPendingSuggestions: ${error.message}`);
  return data ?? [];
}

export async function getGlobalStats() {
  const db = getServerClient();
  const [subjects, modules, questions, reports, suggestions] = await Promise.all([
    db.from('subjects').select('*', { count: 'exact', head: true }),
    db.from('modules').select('*', { count: 'exact', head: true }),
    db.from('questions').select('*', { count: 'exact', head: true }),
    db.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('suggestions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  return {
    totalSubjects: subjects.count ?? 0,
    totalModules: modules.count ?? 0,
    totalQuestions: questions.count ?? 0,
    totalReports: reports.count ?? 0,
    newSubmissions: suggestions.count ?? 0,
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function updateReportStatus(id: string, status: 'accepted' | 'rejected') {
  const db = getServerClient();
  const { error } = await db
    .from('reports')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(`updateReportStatus: ${error.message}`);
}

export async function updateSuggestionStatus(id: string, status: 'accepted' | 'rejected') {
  const db = getServerClient();
  const { error } = await db
    .from('suggestions')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(`updateSuggestionStatus: ${error.message}`);
}
