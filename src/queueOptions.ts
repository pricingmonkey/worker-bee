export type OptionalJobQueueOptions<M> = {
  compare: (a: M, b: M) => boolean;
  isCancelMessage: (message: M) => boolean;
  compactThreshold: number;
};

export type JobQueueOptions<M> = {
  getContextId: (message: M) => string;
} & Partial<OptionalJobQueueOptions<M>>;
