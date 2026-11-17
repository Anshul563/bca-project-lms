import mongoose, { type HydratedDocument, type Model, type Types } from "mongoose";
import type { QuestionType } from "@lms/shared";

export interface IQuizOption {
  _id: Types.ObjectId;
  text: string;
}

export interface IQuizQuestion {
  _id: Types.ObjectId;
  text: string;
  type: QuestionType;
  points: number;
  options: IQuizOption[];
  correctOptionIds: string[];
}

export interface IQuiz {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  title: string;
  passScore: number;
  questions: IQuizQuestion[];
  createdAt: Date;
}

export type QuizDoc = HydratedDocument<IQuiz>;

const quizSchema = new mongoose.Schema<IQuiz>(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    passScore: { type: Number, required: true, min: 0, max: 100, default: 70 },
    questions: {
      type: [
        {
          text: { type: String, required: true, trim: true, maxlength: 500 },
          type: { type: String, enum: ["single_choice", "multiple_choice", "true_false"], default: "single_choice" },
          points: { type: Number, default: 1, min: 1, max: 100 },
          options: [{ text: { type: String, required: true, trim: true, maxlength: 200 } }],
          correctOptionIds: { type: [String], required: true },
        },
      ],
      required: true,
      validate: (value: IQuizQuestion[]) => value.length > 0,
    },
  },
  { timestamps: true },
);

export type QuizModelType = Model<IQuiz>;

export const QuizModel =
  (mongoose.models.Quiz as QuizModelType | undefined) ?? mongoose.model<IQuiz>("Quiz", quizSchema);

export interface IQuizAttempt {
  user: Types.ObjectId;
  quiz: Types.ObjectId;
  course: Types.ObjectId;
  answers: { questionId: Types.ObjectId; selectedOptionIds: string[] }[];
  scorePercent: number;
  earnedPoints: number;
  totalPoints: number;
  passed: boolean;
  submittedAt: Date;
}

export type QuizAttemptDoc = HydratedDocument<IQuizAttempt>;

const quizAttemptSchema = new mongoose.Schema<IQuizAttempt>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    answers: {
      type: [{ questionId: mongoose.Schema.Types.ObjectId, selectedOptionIds: [String] }],
      required: true,
    },
    scorePercent: { type: Number, required: true, min: 0, max: 100 },
    earnedPoints: { type: Number, required: true, min: 0 },
    totalPoints: { type: Number, required: true, min: 1 },
    passed: { type: Boolean, required: true },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

quizAttemptSchema.index({ user: 1, course: 1, submittedAt: -1 });

export type QuizAttemptModelType = Model<IQuizAttempt>;

export const QuizAttemptModel =
  (mongoose.models.QuizAttempt as QuizAttemptModelType | undefined) ??
  mongoose.model<IQuizAttempt>("QuizAttempt", quizAttemptSchema);
