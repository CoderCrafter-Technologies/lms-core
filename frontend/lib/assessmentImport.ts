export type ImportedQuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'essay'
  | 'fill-blank'
  | 'coding';

export interface ImportedAssessmentSection {
  id: string;
  title: string;
  type: 'theory' | 'mcq' | 'coding';
  description: string;
  order: number;
}

export interface ImportedQuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ImportedCodingTestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
}

export interface ImportedQuestion {
  id: string;
  type: ImportedQuestionType;
  sectionId?: string;
  question: string;
  options: ImportedQuestionOption[];
  correctAnswer: any;
  points: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  coding?: {
    allowedLanguages: string[];
    starterCode: Record<string, string>;
    testCases: ImportedCodingTestCase[];
  };
  tags: string[];
  order: number;
}

export interface ImportedAssessmentPayload {
  assessment?: {
    title?: string;
    description?: string;
    type?: 'quiz' | 'exam' | 'assignment' | 'practice';
    instructions?: {
      general?: string;
      additional?: string;
    };
  };
  sections: ImportedAssessmentSection[];
  questions: ImportedQuestion[];
}

const DEFAULT_CODING_STARTER_CODE: Record<string, string> = {
  javascript: '// Write your solution here\n',
  python: '# Write your solution here\n',
  java: 'class Main {\n  public static void main(String[] args) {\n    \n  }\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main(){\n  \n  return 0;\n}\n',
};

const toId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeQuestionType = (value: unknown): ImportedQuestionType => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'mcq' || raw === 'multiple_choice' || raw === 'multiple choice') return 'multiple-choice';
  if (raw === 'true_false' || raw === 'true false' || raw === 'boolean') return 'true-false';
  if (raw === 'short_answer' || raw === 'short answer') return 'short-answer';
  if (raw === 'fill_blank' || raw === 'fill blank') return 'fill-blank';
  if (raw === 'coding' || raw === 'dsa' || raw === 'programming') return 'coding';
  if (raw === 'essay') return 'essay';
  return 'multiple-choice';
};

const normalizeDifficulty = (value: unknown): 'easy' | 'medium' | 'hard' => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'easy' || raw === 'hard') return raw;
  return 'medium';
};

const normalizeSectionType = (value: unknown): 'theory' | 'mcq' | 'coding' => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'mcq') return 'mcq';
  if (raw === 'coding') return 'coding';
  return 'theory';
};

const parseBoolean = (value: unknown): boolean => {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'y';
};

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeJson = (value: unknown) => {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const parseCsvRows = (text: string): Record<string, string>[] => {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push(row);
  }

  return rows;
};

const normalizeOptions = (value: unknown, type: ImportedQuestionType, correctAnswer: unknown): ImportedQuestionOption[] => {
  if (type !== 'multiple-choice') return [];

  const raw = safeJson(value);
  let options: ImportedQuestionOption[] = [];

  if (Array.isArray(raw)) {
    options = raw.map((option: any, index: number) => ({
      id: option?.id || toId(`opt_${index + 1}`),
      text: String(option?.text ?? option ?? '').trim(),
      isCorrect: !!option?.isCorrect,
    }));
  }

  if (options.length === 0 && typeof value === 'string' && value.includes('|')) {
    options = value
      .split('|')
      .map((option, index) => ({
        id: toId(`opt_${index + 1}`),
        text: option.trim(),
        isCorrect: false,
      }))
      .filter((option) => option.text.length > 0);
  }

  if (options.length < 2) {
    options = [
      { id: toId('opt_1'), text: options[0]?.text || '', isCorrect: true },
      { id: toId('opt_2'), text: options[1]?.text || '', isCorrect: false },
    ];
  }

  const normalizedCorrectAnswer = String(correctAnswer ?? '').trim().toLowerCase();
  if (normalizedCorrectAnswer) {
    options = options.map((option) => ({
      ...option,
      isCorrect: option.text.trim().toLowerCase() === normalizedCorrectAnswer,
    }));
  }

  if (!options.some((option) => option.isCorrect)) {
    options[0].isCorrect = true;
  }

  return options;
};

const normalizeCodingTestCases = (value: unknown): ImportedCodingTestCase[] => {
  const raw = safeJson(value);
  if (!Array.isArray(raw)) return [];

  return raw
    .map((row: any) => ({
      input: String(row?.input ?? '').trim(),
      expectedOutput: String(row?.expectedOutput ?? row?.expected_output ?? '').trim(),
      isHidden: parseBoolean(row?.isHidden ?? row?.is_hidden),
      weight: parseNumber(row?.weight, 1),
    }))
    .filter((row) => row.input.length > 0 || row.expectedOutput.length > 0);
};

const normalizeCodingBlock = (row: any, type: ImportedQuestionType) => {
  if (type !== 'coding') return undefined;

  const starterCode = safeJson(row?.starterCode || row?.startercodejson || row?.starter_code_json);
  const allowedLanguagesRaw = row?.codingLanguages || row?.allowedLanguages || row?.codinglanguages;
  const allowedLanguages = String(allowedLanguagesRaw || '')
    .split('|')
    .map((language) => language.trim())
    .filter(Boolean);

  const parsedTestCases = normalizeCodingTestCases(
    row?.testCases || row?.testcasesjson || row?.test_cases_json
  );

  return {
    allowedLanguages: allowedLanguages.length > 0 ? allowedLanguages : ['javascript', 'python', 'java', 'cpp'],
    starterCode:
      starterCode && typeof starterCode === 'object' && !Array.isArray(starterCode)
        ? starterCode
        : DEFAULT_CODING_STARTER_CODE,
    testCases: parsedTestCases,
  };
};

