import rateLimit from "express-rate-limit";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: "Keni bërë shumë kërkesa, ju lutemi provoni përsëri më vonë",
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message:
    "Keni bërë shumë kërkesa për autentifikim, ju lutemi provoni përsëri më vonë",
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Keni bërë shumë ngarkime, ju lutemi provoni përsëri më vonë",
});

export const userCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message:
    "Keni arritur limitin e krijimit të përdoruesve, ju lutemi provoni përsëri nesër",
});
