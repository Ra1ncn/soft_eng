import "dotenv/config";
import { prisma } from "../src/lib/prisma.ts";

// Stable IDs and upserts preserve other quizzes and student submissions.
async function seed() {
  await prisma.$transaction(async (tx) => {
    for (const user of [
      { id: "teacher-demo", name: "Demo Teacher", email: "teacher@example.test", role: "TEACHER" as const },
      { id: "student-demo", name: "Demo Student", email: "student@example.test", role: "STUDENT" as const },
    ]) {
      await tx.user.upsert({ where: { id: user.id }, create: user, update: user });
    }
    const quiz = { id: "quiz-demo", title: "Database fundamentals", teacherId: "teacher-demo" };
    await tx.quiz.upsert({ where: { id: quiz.id }, create: quiz, update: quiz });
    const questions = [
      {
        id: "quiz-demo-q1", position: 0, prompt: "Which item uniquely identifies a row in a database table?", type: "SINGLE_CHOICE" as const,
        options: [
          { id: "quiz-demo-q1-o1", text: "Primary key", isCorrect: true },
          { id: "quiz-demo-q1-o2", text: "Regular index", isCorrect: false },
        ],
      },
      {
        id: "quiz-demo-q2", position: 1, prompt: "Which properties must a primary key have?", type: "MULTIPLE_SELECT" as const,
        options: [
          { id: "quiz-demo-q2-o1", text: "Values are unique", isCorrect: true },
          { id: "quiz-demo-q2-o2", text: "Values cannot be NULL", isCorrect: true },
          { id: "quiz-demo-q2-o3", text: "Values may repeat", isCorrect: false },
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
  console.log("Seed complete: 2 demo users, quiz-demo, 2 questions, 5 options.");
}

seed().catch(() => {
  console.error("Seed failed. Check the database connection and migrations.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
