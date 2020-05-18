export type OptionalJobQueueOptions<ProcessableMessage, CancelMessage> = {
  compare: (a: ProcessableMessage, b: ProcessableMessage) => boolean;
  isCancelMessage: (message: ProcessableMessage | CancelMessage) => message is CancelMessage;
  compactThreshold: number;
};

export type JobQueueOptions<ProcessableMessage, CancelMessage> = {
  getContextId: (message: ProcessableMessage | CancelMessage) => string;
} & Partial<OptionalJobQueueOptions<ProcessableMessage, CancelMessage>>;