const normalizeQuestion = (row: any, fallbackOrder: number, fallbackSectionId?: string): ImportedQuestion | null => {
  const questionText = String(row?.question || row?.questiontext || '').trim();
  if (!questionText) return null;

  const type = normalizeQuestionType(row?.type);
  const correctAnswer =
    type === 'true-false'
      ? parseBoolean(row?.correctAnswer ?? row?.correctanswer)
      : row?.correctAnswer ?? row?.correctanswer ?? null;
  const options = normalizeOptions(
    row?.options || row?.optionsjson || row?.option_values,
    type,
    correctAnswer
  );
  const coding = normalizeCodingBlock(row, type);
  const tagsRaw = row?.tags || '';
  const tags =
    Array.isArray(tagsRaw) ? tagsRaw : String(tagsRaw).split('|').map((tag) => tag.trim()).filter(Boolean);

  return {
    id: row?.id || toId('q'),
    type,
    sectionId: row?.sectionId || row?.sectionid || fallbackSectionId,
    question: questionText,
    options,
    correctAnswer,
    points: parseNumber(row?.points, 1),
    explanation: String(row?.explanation || '').trim(),
    difficulty: normalizeDifficulty(row?.difficulty),
    coding,
    tags,
    order: parseNumber(row?.order, fallbackOrder),
  };
};

export const parseAssessmentImportFile = async (
  file: File,
  existingSections: ImportedAssessmentSection[]
): Promise<ImportedAssessmentPayload> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const text = await file.text();

  let rawQuestions: any[] = [];
  let sections: ImportedAssessmentSection[] = [];
  let assessmentMeta: ImportedAssessmentPayload['assessment'];

  if (extension === 'json') {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      rawQuestions = parsed;
    } else {
      rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];
      sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
      assessmentMeta = parsed?.assessment || parsed?.meta;
    }
  } else if (extension === 'csv') {
    rawQuestions = parseCsvRows(text);
  } else {
    throw new Error('Unsupported format. Use JSON or CSV.');
  }

  const normalizedSectionsFromFile: ImportedAssessmentSection[] = sections
    .map((section: any, index: number) => ({
      id: String(section?.id || toId('sec')),
      title: String(section?.title || `Section ${index + 1}`).trim(),
      type: normalizeSectionType(section?.type),
      description: String(section?.description || '').trim(),
      order: parseNumber(section?.order, index),
    }))
    .filter((section) => section.title.length > 0);

  const sectionPool = [...existingSections, ...normalizedSectionsFromFile];
  const fallbackSectionId = sectionPool[0]?.id;

  const normalizedQuestions = rawQuestions
    .map((row, index) => normalizeQuestion(row, index, fallbackSectionId))
    .filter((question): question is ImportedQuestion => !!question);

  // Auto-build sections from CSV when section info is embedded in rows.
  const derivedSections = rawQuestions
    .map((row: any) => {
      const sectionId = row?.sectionId || row?.sectionid;
      const sectionTitle = String(row?.sectionTitle || row?.sectiontitle || '').trim();
      const sectionType = normalizeSectionType(row?.sectionType || row?.sectiontype);
      if (!sectionId && !sectionTitle) return null;

      return {
        id: String(sectionId || toId('sec')),
        title: sectionTitle || 'Imported Section',
        type: sectionType,
        description: String(row?.sectionDescription || row?.sectiondescription || '').trim(),
      };
    })
    .filter((section): section is { id: string; title: string; type: 'theory' | 'mcq' | 'coding'; description: string } => !!section);

  const mergedSectionsMap = new Map<string, ImportedAssessmentSection>();
  [...existingSections, ...normalizedSectionsFromFile].forEach((section, index) => {
    mergedSectionsMap.set(section.id, { ...section, order: index });
  });
  derivedSections.forEach((section) => {
    if (!mergedSectionsMap.has(section.id)) {
      mergedSectionsMap.set(section.id, {
        ...section,
        order: mergedSectionsMap.size,
      });
    }
  });

  const mergedSections = Array.from(mergedSectionsMap.values());

  return {
    assessment: assessmentMeta,
    sections: mergedSections,
    questions: normalizedQuestions,
  };
};

export const parseCodingTestCasesFile = async (file: File): Promise<ImportedCodingTestCase[]> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const text = await file.text();

  if (extension === 'json') {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : parsed?.testCases;
    if (!Array.isArray(list)) {
      throw new Error('Invalid JSON testcase format.');
    }

    return list
      .map((row: any) => ({
        input: String(row?.input ?? '').trim(),
        expectedOutput: String(row?.expectedOutput ?? row?.expected_output ?? '').trim(),
        isHidden: parseBoolean(row?.isHidden ?? row?.is_hidden),
        weight: parseNumber(row?.weight, 1),
      }))
      .filter((row) => row.input.length > 0 || row.expectedOutput.length > 0);
  }

  if (extension === 'csv') {
    const rows = parseCsvRows(text);
    return rows
      .map((row) => ({
        input: String(row.input ?? '').trim(),
        expectedOutput: String(row.expectedoutput ?? row.expected_output ?? '').trim(),
        isHidden: parseBoolean(row.ishidden ?? row.is_hidden),
        weight: parseNumber(row.weight, 1),
      }))
      .filter((row) => row.input.length > 0 || row.expectedOutput.length > 0);
  }

  throw new Error('Unsupported testcase file. Use JSON or CSV.');
};

