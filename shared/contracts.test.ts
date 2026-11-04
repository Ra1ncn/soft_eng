import { describe, expect, it } from "vitest";
import { CreateQuizRequest, SubmitRequest, QuizDetailResponse } from "./contracts.ts";

function quiz(type = "SINGLE_CHOICE", correct = [true, false]) {
  return { title: " 数据库 ", questions: [{ prompt: " 主键？ ", type, options: correct.map((isCorrect, i) => ({ text: `选项${i}`, isCorrect })) }] };
}
describe("CreateQuizRequest", () => {
  it("接受合法单选并 trim 文本", () => expect(CreateQuizRequest.parse(quiz()).title).toBe("数据库"));
  it("接受合法多选", () => expect(CreateQuizRequest.safeParse(quiz("MULTIPLE_SELECT", [true, true])).success).toBe(true));
  it.each([0, 2])("单选正确选项数量 %i 不合法", (count) => {
    const result = CreateQuizRequest.safeParse(quiz("SINGLE_CHOICE", count ? [true, true] : [false, false]));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path.join(".")).toBe("questions.0.options");
  });
  it("多选至少一个正确选项", () => expect(CreateQuizRequest.safeParse(quiz("MULTIPLE_SELECT", [false, false])).success).toBe(false));
  it.each([
    { ...quiz(), title: "   " }, { ...quiz(), questions: [] },
    { ...quiz(), questions: [{ ...quiz().questions[0], prompt: " " }] },
    { ...quiz(), questions: [{ ...quiz().questions[0], options: [{ text: "a", isCorrect: true }] }] },
    { ...quiz(), questions: [{ ...quiz().questions[0], options: [{ text: " ", isCorrect: true }, { text: "b", isCorrect: false }] }] },
    { ...quiz(), questions: [{ ...quiz().questions[0], type: "ESSAY" }] },
  ])("拒绝非法请求 %#", (body) => expect(CreateQuizRequest.safeParse(body).success).toBe(false));
});
describe("SubmitRequest", () => {
  it("允许全部未答", () => expect(SubmitRequest.parse({ answers: [] })).toEqual({ answers: [] }));
  it("允许单题未答", () => expect(SubmitRequest.safeParse({ answers: [{ questionId: "q1", optionIds: [] }] }).success).toBe(true));
  it("允许不同题目", () => expect(SubmitRequest.safeParse({ answers: [
    { questionId: "q1", optionIds: ["o1"] }, { questionId: "q2", optionIds: ["o2", "o3"] },
  ] }).success).toBe(true));
  it("拒绝重复题目，含 trim 后重复", () => {
    const result = SubmitRequest.safeParse({ answers: [{ questionId: "q1", optionIds: [] }, { questionId: " q1 ", optionIds: [] }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path.join(".")).toBe("answers.1.questionId");
  });
  it("拒绝同题重复选项", () => {
    const result = SubmitRequest.safeParse({ answers: [{ questionId: "q1", optionIds: ["o1", " o1 "] }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path.join(".")).toBe("answers.0.optionIds.1");
  });
  it("拒绝空 ID", () => expect(SubmitRequest.safeParse({ answers: [{ questionId: " ", optionIds: [" "] }] }).success).toBe(false));
});
it("学生响应校验拒绝泄漏正确答案", () => {
  expect(QuizDetailResponse.safeParse({ id: "q", title: "t", submittedAt: null, questions: [{
    id: "q1", prompt: "p", type: "SINGLE_CHOICE", options: [{ id: "o", text: "t", isCorrect: true }],
  }] }).success).toBe(false);
});
