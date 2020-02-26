export type OptionalQueueOptions<M> = {
  compare: (a: M, b: M) => boolean;
  shouldCancelMessage: (message: M) => boolean;
  compactThreshold: number;
};

export type QueueOptions<M> = {
  getJobId: (message: M) => string;
} & Partial<OptionalQueueOptions<M>>;
