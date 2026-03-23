import { getDb } from './client';
import { addDoc, collection, collectionGroup, doc, getCountFromServer, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';

function safeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout ${label} after ${ms}ms`)), ms);
    })
  ]);
}

function getCourseIdFromPath(refPath: string | undefined | null): string | null {
  // Expected subject path: courses/{courseId}/subjects/{subjectId}
  // Expected module path:  courses/{courseId}/subjects/{subjectId}/modules/{moduleId}
  if (!refPath) return null;
  const parts = refPath.split('/');
  if (parts.length < 4) return null;
  if (parts[0] !== 'courses') return null;
  // courses/{courseId}/subjects/...
  return parts[1] ?? null;
}

function getSubjectIdFromPath(refPath: string | undefined | null): string | null {
  if (!refPath) return null;
  const parts = refPath.split('/');
  // courses/{courseId}/subjects/{subjectId}
  if (parts.length < 4) return null;
  if (parts[0] !== 'courses') return null;
  // .../subjects/{subjectId}
  return parts[3] ?? null;
}

function deriveCourseIdFromSubjectRef(subjectRef: any): string | null {
  return getCourseIdFromPath(subjectRef?.path);
}

function deriveCourseIdFromModuleRef(moduleRef: any): string | null {
  return getCourseIdFromPath(moduleRef?.path);
}

export async function getSubjects() {
  const db = getDb();
  const snap = await getDocs(collectionGroup(db, 'subjects'));

  return snap.docs
    .map((docSnap: any) => {
      const data = docSnap.data() || {};
      const derivedCourseId = deriveCourseIdFromSubjectRef(docSnap.ref);
      return {
        ...data,
        id: data.id ?? docSnap.id,
        courseId: data.courseId ?? derivedCourseId ?? undefined
      };
    })
    .sort((a: any, b: any) => safeString(a?.name).localeCompare(safeString(b?.name)));
}

export async function getSubject(id: string) {
  const subjects = await getSubjects();
  return subjects.find((s: any) => s.id === id) || null;
}

export async function getModulesForSubject(subjectId: string) {
  const db = getDb();
  // Avoid relying on `subject.courseId` being present; derive from the document reference.
  const subjectsSnap = await getDocs(collectionGroup(db, 'subjects'));
  const subjectDoc = subjectsSnap.docs.find(
    (d: any) => d.id === subjectId || d.data()?.id === subjectId
  );
  if (!subjectDoc) {
    console.warn(`⚠️ Subject ${subjectId} not found in Firestore`);
    return [];
  }

  const derivedCourseId = deriveCourseIdFromSubjectRef(subjectDoc.ref);
  if (!derivedCourseId) {
    console.warn(`⚠️ Could not derive courseId for subject ${subjectId}`);
    return [];
  }

  console.log(`✅ getModulesForSubject: subject=${subjectId}, courseId=${derivedCourseId}`);

  const modulesSnap = await getDocs(collection(db, 'courses', derivedCourseId, 'subjects', subjectId, 'modules'));

  const result = modulesSnap.docs.map((docSnap: any) => {
    const data = docSnap.data() || {};
    const moduleData = {
      ...data,
      id: data.id ?? docSnap.id,
      subjectId: data.subjectId ?? subjectId,
      courseId: data.courseId ?? derivedCourseId  // ✅ SIEMPRE asegura courseId
    };
    console.log(`  - Module: ${moduleData.id}, courseId=${moduleData.courseId}, subjectId=${moduleData.subjectId}`);
    return moduleData;
  });
  
  return result;
}

export async function getQuestionsForModule(moduleId: string, courseId?: string, subjectId?: string) {
  const db = getDb();
  
  // Validar inputs
  if (!moduleId) {
    console.error('❌ getQuestionsForModule: moduleId is required');
    return [];
  }

  let moduleRef: any = null;
  const timeoutMs = 12000;

  // 1) Resolver el documento "module" (importante: moduleId puede ser data.id, no docSnap.id)
  // PRIORITARIO: Si tenemos courseId y subjectId, usar ruta directa (MÁS RÁPIDO)
  if (courseId && subjectId) {
    try {
      const directModuleRef = doc(db, 'courses', courseId, 'subjects', subjectId, 'modules', moduleId);
      const maybeModuleSnap = await withTimeout(getDoc(directModuleRef), timeoutMs, `getDoc module ${moduleId}`);
      if (maybeModuleSnap.exists()) {
        moduleRef = maybeModuleSnap.ref;
      }
    } catch (error) {
      console.error(`❌ Error fetching module directly:`, error);
    }
  }

  // FALLBACK: Buscar el módulo globalmente (MÁS LENTO, pero necesario si moduleId != doc.id)
  if (!moduleRef) {
    try {
      const modulesSnap = await withTimeout(
        getDocs(collectionGroup(db, 'modules')),
        timeoutMs,
        'getDocs modules collectionGroup'
      );
      moduleRef =
        modulesSnap.docs.find((d: any) => d.id === moduleId || d.data()?.id === moduleId)?.ref ??
        null;
    } catch (error) {
      console.error(`❌ Error searching modules globally:`, error);
      return [];
    }
  }

  if (!moduleRef) {
    console.warn(`⚠️ Module ${moduleId} not found (direct path or global search)`);
    return [];
  }

  // Extraer courseId y subjectId del path si no se proporcionaron
  const derivedCourseId = deriveCourseIdFromModuleRef(moduleRef);
  const derivedSubjectId = getSubjectIdFromPath(moduleRef?.path);
  const moduleCourseId = derivedCourseId ?? courseId ?? null;
  const moduleSubjectId = derivedSubjectId ?? subjectId ?? null;
  
  if (!moduleCourseId || !moduleSubjectId) {
    console.error('❌ Cannot determine courseId or subjectId for module', {
      moduleId,
      derivedCourseId,
      derivedSubjectId,
      refPath: moduleRef?.path
    });
    return [];
  }

  const moduleDocId = moduleRef.id;

  // 2) Obtener las preguntas por subcolección anidada (usando moduleDocId, no el moduleId "de entrada")
  let directFetchErrored = false;
  let directQuestions: Array<any> = [];
  try {
    const qSnap = await withTimeout(
      getDocs(
        collection(
          db,
          'courses',
          moduleCourseId,
          'subjects',
          moduleSubjectId,
          'modules',
          moduleDocId,
          'questions'
        )
      ),
      timeoutMs,
      `getDocs questions subcollection for module ${moduleDocId}`
    );

    directQuestions = qSnap.docs.map((docSnap: any) => ({
      ...docSnap.data(),
      id: docSnap.data()?.id ?? docSnap.id,
      courseId: docSnap.data()?.courseId ?? moduleCourseId
    }));

    if (directQuestions.length > 0) return directQuestions;
  } catch (error) {
    directFetchErrored = true;
    console.error(`❌ Error fetching questions (direct path) for module ${moduleId}:`, error);
  }

  // Si el doc.id del módulo coincide con el id de entrada y la ruta anidada no trajo nada,
  // lo más probable es que el módulo no tenga preguntas; evitamos el fallback caro.
  if (!directFetchErrored && directQuestions.length === 0 && moduleDocId === moduleId) {
    return [];
  }

  // 3) Fallback: collectionGroup('questions') filtrando por el módulo padre
  try {
    const questionsSnap = await withTimeout(
      getDocs(collectionGroup(db, 'questions')),
      timeoutMs,
      "getDocs questions collectionGroup"
    );

    return questionsSnap.docs
      .filter((docSnap: any) => docSnap.ref?.parent?.parent?.id === moduleDocId)
      .map((docSnap: any) => ({
        ...docSnap.data(),
        id: docSnap.data()?.id ?? docSnap.id,
        courseId: docSnap.data()?.courseId ?? moduleCourseId
      }));
  } catch (error) {
    console.error(`❌ Error fetching questions (fallback) for module ${moduleId}:`, error);
    return [];
  }
}

export async function submitReport(reportData: { questionId: string, reason: string, details: string }) {
  const db = getDb();
  const reportsCol = collection(db, 'reports');
  return await addDoc(reportsCol, {
    ...reportData,
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

export async function submitQuestionSuggestion(suggestion: { subjectId: string, text: string, options: any[] }) {
  const db = getDb();
  const suggestionsCol = collection(db, 'suggestions');
  return await addDoc(suggestionsCol, {
    ...suggestion,
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

export async function getGlobalStats() {
  const db = getDb();
  try {
    const subjectsSnap = await getCountFromServer(collectionGroup(db, 'subjects'));
    const modulesSnap = await getCountFromServer(collectionGroup(db, 'modules'));
    const questionsSnap = await getCountFromServer(collectionGroup(db, 'questions'));
    const reportsSnap = await getCountFromServer(collection(db, 'reports'));
    const suggestionsSnap = await getCountFromServer(collection(db, 'suggestions'));

    return {
      totalSubjects: subjectsSnap.data().count,
      totalModules: modulesSnap.data().count,
      totalQuestions: questionsSnap.data().count,
      totalReports: reportsSnap.data().count,
      newSubmissions: suggestionsSnap.data().count
    };
  } catch (error) {
    console.error('Error fetching global stats', error);
    return {
      totalSubjects: 0,
      totalModules: 0,
      totalQuestions: 0,
      totalReports: 0,
      newSubmissions: 0
    }
  }
}

