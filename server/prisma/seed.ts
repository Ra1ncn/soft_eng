import "dotenv/config";
import { prisma } from "../src/lib/prisma.ts";

// 固定 ID + upsert：不清空已有 quiz / 学生提交，可安全重复执行。
async function seed() {
  await prisma.$transaction(async (tx) => {
    for (const user of [
      { id: "teacher-demo", name: "Demo Teacher", email: "teacher@example.test", role: "TEACHER" as const },
      { id: "student-demo", name: "Demo Student", email: "student@example.test", role: "STUDENT" as const },
    ]) {
      await tx.user.upsert({ where: { id: user.id }, create: user, update: user });
    }
    const quiz = { id: "quiz-demo", title: "数据库基础小测", teacherId: "teacher-demo" };
    await tx.quiz.upsert({ where: { id: quiz.id }, create: quiz, update: quiz });
    const questions = [
      {
        id: "quiz-demo-q1", position: 0, prompt: "哪一项用于唯一标识一行记录？", type: "SINGLE_CHOICE" as const,
        options: [
          { id: "quiz-demo-q1-o1", text: "主键", isCorrect: true },
          { id: "quiz-demo-q1-o2", text: "普通索引", isCorrect: false },
        ],
      },
      {
        id: "quiz-demo-q2", position: 1, prompt: "主键必须满足哪些条件？", type: "MULTIPLE_SELECT" as const,
        options: [
          { id: "quiz-demo-q2-o1", text: "值唯一", isCorrect: true },
          { id: "quiz-demo-q2-o2", text: "不能为 NULL", isCorrect: true },
          { id: "quiz-demo-q2-o3", text: "值可以重复", isCorrect: false },
        ],
      },
    ];
    for (const { options, ...question } of questions) {
      const data = { ...question, quizId: quiz.id };
      await tx.question.upsert({ where: { id: data.id }, create: data, update: data });
      for (const [position, option] of options.entries()) {
        const data = { ...option, position, questionId: question.id };
        await tx.option.upsert({ where: { id: data.id }, create: data, update: data });
      }
    }
  });
  console.log("Seed 完成：2 个演示用户、quiz-demo、2 道题、5 个选项。");
}

seed().catch(() => {
  console.error("Seed 失败，请检查数据库连接和 migration。");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
