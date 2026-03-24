import { g as getServerClient } from './server_CZpMGDek.mjs';

async function getSubjects() {
  const db = getServerClient();
  const { data, error } = await db.from("subjects").select("*").order("name", { ascending: true });
  if (error) throw new Error(`getSubjects: ${error.message}`);
  return data ?? [];
}
async function getSubject(id) {
  const db = getServerClient();
  const { data, error } = await db.from("subjects").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}
async function getModulesForSubject(subjectId) {
  const db = getServerClient();
  const { data, error } = await db.from("modules").select("*").eq("subject_id", subjectId).order("name", { ascending: true });
  if (error) throw new Error(`getModulesForSubject: ${error.message}`);
  return data ?? [];
}
async function getModule(id) {
  const db = getServerClient();
  const { data, error } = await db.from("modules").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}
async function getQuestionsForModule(moduleId) {
  const db = getServerClient();
  const { data: questions, error: qError } = await db.from("questions").select("id, module_id, text, image_path").eq("module_id", moduleId);
  if (qError) throw new Error(`getQuestionsForModule: ${qError.message}`);
  if (!questions || questions.length === 0) return [];
  const questionIds = questions.map((q) => q.id);
  const { data: options, error: oError } = await db.from("options").select("id, question_id, text, is_correct").in("question_id", questionIds);
  if (oError) throw new Error(`getOptions: ${oError.message}`);
  return questions.map((q) => ({
    ...q,
    options: (options ?? []).filter((o) => o.question_id === q.id)
  }));
}
async function submitReport(data) {
  const db = getServerClient();
  const { error } = await db.from("reports").insert({
    ...data,
    status: "pending"
  });
  if (error) throw new Error(`submitReport: ${error.message}`);
}
async function submitSuggestion(data) {
  const db = getServerClient();
  const { error } = await db.from("suggestions").insert({
    ...data,
    status: "pending"
  });
  if (error) throw new Error(`submitSuggestion: ${error.message}`);
}
async function getPendingReports() {
  const db = getServerClient();
  const { data, error } = await db.from("reports").select(`
      id, reason, details, status, created_at,
      question:question_id (id, text, options:options(id, text, is_correct))
    `).eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw new Error(`getPendingReports: ${error.message}`);
  return data ?? [];
}
async function getPendingSuggestions() {
  const db = getServerClient();
  const { data, error } = await db.from("suggestions").select("*").eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw new Error(`getPendingSuggestions: ${error.message}`);
  return data ?? [];
}
async function getGlobalStats() {
  const db = getServerClient();
  const [subjects, modules, questions, reports, suggestions] = await Promise.all([
    db.from("subjects").select("*", { count: "exact", head: true }),
    db.from("modules").select("*", { count: "exact", head: true }),
    db.from("questions").select("*", { count: "exact", head: true }),
    db.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("suggestions").select("*", { count: "exact", head: true }).eq("status", "pending")
  ]);
  return {
    totalSubjects: subjects.count ?? 0,
    totalModules: modules.count ?? 0,
    totalQuestions: questions.count ?? 0,
    totalReports: reports.count ?? 0,
    newSubmissions: suggestions.count ?? 0
  };
}
async function updateReportStatus(id, status) {
  const db = getServerClient();
  const { error } = await db.from("reports").update({ status }).eq("id", id);
  if (error) throw new Error(`updateReportStatus: ${error.message}`);
}
async function updateSuggestionStatus(id, status) {
  const db = getServerClient();
  const { error } = await db.from("suggestions").update({ status }).eq("id", id);
  if (error) throw new Error(`updateSuggestionStatus: ${error.message}`);
}

export { getPendingSuggestions as a, getGlobalStats as b, updateSuggestionStatus as c, submitSuggestion as d, getModule as e, getSubject as f, getPendingReports as g, getQuestionsForModule as h, getModulesForSubject as i, getSubjects as j, submitReport as s, updateReportStatus as u };
