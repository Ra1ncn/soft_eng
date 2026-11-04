import { Router } from "express";

// D 在此添加 POST /；父路由传入 quizId，必须按 docs/api.md 用事务保存。
export const submissionsRouter = Router({ mergeParams: true });
