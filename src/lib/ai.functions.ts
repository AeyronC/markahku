import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "openai/gpt-6-astra" as const;

type AiResult<T> = { ok: true; data: T } | { ok: false; code: "cap" | "failed" | "refused" };

async function callModel(
  system: string,
  content: ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" })[],
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<unknown> {
  const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await generateResponse({
        model: MODEL,
        instructions: system,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: schemaName, schema, strict: true } },
      });
      let text = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") {
          for (const c of item.content) {
            if (c.type === "output_text") text += c.text;
            if (c.type === "refusal") throw new Error("refused");
          }
        }
      }
      return JSON.parse(text);
    } catch (e) {
      if (e instanceof GatewayError) throw e;
      if (e instanceof Error && e.message === "refused") throw e;
      // Malformed JSON: retry once.
      if (attempt === 1) throw e;
    }
  }
  throw new Error("unreachable");
}

/* ---------------- OCR: read marks from a report card photo ---------------- */

const ocrInput = z.object({
  image: z
    .string()
    .max(7_200_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
  form: z.number().int().min(1).max(5),
  subjects: z.array(z.string().max(80)).max(40),
});

const ocrSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rows"],
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "mark", "exam", "absent", "confidence"],
        properties: {
          subject: { type: "string" },
          mark: { type: ["integer", "null"] },
          exam: { type: ["string", "null"], enum: ["sumatif_1", "sumatif_2", "uasa", null] },
          absent: { type: "boolean" },
          confidence: { type: "string", enum: ["high", "low"] },
        },
      },
    },
  },
};

export type OcrRow = {
  subject: string;
  mark: number | null;
  exam: "sumatif_1" | "sumatif_2" | "uasa" | null;
  absent: boolean;
  confidence: "high" | "low";
};

export const ocrMarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ocrInput.parse(input))
  .handler(async ({ data, context }): Promise<AiResult<OcrRow[]>> => {
    const cap = Number(process.env["OCR_DAILY_CAP"] ?? 10) || 10;
    const { data: allowed, error } = await context.supabase.rpc("consume_ai_call", { _kind: "ocr", _cap: cap });
    if (error) {
      console.error("usage check failed", error);
      return { ok: false, code: "failed" };
    }
    if (!allowed) return { ok: false, code: "cap" };

    const system = [
      "You read marks from photos or screenshots of Malaysian secondary school report cards or class mark sheets.",
      "Return one row per subject that has a visible mark or status. Never invent marks; if a mark is unreadable set mark to null and confidence to low.",
      "Marks are whole numbers 0-100. If the sheet shows TH, Tidak Hadir or Absent, set absent true and mark null.",
      "The sheet may show several exams (Sumatif 1, Sumatif 2, Ujian Akhir Sesi Akademik / UASA). Return one row per subject per exam column and set exam accordingly; null if unclear.",
      "Ignore totals, averages, grades, positions and student names.",
      `Prefer these subject names when they match: ${data.subjects.join("; ")}.`,
    ].join(" ");
    try {
      const out = (await callModel(
        system,
        [
          { type: "input_text", text: `Form ${data.form} report. Return JSON with the rows you can read.` },
          { type: "input_image", image_url: data.image, detail: "high" },
        ],
        "report_marks",
        ocrSchema,
      )) as { rows?: OcrRow[] };
      const rows = (out.rows ?? [])
        .filter((r) => typeof r.subject === "string" && r.subject.trim())
        .slice(0, 80)
        .map((r) => ({
          subject: r.subject.trim().slice(0, 80),
          mark: typeof r.mark === "number" && Number.isInteger(r.mark) && r.mark >= 0 && r.mark <= 100 ? r.mark : null,
          exam: r.exam ?? null,
          absent: !!r.absent,
          confidence: r.confidence === "high" ? ("high" as const) : ("low" as const),
        }));
      return { ok: true, data: rows };
    } catch (e) {
      console.error("ocr failed", e);
      return { ok: false, code: e instanceof Error && e.message === "refused" ? "refused" : "failed" };
    }
  });

/* ---------------- AI analyst ---------------- */

const summaryInput = z.object({
  kind: z.enum(["analysis", "study_plan"]),
  form: z.number().int().min(1).max(5),
  language: z.enum(["ms", "en"]),
  summary: z.object({
    exams: z
      .array(
        z.object({
          exam: z.string().max(40),
          average: z.number().nullable(),
          cgpa: z.number().nullable(),
          counted: z.number(),
          pending: z.number(),
        }),
      )
      .max(15),
    subjects: z
      .array(
        z.object({
          subject: z.string().max(80),
          marks: z.array(z.object({ exam: z.string().max(40), mark: z.number().nullable(), grade: z.string().max(2).nullable() })).max(15),
          trend: z.enum(["improving", "flat", "declining", "unknown"]),
          change: z.number().nullable(),
          nextGrade: z.object({ letter: z.string().max(2), marksNeeded: z.number() }).nullable(),
          goal: z.string().max(2).nullable(),
          goalGap: z.number().nullable(),
        }),
      )
      .max(40),
    examGoals: z
      .array(z.object({ exam: z.string().max(40), targetAverage: z.number().nullable(), targetCgpa: z.number().nullable(), currentAverage: z.number().nullable(), currentCgpa: z.number().nullable() }))
      .max(5),
  }),
});

export type AnalystInput = z.infer<typeof summaryInput>;

const noteList = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["subject", "note"],
    properties: { subject: { type: "string" }, note: { type: "string" } },
  },
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strongest", "weakest", "trends", "near_boundary", "goal_gaps"],
  properties: {
    summary: { type: "string" },
    strongest: noteList,
    weakest: noteList,
    trends: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "direction", "note"],
        properties: {
          subject: { type: "string" },
          direction: { type: "string", enum: ["improving", "flat", "declining"] },
          note: { type: "string" },
        },
      },
    },
    near_boundary: noteList,
    goal_gaps: noteList,
  },
};

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "days", "tips"],
  properties: {
    overview: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "focus"],
        properties: {
          day: { type: "string" },
          focus: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["subject", "task", "minutes"],
              properties: { subject: { type: "string" }, task: { type: "string" }, minutes: { type: "integer" } },
            },
          },
        },
      },
    },
    tips: { type: "array", items: { type: "string" } },
  },
};

export const runAnalyst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => summaryInput.parse(input))
  .handler(async ({ data, context }): Promise<AiResult<{ id: string; created_at: string; payload: unknown }>> => {
    const cap = Number(process.env["AI_DAILY_CAP"] ?? 30) || 30;
    const { data: allowed, error } = await context.supabase.rpc("consume_ai_call", { _kind: "ai", _cap: cap });
    if (error) {
      console.error("usage check failed", error);
      return { ok: false, code: "failed" };
    }
    if (!allowed) return { ok: false, code: "cap" };

    const langName = data.language === "ms" ? "Bahasa Melayu (Malaysia)" : "English";
    const system = [
      `You are a friendly, honest study coach for a Malaysian Form ${data.form} secondary student.`,
      `Write every string in ${langName}.`,
      "Use ONLY the numbers supplied in the JSON. Never invent, estimate or predict marks. Do not recalculate averages or CGPA; quote them as given.",
      "Letter grades (KSSM): A 82-100, B 66-81, C 50-65, D 35-49, E 20-34, F 0-19.",
      "Be encouraging and concrete. Keep each note to one or two short sentences. Refer to subjects by the names given.",
      data.kind === "analysis"
        ? "Produce an analysis: a short summary, 1-3 strongest subjects, 1-3 weakest subjects, a trend per subject that has a previous exam (improving / flat / declining), subjects within about 5 marks of the next grade boundary, and gaps to goals. Empty arrays are fine when nothing applies."
        : "Produce a personalised 14-day study plan (days labelled e.g. 'Day 1' / 'Hari 1'), 1-3 focus blocks per day of 20-60 minutes, weighted toward the weakest subjects and the biggest goal gaps, with rest built in, plus 3-5 practical tips.",
    ].join(" ");
    try {
      const payload = await callModel(
        system,
        [{ type: "input_text", text: `Student results as JSON. Return JSON only.\n${JSON.stringify(data.summary)}` }],
        data.kind === "analysis" ? "grade_analysis" : "study_plan",
        data.kind === "analysis" ? analysisSchema : planSchema,
      );
      const { data: row, error: insErr } = await context.supabase
        .from("ai_insights")
        .insert({ user_id: context.userId, kind: data.kind, form: data.form, language: data.language, payload: payload as never })
        .select("id, created_at, payload")
        .single();
      if (insErr) throw insErr;
      return { ok: true, data: row };
    } catch (e) {
      console.error("analyst failed", e);
      return { ok: false, code: e instanceof Error && e.message === "refused" ? "refused" : "failed" };
    }
  });
